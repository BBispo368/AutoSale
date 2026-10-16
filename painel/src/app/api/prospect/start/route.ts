import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRandomDelay = (minSec: number, maxSec: number) => {
  const min = Math.min(minSec, maxSec);
  const max = Math.max(minSec, maxSec);
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
};

export async function POST() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const apiKey = process.env.EVOLUTION_API_KEY || 'B1F93A4D8C2E7G5H6J9K0L1M2N3P4Q5R';
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'prospect-bot';

  try {
    // 1. Busca configurações ativas
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const delayMin = settings?.delay_min || 15;
    const delayMax = settings?.delay_max || 40;
    const template = settings?.message_template || 'Olá {nome_empresa}!';

    // 2. Busca leads pendentes em lote controlado
    const { data: pendingLeads, error: selectError } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone')
      .eq('status', 'pending')
      .limit(50);

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      return NextResponse.json({
        message: 'Nenhum lead com status pendente para disparo.',
        processed: 0,
      });
    }

    const leadIds = pendingLeads.map((l) => l.id);

    // 3. LOCK ATÔMICO: Atualiza imediatamente para 'processing' para evitar duplicidade em cliques repetidos
    const { data: lockedLeads, error: lockError } = await supabaseAdmin
      .from('leads')
      .update({ status: 'processing' })
      .in('id', leadIds)
      .eq('status', 'pending')
      .select('id, name, phone');

    if (lockError) {
      return NextResponse.json({ error: lockError.message }, { status: 500 });
    }

    if (!lockedLeads || lockedLeads.length === 0) {
      return NextResponse.json({
        message: 'Os leads selecionados já foram capturados por outro processo em execução.',
        processed: 0,
      });
    }

    // 4. Execução sequencial assíncrona em background com delay anti-bloqueio
    (async () => {
      for (const lead of lockedLeads) {
        const message = template.replace(/{nome_empresa}/g, lead.name);

        try {
          const sendRes = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
            },
            body: JSON.stringify({
              number: lead.phone,
              text: message,
              options: {
                delay: 1500,
                presence: 'composing',
              },
            }),
          });

          if (sendRes.ok) {
            await supabaseAdmin
              .from('leads')
              .update({ status: 'sent' })
              .eq('id', lead.id);
          } else {
            const errBody = await sendRes.text();
            console.error(`Falha no envio para ${lead.phone}:`, errBody);
            await supabaseAdmin
              .from('leads')
              .update({ status: 'failed' })
              .eq('id', lead.id);
          }
        } catch (error) {
          console.error(`Exceção no envio para ${lead.phone}:`, error);
          await supabaseAdmin
            .from('leads')
            .update({ status: 'failed' })
            .eq('id', lead.id);
        }

        // Aguarda delay humanizado antes do próximo envio
        const waitTime = getRandomDelay(delayMin, delayMax);
        await sleep(waitTime);
      }
    })();

    return NextResponse.json({
      message: `Disparo iniciado com sucesso para ${lockedLeads.length} leads.`,
      count: lockedLeads.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro inesperado ao iniciar processo de prospecção' },
      { status: 500 }
    );
  }
}

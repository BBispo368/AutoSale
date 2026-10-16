import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function sanitizePhone(phoneStr: string): string {
  let clean = phoneStr.replace(/\D/g, '');
  // Adiciona DDI 55 (Brasil) caso tenha vindo apenas DDD + Número (10 ou 11 dígitos)
  if (clean.length === 10 || clean.length === 11) {
    clean = '55' + clean;
  }
  return clean;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const leadsRaw = Array.isArray(body) ? body : body.leads;

    if (!leadsRaw || !Array.isArray(leadsRaw)) {
      return NextResponse.json(
        { error: 'Payload inválido. Esperado um array de leads ou objeto { leads: [...] }' },
        { status: 400 }
      );
    }

    const formattedLeads = leadsRaw
      .filter((l: any) => (l.name || l.title || l.nome) && (l.phone || l.telefone || l.whatsapp))
      .map((item: any) => ({
        name: String(item.name || item.title || item.nome).trim(),
        phone: sanitizePhone(String(item.phone || item.telefone || item.whatsapp)),
        instagram: item.instagram || item.ig || null,
        business_type: item.business_type || item.category || item.categoria || 'Geral',
        source: item.source || item.fonte || 'Google Maps',
        status: 'pending',
      }));

    if (formattedLeads.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lead válido com nome e telefone foi identificado no JSON.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert(formattedLeads)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao processar importação' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar configurações' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { delay_min, delay_max, message_template } = body;

    const { data, error } = await supabaseAdmin
      .from('settings')
      .upsert({
        id: 1,
        delay_min: Number(delay_min) || 15,
        delay_max: Number(delay_max) || 40,
        message_template: message_template || '',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao salvar configurações' }, { status: 500 });
  }
}

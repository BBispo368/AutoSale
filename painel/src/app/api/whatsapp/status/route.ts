import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const apiKey = process.env.EVOLUTION_API_KEY || 'B1F93A4D8C2E7G5H6J9K0L1M2N3P4Q5R';
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'prospect-bot';

  try {
    const res = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ status: 'close' });
    }

    const data = await res.json();
    // Retorna status padronizado: 'open' | 'connecting' | 'close'
    const state = data?.instance?.state || 'close';
    return NextResponse.json({ status: state });
  } catch {
    return NextResponse.json({ status: 'close' });
  }
}

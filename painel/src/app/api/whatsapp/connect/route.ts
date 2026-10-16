import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
  const apiKey = process.env.EVOLUTION_API_KEY || 'B1F93A4D8C2E7G5H6J9K0L1M2N3P4Q5R';
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'prospect-bot';

  try {
    // 1. Tenta criar a instância (se já existir, retorna status e continuamos para obter o QR)
    await fetch(`${evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        instanceName,
        token: apiKey,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });

    // 2. Solicita o QR Code de conexão
    const connectRes = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
      },
      cache: 'no-store',
    });

    const data = await connectRes.json();
    return NextResponse.json({
      qrcode: data?.base64 || data?.qrcode?.base64 || null,
      pairingCode: data?.pairingCode || null,
      instance: data?.instance || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Falha ao conectar WhatsApp' }, { status: 500 });
  }
}

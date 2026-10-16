import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoSale - Prospecção WhatsApp de Landing Pages',
  description: 'Painel de controle e automação de disparos de mensagens para prospecção ativa de landing pages.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

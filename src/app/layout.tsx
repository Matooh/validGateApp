import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ValidGateApp',
  description: 'MVP para control de ingreso y salida estudiantil',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

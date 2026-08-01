import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ProtectedSessionGuard } from '@/components/protected-session-guard';
import './globals.css';

export const metadata: Metadata = {
  title: 'ValidGateApp',
  description: 'MVP para control de ingreso y salida estudiantil',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Suspense fallback={null}>
          <ProtectedSessionGuard />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

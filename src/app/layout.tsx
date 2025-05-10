import type {Metadata} from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Providers from '@/components/Providers'; 

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FreelaOS Minimal', 
  description: 'Aplicativo Mínimo de Gerenciamento de Ordens de Serviço', 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning> {/* Changed lang to pt-BR */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers> 
          {children}
          <Toaster /> 
        </Providers>
      </body>
    </html>
  );
}

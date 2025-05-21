
import type {Metadata} from 'next';
import './globals.css'; // Mantém o CSS global
import Providers from '@/components/Providers';
import Script from 'next/script';
import ThemeProvider from '@/components/theme/ThemeProvider';

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
    <ThemeProvider>
        <html lang="pt-BR" suppressHydrationWarning>
          <head>
            <link
                href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
                rel="stylesheet"
                integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
                crossOrigin="anonymous"
            />
            <link
                rel="stylesheet"
                href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
            />
          </head>
          <body className="antialiased d-flex flex-column min-vh-100">
            <Providers>
               <div className="page-transition-container">
                 {children}
               </div>
            </Providers>
            <Script
                src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
                integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz"
                crossOrigin="anonymous"
                strategy="lazyOnload"
            />
          </body>
        </html>
    </ThemeProvider>
  );
}

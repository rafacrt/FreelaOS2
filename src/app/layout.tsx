
import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import Script from 'next/script';
import ThemeProvider from '@/components/theme/ThemeProvider';
// Toaster can be re-added if you plan to use it for form feedback from AuthForm/RegisterForm
// import { Toaster } from '@/components/ui/toaster'; 

export const metadata: Metadata = {
  title: 'FreelaOS', // Updated title
  description: 'Gerenciamento de Ordens de Serviço e Autenticação',
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
<<<<<<< HEAD
          <body className="antialiased d-flex flex-column min-vh-100 bg-body"> {/* Changed bg-body-tertiary to bg-body */}
=======
          <body className="antialiased d-flex flex-column min-vh-100 bg-body-tertiary">
>>>>>>> 988ed2c (vc não pode colocar tudo isso já no projeto? (essa questão do bcrypt) onde meu trabalho seja unicamente criar as tabelas via sql lá no banco? vc cria uma área para cadastro de usuário, e o primeiro usuário registrado, já vira super admin, e do segundo em diante precisa de aprovação)
            <Providers>
               <div className="page-transition-container d-flex flex-column flex-grow-1">
                 {children}
               </div>
               {/* <Toaster /> */}
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

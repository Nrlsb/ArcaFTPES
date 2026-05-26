import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800'],
});

export const metadata = {
    title: 'Herramientas ARCA',
    description: 'Procesamiento de Facturas y Control de IVA',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es">
            <body className={`${outfit.className} antialiased`}>
                {children}
            </body>
        </html>
    );
}

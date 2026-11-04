import type { Metadata, Viewport } from "next";
import { Baloo_2, Caveat, Quicksand } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["600", "700", "800"] });
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Assados da Evy · Pronta entrega e encomendas · Jacareí/SP",
  description:
    "Peça salgados assados, pizza enrolada e assadinhos da Evy: pronta entrega no dia ou encomenda com horário marcado em Jacareí/SP.",
  openGraph: {
    title: "Assados da Evy · 1 cadin de tudo",
    description: "Pronta entrega e encomendas com horário marcado em Jacareí/SP.",
    images: ["/img/logo.png"],
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#a44f31",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${baloo.variable} ${quicksand.variable} ${caveat.variable} antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

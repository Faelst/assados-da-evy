import { Contact, FloatingWhatsApp, Footer } from "@/components/Contact";
import { Events } from "@/components/Events";
import { Hero } from "@/components/Hero";
import { Highlights } from "@/components/Highlights";
import { Manifesto } from "@/components/Manifesto";
import { Menu } from "@/components/Menu";
import { Nav } from "@/components/Nav";
import { Quote } from "@/components/Quote";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <Highlights />
        <Menu />
        <Events />
        <Quote />
        <Contact />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}

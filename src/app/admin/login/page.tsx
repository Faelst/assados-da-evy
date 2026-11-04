import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar — Painel Assados da Evy" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl shadow-terracotta/10">
        <Image src="/img/logo.webp" alt="Assados da Evy" width={96} height={96} className="mx-auto mb-4 h-24 w-24" />
        <h1 className="mb-6 text-center font-display text-2xl font-bold text-terracotta-dark">Painel da cozinha</h1>
        <Suspense>
          <Form searchParams={searchParams as Promise<{ next?: string }>} />
        </Suspense>
      </div>
    </main>
  );
}

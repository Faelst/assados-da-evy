import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="font-display text-3xl font-bold text-terracotta-dark">Sem acesso</h1>
      <p className="text-ink/70">Seu usuário não tem permissão para esta área.</p>
      <Link href="/admin" className="btn-primary">Voltar ao painel</Link>
    </main>
  );
}

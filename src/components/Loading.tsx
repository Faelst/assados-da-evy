export function Loading() {
  return (
    <div className="flex justify-center py-20" role="status" aria-label="Carregando">
      <span className="size-8 animate-spin rounded-full border-4 border-terracotta/20 border-t-terracotta" />
    </div>
  );
}

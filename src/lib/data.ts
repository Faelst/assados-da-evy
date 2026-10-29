export const BRAND = {
  name: "Assados da Evy",
  tagline: "1 cadin de tudo",
  instagram: "assadosdaevy",
  instagramUrl: "https://www.instagram.com/assadosdaevy",
  menuPostUrl: "https://www.instagram.com/p/Db3Xr0dqnZK/",
  whatsapp: "5512991058305",
  whatsappDisplay: "(12) 99105-8305",
  city: "Jacareí/SP",
  hours: [
    { days: "Terça a sexta", time: "9h às 18h" },
    { days: "Sábado", time: "9h às 14h" },
  ],
  hoursNote: "Alguns pedidos na hora, outros por encomenda.",
} as const;

export const waLink = (text?: string) =>
  `https://wa.me/${BRAND.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export type CategoryId = "individual" | "pizza" | "assadinhos" | "doce";

export type MenuItem = {
  id: string;
  category: CategoryId;
  name: string;
  description: string;
  /** Preço em reais. Exibido somente na área de orçamento. */
  price: number;
  /** Para pacotes de assadinhos: quantos sabores podem ser escolhidos. */
  flavors?: number;
};

export const CATEGORIES: {
  id: CategoryId;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "individual",
    title: "Individual",
    subtitle: "Salgados em formato redondo, pesando até 600 gramas, dependendo do sabor.",
  },
  {
    id: "pizza",
    title: "Pizza Enrolada",
    subtitle: "Serve 4 pessoas.",
  },
  {
    id: "assadinhos",
    title: "Assadinhos",
    subtitle: "Assados em formato mini — perfeitos para eventos.",
  },
  {
    id: "doce",
    title: "Doce",
    subtitle: "Para fechar com chave de ouro.",
  },
];

export const ASSADINHO_FLAVORS = [
  "Brócolis",
  "Calafrango",
  "Calabresa",
  "Frango com requeijão cremoso",
  "Salsicha com requeijão cremoso",
  "Pizza",
] as const;

const flavorList = ASSADINHO_FLAVORS.join(", ");

export const MENU: MenuItem[] = [
  // Individual
  { id: "brocao", category: "individual", name: "Brocão", price: 30, description: "Brócolis salteado no azeite e alho, mussarela, bacon e requeijão cremoso." },
  { id: "calafrao", category: "individual", name: "Calafrão", price: 28, description: "Calabresa, frango desfiado, mussarela, requeijão cremoso ou cheddar." },
  { id: "calao", category: "individual", name: "Calão", price: 28, description: "Calabresa, mussarela, requeijão cremoso ou cheddar." },
  { id: "frangao", category: "individual", name: "Frangão", price: 30, description: "Frango desfiado, mussarela, requeijão cremoso ou cheddar." },
  { id: "hamburgao-sadia", category: "individual", name: "Hamburgão Sadia", price: 25, description: "2 hambúrgueres Sadia, cebola roxa, manjericão, mussarela e cheddar." },
  { id: "hamburgao-artesanal", category: "individual", name: "Hamburgão Artesanal", price: 30, description: "1 hambúrguer artesanal de 100g, mussarela, cebola caramelizada, manjericão e cheddar." },
  { id: "portugao", category: "individual", name: "Portugão", price: 30, description: "Mussarela, presunto, ervilha, milho, ovo, manjericão e requeijão cremoso." },
  // Pizza enrolada
  { id: "pz-calafrango", category: "pizza", name: "Calafrango", price: 68, description: "Calabresa, frango desfiado, mussarela, requeijão cremoso ou cheddar." },
  { id: "pz-calabresa", category: "pizza", name: "Calabresa", price: 60, description: "Calabresa, mussarela, requeijão cremoso ou cheddar." },
  { id: "pz-frango", category: "pizza", name: "Frango", price: 65, description: "Frango desfiado, mussarela e requeijão cremoso." },
  { id: "pz-portuguesa", category: "pizza", name: "Portuguesa", price: 68, description: "Mussarela, presunto, ervilha, milho, ovo, manjericão e requeijão cremoso." },
  // Assadinhos
  { id: "assadinhos-30", category: "assadinhos", name: "30 assadinhos", price: 70, flavors: 3, description: `Escolha até 3 sabores: ${flavorList}.` },
  { id: "assadinhos-50", category: "assadinhos", name: "50 assadinhos", price: 110, flavors: 4, description: `Escolha até 4 sabores: ${flavorList}.` },
  { id: "assadinhos-100", category: "assadinhos", name: "100 assadinhos", price: 220, flavors: 6, description: `Escolha até 6 sabores: ${flavorList}.` },
  // Doce
  { id: "nutelinha", category: "doce", name: "Nutelinha", price: 22, description: "5 assadinhos pequenos recheados com Nutella." },
];

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

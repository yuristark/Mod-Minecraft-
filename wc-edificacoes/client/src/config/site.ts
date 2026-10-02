/**
 * ==================================================================
 *  DADOS DA EMPRESA — edite aqui antes de publicar.
 *  Todo o site (cabeçalho, rodapé, contato, política de privacidade,
 *  WhatsApp, SEO) lê destas informações.
 *  Campos marcados com "PREENCHER" estão com valor provisório.
 * ==================================================================
 */
export const site = {
  name: "WC Edificações",
  shortName: "WC",
  legalName: "WC Edificações Ltda", // PREENCHER: razão social
  cnpj: "00.000.000/0001-00", // PREENCHER
  crea: "CREA-MG 000000", // PREENCHER: registro da empresa / responsável técnico
  foundedYear: 2012, // PREENCHER: ano de fundação (usado para calcular "anos de atuação")
  tagline: "Construtora e edificadora",
  pitch:
    "Construímos casas, prédios comerciais e galpões com planejamento de engenharia, prazo em contrato e acompanhamento transparente do primeiro pilar à entrega das chaves.",
  serviceArea: "Belo Horizonte, Contagem, Betim e região metropolitana", // PREENCHER

  contact: {
    phone: "(31) 0000-0000", // PREENCHER
    phoneHref: "+553100000000", // PREENCHER: só dígitos com +55
    whatsapp: "5531900000000", // PREENCHER: 55 + DDD + número, só dígitos
    email: "contato@wcedificacoes.com.br", // PREENCHER
    address: "Rua Exemplo, 100 — Sala 1 · Centro, Contagem – MG · 32000-000", // PREENCHER
    hours: "Seg. a sex., 8h às 18h · Sáb., 8h às 12h",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Contagem+MG", // PREENCHER
  },

  social: {
    instagram: "https://www.instagram.com/", // PREENCHER
    linkedin: "https://www.linkedin.com/", // PREENCHER
    youtube: "", // deixe vazio para ocultar
  },

  // Encarregado de dados pessoais (LGPD) — exibido na Política de Privacidade
  dpo: { name: "Responsável pela privacidade", email: "privacidade@wcedificacoes.com.br" }, // PREENCHER

  privacyUpdatedAt: "01/10/2026",
} as const;

export const whatsappLink = (text = `Olá! Vim pelo site da ${site.name} e gostaria de falar sobre uma obra.`) =>
  `https://wa.me/${site.contact.whatsapp}?text=${encodeURIComponent(text)}`;

export const CATEGORY_LABEL: Record<string, string> = {
  residencial: "Residencial",
  comercial: "Comercial",
  industrial: "Industrial",
  reforma: "Reforma & retrofit",
};

export const STATUS_LABEL: Record<string, string> = {
  concluida: "Concluída",
  em_andamento: "Em andamento",
  lancamento: "Lançamento",
};

export const STANDARD_LABEL: Record<string, string> = {
  economico: "Econômico",
  medio: "Médio",
  alto: "Alto padrão",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  proposta: "Proposta enviada",
  fechado: "Fechado",
  descartado: "Descartado",
};

export const START_WINDOW_LABEL: Record<string, string> = {
  imediato: "Imediatamente",
  "3_meses": "Em até 3 meses",
  "6_meses": "Em até 6 meses",
  sem_data: "Ainda sem data",
};

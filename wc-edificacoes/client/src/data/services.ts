import { Building2, Factory, Hammer, Home, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/types";

export interface Service {
  id: Category;
  icon: LucideIcon;
  title: string;
  lead: string;
  items: string[];
}

/** Textos dos serviços — edite à vontade. */
export const SERVICES: Service[] = [
  {
    id: "residencial",
    icon: Home,
    title: "Construção residencial",
    lead: "Casas térreas, sobrados e condomínios do terreno vazio às chaves na mão, com projeto, aprovação e execução sob uma única responsabilidade.",
    items: ["Casas de médio e alto padrão", "Sobrados e casas em condomínio", "Condomínios horizontais", "Aprovação na prefeitura e habite-se"],
  },
  {
    id: "comercial",
    icon: Building2,
    title: "Obras comerciais",
    lead: "Lojas, clínicas, escritórios e edifícios de uso misto planejados para abrir no prazo e cumprir todas as normas de uso público.",
    items: ["Edifícios comerciais e de uso misto", "Clínicas e consultórios (RDC 50)", "Lojas e pontos comerciais", "Acessibilidade NBR 9050 e AVCB"],
  },
  {
    id: "industrial",
    icon: Factory,
    title: "Galpões e indústria",
    lead: "Galpões logísticos, fábricas e ampliações em estrutura metálica ou pré-moldada, com obras planejadas para não parar a sua operação.",
    items: ["Galpões em pré-moldado e estrutura metálica", "Piso industrial de alta resistência", "Ampliação sem parar a produção", "Docas, mezaninos e pontes rolantes"],
  },
  {
    id: "reforma",
    icon: Hammer,
    title: "Reformas e retrofit",
    lead: "Modernização de casas, apartamentos e fachadas de edifícios, com laudo técnico antes de mexer em qualquer estrutura.",
    items: ["Reforma completa de apartamentos", "Recuperação e pintura de fachadas", "Troca de instalações elétricas e hidráulicas", "Impermeabilização e tratamento de patologias"],
  },
];

export const PROCESS = [
  { title: "Conversa e visita técnica", text: "Entendemos o que você precisa, visitamos o terreno ou imóvel e avaliamos as condições do local." },
  { title: "Projeto e orçamento detalhado", text: "Desenvolvemos ou compatibilizamos os projetos e entregamos um orçamento por etapas, sem itens escondidos." },
  { title: "Contrato com prazo e cronograma", text: "Prazo, valores e cronograma físico-financeiro ficam definidos no contrato antes do início da obra." },
  { title: "Execução acompanhada", text: "Engenheiro responsável com ART, diário de obra e relatórios com fotos a cada etapa concluída." },
  { title: "Entrega e pós-obra", text: "Vistoria final com você, manual do proprietário e atendimento de garantia após a entrega." },
];

export const COMMITMENTS = [
  { k: "ART / RRT", v: "Responsável técnico registrado em toda obra." },
  { k: "Prazo em contrato", v: "Cronograma assinado e acompanhado por medição." },
  { k: "Normas técnicas", v: "Execução conforme NBR 15575 (desempenho) e normas aplicáveis." },
  { k: "Segurança", v: "Equipes treinadas em NR-18 e NR-35, com EPI e canteiro organizado." },
];

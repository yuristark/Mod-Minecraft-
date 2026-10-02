import { SectionLabel } from "@/components/Brand";
import { site } from "@/config/site";
import { useSeo } from "@/hooks/useSeo";

/**
 * Modelo de Política de Privacidade (LGPD — Lei 13.709/2018).
 * Revise com o jurídico do cliente antes de publicar.
 */
export default function Privacidade() {
  useSeo("Política de Privacidade", `Como a ${site.name} trata dados pessoais, conforme a LGPD.`);
  const S = ({ n, t, children }: { n: string; t: string; children: React.ReactNode }) => (
    <section className="grid gap-3 border-t border-line py-8 md:grid-cols-[220px_1fr] md:gap-10">
      <h2 className="text-lg font-bold"><span className="label-mono mr-2 text-signal-strong">{n}</span>{t}</h2>
      <div className="space-y-3 leading-relaxed text-ink-2">{children}</div>
    </section>
  );
  return (
    <div className="container max-w-5xl py-14 md:py-20">
      <SectionLabel>LGPD</SectionLabel>
      <h1 className="mt-5 text-display-lg uppercase">Política de Privacidade</h1>
      <p className="mt-4 text-ink-3">Última atualização: {site.privacyUpdatedAt}</p>

      <div className="mt-12">
        <S n="01" t="Quem somos">
          <p>{site.legalName}, CNPJ {site.cnpj}, com sede em {site.contact.address}, é a controladora dos dados pessoais coletados neste site.</p>
        </S>
        <S n="02" t="Dados coletados">
          <p>Somente os dados que você informa no formulário de orçamento: nome, e-mail, telefone, cidade e informações sobre a obra.</p>
          <p>Por segurança e prevenção a fraudes, registramos uma versão anonimizada (hash) do endereço IP da solicitação. Não armazenamos o IP em si.</p>
        </S>
        <S n="03" t="Finalidade e base legal">
          <p>Os dados são usados exclusivamente para responder ao seu pedido e elaborar propostas comerciais, com base no seu consentimento (art. 7º, I) e em procedimentos preliminares a contrato (art. 7º, V) da LGPD.</p>
          <p>Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins de marketing.</p>
          <p>Para operar o site usamos fornecedores que tratam os dados apenas em nosso nome, como a empresa de hospedagem e o serviço de e-mail que nos avisa sobre novos pedidos de orçamento.</p>
        </S>
        <S n="04" t="Cookies">
          <p>O site público não usa cookies de rastreamento nem de publicidade. A área restrita usa apenas um cookie técnico de sessão, essencial para o login de administradores.</p>
        </S>
        <S n="05" t="Armazenamento e segurança">
          <p>Os dados ficam em servidor protegido, acessível apenas por pessoas autorizadas, com conexão criptografada (HTTPS), senhas protegidas por algoritmo de hash forte e registro de acessos administrativos.</p>
          <p>Pedidos de orçamento são mantidos pelo tempo necessário ao atendimento e à eventual relação contratual, e eliminados quando não forem mais necessários.</p>
        </S>
        <S n="06" t="Seus direitos">
          <p>Você pode, a qualquer momento, solicitar confirmação, acesso, correção, anonimização, portabilidade ou eliminação dos seus dados, além de revogar o consentimento (art. 18 da LGPD).</p>
        </S>
        <S n="07" t="Contato do encarregado">
          <p>{site.dpo.name}: <a className="font-semibold underline underline-offset-2" href={`mailto:${site.dpo.email}`}>{site.dpo.email}</a></p>
          <p>Você também pode recorrer à Autoridade Nacional de Proteção de Dados (ANPD).</p>
        </S>
      </div>
    </div>
  );
}

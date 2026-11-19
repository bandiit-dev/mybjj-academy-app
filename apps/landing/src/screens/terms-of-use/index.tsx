import Link from "next/link";
import {
  LegalDocument,
  type LegalSection,
} from "@/components/organisms/legal-document";

const contactEmail = "contato@mybjjacademy.com.br";

const sections: LegalSection[] = [
  {
    id: "servico",
    title: "Quem fornece o serviço",
    content: (
      <>
        <p>
          O My BJJ Academy é uma plataforma de gestão de academias de jiu-jitsu,
          operada pelo fornecedor inscrito no CNPJ 49.688.273/0001-60. Estes
          termos regem o uso do site, do portal administrativo e do aplicativo,
          conforme os recursos disponíveis para cada perfil.
        </p>
        <p>
          A plataforma permite organizar academias, unidades, professores,
          alunos e aulas, além de acompanhar inscrições, presença, graduações,
          planos e registros de pagamento dos alunos. A academia é responsável
          pelas aulas que oferece e pelas condições que combina com seus alunos.
        </p>
      </>
    ),
  },
  {
    id: "conta",
    title: "Cadastro e acesso",
    content: (
      <>
        <p>
          Quem contrata a assinatura deve ter capacidade legal para contratar e,
          se agir em nome de uma academia, ter autorização para representá-la.
          Mantenha os dados da conta e da academia corretos e atualizados.
        </p>
        <p>
          As credenciais são pessoais. Use os convites e permissões do portal
          para conceder acesso, revise essas permissões quando alguém sair da
          equipe e avise o suporte se suspeitar de acesso indevido. A academia
          pode manter cadastros de alunos sem criar contas de acesso para eles.
        </p>
      </>
    ),
  },
  {
    id: "assinatura",
    title: "Assinatura, cobrança e renovação",
    content: (
      <>
        <p>
          A assinatura do portal administrativo é mensal e contratada por
          academia. Antes de confirmar, confira o valor, a periodicidade e as
          condições do desconto, se houver. A cobrança é processada pela Stripe
          e a assinatura se renova automaticamente a cada ciclo até que seja
          cancelada.
        </p>
        <p>
          O acesso administrativo depende de uma assinatura ativa e de um
          período de acesso confirmado. Quando o período pago termina sem a
          confirmação da renovação, o acesso pode ficar indisponível até a
          regularização. O responsável pela assinatura pode consultar sua
          situação em <strong>Academia → Plano do portal</strong>.
        </p>
        <p>
          Os lançamentos de pagamento dos alunos são registros feitos pela
          academia para controle interno. A cobrança da assinatura do portal
          pela Stripe é uma operação separada.
        </p>
      </>
    ),
  },
  {
    id: "cancelamento",
    title: "Cancelamento, arrependimento e reembolso",
    content: (
      <>
        <p>
          O responsável pela assinatura pode interromper a renovação em{" "}
          <strong>Academia → Plano do portal → Gerenciar assinatura</strong> ou
          solicitar ajuda pelo e-mail de atendimento. No cancelamento programado
          para o fim do ciclo, o acesso segue disponível até o fim do período
          pago e a assinatura deixa de se renovar.
        </p>
        <p>
          Quando o direito de arrependimento do art. 49 do Código de Defesa do
          Consumidor se aplicar, o consumidor pode desistir da contratação a
          distância em até sete dias, contados da assinatura ou do recebimento
          do serviço, conforme o caso, com devolução dos valores pagos na forma
          da lei. Use o canal eletrônico da contratação ou escreva para{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a> para solicitar o
          arrependimento ou tratar de um reembolso.
        </p>
      </>
    ),
  },
  {
    id: "uso-da-plataforma",
    title: "Uso da plataforma e registros da academia",
    content: (
      <>
        <p>
          Use a plataforma para as atividades da academia e respeite as
          permissões do seu perfil, a legislação e os direitos de terceiros. São
          proibidos o acesso indevido a contas ou dados, a divulgação de
          informações sem autorização e atos que prejudiquem a segurança ou o
          funcionamento do serviço.
        </p>
        <p>
          A academia responde pela exatidão dos cadastros, pelo registro de
          aulas, presenças e pagamentos e pela legitimidade das informações e
          imagens que insere. No caso de crianças e adolescentes, deve observar
          o melhor interesse do aluno e as exigências legais aplicáveis,
          inclusive quanto à atuação do responsável legal.
        </p>
      </>
    ),
  },
  {
    id: "propriedade-intelectual",
    title: "Propriedade intelectual",
    content: (
      <p>
        O acesso à plataforma permite usar os recursos disponibilizados conforme
        o perfil e o plano contratado. O software, as marcas e a identidade
        visual continuam protegidos pelos direitos de seus titulares. Quem envia
        conteúdo deve ter permissão para usá-lo e autoriza seu armazenamento e
        exibição na medida necessária para operar as funcionalidades utilizadas.
      </p>
    ),
  },
  {
    id: "privacidade",
    title: "Privacidade e dados pessoais",
    content: (
      <p>
        A <Link href="/politica-de-privacidade">Política de Privacidade</Link>{" "}
        explica quais dados são tratados, como são usados e como exercer os
        direitos previstos na LGPD. Para dúvidas sobre registros geridos pela
        sua academia, você também pode procurar a própria academia.
      </p>
    ),
  },
  {
    id: "disponibilidade",
    title: "Disponibilidade, suporte e suspensão",
    content: (
      <>
        <p>
          Manutenções, atualizações e falhas de infraestrutura podem interromper
          o acesso temporariamente. A autenticação, a hospedagem e o
          processamento de cobranças dependem de serviços de terceiros. Em caso
          de dificuldades, entre em contato com o suporte.
        </p>
        <p>
          O acesso pode ser restringido para proteger contas e dados, cumprir
          uma determinação legal ou conter uso indevido. A medida deve ser
          compatível com o motivo da restrição e respeitar os direitos previstos
          na legislação aplicável.
        </p>
      </>
    ),
  },
  {
    id: "alteracoes-e-legislacao",
    title: "Atualizações e legislação aplicável",
    content: (
      <p>
        Estes termos podem ser atualizados para refletir mudanças no serviço ou
        na legislação. A versão vigente e sua data de atualização ficam
        disponíveis nesta página. Para alterações que afetem a contratação,
        aplicam-se os requisitos legais de comunicação e aceite. Estes termos
        são regidos pela legislação brasileira, preservados os direitos do
        consumidor quando aplicáveis.
      </p>
    ),
  },
  {
    id: "contato",
    title: "Contato",
    content: (
      <address className="not-italic">
        <strong>My BJJ Academy</strong>
        <br />
        CNPJ 49.688.273/0001-60
        <br />
        Rua Baronesa, 222, 404 A, Rio de Janeiro – RJ, CEP 21321-000
        <br />
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        <br />
        <a href="tel:+5521971340128">(21) 97134-0128</a>
      </address>
    ),
  },
];

export function TermsOfUsePage() {
  return (
    <LegalDocument
      title="Termos de Uso"
      introduction={
        <>
          <p className="text-sm">
            Última atualização em{" "}
            <time dateTime="2026-11-19">19 de novembro de 2026</time>.
          </p>
          <p>
            Conheça as condições de contratação e uso do My BJJ Academy para
            gestores, professores, alunos e demais usuários autorizados.
          </p>
        </>
      }
      sections={sections}
    />
  );
}

import {
  LegalDocument,
  type LegalSection,
} from "@/components/organisms/legal-document";

const contactEmail = "contato@mybjjacademy.com.br";

const sections: LegalSection[] = [
  {
    id: "responsaveis",
    title: "Quem trata os dados",
    content: (
      <>
        <p>
          O My BJJ Academy, inscrito no CNPJ 49.688.273/0001-60, atua como
          controlador dos dados que utiliza para administrar o site e os
          serviços, como os de conta, assinatura, cobrança, suporte e segurança.
        </p>
        <p>
          Quando uma academia usa a plataforma para gerir seus alunos e
          professores, ela decide para que os dados dos seus cadastros e
          registros internos serão usados. Nesse contexto, a academia é a
          controladora e o My BJJ Academy atua como operador, tratando esses
          dados de acordo com as instruções da academia para prestar o serviço.
        </p>
      </>
    ),
  },
  {
    id: "dados",
    title: "Quais dados são tratados",
    content: (
      <>
        <p>
          Os dados podem ser fornecidos por você, registrados pela academia ou
          gerados durante o uso do serviço. Conforme a funcionalidade utilizada,
          tratamos as seguintes informações.
        </p>
        <ul>
          <li>
            <strong>Cadastro e acesso.</strong> Nome, e-mail, telefone, foto de
            perfil quando fornecida, identificadores de conta e permissões.
            Também tratamos dados de contato e cadastro da academia e das suas
            unidades, como CNPJ e endereço.
          </li>
          <li>
            <strong>Gestão da academia.</strong> Cadastros de alunos e
            professores, data de nascimento quando informada, faixa, grau,
            função, unidade, aulas, inscrições e registros de presença. O
            histórico de planos de alunos pode incluir períodos, situação de
            pagamento e a data em que a academia registrou o pagamento.
          </li>
          <li>
            <strong>Assinatura do portal.</strong> Identificadores de cliente e
            assinatura, plano contratado, situação da cobrança e datas de
            vigência e renovação. Os dados do cartão são inseridos no ambiente
            da Stripe, que processa a cobrança. O My BJJ Academy não armazena o
            número completo do cartão nem seu código de segurança.
          </li>
          <li>
            <strong>Atendimento e acesso técnico.</strong> Informações
            compartilhadas com o suporte e registros técnicos que podem incluir
            endereço IP, navegador, data e hora do acesso e informações sobre
            erros.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Finalidades e bases legais",
    content: (
      <>
        <p>
          Usamos dados para criar contas, autenticar usuários, gerenciar
          permissões, manter o serviço disponível, processar assinaturas e
          atender solicitações de suporte. As informações inseridas pelas
          academias viabilizam as funções de gestão, como organizar turmas,
          acompanhar presença e registrar pagamentos de alunos.
        </p>
        <p>
          Para os tratamentos em que atuamos como controlador, a base legal
          depende da finalidade. Usamos a execução de contrato ou de
          procedimentos preliminares a pedido do titular para disponibilizar o
          serviço, administrar a assinatura e prestar suporte. Podemos usar o
          legítimo interesse para proteger contas, prevenir abusos e
          diagnosticar falhas, observados os direitos e as expectativas dos
          titulares. Quando aplicável, também tratamos dados para cumprir
          obrigações legais ou regulatórias e para o exercício regular de
          direitos. Quando o tratamento depender de consentimento, ele será
          solicitado para a finalidade correspondente.
        </p>
      </>
    ),
  },
  {
    id: "menores-de-idade",
    title: "Dados de crianças e adolescentes",
    content: (
      <p>
        Academias podem cadastrar alunos menores de idade, inclusive sem criar
        uma conta de acesso. Podem registrar, por exemplo, nome, data de
        nascimento, faixa, matrícula e presença, conforme as necessidades da
        gestão. A academia deve avaliar a base legal aplicável, observar o
        melhor interesse da criança ou do adolescente e obter autorização do
        responsável legal quando exigida. Pais e responsáveis podem solicitar
        informações ou exercer direitos junto à academia ou pelo nosso canal de
        privacidade.
      </p>
    ),
  },
  {
    id: "compartilhamento",
    title: "Compartilhamento e transferências internacionais",
    content: (
      <>
        <p>
          Conforme o contexto, os dados ficam disponíveis aos usuários
          autorizados pela academia e são compartilhados com prestadores na
          medida necessária para suas funções.
        </p>
        <ul>
          <li>
            <strong>Clerk</strong> para autenticação, sessões e convites de
            acesso.
          </li>
          <li>
            <strong>Convex</strong> para banco de dados, processamento e
            armazenamento de arquivos.
          </li>
          <li>
            <strong>Stripe</strong> para checkout e gestão da cobrança da
            assinatura do portal.
          </li>
          <li>
            <strong>Vercel</strong> para hospedagem do site e do portal.
          </li>
        </ul>
        <p>
          Também podemos divulgar informações a autoridades competentes quando
          houver obrigação legal ou ordem válida. Os prestadores podem tratar
          informações fora do Brasil. Quando houver transferência internacional,
          aplicam-se as hipóteses e garantias previstas na LGPD e na
          regulamentação da ANPD. Você pode solicitar detalhes sobre essas
          transferências pelo canal de privacidade.
        </p>
      </>
    ),
  },
  {
    id: "retencao-e-seguranca",
    title: "Retenção e segurança",
    content: (
      <>
        <p>
          Mantemos os dados pelo tempo necessário para prestar o serviço e
          atender às finalidades descritas nesta política. O prazo depende do
          tipo de registro, do vínculo com a academia e das obrigações legais ou
          da necessidade de resguardar direitos. Quando a retenção deixa de ser
          necessária, os dados são eliminados ou anonimizados, conforme
          aplicável. Para registros administrados pela academia, seguimos suas
          instruções observadas as obrigações legais aplicáveis.
        </p>
        <p>
          Usamos controles de autenticação e de permissões no portal para
          limitar o acesso aos dados. A academia deve manter suas permissões
          atualizadas e restringir o acesso aos registros às pessoas que
          precisam deles.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies e tecnologias de sessão",
    content: (
      <p>
        O portal usa cookies e tecnologias de sessão para manter o login e
        proteger o acesso à conta. Você pode gerenciar cookies pelo navegador.
        Bloquear cookies necessários pode impedir o login ou interromper a
        sessão.
      </p>
    ),
  },
  {
    id: "direitos",
    title: "Seus direitos",
    content: (
      <>
        <p>
          Nos termos da LGPD, você pode pedir confirmação de tratamento, acesso
          e correção de dados, informações sobre compartilhamento e, quando
          aplicável, portabilidade, anonimização, bloqueio ou eliminação. Também
          pode se opor a tratamento realizado em desacordo com a lei e, quando a
          base for o consentimento, revogá-lo, solicitar a eliminação dos dados
          tratados com base nele e receber informações sobre as consequências de
          recusá-lo. Quando aplicável, você pode solicitar a revisão de decisões
          tomadas unicamente com base em tratamento automatizado que afetem seus
          interesses.
        </p>
        <p>
          Envie sua solicitação para{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>. Se ela envolver
          um cadastro ou registro gerido pela sua academia, você pode procurar a
          própria academia, que é a controladora desses dados. Podemos
          encaminhar o pedido à academia e auxiliá-la no atendimento. Podemos
          pedir informações proporcionais para confirmar sua identidade ou
          representação. Você também pode apresentar petição à ANPD, conforme a
          legislação aplicável.
        </p>
      </>
    ),
  },
  {
    id: "contato-e-atualizacoes",
    title: "Contato e atualizações",
    content: (
      <>
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
        <p>
          Esta política pode ser atualizada para refletir mudanças no serviço ou
          na legislação. A versão vigente fica disponível nesta página com a
          data da última atualização.
        </p>
      </>
    ),
  },
];

export function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Política de Privacidade"
      introduction={
        <>
          <p className="text-sm">
            Última atualização em{" "}
            <time dateTime="2026-11-19">19 de novembro de 2026</time>.
          </p>
          <p>
            Esta política explica como o My BJJ Academy trata dados pessoais no
            site, no portal administrativo e no aplicativo, em conformidade com
            a Lei Geral de Proteção de Dados Pessoais (LGPD).
          </p>
        </>
      }
      sections={sections}
    />
  );
}

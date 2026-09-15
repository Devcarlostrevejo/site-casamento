import Link from 'next/link';

export const metadata = { title: 'Privacidade | Nosso Dia' };

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <article className="policy-card">
        <Link className="policy-back" href="/">
          ← Voltar ao site
        </Link>
        <p className="eyebrow">Transparência</p>
        <h1>Política de privacidade</h1>
        <p>
          Esta é uma versão inicial e deve ser revisada pelo casal antes da
          publicação. O site usa somente os dados necessários para criar e
          acompanhar contribuições para a lista de presentes.
        </p>

        <h2>Dados coletados</h2>
        <p>
          Ao iniciar um pagamento, coletamos nome, e-mail, mensagem opcional,
          presente escolhido e informações sobre o estado da contribuição. CPF
          ou CNPJ é solicitado somente para o pagamento por cartão. Os dados do
          cartão não passam por este site: são preenchidos na página segura do
          Asaas.
        </p>

        <h2>Como usamos os dados</h2>
        <ul>
          <li>criar a cobrança solicitada e evitar cobranças duplicadas;</li>
          <li>confirmar o pagamento e registrar o presente para o casal;</li>
          <li>
            prevenir fraude, investigar erros e cumprir obrigações aplicáveis.
          </li>
        </ul>

        <h2>Compartilhamento e armazenamento</h2>
        <p>
          No Pix, o QR Code aponta diretamente para a chave cadastrada pelo
          casal, e a confirmação é feita manualmente após a conferência do
          extrato. No cartão, os dados necessários são enviados ao Asaas,
          responsável pelo processamento financeiro. As informações do pedido
          ficam armazenadas na infraestrutura do site pelo período necessário à
          operação e às obrigações legais. Não vendemos dados pessoais.
        </p>

        <h2>Mapas</h2>
        <p>
          As páginas de localização carregam mapas incorporados do Google Maps.
          Ao visualizar esses mapas, o Google pode receber dados técnicos do
          navegador, como endereço IP e informações do dispositivo, de acordo
          com as próprias políticas do serviço. Também oferecemos um link para
          abrir cada rota diretamente no aplicativo de mapas.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir confirmação do tratamento, acesso, correção ou
          eliminação quando aplicável. Antes de publicar, o casal deve inserir
          aqui um canal de contato válido para essas solicitações.
        </p>

        <h2>Segurança e atualizações</h2>
        <p>
          Adotamos autenticação para a área administrativa, validação de
          solicitações e segregação dos segredos de pagamento. Esta política
          pode ser atualizada quando o site ou seus fornecedores mudarem.
        </p>
      </article>
    </main>
  );
}

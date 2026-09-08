# Nosso Dia — casamento e lista de presentes

Aplicação full-stack para publicar as informações do casamento, administrar presentes simbólicos e receber contribuições por Pix direto ou cartão através do checkout hospedado do Asaas.

## Arquitetura

- Next.js/Vinext + TypeScript e componentes shadcn no frontend.
- Cloudflare D1 para casamento, presentes, pedidos, webhooks e auditoria.
- Cloudflare R2 para fotos enviadas pelo painel.
- Sign in with ChatGPT para autenticar a área do casal; `ADMIN_EMAILS` define quem pode administrar.
- Pix copia e cola/QR Code gerado pelo site para a chave do casal, com conferência manual no painel.
- Asaas somente para cartão e no servidor. Dados de cartão são preenchidos na página do Asaas.
- Alertas persistentes no painel para Pix informado e cartão confirmado.

## Executar e validar

1. Copie `.env.example` para `.env.local` e preencha apenas valores de Sandbox.
2. Gere uma nova migração após qualquer alteração estrutural com `npm run db:generate`.
3. Execute `npm run dev`.
4. Antes de entregar uma mudança, rode:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

A migração inicial versionada está em `drizzle/`. O conteúdo de demonstração é inserido separadamente pelo botão da área administrativa; migrations nunca contêm dados de exemplo.

## Configuração Asaas

Crie credenciais próprias no Sandbox e configure:

- `ASAAS_API_KEY`: chave da API, mantida apenas no servidor;
- `ASAAS_WEBHOOK_TOKEN`: segredo distinto, com 32 a 255 caracteres;
- webhook apontando para `https://SEU-DOMINIO/api/webhooks/asaas` e enviando o token no cabeçalho `asaas-access-token`.

O cartão abre a página hospedada do Asaas e só aparece como confirmado após o webhook. No Pix, o convidado avisa o pagamento e o casal confirma manualmente depois de conferir o extrato. Requisições possuem ID idempotente e tentativas com resultado incerto são reconciliadas antes de uma nova cobrança.

Não use a chave de produção durante testes. Antes de ativar pagamentos reais, valide os webhooks no Sandbox, confirme os dados da chave Pix direta no painel e substitua o texto provisório da política de privacidade por um canal de contato real.

## Observação financeira

O Pix entra diretamente na conta vinculada à chave cadastrada. O cartão entra no saldo da conta Asaas vinculada à API.

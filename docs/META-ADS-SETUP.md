# Guia rápido para ativar campanhas no Meta Ads (Honra)

Tudo o que você precisa configurar antes de colocar verba no ar.

## 1. Preencher suas credenciais em `js/config.js`

Abra [`js/config.js`](../js/config.js) e preencha:

- `metaPixelId`: cole o ID do seu Pixel da Meta (15 a 16 dígitos). Assim que preenchido, o site passa a disparar automaticamente:
  - `PageView` e `ViewContent` na Landing Page (`/`)
  - `Lead` nos cliques dos botões de teste grátis e WhatsApp
  - `CompleteRegistration` + `StartTrial` ao concluir a criação de conta (`/app/?modo=criar`)
  - `InitiateCheckout` ao clicar em **Assinar com Mercado Pago**
  - `Subscribe` ao retornar com a assinatura confirmada
- `whatsappNumero`: seu WhatsApp comercial com DDI + DDD só com números (ex.: `'5543999990000'`). Quando preenchido, o botão de atendimento aparece automaticamente na Landing Page.
- `emailContato` e `empresaDoc`: usados automaticamente no rodapé, em `/privacidade/`, em `/termos/` e dentro do app.

## 2. Ativar Conversions API (CAPI) no Supabase (recomendado)

Para que o algoritmo da Meta receba as assinaturas pagas direto do servidor (sem sofrer bloqueio de iOS/adblockers), adicione estes dois segredos na Edge Function `mp-webhook` no Supabase:

```bash
supabase secrets set META_PIXEL_ID=SEU_PIXEL_ID META_CAPI_TOKEN=SEU_TOKEN_CAPI
supabase functions deploy mp-webhook --no-verify-jwt
supabase functions deploy assinar
```

> Enquanto esses segredos não estiverem definidos, o webhook continua funcionando normalmente sem erro.

## 3. URLs prontas para cadastrar no Gerenciador de Anúncios

- **URL de destino dos anúncios:** `https://honra.imaguiar.com.br/`
- **Parâmetros UTM sugeridos no anúncio:**
  `utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`
  *(Os parâmetros são salvos automaticamente no navegador e gravados nos metadados da conta no Supabase no momento do cadastro.)*
- **Política de Privacidade (exigida pela Meta):** `https://honra.imaguiar.com.br/privacidade/`
- **Termos de Uso:** `https://honra.imaguiar.com.br/termos/`

## 4. Verificação rápida antes de subir verba

1. **Testar pagamento em produção:** confirmar se `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` estão configurados no Supabase.
2. **Avaliar confirmação de e-mail no Supabase Auth:** se o fluxo de confirmação obrigatória por e-mail reduzir a taxa de entrada no celular, considere desativar *Confirm email* em *Authentication → Providers → Email* (ou deixar e-mail transacional com domínio próprio para não cair no spam).
3. **Objetivo de campanha inicial:** comece otimizando para **Conversões → Iniciar avaliação (`StartTrial`)** ou **Cadastro concluído (`CompleteRegistration`)**. Quando acumular ~30+ assinaturas pagas, teste otimizar direto para **`Subscribe`**.
4. **Estrutura sugerida de criativos para advogados (3 ângulos):**
   - *Dor financeira:* "Quantos honorários parcelados você deixou de cobrar no mês passado por estar tudo em planilha?"
   - *Ganho de tempo:* "Cadastre o cliente 1 vez e gere contrato de honorários, procuração e recibo em 1 clique."
   - *Oferta/equipe:* "Sistema completo para escritório de advocacia por R$ 69,90/mês — com toda a equipe inclusa e 7 dias grátis sem cartão."

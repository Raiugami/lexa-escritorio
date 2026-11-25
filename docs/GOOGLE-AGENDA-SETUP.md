# Como ativar o Google Agenda em 1 clique (100% gratuito)

Com esta configuração, qualquer advogado conecta a própria conta Google **uma única vez** dentro do Honra — sem criar Client ID e sem perder a conexão após 1 hora.

---

## Passo 1 — Rodar o SQL no Supabase (1 minuto)

1. Abra o **SQL Editor** do seu projeto no Supabase.
2. Cole e execute o arquivo [`supabase/05-google-agenda.sql`](../supabase/05-google-agenda.sql).

Isso cria a tabela `public.google_conexoes` (protegida contra leitura pelo navegador) e a função `minha_conexao_google()`.

---

## Passo 2 — Criar as credenciais gratuitas no Google Cloud (4 minutos)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie um projeto chamado **Honra** (ou use um existente).
2. No menu lateral, vá em **APIs e serviços → Biblioteca**, procure por **Google Calendar API** e clique em **Ativar**.
3. Vá em **APIs e serviços → Tela de permissão OAuth** (*Google Auth Platform*):
   * **Tipo de usuário:** Externo (*External*).
   * **Nome do app:** `Honra`
   * **E-mail de suporte / desenvolvedor:** seu e-mail (`contato@imaguiar.com.br`).
   * **Página inicial:** `https://honra.imaguiar.com.br/`
   * **Política de Privacidade:** `https://honra.imaguiar.com.br/privacidade/`
   * **Termos de Uso:** `https://honra.imaguiar.com.br/termos/`
   * **Domínio autorizado:** `imaguiar.com.br`
   * **Escopos:** adicione `openid`, `email`, `.../auth/calendar.events` e `.../auth/calendar.calendarlist.readonly`.
4. Vá em **APIs e serviços → Credenciais → + Criar credenciais → ID do cliente OAuth**:
   * **Tipo de aplicativo:** **Aplicativo da Web**.
   * **Nome:** `Honra Web`
   * **Origens JavaScript autorizadas:** adicione `https://honra.imaguiar.com.br`
   * **URIs de redirecionamento autorizados:** *(pode deixar em branco ou colocar `https://honra.imaguiar.com.br` — o popup usa `postmessage`)*.
5. Copie o **ID do cliente** (`...apps.googleusercontent.com`) e a **Chave secreta do cliente** (*Client Secret*).

---

## Passo 3 — Salvar os segredos e publicar a função no Supabase (1 minuto)

No terminal (ou no painel do Supabase → Edge Functions → Secrets):

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID="SEU_ID.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="SEU_CLIENT_SECRET"

supabase functions deploy google-agenda
```

Pronto! Assim que publicar, o botão **Conectar com Google** aparece automaticamente na tela **Agenda** do Honra.

---

## Passo 4 — Liberar para todos os clientes (Verificação gratuita do Google)

* Enquanto o app estiver em modo **Teste** no Google Cloud, você pode adicionar até 100 e-mails em *Usuários de teste* para testar imediatamente com você e os primeiros clientes.
* Para qualquer advogado conectar sem aviso *"App não verificado"*, clique em **Publicar aplicativo** na tela OAuth e envie a verificação gratuita do Google (eles pedem um vídeo de ~1 min mostrando você clicando em *Conectar com Google* no Honra e o evento aparecendo no Google Agenda — geralmente aprovam em 3 a 7 dias úteis).

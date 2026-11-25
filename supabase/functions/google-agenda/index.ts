// Conexão definitiva (OAuth Authorization Code + refresh_token) com o Google Agenda.
// Segredos necessários no Supabase: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
// 100% gratuito no Google Cloud e no plano Free do Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SITE = "https://honra.imaguiar.com.br";
const ORIGENS = new Set([SITE, "https://raiugami.github.io", "http://localhost:8000", "http://127.0.0.1:8000"]);
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const corsDe = (req: Request) => {
  const o = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.has(o) ? o : SITE,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

async function trocaGoogle(params: Record<string, string>) {
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}

async function buscaEmailGoogle(accessToken: string): Promise<string> {
  try {
    const r = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return "";
    const j = await r.json().catch(() => ({}));
    return typeof j.email === "string" ? j.email : "";
  } catch (_) {
    return "";
  }
}

Deno.serve(async (req) => {
  const cors = corsDe(req);
  const resp = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return resp("ok");
  if (req.method !== "POST") return resp({ erro: "método não permitido" }, 405);

  const clientId = (Deno.env.get("GOOGLE_CLIENT_ID") || "").trim();
  const clientSecret = (Deno.env.get("GOOGLE_CLIENT_SECRET") || "").trim();
  const configurado = Boolean(clientId && clientSecret);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await usuario.auth.getUser();
    if (!user) return resp({ erro: "não autenticado" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const acao = String(body.acao || "status");

    // 1) Status atual da conexão do usuário (também informa client_id público para o botão 1-clique)
    if (acao === "status") {
      const { data: row } = await admin.from("google_conexoes")
        .select("conta, calendario_id, calendario_nome, modo, ultima_sync")
        .eq("usuario", user.id)
        .maybeSingle();
      return resp({
        configurado,
        client_id: configurado ? clientId : "",
        conectado: Boolean(row),
        conta: row?.conta || "",
        calendario_id: row?.calendario_id || "primary",
        calendario_nome: row?.calendario_nome || "Agenda principal",
        modo: row?.modo || "enviar",
        ultima_sync: row?.ultima_sync || null,
      });
    }

    if (!configurado) {
      return resp({ erro: "Integração com o Google Agenda ainda não configurada no servidor." }, 503);
    }

    // 2) Primeira conexão: troca o authorization code (popup postmessage) por access_token + refresh_token
    if (acao === "conectar") {
      const code = String(body.code || "").trim();
      if (!code) return resp({ erro: "código de autorização ausente" }, 400);

      const { ok, data: tk } = await trocaGoogle({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      });
      if (!ok || !tk.access_token) {
        console.error("Google code exchange falhou:", tk.error, tk.error_description);
        return resp({ erro: "O Google recusou a conexão. Tente novamente." }, 400);
      }

      const { data: existente } = await admin.from("google_conexoes")
        .select("refresh_token, calendario_id, calendario_nome, modo")
        .eq("usuario", user.id)
        .maybeSingle();

      const refreshToken = tk.refresh_token || existente?.refresh_token || "";
      if (!refreshToken) {
        return resp({
          erro: "O Google não enviou a permissão contínua. Tente conectar novamente aceitando as permissões.",
          reconectar: true,
        }, 400);
      }

      const conta = await buscaEmailGoogle(tk.access_token);
      const modo = body.modo === "ambos" ? "ambos" : (existente?.modo || "enviar");
      const calId = existente?.calendario_id || "primary";
      const calNome = existente?.calendario_nome || "Agenda principal";
      const agora = new Date().toISOString();

      const { error: upErr } = await admin.from("google_conexoes").upsert({
        usuario: user.id,
        conta: conta || null,
        calendario_id: calId,
        calendario_nome: calNome,
        modo,
        refresh_token: refreshToken,
        atualizado_em: agora,
      }, { onConflict: "usuario" });
      if (upErr) throw upErr;

      return resp({
        conectado: true,
        access_token: tk.access_token,
        expires_in: Number(tk.expires_in || 3500),
        conta,
        calendario_id: calId,
        calendario_nome: calNome,
        modo,
      });
    }

    // 3) Renovação silenciosa: gera novo access_token a partir do refresh_token salvo no banco
    if (acao === "token") {
      const { data: row } = await admin.from("google_conexoes")
        .select("conta, calendario_id, calendario_nome, modo, refresh_token")
        .eq("usuario", user.id)
        .maybeSingle();
      if (!row?.refresh_token) return resp({ conectado: false, reconectar: true });

      const { ok, data: tk } = await trocaGoogle({
        refresh_token: row.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      });

      if (!ok || !tk.access_token) {
        console.error("Google refresh falhou:", tk.error, tk.error_description);
        if (tk.error === "invalid_grant") {
          await admin.from("google_conexoes").delete().eq("usuario", user.id);
          return resp({ conectado: false, reconectar: true, erro: "O acesso no Google foi revogado. Conecte novamente." });
        }
        return resp({ erro: "Não foi possível renovar o acesso ao Google agora." }, 502);
      }

      const mud: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      if (tk.refresh_token) mud.refresh_token = tk.refresh_token;
      if (body.marcar_sync) mud.ultima_sync = new Date().toISOString();
      await admin.from("google_conexoes").update(mud).eq("usuario", user.id);

      return resp({
        conectado: true,
        access_token: tk.access_token,
        expires_in: Number(tk.expires_in || 3500),
        conta: row.conta || "",
        calendario_id: row.calendario_id || "primary",
        calendario_nome: row.calendario_nome || "Agenda principal",
        modo: row.modo || "enviar",
      });
    }

    // 4) Salva preferências (qual agenda do Google usar e modo enviar/ambos)
    if (acao === "configurar") {
      const modo = body.modo === "ambos" ? "ambos" : "enviar";
      const calId = String(body.calendario_id || "primary").trim().slice(0, 200) || "primary";
      const calNome = String(body.calendario_nome || (calId === "primary" ? "Agenda principal" : calId)).trim().slice(0, 120);
      const { error: e } = await admin.from("google_conexoes")
        .update({ modo, calendario_id: calId, calendario_nome: calNome, atualizado_em: new Date().toISOString() })
        .eq("usuario", user.id);
      if (e) throw e;
      return resp({ ok: true, modo, calendario_id: calId, calendario_nome: calNome });
    }

    // 5) Marca timestamp de última sincronização concluída
    if (acao === "marcar_sync") {
      await admin.from("google_conexoes")
        .update({ ultima_sync: new Date().toISOString(), atualizado_em: new Date().toISOString() })
        .eq("usuario", user.id);
      return resp({ ok: true });
    }

    // 6) Desconectar: revoga token no Google e apaga registro no banco
    if (acao === "desconectar") {
      const { data: row } = await admin.from("google_conexoes")
        .select("refresh_token")
        .eq("usuario", user.id)
        .maybeSingle();
      if (row?.refresh_token) {
        await fetch(GOOGLE_REVOKE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: row.refresh_token }).toString(),
        }).catch(() => {});
      }
      await admin.from("google_conexoes").delete().eq("usuario", user.id);
      return resp({ ok: true });
    }

    return resp({ erro: "ação desconhecida" }, 400);
  } catch (e) {
    console.error("google-agenda erro:", e);
    return resp({ erro: "Erro ao falar com o Google Agenda agora." }, 502);
  }
});

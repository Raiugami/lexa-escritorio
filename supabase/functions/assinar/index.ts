// Cria (ou cancela) a assinatura mensal do escritório no Mercado Pago.
// Segredos: MP_ACCESS_TOKEN (Mercado Pago > Suas integrações > Credenciais de produção).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const PRECO = 69.9;
const SITE = "https://honra.imaguiar.com.br";
// endereços de volta aceitos: comparação exata da origem (startsWith deixava passar honra.imaguiar.com.br.golpe.com)
const ORIGENS = new Set([SITE, "https://raiugami.github.io"]);
const MP = "https://api.mercadopago.com";

const corsDe = (req: Request) => {
  const o = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.has(o) ? o : SITE,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

async function mp(path: string, init: RequestInit = {}) {
  const r = await fetch(MP + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const j = await r.json().catch(() => ({}));
  // detalhe do erro só no log do servidor, nunca para o navegador
  if (!r.ok) throw new Error(`Mercado Pago ${r.status} em ${path}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

function voltaSegura(v: unknown) {
  try {
    const u = new URL(String(v || ""));
    if (ORIGENS.has(u.origin)) return u.toString();
  } catch (_) { /* endereço inválido */ }
  return `${SITE}/app/#assinatura`;
}

Deno.serve(async (req) => {
  const cors = corsDe(req);
  const resp = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return resp("ok");
  if (req.method !== "POST") return resp({ erro: "método não permitido" }, 405);
  if (!Deno.env.get("MP_ACCESS_TOKEN")) return resp({ erro: "pagamento ainda não configurado" }, 503);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await usuario.auth.getUser();
    if (!user) return resp({ erro: "não autenticado" }, 401);
    const { data: esc, error: e0 } = await usuario.rpc("meu_escritorio");
    if (e0 || !esc) return resp({ erro: "escritório não encontrado" }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // só o dono do escritório assina ou cancela (estagiário/secretaria não mexem na cobrança)
    const { data: membro } = await admin.from("membros").select("papel")
      .eq("escritorio_id", esc).eq("usuario", user.id).maybeSingle();
    if (membro?.papel !== "dono") return resp({ erro: "só o dono do escritório pode mudar a assinatura" }, 403);

    const { data: ass } = await admin.from("assinaturas").select("*").eq("escritorio_id", esc).maybeSingle();
    if (!ass) return resp({ erro: "assinatura não encontrada" }, 400);
    const body = await req.json().catch(() => ({}));

    // assinatura que já existe no Mercado Pago (se houver)
    let atual: any = null;
    if (ass.gateway_assinatura) {
      atual = await mp(`/preapproval/${encodeURIComponent(ass.gateway_assinatura)}`).catch(() => null);
    }

    if (body.acao === "cancelar") {
      if (atual && atual.status !== "cancelled") {
        await mp(`/preapproval/${encodeURIComponent(atual.id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
      }
      // escritório cortesia nunca vira "cancelada" (senão ficaria só leitura)
      if (ass.status !== "cortesia") {
        await admin.from("assinaturas").update({ status: "cancelada", atualizado_em: new Date().toISOString() }).eq("escritorio_id", esc);
      }
      return resp({ ok: true });
    }

    // evita cobrança dobrada e criação repetida de assinaturas (limite natural de requisições):
    // já autorizada = nada a fazer; ainda pendente = devolve o mesmo link de pagamento
    if (atual?.status === "authorized") return resp({ ja: true });
    if (atual?.status === "pending" && atual.init_point) return resp({ url: atual.init_point });
    if (ass.status === "cortesia") return resp({ ja: true });

    const volta = voltaSegura(body.volta);
    // se ainda há dias de teste, a primeira cobrança só acontece quando o teste acabar
    const agora = Date.now();
    const fimTeste = ass.teste_ate ? new Date(ass.teste_ate).getTime() : 0;
    const inicio = new Date(Math.max(agora + 60_000, fimTeste)).toISOString();

    const pre = await mp("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: "Honra · assinatura mensal",
        external_reference: esc,
        payer_email: user.email,
        back_url: volta,
        status: "pending",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          start_date: inicio,
          transaction_amount: PRECO,
          currency_id: "BRL",
        },
      }),
    });
    await admin.from("assinaturas").update({
      gateway: "mercadopago",
      gateway_assinatura: pre.id,
      plano: "mensal",
      atualizado_em: new Date().toISOString(),
    }).eq("escritorio_id", esc);
    return resp({ url: pre.init_point });
  } catch (e) {
    console.error(e);
    return resp({ erro: "não foi possível falar com o Mercado Pago agora" }, 502);
  }
});

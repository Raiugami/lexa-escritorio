// Cria (ou cancela) a assinatura mensal do escritório no Mercado Pago.
// Segredos: MP_ACCESS_TOKEN (Mercado Pago > Suas integrações > Credenciais de produção).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const PRECO = 69.9;
const ORIGENS = ["https://honra.imaguiar.com.br", "https://raiugami.github.io", "http://localhost", "http://127.0.0.1"];
const MP = "https://api.mercadopago.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

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
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return resp("ok");
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
    const { data: ass } = await admin.from("assinaturas").select("*").eq("escritorio_id", esc).maybeSingle();
    const body = await req.json().catch(() => ({}));

    if (body.acao === "cancelar") {
      if (ass?.gateway_assinatura) {
        await mp(`/preapproval/${ass.gateway_assinatura}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
      }
      await admin.from("assinaturas").update({ status: "cancelada", atualizado_em: new Date().toISOString() }).eq("escritorio_id", esc);
      return resp({ ok: true });
    }

    let volta = String(body.volta || "");
    if (!ORIGENS.some((o) => volta.startsWith(o))) volta = "https://honra.imaguiar.com.br/#assinatura";

    // se ainda há dias de teste, a primeira cobrança só acontece quando o teste acabar
    const agora = Date.now();
    const fimTeste = ass?.teste_ate ? new Date(ass.teste_ate).getTime() : 0;
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
    return resp({ erro: String((e as Error).message || e) }, 500);
  }
});

// Recebe os avisos do Mercado Pago e atualiza a tabela assinaturas.
// Segredos: MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET (assinatura secreta do webhook, em Suas integrações > Webhooks).
// Publicar sem verificação de JWT (o Mercado Pago não manda token do Supabase).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const MP = "https://api.mercadopago.com";
const ok = () => new Response("ok", { status: 200 });

async function mp(path: string) {
  const r = await fetch(MP + path, { headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` } });
  if (!r.ok) throw new Error(`Mercado Pago ${r.status} em ${path}`);
  return await r.json();
}

// confere a assinatura x-signature: HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
async function assinaturaValida(req: Request, dataId: string) {
  const segredo = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!segredo) return true;
  const sig = req.headers.get("x-signature") || "";
  const partes = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2)));
  if (!partes.ts || !partes.v1) return false;
  let manifesto = "";
  if (dataId) manifesto += `id:${dataId.toLowerCase()};`;
  const rid = req.headers.get("x-request-id");
  if (rid) manifesto += `request-id:${rid};`;
  manifesto += `ts:${partes.ts};`;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bin = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(manifesto)));
  const hex = [...bin].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === partes.v1;
}

const maisUmMes = (d: string | number | Date) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x.toISOString(); };

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok();
  const u = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const tipo = String(body.type || body.topic || u.searchParams.get("type") || u.searchParams.get("topic") || "");
  const id = String(body?.data?.id || u.searchParams.get("data.id") || u.searchParams.get("id") || "");
  if (!id) return ok();
  if (!(await assinaturaValida(req, u.searchParams.get("data.id") || id))) return new Response("assinatura inválida", { status: 401 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    // os dados vêm sempre da API do Mercado Pago, nunca do corpo do aviso
    let preId = "", pagamento: any = null;
    if (tipo.includes("authorized_payment")) {
      pagamento = await mp(`/authorized_payments/${id}`);
      preId = pagamento.preapproval_id;
    } else if (tipo.includes("preapproval")) {
      preId = id;
    } else return ok();

    const pre = await mp(`/preapproval/${preId}`);
    const esc = pre.external_reference;
    if (!esc) return ok();
    const { data: ass } = await admin.from("assinaturas").select("*").eq("escritorio_id", esc).maybeSingle();
    if (!ass) return ok();

    const mud: Record<string, unknown> = { gateway: "mercadopago", gateway_assinatura: pre.id, atualizado_em: new Date().toISOString() };
    if (pre.payer_id) mud.gateway_cliente = String(pre.payer_id);
    const pagoAte = ass.pago_ate ? new Date(ass.pago_ate).getTime() : 0;

    if (pagamento) {
      const st = pagamento?.payment?.status || pagamento.status;
      if (st === "approved" || st === "processed") {
        const novo = maisUmMes(pagamento.debit_date || pagamento.date_created || Date.now());
        if (new Date(novo).getTime() > pagoAte) mud.pago_ate = novo;
        mud.status = "ativa";
      } else if (st === "rejected" || st === "recycling") {
        mud.status = "atrasada";
      }
    } else if (pre.status === "authorized") {
      if (ass.status !== "cortesia") mud.status = ass.status === "atrasada" ? "atrasada" : "ativa";
      // cartão autorizado: libera até a primeira cobrança (fim do teste) + tolerância do banco
      const inicio = new Date(pre.auto_recurring?.start_date || Date.now()).getTime();
      if (inicio > pagoAte) mud.pago_ate = new Date(inicio).toISOString();
    } else if (pre.status === "cancelled") {
      mud.status = "cancelada";
    } else if (pre.status === "paused") {
      mud.status = "atrasada";
    }
    if (ass.status === "cortesia") delete mud.status;
    await admin.from("assinaturas").update(mud).eq("escritorio_id", esc);
  } catch (e) {
    console.error(e);
    return new Response("erro", { status: 500 }); // o Mercado Pago tenta de novo
  }
  return ok();
});

// 命式ノート — バックエンド（Cloudflare Workers）
// 役割：①AI中継（運営キーを隠す）②コホート計測 ③購読権利の確認 ④Stripe Webhook受け
//
// ■ 必要な設定（Cloudflareダッシュボード）
//  - KV namespace を作成し、変数名 KV でバインド（Settings → Variables → KV Namespace Bindings）
//  - Secrets（Settings → Variables and Secrets → Secret）
//      GEMINI_KEY            … Google AI Studio の Gemini APIキー（AI相談用）
//      STRIPE_WEBHOOK_SECRET … Stripe Webhook の署名シークレット（whsec_...）
//      STATS_KEY             … /stats を見るための任意の管理パスワード
//  詳しい手順は SETUP_BILLING.md を参照。
//
// ■ エンドポイント
//   POST /            … AI中継（body: {system, messages}）※アプリの AI_PROXY はこのルートを叩く
//   POST /event       … 計測イベント（body: {id, name, t}）
//   GET  /entitlement?id=...     … 購読状態 {active, status, currentPeriodEnd}
//   GET  /stats?key=STATS_KEY    … ファネル集計（管理用）
//   POST /stripe/webhook         … Stripe からの購読イベント

const AI_MODEL = "gemini-2.5-flash";
const CORS = {
  "Access-Control-Allow-Origin": "*", // 公開後は自分のサイトのオリジンに絞ると安全
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
};
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json", ...extra } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    try {
      if (path === "/event" && req.method === "POST") return await handleEvent(req, env);
      if (path === "/entitlement" && req.method === "GET") return await handleEntitlement(url, env);
      if (path === "/stats" && req.method === "GET") return await handleStats(url, env);
      if (path === "/stripe/webhook" && req.method === "POST") return await handleStripeWebhook(req, env);
      if (req.method === "POST") return await handleAI(req, env); // 既定：AI中継（/ または /ai）
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 200);
    }
  },
};

// ── AI中継（運営Geminiキーを隠す）──
async function handleAI(req, env) {
  if (!env.GEMINI_KEY) return json({ error: "server not configured (GEMINI_KEY missing)" }, 500);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const system = String(body.system || "").slice(0, 8000);
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : null;
  if (!messages) return json({ error: "messages required" }, 400);
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "").slice(0, 4000) }],
  }));
  const api = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${env.GEMINI_KEY}`;
  const r = await fetch(api, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: (data.error && data.error.message) || `HTTP ${r.status}` });
  const cand = (data.candidates || [])[0];
  const text = (((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("")).trim();
  if (!text) {
    const br = data.promptFeedback && data.promptFeedback.blockReason;
    return json({ error: br ? `ブロック（${br}）` : "回答が空でした" });
  }
  return json({ text });
}

// ── コホート計測：イベントを日次カウンタ＆ユニットで集計 ──
const ALLOWED_EVENTS = ["app_open", "paywall_view", "checkout_click", "activated"];
async function handleEvent(req, env) {
  if (!env.KV) return json({ ok: false, error: "KV not bound" });
  let b;
  try { b = await req.json(); } catch { return json({ ok: false }); }
  const name = String(b.name || "").slice(0, 32);
  const id = String(b.id || "anon").slice(0, 64);
  if (!ALLOWED_EVENTS.includes(name)) return json({ ok: true }); // 未知イベントは無視
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  // 日次合計（get→+1→put：MVPの近似カウント）
  await incr(env, `c:${name}:${day}`);
  await incr(env, `c:${name}:total`);
  // ユニット（重複加算を避ける：初回のみカウント）
  const ukey = `u:${name}:${id}`;
  if (!(await env.KV.get(ukey))) {
    await env.KV.put(ukey, "1");
    await incr(env, `cu:${name}:total`);
  }
  return json({ ok: true });
}
async function incr(env, key) {
  const cur = parseInt((await env.KV.get(key)) || "0", 10) || 0;
  await env.KV.put(key, String(cur + 1));
}

// ── 購読権利の確認 ──
async function handleEntitlement(url, env) {
  if (!env.KV) return json({ active: false, status: "no-kv" });
  const id = (url.searchParams.get("id") || "").slice(0, 64);
  if (!id) return json({ active: false, status: "no-id" });
  const raw = await env.KV.get(`ent:${id}`);
  if (!raw) return json({ active: false, status: "none" });
  try { return json(JSON.parse(raw)); } catch { return json({ active: false, status: "bad" }); }
}

// ── ファネル集計（管理用）──
async function handleStats(url, env) {
  if (!env.KV) return json({ error: "KV not bound" }, 500);
  if (!env.STATS_KEY || url.searchParams.get("key") !== env.STATS_KEY) return json({ error: "unauthorized" }, 401);
  const out = { unique: {}, total: {} };
  for (const n of ALLOWED_EVENTS) {
    out.unique[n] = parseInt((await env.KV.get(`cu:${n}:total`)) || "0", 10);
    out.total[n] = parseInt((await env.KV.get(`c:${n}:total`)) || "0", 10);
  }
  const u = out.unique;
  out.funnel = {
    起動: u.app_open || 0,
    ペイウォール表示: u.paywall_view || 0,
    決済クリック: u.checkout_click || 0,
    課金開始: u.activated || 0,
    "起動→課金 %": u.app_open ? Math.round(((u.activated || 0) / u.app_open) * 1000) / 10 : 0,
    "ペイウォール→課金 %": u.paywall_view ? Math.round(((u.activated || 0) / u.paywall_view) * 1000) / 10 : 0,
  };
  return json(out);
}

// ── Stripe Webhook：購読状態を KV に反映 ──
async function handleStripeWebhook(req, env) {
  if (!env.KV) return json({ error: "KV not bound" }, 500);
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "no webhook secret" }, 500);
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  const ok = await verifyStripeSig(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "bad signature" }, 400);

  let event;
  try { event = JSON.parse(payload); } catch { return json({ error: "bad json" }, 400); }
  const obj = (event.data && event.data.object) || {};
  const ACTIVE = ["trialing", "active", "past_due"];

  if (event.type === "checkout.session.completed") {
    const id = obj.client_reference_id;
    if (id) {
      if (obj.subscription) await env.KV.put(`sub:${obj.subscription}`, id);
      if (obj.customer) await env.KV.put(`cust:${obj.customer}`, id);
      await env.KV.put(`ent:${id}`, JSON.stringify({ active: true, status: "trialing", currentPeriodEnd: 0 }));
    }
  } else if (event.type && event.type.startsWith("customer.subscription.")) {
    const subId = obj.id;
    let id = subId ? await env.KV.get(`sub:${subId}`) : null;
    if (!id && obj.customer) id = await env.KV.get(`cust:${obj.customer}`);
    if (id) {
      const active = ACTIVE.includes(obj.status) && event.type !== "customer.subscription.deleted";
      await env.KV.put(`ent:${id}`, JSON.stringify({ active, status: obj.status || "", currentPeriodEnd: obj.current_period_end || 0 }));
    }
  }
  return json({ received: true });
}

// Stripe-Signature の検証（Web Crypto・stripeライブラリ不要）
async function verifyStripeSig(payload, sigHeader, secret) {
  try {
    const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=")));
    const t = parts.t, v1 = parts.v1;
    if (!t || !v1) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    // タイミング安全な比較
    if (hex.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

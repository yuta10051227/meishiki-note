// 命式ノート — AI中継プロキシ（Cloudflare Workers 用）
// 目的：運営のGeminiキーを「シークレット」として隠し、ユーザーがキー無しでAI相談を使えるようにする。
//
// ■ デプロイ手順（一度だけ・無料）
// 1. https://aistudio.google.com/apikey で Gemini のAPIキーを無料取得（カード不要）。
// 2. Cloudflare（無料アカウント）→ Workers & Pages → Create Worker。
// 3. このファイルの中身を貼り付けて Deploy。
// 4. Worker の Settings → Variables and Secrets → 「GEMINI_KEY」という名前で 1. のキーを Secret として追加。
// 5. 公開された Worker の URL（例: https://xxx.workers.dev）を、index.html の AI_PROXY に貼る。
//
// ■ コスト：Gemini無料枠の範囲なら $0。超えてもFlashは激安（1相談あたり概ね0.0数円）。
// ■ 注意：本格運用では悪用対策（レート制限/Turnstile）を足すこと。下に簡易な日次上限の雛形あり。

const MODEL = "gemini-2.5-flash";
const CORS = {
  "Access-Control-Allow-Origin": "*", // 公開後は自分のサイトのオリジンに絞ると安全
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_KEY}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.9, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: (data.error && data.error.message) || `HTTP ${r.status}` }, 200);
      const cand = (data.candidates || [])[0];
      const text = (((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("")).trim();
      if (!text) {
        const br = data.promptFeedback && data.promptFeedback.blockReason;
        return json({ error: br ? `ブロック（${br}）` : "回答が空でした" }, 200);
      }
      return json({ text });
    } catch (e) {
      return json({ error: String(e) }, 200);
    }
  },
};

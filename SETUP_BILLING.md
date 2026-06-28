# 課金＋計測（S1）セットアップ手順

評価委員会の最優先ブロッカー＝「決済＋計測の最小実装」をオンにする手順です。
**何も設定しなければ全機能は無料開放のまま**（＝今までどおり）。下記を設定した瞬間に有効化されます。

決済は **MOSH（会員コード方式）** と **Stripe（自動判定方式）** のどちらでも可。
MOSHはWebhook/APIが無いため「会員コード」でロック解除します（手順は次章）。

---

## ★ MOSH で設定する（会員コード方式・推奨ルート）

### 仕組み
```
ユーザー ──①MOSHで月額/年額サブスクを購読──▶ MOSH
   │                                           │
   │   ②MOSHの「購読者限定コンテンツ」に会員コードを記載
   ▼
 アプリ ──③コード入力──▶ Worker(/redeem) ──UNLOCK_CODESと照合──▶ 解除(KVに記録)
```
> MOSHは購読の自動判定（Webhook）ができないため、**購読者だけが見られるコンテンツに「会員コード」を載せ**、それをアプリに入力してもらう運用です。コードは月ごとに変更（ローテーション）すると共有リスクを抑えられます。

### 手順
1. **MOSHでサブスク作成**（https://mosh.jp/ ）
   - 月額サブスク（または年額相当）を作成。価格は方針に合わせて（例：月¥980 / 年¥10,000相当）。
   - ※手数料は決済3.5%＋サービス利用料3.5%＝**約7%**。無料体験の可否はMOSH側設定で確認。
2. **購読者限定コンテンツに会員コードを記載**
   - 例：限定ブログ/メッセージに「アプリの会員コード：`HOSHI2026`」と載せる。
3. **Cloudflare Worker を用意**（`worker.js` をデプロイ）
   - **KV namespace** を変数名 `KV` でバインド。
   - **Secret** `UNLOCK_CODES` に、有効な会員コードをカンマ区切りで登録（例：`HOSHI2026,TSUKI2026`）。手順2と同じ値。
   - （AI相談も使うなら `GEMINI_KEY`、`/stats`を見るなら `STATS_KEY` も登録）
4. **アプリに設定**（`index.html` の `BILLING`）
   ```js
   const BILLING = {
     mode: "mosh",
     checkoutUrl: "https://mosh.jp/services/xxxx", // MOSHのサブスクページ
     portalUrl:   "https://mosh.jp/...",           // 解約案内（MOSHマイページ等）
     api:         "https://<あなたのWorker>",
     ctaLabel:    "",   // 空でOK（"MOSHで購読する"が出る）
     trialDays:   0,    // MOSHで無料体験を設定したら日数を入れる
   };
   ```
   → コミット＆プッシュで有効化。
5. **コードのローテーション**：共有が広がったら `UNLOCK_CODES` を新コードに変更し、MOSHの限定コンテンツも更新。

> 注：コードは「端末ごと」に解除を記録します（匿名install ID単位）。端末変更やデータ削除時は再入力が必要。

---

## Stripe で設定する（自動判定方式・Webあり）

---

## 全体像

```
ユーザー ──①無料トライアル/購読──▶ Stripe Checkout
   │                                   │ ②Webhook
   ▼                                   ▼
 アプリ(index.html) ──③権利確認──▶ Cloudflare Worker(worker.js) ──▶ KV
   └──────────④計測イベント───────────┘
```

- **決済・自動更新・解約・トライアル**は Stripe が担当（自前実装ゼロ）
- **権利確認・計測・Webhook受け**は Worker が担当
- アプリは「購読中か」を Worker に聞き、有料機能を出し分け

---

## 手順

### 1. Cloudflare Worker を用意
1. `worker.js` を Cloudflare の Worker にデプロイ（既にAI中継で使っている場合は中身を差し替え）。
2. **KV namespace** を作成し、変数名 **`KV`** でバインド
   （Worker → Settings → Variables → KV Namespace Bindings → Add → Variable name: `KV`）。
3. **Secrets** を登録（Settings → Variables and Secrets → + Add → Type: Secret）:
   - `GEMINI_KEY` … Gemini APIキー（AI相談用・https://aistudio.google.com/apikey ）
   - `STATS_KEY` … `/stats` を見るための任意パスワード（例：好きな英数字）
   - `STRIPE_WEBHOOK_SECRET` … ※手順3で取得後に登録

### 2. Stripe を用意
1. Stripe アカウント作成（https://dashboard.stripe.com ）。
2. **商品と価格**：Products → Add product
   - 価格 **¥10,000 / year（継続）** を作成（Recurring・Yearly）。
3. **無料トライアル**：その価格に「Free trial **7 days**」を設定。
4. **Payment Link** を作成（No-code）または Checkout。
   - 「**顧客が支払い方法を後で変更できる**」「サブスクの解約を許可」をオンに。
   - リンク作成後の URL を控える（例：`https://buy.stripe.com/xxxx`）。
5. **Customer Portal** を有効化（Settings → Billing → Customer portal）。
   - 「サブスクのキャンセルを許可」をオン＝**解約1タップ**（特商法対応の要）。
   - ポータルURLを控える（または Link を使う）。

### 3. Webhook を接続
1. Stripe → Developers → Webhooks → Add endpoint
   - URL：`https://<あなたのWorker>/stripe/webhook`
   - 送るイベント：`checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
2. 作成後に表示される **Signing secret（whsec_...）** を、Worker の Secret
   **`STRIPE_WEBHOOK_SECRET`** に登録。

### 4. アプリに設定を入れる（`index.html` の `BILLING`）
```js
const BILLING = {
  checkoutUrl: "https://buy.stripe.com/xxxx", // 手順2-4のPayment Link
  portalUrl:   "https://billing.stripe.com/p/login/xxxx", // 手順2-5のポータル
  api:         "https://<あなたのWorker>", // 手順1のWorker URL（末尾スラッシュ不要）
  trialDays:   7,
};
```
→ コミット＆プッシュすれば有効化。`api` を空のままにすると**計測はローカルのみ・全機能開放**（テスト用）。

---

## 動作

- **未購読**：運勢・占いカレンダー・AI相談・AIチャット・ネイタル詳細・分野別ガイドが
  🔒 ロックされ、上部に「7日間無料ではじめる」CTA を表示。
  （「今日」「わたしの要約」「人体星図」「相性」などは無料のまま＝フック）
- **購読/トライアル中**：全解放。
- **解約**：CTA下またはポータルから1タップ。

---

## 計測（実コホートの数字を取る）

アプリは以下のイベントを Worker に送ります（PIIなし・匿名 install ID のみ）:
`app_open` → `paywall_view` → `checkout_click` → `activated`

**ファネルの確認**（管理用）:
```
https://<あなたのWorker>/stats?key=<STATS_KEYの値>
```
→ 起動数・ペイウォール表示・決済クリック・課金開始の**ユニーク数**と、
   「起動→課金 %」「ペイウォール→課金 %」が JSON で返ります。
これが評価委員会の言う「50人の本物の数字」を取る土台です。

> ⚠️ 計測は MVP の近似カウント（KVのget→put）。本番で厳密値が要るなら
> Durable Objects か外部分析（PostHog等）への置換を検討。

---

## まだ未実装（次フェーズ／委員会の条件4〜6）
- Web Push（iOS16.4+）＝習慣化トリガー
- クラウド同期／復元（端末内データ消失の防止）
- 月額¥980主軸＋年額アンカーの2段構成
- 特商法 最終確認画面6項目・景表法の表現統制（法務レビュー）

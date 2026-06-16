# 命式ノート（占術アプリ・プロトタイプ）

生年月日から、算命学（人体星図・十大主星・十二大従星・天中殺・大運・日月年運・相性）と
四柱推命・西洋占星術・インド占星術を**自前計算**して表示する単体ページ。

- VIELE secretary の計算エンジン `natal.js` を流用（決定論・AI不使用）。
- **ビルド不要**。React / htm / astronomy-engine を `esm.sh` から読み込みます。
- 計算はすべて端末内で完結（データ送信なし）。

## 開き方

ES モジュール（`./natal.js` の相対 import）を使うため、`file://` の直接ダブルクリックでは動きません。
簡易サーバ経由で開いてください。

```bash
python3 -m http.server 8000
# → ブラウザで http://localhost:8000 を開く
```

または Node があれば：

```bash
npx serve .
```

※ 初回はネット接続が必要（esm.sh から React と計算ライブラリを取得）。

## Web で公開する（GitHub Pages）

ビルド不要の静的サイトなので、GitHub Pages でそのまま公開できます。

1. GitHub のリポジトリ → **Settings** → **Pages** を開く。
2. **Build and deployment** の **Source** を **Deploy from a branch** にする。
3. **Branch** で公開したいブランチ（例: `claude/divination-app-qo0dg4` または `main`）と
   フォルダ **/(root)** を選び **Save**。
4. 数十秒〜数分後、`https://<ユーザー名>.github.io/meishiki-note/` で公開されます。

> HTTPS 経由なら esm.sh / astronomy-engine も問題なく読み込まれます。
> Jekyll の処理を無効化するため、リポジトリ直下に空の `.nojekyll` を置いています。

## 構成

- `index.html` … UI（React + htm、単一ファイル）
- `natal.js` … 命式計算エンジン（VIELE から流用。astronomy-engine の取得元のみ esm.sh に変更）

## このプロトタイプでできること

- 算命学・人体星図（五主星の十字＋十二大従星のエネルギー＋日干タイプ＋干支三柱）
- 今日／今月／今年の運氣（今動く十大主星＋攻め/守りのスタンス＋動き方）
- 天中殺・大運（10年ロードマップ）
- 相性（2人）— スコア＋根拠＋うまくいくコツ
- 西洋・インド占星術の要約（サイン／ASC／ナクシャトラ／ダシャー）

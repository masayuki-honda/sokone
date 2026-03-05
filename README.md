# Sokone（底値）

チラシ・Instagram・店頭写真から商品価格を読み取り、底値データを蓄積・可視化するWebアプリ。

「本当に安いのか？」をデータで判断できるようにします。

## 主な機能

- 📸 **写真・チラシ・Instagramから価格を自動読み取り** — 店頭写真・チラシ画像・Instagramスクショをアップロードするだけ
- 🤖 **AI による商品名・価格の自動抽出** — Google Gemini 2.0 Flash で OCR＋構造化抽出＋画像識別を一発実行
- 📉 **底値トラッキング** — 商品×店舗ごとの価格履歴を記録し、底値を自動特定
- ⭐ **お気に入り・検索** — よく買う商品をピン留めして優先表示、商品名で素早く検索
- 🏪 **店舗管理** — 自分の生活圏のスーパーを登録して、パーソナライズされた価格比較
- 🔔 **特売・底値アラート** — 登録商品がお買い得価格になったら通知（Phase 3 予定）

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フルスタック | Next.js 16 (App Router) / TypeScript / shadcn/ui / Tailwind CSS |
| DB | PostgreSQL 16 (Neon Serverless) / Prisma ORM |
| AI/OCR | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| 認証 | NextAuth.js (Auth.js) / Google OAuth |
| 画像ストレージ | Cloudflare R2 (`@aws-sdk/client-s3`) |
| ホスティング | Vercel (Hobby) |

## 開発ロードマップ

| Phase | 内容 |
|---|---|
| **Phase 1** | MVP — 全画像ソース（写真・チラシ・Instagram）→ OCR → 底値ダッシュボード |
| **Phase 2** | 高度チラシ機能 + 検索・フィルタ + UX改善 |
| **Phase 3** | 底値アラート + 特売通知 |
| **Phase 4** | 自動チラシ収集 + Instagram API検討 |
| **Phase 5** | React Native (Expo) モバイルアプリ化 |

## セットアップ

### 前提条件

- **Node.js 22 LTS**
- **npm**（パッケージマネージャ）
- Neon（クラウド PostgreSQL）のアカウント — ローカルDBは不要
- Google Cloud Console で OAuth 2.0 クライアントIDを取得済み
- Cloudflare R2 のバケット・APIキーを取得済み
- Google AI Studio で Gemini API キーを取得済み

### 環境変数

`.env.example` を参考に `.env.local`（Next.js 用）と `.env`（Prisma CLI 用）を作成してください。

```bash
# .env / .env.local 共通
DATABASE_URL="postgresql://..."     # Neon 接続文字列
DIRECT_URL="postgresql://..."       # Neon Direct 接続（マイグレーション用）

# .env.local のみ
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GEMINI_API_KEY="..."
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."
```

### ローカル起動

```bash
# 依存パッケージをインストール
npm install

# Prisma クライアントを生成
# ※ npm run db:generate（--no-engine 付き）ではなく、以下のコマンドを使用
npx prisma generate

# DB マイグレーション（初回のみ）
npx prisma migrate dev

# 開発サーバー起動（http://localhost:3000）
npm run dev
```

### ローカルビルド

```bash
# 本番ビルド
# ※ 事前に `npx prisma generate` を実行しておくこと
#   `npm run db:generate`（--no-engine 付き）で生成されたクライアントだと
#   ビルド時に PrismaClientValidationError が発生します
npm run build

# 本番モードで起動
npm start
```

### npm scripts 一覧

| コマンド | 用途 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm start` | 本番モード起動 |
| `npm run lint` | ESLint 実行 |
| `npm run type-check` | TypeScript 型チェック |
| `npm test` | Vitest テスト実行 |
| `npm run test:watch` | Vitest ウォッチモード |
| `npm run db:generate` | Prisma クライアント生成（`--no-engine`、WebSocket/Serverless用） |
| `npm run db:migrate` | マイグレーション実行 |
| `npm run db:push` | スキーマをDBに直接反映 |
| `npm run db:seed` | シードデータ投入 |

> **注意**: `npm run db:generate` は Neon Serverless Driver (WebSocket) 経由で接続するために `--no-engine` フラグ付きで Prisma クライアントを生成します。`npm run dev` はこれで動作しますが、`npm run build` を実行する場合はビルド前に `npx prisma generate`（フラグなし）を実行してください。

### デプロイ

- **ホスティング**: Vercel (Hobby)
- **自動デプロイ**: GitHub リポジトリ連携により、`main` ブランチへの push で本番デプロイ、その他のブランチ（`dev` 等）への push でプレビューデプロイが実行される
- Vercel 上では `@prisma/client` の postinstall フックが `prisma generate`（`--no-engine` なし）を自動実行するため、ビルドエラーは発生しない

## テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch
```

**テスト構成:**
- **Vitest** — テストランナー
- API Route Handler テスト（`src/app/api/**/route.test.ts`）
- サービスロジック テスト（`src/lib/*.test.ts`）
  - OCR（Gemini API モック）
  - 商品名寄せ（`normalizeProductName` 等）
  - 底値計算

## ドキュメント

- [要件定義書](docs/requirements.md)
- [実装計画](docs/plan.md)

## ライセンス

[MIT](LICENSE)

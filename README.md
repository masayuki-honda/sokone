# Sokone（底値）

チラシ・Instagram・店頭写真から商品価格を読み取り、底値データを蓄積・可視化するWebアプリ。

「本当に安いのか？」をデータで判断できるようにします。

## 主な機能

- 📸 **写真から価格を自動読み取り** — 店頭の値札・POP・チラシを撮影してアップロードするだけ
- 🤖 **AI による商品名・価格の自動抽出** — Google Gemini 2.0 Flash で OCR＋構造化抽出を一発実行
- 📉 **底値トラッキング** — 商品×店舗ごとの価格履歴を記録し、底値を自動特定
- 🏪 **店舗管理** — 自分の生活圏のスーパーを登録して、パーソナライズされた価格比較
- 🔔 **特売・底値アラート** — 登録商品がお買い得価格になったら通知

## 対象商品カテゴリ

酒類 / 肉類 / 野菜類 / 魚介類 / 卵 / 乳製品 / 飲料 / 調味料 / 冷凍食品 / 日用品

## 技術スタック

| レイヤー | 技術 |
|---|---|
| Frontend | Next.js 14+ / TypeScript / shadcn/ui / Tailwind CSS |
| Backend | Python 3.12 / FastAPI |
| DB | PostgreSQL / SQLAlchemy / Alembic |
| AI/OCR | Google Gemini 2.0 Flash（メイン）/ GPT-4o-mini（代替）/ Tesseract（フォールバック） |
| 認証 | NextAuth.js (Auth.js) / Google OAuth |
| インフラ | Docker Compose / Vercel / Cloudflare R2 |

## 開発ロードマップ

| Phase | 内容 |
|---|---|
| **Phase 1** | MVP — 写真アップロード → OCR → 底値ダッシュボード |
| **Phase 2** | チラシ対応 + 商品検索・フィルタ + UX改善 |
| **Phase 3** | Instagram連携 + 底値アラート + 特売通知 |
| **Phase 4** | 自動チラシ収集（スーパー公式サイト） |
| **Phase 5** | React Native / Flutter モバイルアプリ化 |

## セットアップ

### 前提条件

- Docker / Docker Compose
- Node.js 22 LTS
- Python 3.12

### 起動方法

```bash
# リポジトリをクローン
git clone https://github.com/<your-username>/sokone.git
cd sokone

# Docker Compose で起動
docker compose up -d
```

> 詳細なセットアップ手順は開発が進み次第追記します。

## ドキュメント

- [要件定義書](docs/requirements.md)

## ライセンス

[MIT](LICENSE)

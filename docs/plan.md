# Sokone 全Phase 実装計画

> 作成日: 2026-02-26
> 最終更新: 2026-03-09（ウォッチリスト・お買い得バッジ・マイグレーションスクリプト汎用化）
>
> **アーキテクチャ:** Next.js フルスタック + Prisma + Neon + Vercel

## 全体概要

| Phase | テーマ | 期間目安 | 状態 |
|---|---|---|---|
| **Phase 1** | MVP — 全画像ソース（写真・チラシ・Instagram・レシート）→OCR→底値ダッシュボード | 4〜6週間 | � 進行中 |
| **Phase 2** | 高度チラシ機能 + 検索・フィルタ + UX改善 | 3〜4週間 | 未着手 |
| **Phase 3** | 底値アラート + 特売通知 | 3〜4週間 | 未着手 |
| **Phase 4** | 自動チラシ収集 + バッチ処理 + Instagram API検討 | 継続的 | 未着手 |
| **Phase 5** | モバイルアプリ化（React Native / Expo） | 6〜8週間 | 未着手 |

---

# Phase 1: MVP（底値トラッカー基盤）

## 概要

全画像ソース（店頭写真・チラシ・Instagramスクショ・レシート）のアップロード → AI による OCR＋構造化抽出＋画像識別 → 底値ダッシュボードの基本フローを構築する。
チラシやInstagramのスクショット、店頭で撮影した写真、レシートなど、あらゆる画像ソースから商品名と価格を自動読み取り、底値を蓄積・表示できる状態をゴールとする。
チラシやInstagramは店に行かずともデータ収集・デバッグができるため、Phase 1 から全ソースに対応する。

**アーキテクチャ:** Next.js フルスタック（API Routes + Prisma + Neon + Vercel）

**期間目安:** 4〜6週間

---

## Sprint 構成

Phase 1 を 5 つの Sprint に分割する。各 Sprint はおおよそ 1 週間を想定。

---

## Sprint 0: プロジェクト基盤セットアップ（〜3日）

### 0-1. 開発環境構築

- [x] `.gitignore` 作成（Node.js + IDE）
- [x] ~~`docker-compose.yml` 作成~~ → 開発・本番ともに **Neon（クラウドPostgreSQL）** を使用。ローカルDBは不要
- [x] 環境変数テンプレート `.env.example` 作成
  - DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET
  - GEMINI_API_KEY
  - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

### 0-2. Next.js プロジェクト初期化

- [x] `npx create-next-app@latest` で Next.js 14+ プロジェクト作成（プロジェクトルートに直接配置）
  - App Router, TypeScript, Tailwind CSS, ESLint
- [x] shadcn/ui 初期セットアップ（手動設定: `components.json`, `src/lib/utils.ts`, CSS変数）
- [x] 基本レイアウト作成（ヘッダー、サイドバー、メインエリア）
- [x] NextAuth.js (Auth.js) インストール・設定
- [x] Prisma インストール・初期化
  - `npx prisma init`
  - `schema.prisma` に PostgreSQL 接続設定（Neon Serverless Driver 対応）
  - `src/lib/prisma.ts` — Prisma Client シングルトン
- [x] Cloudflare R2 クライアント設定
  - `@aws-sdk/client-s3` インストール
  - `src/lib/r2.ts` — R2 S3Client 初期化
- [x] sharp インストール（画像リサイズ・HEIC変換用）
- [x] ヘルスチェックエンドポイント `GET /api/health`（Route Handler）
- [x] CORS 設定（Next.js middleware で API ルートに CORS ヘッダー付与）

### 0-3. OCR 精度早期検証

- [ ] Google AI Studio で Gemini 2.0 Flash の画像読み取りを手動テスト
  - 値札写真 2〜3枚
  - チラシ画像 2〜3枚
  - レシート 2〜3枚
  - 野菜等テキストなし商品 1〜2枚
- [ ] 各ソースタイプでの抽出精度を記録（商品名/価格の正答率）
- [ ] 精度に問題があれば代替案（Cloud Vision + Gemini 2段構成）を検討
- [ ] プロンプトテンプレートのドラフト作成

### 0-4. CI/CD

- [x] `.github/workflows/ci.yml` 作成
  - lint (eslint) + type-check (tsc) + build
  - Vitest テスト実行
- [x] PR テンプレート作成

### 完了条件

- [x] `npm run dev` で Next.js アプリが起動する
- [x] `http://localhost:3000` でフロントエンドが表示される
- [x] `http://localhost:3000/api/health` が JSON レスポンスを返す
- [x] Prisma で Neon PostgreSQL に接続できる（マイグレーション適用済み）
- [x] Vercel デプロイ完了（https://sokone-sigma.vercel.app）
- [ ] R2 への画像アップロード・削除が動作する（Sprint 2 で実装）
- [ ] CI が Green で通る
- [ ] OCR 精度の初期評価が完了している（Sprint 2 で実施）

---

## Sprint 1: 認証 + データモデル + 店舗管理（〜1週間）

### 1-1. データベースモデル定義

- [x] Prisma スキーマ作成（`prisma/schema.prisma`）
  - `User` — id (UUID), email, name, image, google_id, created_at, updated_at
  - `Store` — id (UUID), name, address, latitude, longitude, user_id (FK), created_at, updated_at
  - `ProductCategory` — id, name, parent_id (自己参照FK), display_order
  - `Product` — id (UUID), name, normalized_name, category_id (FK), unit, volume, created_at
  - `ProductAlias` — id, product_id (FK), alias_name
  - `PriceRecord` — id (UUID), product_id (FK), store_id (FK), user_id (FK), price, unit_price, tax_included (bool), source_type (enum: photo/flyer/instagram/receipt), source_image_id (FK), recorded_at, created_at
  - `UploadedImage` — id (UUID), user_id (FK), store_id (FK, nullable), image_url, source_type, ocr_raw_text, ocr_result_json (Json), status (enum: pending/processed/failed), created_at
  - `FavoriteProduct` — id (UUID), user_id (FK), product_id (FK), display_order (int), created_at
    - @@unique([user_id, product_id])
- [x] Prisma マイグレーション作成・適用（Neon SQL Editor 経由で手動適用 ※ポート5432ブロック環境のため）
- [x] 初期カテゴリデータの seed スクリプト作成（`prisma/seed.ts`）
  - 酒類、肉類、野菜類、魚介類、卵、乳製品、飲料、調味料、冷凍食品、お菓子、日用品、その他

### 1-2. 認証（Google OAuth）

**Server:**
- [x] NextAuth.js 設定（`src/lib/auth.ts`）
  - Google Provider 設定
  - Prisma Adapter でユーザ・セッションを DB 管理
  - コールバック・セッション設定
- [x] NextAuth Route Handler（`src/app/api/auth/[...nextauth]/route.ts`）
- [x] 認証ミドルウェア（`proxy.ts`）— 未認証時のリダイレクト

**UI:**
- [x] ログインページ作成
- [x] ログイン/ログアウトボタン
- [x] 認証状態管理（SessionProvider）

### 1-3. 店舗管理 API + UI

**API (Route Handlers):**
- [x] `GET    /api/stores` — ユーザの店舗一覧（`src/app/api/stores/route.ts`）
- [x] `POST   /api/stores` — 店舗追加
- [x] `PUT    /api/stores/{id}` — 店舗更新（`src/app/api/stores/[id]/route.ts`）
- [x] `DELETE /api/stores/{id}` — 店舗削除

**UI:**
- [x] 店舗管理ページ（一覧 + 追加 + 編集 + 削除）
- [x] 店舗追加フォーム（店舗名、住所）
- [x] 店舗一覧カード/リスト表示

### 完了条件

- Google OAuth でログイン/ログアウトできる
- 店舗の CRUD が動作する
- Prisma マイグレーションが正常に適用される

---

## Sprint 2: 画像アップロード + OCR + 全ソース対応（〜1.5週間）

### 2-1. 画像アップロード

**API (Route Handlers):**
- [x] `POST /api/images/upload` — 画像アップロード（`src/app/api/images/upload/route.ts`）
  - JPEG, PNG, HEIC 対応
  - HEIC → JPEG 変換（sharp）
  - 画像リサイズ（長辺 1600px 以下に。API送信用）
  - **Cloudflare R2 に保存**（`src/lib/r2.ts` 経由）
  - `source_type` パラメータ: `photo`（店頭写真）/ `flyer`（チラシ）/ `instagram`（Instagramスクショ）/ `receipt`（レシート）
  - EXIF メタデータ抽出（`exifr` ライブラリ）
    - 撮影日時（DateTimeOriginal / CreateDate / ModifyDate）→ `taken_at` に保存
    - GPS 座標（GPSLatitude / GPSLongitude）→ `gps_latitude` / `gps_longitude` に保存
    - スクリーンショットは EXIF がないため自動スキップ
- [x] `POST /api/images/from-url` — URL指定で画像取得（`src/app/api/images/from-url/route.ts`）
  - URL からの画像ダウンロード
  - Content-Type 検証（画像であることを確認）
  - OGP画像のフォールバック取得
  - ダウンロード後は通常のアップロードと同じフローに合流（R2 保存）
  - セキュリティ対策: SSRF 防止（プライベートIPブロック）、ファイルサイズ上限（10MB）
- [x] `GET /api/images` — アップロード済み画像一覧
- [x] `GET /api/images/{id}` — 画像詳細（OCR結果含む）
- [x] R2 署名付きURL生成（画像の閲覧用）
- [x] `GET /api/stores/nearby` — GPS 座標から最寄り店舗を検索（Haversine 距離、半径 1km 以内）

**UI:**
- [x] 画像アップロードページ
  - ドラッグ & ドロップ + ファイル選択
  - 複数画像一括対応
  - アップロードプログレス表示
  - [x] **カメラ直接撮影ボタン**（`capture="environment"`）— AndroidでGoogleフォト経由を回避し直接カメラを起動
  - [x] **`accept="*/*"` ファイル選択ボタン**（「ファイルから選択」）— Androidのファイルマネージャーを起動してEXIF GPS情報を保持（GoogleフォtoはEXIFを削除するため）。クライアント側でMIME/拡張子検証を実施
  - [x] **Vercelコールドスタート対策**
    - ページ表示時に `/api/images/upload` と `/api/health` を並列でウォームアップリクエスト送信
    - ウォームアップ中はアップロードボタンを無効化（`isWarmingUp` フラグ）
    - ネットワークエラー発生時に指数バックオフリトライ（最大3回: 2s → 4s）
- [x] ソースタイプ選択UI
  - 📷 店頭写真 / 📰 チラシ / 📱 Instagramスクショ / 🧾 レシート の4タブ or セレクト
  - チラシ選択時はURL入力フォームも表示
- [x] URL入力フォーム＋プレビュー表示（チラシURL取り込み用）
  - URL貼り付け → 画像プレビュー → 店舗選択 → OCR実行
- [x] 店舗選択 UI（ハイブリッド方式）
  - 登録済み店舗リストから選択
  - 「新しい店舗を追加」インライン入力
  - 「あとで設定」スキップ
  - （GPS 自動候補は Sprint 2 では Optional） → ✅ EXIF GPS から最寄り店舗を自動提案（実装済み）

### 2-2. Gemini 2.0 Flash OCR 連携

**Server:**
- [x] `src/lib/ocr.ts` — OCR サービス
  - `@google/generative-ai` SDK で Gemini 2.0 Flash API クライアント実装
  - 画像 → Base64 エンコード → API 送信
  - プロンプト設計: 商品名・価格・単位・容量を JSON で返すよう指示
  - `buildPrompt(sourceType, categoryNames[])` 関数— DBカテゴリ一覧をプロンプト内の【カテゴリ一覧】セクションに動的注入
  - ソースタイプ別のプロンプト切り替え
  - レスポンスパース + バリデーション（Zod）
- [x] `POST /api/images/{id}/analyze` — OCR 実行エンドポイント（`src/app/api/images/[id]/analyze/route.ts`）
  - 画像アップロード後に手動 or 自動で OCR 実行
  - source_type に応じたプロンプト選択
  - 結果を `UploadedImage.ocr_result_json` に保存（Prisma）
- [x] OCR プロンプトテンプレート（共通ベース）
  ```
  以下の画像はスーパーマーケットの商品価格が写っています。
  画像から読み取れるすべての商品について、以下のJSON形式で出力してください。
  価格は税込価格で統一してください。税抜表示の場合は×1.10で計算してください。

  【重要】テキストだけでなく、写っている商品の見た目からも商品名を推定してください。
  例えば、野菜や果物など商品名のテキストラベルがない場合でも、
  画像に写っている商品の外見から「大根」「トマト」「りんご」等を識別し、
  近くの価格表示と紐付けてください。

  {
    "items": [
      {
        "name": "商品名",
        "price": 税込価格(数値),
        "unit": "単位(個/袋/本/パック/100g等)",
        "volume": "容量(350ml/1L等。不明ならnull)",
        "category_hint": "推定カテゴリ(酒類/肉類/野菜類/魚介類/卵/乳製品/飲料/調味料/冷凍食品/日用品)",
        "is_tax_included": true/false(元の表示が税込かどうか),
        "confidence": 0.0-1.0(読み取り確信度),
        "identified_by": "text/image/both(テキストから識別/画像から識別/両方)"
      }
    ]
  }
  ```
- [x] ソースタイプ別プロンプト補足
  - **チラシ（flyer）:** 「この画像はスーパーのチラシです。1枚の画像に複数商品が並んでいます。すべての商品を抽出してください。セール価格がある場合はセール価格を優先してください。」
  - **Instagram（instagram）:** 「この画像はスーパーのInstagram投稿のスクリーンショットです。Instagram UIの要素（いいね数、コメント欄、ユーザ名等）は無視し、投稿画像・テキスト内の商品名と価格情報のみを抽出してください。」
  - **店頭写真（photo）:** デフォルトプロンプト（補足なし）
  - **レシート（receipt）:** 「この画像は買い物のレシートです。レシートに記載されているすべての商品の商品名と購入価格を抽出してください。値引き・割引がある場合は割引後の価格を使用してください。小計・合計・ポイントなどの合算行は除外してください。レシート上部に記載されている店舗名も抽出してください。」
- [x] エラーハンドリング（API 障害時のリトライ、レートリミット対策）
  - Gemini API 429 (quota超過) 検出 → 日本語エラーメッセージ表示
  - OCRエラー詳細をUIに伝播

### 2-3. OCR 精度検証

- [ ] テスト画像セットの準備（各ソースタイプ 3〜5枚ずつ）
  - 値札写真、POP写真、棚全体写真（店頭写真）
  - チラシ画像（新聞折込、WEBチラシスクショ）
  - Instagramスクショ（セール投稿）
  - テキストラベルのない商品（野菜・果物コーナー）の写真
- [ ] Gemini Flash の抽出精度を評価（ソースタイプ別）
- [ ] 画像による商品識別の精度を評価（野菜・果物等）
- [ ] 精度不足の場合の代替案（Cloud Vision + Gemini 2段構成）を検討

### 完了条件

- 画像をアップロードできる（4つのソースタイプを選択可能）
- 画像が Cloudflare R2 に保存される
- チラシURLを指定して画像を取り込める
- アップロード画像に対して OCR が実行され、商品名・価格が JSON で返る
- テキストラベルのない商品（野菜等）も画像認識で識別される
- ソースタイプに応じた適切なプロンプトでOCRが実行される
- 店舗選択 UI が動作する

---

## Sprint 3: 抽出結果の確認・修正 + 価格登録（〜1週間）

### 3-1. OCR 結果確認・修正 UI

**UI:**
- [x] OCR 結果表示ページ
  - 元画像とOCR抽出結果を並べて表示
  - 各商品の編集フォーム（商品名、価格、単位、カテゴリを修正可能）
  - 商品の追加・削除（OCR が見逃した商品を手動追加）
  - 「すべて確認して登録」ボタン
- [x] 商品名のサジェスト
  - 既存の商品マスタから部分一致で候補表示
  - 新規商品の場合はそのまま登録
- [x] 解析結果画面での既存商品紐付けUI
  - 編集フォームのドロップダウンで既存商品を選択 → 登録時にその商品IDで紐付け
  - 紐付け済み商品は青いバッジで表示

### 3-2. 価格登録 API

**API (Route Handlers):**
- [x] `POST /api/prices` — 価格一括登録（`src/app/api/prices/route.ts`）
  - OCR 結果確認後、商品×価格のリストを一括登録
  - 商品マスタに未登録の商品は自動作成（findOrCreateProduct）
  - PriceRecord に店舗・日時・ソース情報を記録
- [x] `GET /api/prices` — 価格記録一覧（フィルタ: 商品ID, 店舗ID, 期間）
- [x] `GET /api/products` — 商品マスタ一覧（検索・フィルタ対応）
- [x] `GET /api/products/{id}` — 商品詳細（価格履歴込み）

### 3-3. 商品マスタ管理

**Server:**
- [x] `src/lib/product-matcher.ts` — 商品名寄せサービス
  - 完全一致 → 既存商品に紐付け
  - 部分一致・類似度（編集距離）→ 候補を提示
  - 新規商品 → 自動作成
- [x] 商品の正規化ルール
  - 全角→半角変換
  - スペース・記号の統一
  - 容量表記の正規化（350ｍｌ → 350ml）
- [x] 表記ゆれ対応: 価格登録時に入力商品名をエイリアスとして自動保存
  - `POST /api/prices` 登録時に入力商品名と正規化名が異なる場合 `ProductAlias` に追記

### 完了条件

- OCR 結果を確認・修正して価格を登録できる
- 登録済み商品名がサジェストされる
- PriceRecord が正しく DB に保存される

---

## Sprint 4: 底値ダッシュボード（〜1週間）

### 4-1. 底値計算ロジック

**Server:**
- [x] 底値計算サービス（`src/lib/bottom-price.ts`）
  - 商品ごとの全店舗での最安値（= 底値）を算出
  - 商品×店舗ごとの最安値
  - 平均価格、最新価格
  - 底値記録日
- [x] 底値ビュー or Prisma クエリ
  - `v_bottom_prices` — product_id, store_id, bottom_price, bottom_date, avg_price, latest_price, record_count
- [x] API エンドポイント（Route Handlers）
  - `GET /api/dashboard` — ダッシュボード概要データ
  - `GET /api/dashboard/products` — 商品別底値一覧（ページネーション、ソート、フィルタ）
  - `GET /api/products/{id}/price-history` — 商品の価格推移データ

### 4-2. ダッシュボード UI

**UI:**
- [x] ダッシュボードページ
  - **概要カード:** 登録商品数、登録店舗数、今月の登録件数、底値更新数
  - **お気に入り商品セクション:** ☆ピン留めした商品を最上部に優先表示（底値・最新価格・店舗名）
  - **検索バー:** 商品名の部分一致検索（デバウンス付き）
  - **最近の価格登録:** 直近登録した価格のリスト
  - **底値一覧テーブル:** 商品名、カテゴリ、底値、底値店舗、最新価格、平均価格
  - カテゴリフィルタ（タブ or ドロップダウン）
- [x] 商品詳細ページ
  - 店舗別価格比較テーブル
  - 底値ハイライト表示
  - 過去の価格記録一覧
  - **☆お気に入りボタン** — タップでお気に入り登録/解除
  - ソースバッジをクリックして元画像をライトボックス表示（`sourceImageId` 付き記録のみ）
  - カテゴリバッジをクリックして直接カテゴリ変更（`PATCH /api/products/{id}`）
- [x] 商品一覧に「✨ カテゴリ自動設定」ボタン追加（Geminiで未分類商品を一括分類）
  - `POST /api/products/auto-categorize` を呼び出し、20件バッチでカテゴリ設定
  - インデックス番号方式でGeminiに送信（UUIDではなくインデックス→ハルシネーション防止）

### 4-3. お気に入り商品機能

**API (Route Handlers):**
- [x] `POST /api/favorites` — お気に入り登録（`src/app/api/favorites/route.ts`）
  - body: `{ product_id }` → Prisma で `FavoriteProduct` 作成
- [x] `GET /api/favorites` — お気に入り一覧（底値情報付き）
  - 商品情報 + 底値 + 最新価格 + 店舗名を Prisma で join して返却
- [x] `DELETE /api/favorites/{product_id}` — お気に入り解除（`src/app/api/favorites/[productId]/route.ts`）
- [x] `PUT /api/favorites/order` — 表示順序変更（任意）

**Prisma モデル:**
- [x] `FavoriteProduct` モデル — id (UUID), user_id (FK), product_id (FK), display_order (int), created_at
  - @@unique([user_id, product_id])

### 4-4. 簡易商品検索

**API:**
- [x] `GET /api/products` に `q` クエリパラメータ追加
  - Prisma の `contains`（大文字小文字無視）で部分一致検索
  - `normalized_name` と `ProductAlias.alias_name` も検索対象
- [x] `GET /api/dashboard/products` にも `q` パラメータ追加

**UI:**
- [x] ダッシュボード・商品一覧に検索バー追加
  - デバウンス付き（300ms）インクリメンタル検索
  - 検索結果をリアルタイムでテーブルに反映

### 4-5. レスポンシブ対応

- [x] スマホ向けレイアウト最適化
  - モバイルファーストで各ページをチェック
  - ナビゲーション（ハンバーガーメニュー or ボトムナビ）
  - [x] 画像アップロードがスマホブラウザから快適に動作することを確認（Androidカメラ直接撮影・ファイル選択・GPS自動提案）

### 完了条件

- ダッシュボードにお気に入り商品が優先表示される
- 商品名で検索して絞り込める
- ダッシュボードに商品別の底値一覧が表示される
- 商品詳細で価格推移グラフが表示される
- スマホで一通りの操作（ログイン→アップロード→確認→ダッシュボード閲覧）ができる

---

## 横断タスク（各 Sprint と並行）

### テスト

- [x] Vitest で API Route Handler テスト（各エンドポイント）
- [x] OCR サービスのユニットテスト（モック使用）
- [ ] 主要コンポーネントの基本テスト（Testing Library）

### ドキュメント

- [ ] API 仕様書（補足ドキュメント）
- [x] 開発環境セットアップ手順を README に追記
- [x] `.env.example` の説明コメント

### DB ストレージ監視

- [x] `GET /api/admin/db-storage` — Neon のストレージ使用量を取得する API
  - PostgreSQL組み込み関数 `pg_database_size()` で使用量を取得（Prisma rawQuery）
  - 使用量 / 上限（0.5GB）の割合を返す
- [x] ダッシュボードにストレージ使用量インジケータを表示
  - 80% 超過でアラートバナー（黄色: 」DBストレージが残り少なくなっています「）
  - 90% 超過で警告バナー（赤: 」DBストレージの空きがほとんどありません「）

---

## API 一覧（Phase 1）

| Method | Path | Sprint | 説明 |
|---|---|---|---|
| GET | `/api/health` | 0 | ヘルスチェック |
| POST | `/api/auth/[...nextauth]` | 1 | NextAuth.js 認証 |
| GET | `/api/auth/[...nextauth]` | 1 | NextAuth.js セッション |
| GET | `/api/stores` | 1 | 店舗一覧 |
| POST | `/api/stores` | 1 | 店舗追加 |
| PUT | `/api/stores/{id}` | 1 | 店舗更新 |
| DELETE | `/api/stores/{id}` | 1 | 店舗削除 |
| POST | `/api/images/upload` | 2 | 画像アップロード |
| POST | `/api/images/from-url` | 2 | URL指定で画像取得 |
| GET | `/api/images` | 2 | アップロード画像一覧 |
| GET | `/api/images/{id}` | 2 | 画像詳細 |
| POST | `/api/images/{id}/analyze` | 2 | OCR 実行 |
| POST | `/api/prices/bulk` | 3 | 価格一括登録 |
| GET | `/api/prices` | 3 | 価格記録一覧 |
| GET | `/api/products` | 3 | 商品一覧 |
| GET | `/api/products/{id}` | 3 | 商品詳細 |
| GET | `/api/products/{id}/price-history` | 4 | 価格推移 |
| GET | `/api/dashboard` | 4 | ダッシュボード概要 |
| GET | `/api/dashboard/products` | 4 | 商品別底値一覧 |
| GET | `/api/categories` | 1 | カテゴリ一覧 |
| POST | `/api/favorites` | 4 | お気に入り登録 |
| GET | `/api/favorites` | 4 | お気に入り一覧 |
| DELETE | `/api/favorites/{product_id}` | 4 | お気に入り解除 |
| PUT | `/api/favorites/order` | 4 | お気に入り表示順序変更 |
| DELETE | `/api/prices/{id}` | 3 | 価格記録削除（誤登録修正） |
| PATCH | `/api/prices/{id}` | 7 | 価格記録更新（編集） |
| POST | `/api/products/{id}/merge` | 6 | 重複商品統合 |
| PATCH | `/api/products/{id}` | 6 | 商品汎用更新（カテゴリ変更等） |
| POST | `/api/products/auto-categorize` | 4 | 未分類商品をGeminiで一括カテゴリ設定 |
| GET | `/api/admin/db-storage` | 横断 | DB ストレージ使用量 |

---

## 技術メモ

### Gemini モデル管理

- モデルIDは `src/lib/gemini.ts` の `GEMINI_MODEL` 定数で一元管理
  - 現在: `"gemini-2.5-flash"`
  - モデルを変更する場合はこの1ファイルだけ修正すればOK
- `genAI`（`GoogleGenerativeAI` インスタンス）も同ファイルから export
- `src/lib/ocr.ts` と `src/app/api/products/auto-categorize/route.ts` が `@/lib/gemini` をインポート

### Gemini API プロンプト設計のポイント

- `response_mime_type: "application/json"` を指定して構造化出力を強制
- `response_schema` でレスポンスの型を厳密に定義
- 税込/税抜の判定もAIに任せ、税抜の場合は×1.10で換算するよう指示
- 画像の解像度: 長辺 1600px 程度にリサイズしてから送信（コスト削減 + 十分な精度）
- **画像識別:** テキストがない商品（野菜・果物等）も見た目から識別するようプロンプトで指示
- **ソースタイプ別プロンプト:** 店頭写真・チラシ・Instagramスクショそれぞれに最適化した補足プロンプトを付加

### 認証フロー

```
NextAuth.js (App Router)
    |
    |-- Google OAuth ログイン (NextAuth built-in)
    |-- Google 認証完了
    |-- Prisma Adapter で User/Session を DB に保存
    |-- セッション Cookie 発行
    |
    |-- API Route Handler 内で:
    |   const session = await getServerSession(authOptions)
    |   // session.user.id でユーザ識別
    |
    |-- Server Component 内で:
    |   const session = await getServerSession(authOptions)
    |   // SSR 時に認証状態を取得
```

### 画像保存方針

- Phase 1 からCloudflare R2 に保存（`@aws-sdk/client-s3` で S3 互換API 経由）
- R2 署名付きURL で画像を配信
- テスト画像は不要になったら `DeleteObject` で削除可能

### 底値計算ロジック

```typescript
// Prisma での底値計算例
const bottomPrices = await prisma.priceRecord.groupBy({
  by: ['productId'],
  _min: { price: true },
  _avg: { price: true },
  _count: { id: true },
});

// 商品ごとの最新価格は別途クエリ
const latestPrices = await prisma.priceRecord.findMany({
  where: { productId: { in: productIds } },
  orderBy: { recordedAt: 'desc' },
  distinct: ['productId'],
});
```

---

## リスク・注意事項

| リスク | 影響 | 対策 |
|---|---|---|
| Gemini Flash の OCR 精度が不十分 | 商品名・価格の誤認識 | Phase 1 で早期検証。Cloud Vision + Gemini の2段構成にフォールバック |
| チラシ画像のレイアウトが複雑 | 1回のOCRで全商品を抽出できない | 画像を分割して送信 or ユーザに対象範囲を指定させる |
| Gemini API レートリミット | 1分15リクエストの制限に達する | リトライ + キュー制御。複数画像は順次処理 |
| HEIC 画像の扱い | ブラウザ非対応形式 | sharp で JPEG に変換 |
| Google OAuth 設定 | GCP コンソールでの設定ミス | セットアップ手順をドキュメント化 |

---

## 成功基準（Phase 1 完了条件）

1. **ユーザが Google アカウントでログインできる**
2. **店舗を登録・管理できる**
3. **店頭写真・チラシ・Instagramスクショ・レシートの4種類のソースをアップロードできる**
4. **チラシURLを指定して画像を取り込める**
5. **アップロード画像から商品名と価格が自動抽出される（テキスト＋画像識別）**
6. **抽出結果を確認・修正して価格を登録できる**
7. **お気に入り商品をダッシュボード上部に優先表示できる**
8. **商品名で検索して絞り込める**
9. **ダッシュボードで商品別の底値一覧を閲覧できる**
10. **商品の価格推移グラフを閲覧できる**
11. **スマホブラウザで一通りの操作（ログイン→アップロード→確認→ダッシュボード閲覧）ができる**

---
---

# Phase 2: 高度チラシ機能＋検索・フィルタ＋UX改善

## 概要

Phase 1 で構築した全ソース対応の基盤を強化する。
大きなチラシ画像の分割処理、商品名寄せの改善、商品検索・フィルタの充実、
画像ストレージの外部化（Cloudflare R2）で、データ品質と使い勝手を底上げする。

**期間目安:** 3〜4週間
**前提:** Phase 1 完了

---

## Sprint 構成

### Sprint 5: チラシ高度機能（〜1週間）

#### 5-1. チラシ画像の分割・複雑レイアウト対応

**Server:**
- [x] 大きなチラシ画像の分割送信対応
  - 画像を4分割（10%オーバーラップ）して個別にOCR → 結果をマージ
  - 重複商品の除去ロジック（名前正規化＋価格一致で判定）
- [x] OCR プロンプトのチラシ対応強化
  - チラシ特有の複雑レイアウト（段組み、矢印、吹き出し等）に対応するプロンプト調整
  - 1枚の画像から10〜30商品を抽出するケースの精度向上
  - セール価格 vs 通常価格の識別強化、まとめ買い価格の単価換算

**UI:**
- [ ] チラシ抽出結果の一括編集UI改善
  - スプレッドシート風の一括編集
  - 画像上のハイライト表示（抽出位置の可視化）

### Sprint 6: 商品名寄せ改善＋カテゴリ管理（〜1週間）

#### 6-1. 商品名寄せの改善

**Server:**
- [x] `src/lib/product-matcher.ts` の強化
  - ルールベースマッチング改善
    - 全角半角統一、スペース正規化
    - ブランド名 + 容量での正規化（「金麦350ml6缶パック」→「金麦 350ml×6」）
    - 同義語辞書（60+グループ: 「鶏もも」=「とりもも」=「鶏モモ」等）
  - LLM による類似判定（Gemini Flash）
    - 候補商品リストを提示して「同じ商品か？」を判定
    - 確信度が低い場合はユーザに確認を求める
- [x] 商品マージ機能
  - `POST /api/products/{id}/merge` — 重複商品を統合（Prisma transaction）
  - 統合時に価格記録・エイリアスも移行
  - 商品一覧ページに「統合」ボタン追加（Dialog で統合先検索・選択→実行）

#### 6-2. カテゴリ管理UI

**API (Route Handlers):**
- [x] `GET /api/categories` — カテゴリツリー取得（既存の拡張）
- [x] `POST /api/categories` — カスタムカテゴリ追加
- [x] `PUT /api/categories/{id}` — カテゴリ編集
- [x] `DELETE /api/categories/{id}` — カテゴリ削除（商品0件の場合のみ）
- [x] 商品のカテゴリ変更 API（`PATCH /api/products/{id}` — categoryId 更新）

**UI:**
- [x] カテゴリ管理ページ（`/categories`）
  - カテゴリ一覧表示・追加・インライン編集・削除
  - 商品件数表示・削除制約バリデーション
- [x] 商品のカテゴリ変更UI（商品詳細ページでカテゴリバッジクリック→インラインセレクタ）

### Sprint 7: 商品検索・フィルタ＋UX改善（〜1週間）

#### 7-1. 商品検索・フィルタ

**API (Route Handlers):**
- [x] `GET /api/products` の拡張
  - 全文検索（Prisma の `search` / `contains`）
  - カテゴリフィルタ（「未分類」含む）、店舗フィルタ、ソート（底値順、名前順、記録数順 ＋ 昇降順切替）
  - ページネーション（カーソルベース）
- [x] `GET /api/dashboard/products` の拡張
  - 同様のフィルタ・ソート対応（storeId, sortBy, sortOrder パラメータ追加）

**UI:**
- [x] 商品一覧ページの大幅改善
  - 検索バー（インクリメンタルサーチ）
  - カテゴリタブ（「未分類」フィルタ追加）/ フィルタパネル（展開式）
  - 店舗フィルタ（ドロップダウン）
  - ソート切り替え（名前順/底値順/記録数順 ＋ 昇降順）
  - カーソルベースページネーション（「もっと読み込む」）
- [x] ダッシュボードのフィルタリング改善（店舗フィルタ・ソート切替を底値一覧に追加）

#### 7-2. UX 改善

**UI:**
- [x] ローディング表示の統一（Skeleton UI）
- [x] エラーハンドリングの統一（Toast通知）
- [x] 画像アップロード履歴ページ（`/uploads`）— フィルタ（ソースタイプ・ステータス）・ライトボックス・OCR結果サマリ表示
- [x] アップロード履歴: 画像削除ボタン（個別 `DELETE /api/images/{id}`）
- [x] アップロード履歴: 未登録画像を一括削除（`DELETE /api/images/cleanup`）
- [x] アップロード履歴: Radix DialogTitle アクセシビリティ修正・縦長画像でも見える閉じるボタン
- [x] 「最近見た商品」セクション追加（localStorage + 横スクロールカード）
- [x] PWA 基本設定（manifest.json、アイコン）→ ホーム画面に追加可能に
- [x] 同一画像の重複アップロード検出（SHA-256 + localStorage + 確認ダイアログ）
- [x] 重複検知強化: fileHashをDBに保存・`GET /api/images/hashes`でサーバー側ハッシュをseed
- [x] カテゴリ管理: ↑↓ボタンで表示順を変更（displayOrder入れ替え）→ **DnD操作に置換済み**
- [x] カテゴリ管理: ドラッグ&ドロップで表示順を変更（@dnd-kit/sortable + `PUT /api/categories/reorder`）
- [x] 商品一覧: 底値を商品名横に表示（肉類＋volumeがXgの場合 ¥Y/100g 表示）
- [x] **店舗にtokubaiショップURL登録機能**
  - 店舗管理フォームに「tokubaiショップURL」入力欄追加
  - `Store` テーブルに `tokubai_shop_url` カラム追加
  - `ScrapedLeaflet` テーブル新規（処理済チラシID根拠・重複防止）
- [x] **tokubaiチラシ自動スクレイピング（手動トリガー）**
  - `POST /api/stores/{id}/scrape` — tokubai店舗ページをスクレイプし「`bargain_office_leaflets`」画像を自動吭取得
  - `cheerio` で静的HTMLをパース（Playwright不要）
  - マルチページ対応（`?page=N` リトライ）、リクエスト間隔制御（800ms）
  - 取得画像は R2アップロード → `UploadedImage`番変 `flyer` で登録、その後アップロード履歴からOCR実行
  - 店舗カードに「🗹 チラシ取得」ボタン追加（tokubai URLが設定済みの店舗のみ表示）
- [x] バッチアップロード（5枚/リクエスト）— Vercel 4.5MB制限回避のため複数ファイルを分割送信
- [x] アップロード10枚制限UX — onDropRejected でファイル数超過・サイズ超過・形式エラーを日本語メッセージ表示
- [x] OCRプロンプト改善: 「商談時使用売価」等の業者向け価格を除外するよう指示追加
- [x] 価格履歴インライン編集・削除（商品詳細ページ）— 日付・店舗・価格を編集フォームで修正可能
- [x] OCR `category_hint` 動的化 — DBのカテゴリ一覧を取得してプロンプトに注入（`buildPrompt()` 関数追加）

### 追加 API（Phase 2）

| Method | Path | Sprint | 説明 |
|---|---|---|---|
| POST | `/api/products/{id}/merge` | 6 | 商品マージ |
| POST | `/api/categories` | 6 | カテゴリ追加 ✅ |
| PUT | `/api/categories/{id}` | 6 | カテゴリ編集 ✅ |
| DELETE | `/api/categories/{id}` | 6 | カテゴリ削除 ✅ |
| DELETE | `/api/images/{id}` | 6 | 画像個別削除 ✅ |
| DELETE | `/api/images/cleanup` | 6 | 未登録画像一括削除 ✅ |
| GET | `/api/images/hashes` | 6 | ユーザーの既存ファイルハッシュ一覧 ✅ |
| PUT | `/api/categories/reorder` | 7 | カテゴリ並び替え（DnD） ✅ |
| PATCH | `/api/prices/{id}` | 7 | 価格記録更新（編集）✅ |
| POST | `/api/stores/{id}/scrape` | 7 | tokubaiチラシ自動取得 ✅ |
| GET | `/api/stores/{id}/scrape` | 7 | 取得済みチラシ一覧 ✅ |
| GET | `/api/watch-keywords` | - | ウォッチキーワード一覧 ✅ |
| POST | `/api/watch-keywords` | - | ウォッチキーワード追加 ✅ |
| DELETE | `/api/watch-keywords/{id}` | - | ウォッチキーワード削除 ✅ |

### 成功基準（Phase 2 完了条件）

1. **大きなチラシ画像を分割して高精度にOCRできる**
2. **商品名の表記ブレが自動的に名寄せされる**
3. **カテゴリ別・店舗別・価格帯で商品を検索できる**
4. **スマホのホーム画面に追加できる（PWA）**

---
---

# Phase 3: 底値アラート＋特売通知

## 概要

底値アラートと特売情報通知機能を実装し、ユーザが能動的に確認しなくても
お買い得情報を受け取れるようにする。価格推移グラフの充実と店舗間比較機能も追加する。

**期間目安:** 3〜4週間
**前提:** Phase 2 完了

---

## Sprint 構成

### Sprint 8: 通知基盤＋底値アラート（〜1週間）

#### 8-1. 通知基盤構築

**Server:**
- [ ] 通知サービス基盤
  - `Notification` モデル — id, user_id, type (enum), title, body, data (Json), is_read, created_at
  - `NotificationPreference` モデル — user_id, notification_type, enabled, channel (email/push/in_app)
- [ ] メール送信基盤
  - メール送信サービス（SendGrid or Resend — 無料枠あり）
  - メールテンプレート管理
- [ ] アプリ内通知
  - `GET /api/notifications` — 通知一覧
  - `PUT /api/notifications/{id}/read` — 既読処理
  - `GET /api/notifications/unread-count` — 未読数

**UI:**
- [ ] ヘッダーに通知ベルアイコン + 未読バッジ
- [ ] 通知ドロップダウン（最新通知一覧）
- [ ] 通知一覧ページ
- [ ] 通知設定ページ（メール通知 ON/OFF、通知対象カテゴリ設定）

### Sprint 9: 底値アラート＋特売情報通知（〜1週間）

#### 9-1. 底値アラート

**Server:**
- [x] 底値ウォッチリスト
  - `PriceWatch` モデル — user_id, product_id, target_price (nullable), enabled
  - `POST /api/watches` — ウォッチ登録
  - `GET /api/watches` — ウォッチ一覧
  - `DELETE /api/watches/{id}` — ウォッチ解除
  - `PATCH /api/watches/{id}` — ウォッチ更新（targetPrice, enabled）
  - `GET /api/watches/check?productId=xxx` — ウォッチ状態確認
- [ ] 底値判定ロジック
  - 価格登録時に自動チェック: `新価格 <= 既存底値` なら底値更新通知
  - ウォッチ対象商品なら個別通知
- [ ] 底値更新通知
  - アプリ内通知 + メール（ユーザ設定に応じて）
  - 通知内容: 「{商品名}が{店舗名}で底値更新！ ¥{価格}（前回底値: ¥{旧価格}）」

**UI:**
- [x] 商品詳細ページに「ウォッチする」ボタン追加
- [x] ウォッチリスト管理ページ（`/watches`）
- [ ] 底値更新のハイライト表示（ダッシュボード上）

#### 9-2. 特売情報通知

**Server:**
- [x] 特売判定ロジック
  - 価格登録時に動的判定: `新価格 <= 底値 × 1.10`（底値+10%以内）なら「お買い得」判定
  - 判定結果をクエリ時に動的計算（スキーマ変更不要）
  - 商品ごとに最安のお買い得のみ返却
- [x] `GET /api/deals` — 現在のお買い得商品一覧
  - 直近7日間の「お買い得」判定された価格記録

**UI:**
- [x] ダッシュボードに「今週のお買い得」セクション追加
- [ ] お買い得商品一覧ページ
- [x] 価格登録時に「お買い得！」バッジ表示（トースト通知でお買い得件数表示）

### Sprint 10: 価格推移グラフ充実＋店舗間比較（〜1週間）

#### 10-1. 価格推移グラフの充実

**UI:**
- [x] グラフ改善（recharts 導入）
  - 期間切り替え（1ヶ月 / 3ヶ月 / 6ヶ月 / 1年 / 全期間）
  - 底値ライン表示（水平線）
  - 平均価格ライン表示
  - 店舗別の折れ線を色分け表示
  - データポイントのツールチップ（日付、価格）

#### 10-2. 店舗間価格比較機能

**Server:**
- [x] `GET /api/products/{id}/compare` — 店舗間価格比較データ
  - 各店舗の最新価格、底値、平均価格を一覧化

**UI:**
- [ ] 商品詳細ページに店舗間比較テーブル追加
  - 店舗名、最新価格、底値、平均価格、記録数
  - 最安店舗のハイライト
- [ ] 「どこが一番安い？」ビュー
  - 選択した複数商品の最安店舗を一覧表示

### 追加 API（Phase 3）

| Method | Path | Sprint | 説明 |
|---|---|---|---|
| GET | `/api/notifications` | 8 | 通知一覧 |
| PUT | `/api/notifications/{id}/read` | 8 | 通知既読 |
| GET | `/api/notifications/unread-count` | 8 | 未読数 |
| POST | `/api/watches` | 9 | ウォッチ登録 ✅ |
| GET | `/api/watches` | 9 | ウォッチ一覧 ✅ |
| DELETE | `/api/watches/{id}` | 9 | ウォッチ解除 ✅ |
| PATCH | `/api/watches/{id}` | 9 | ウォッチ更新 ✅ |
| GET | `/api/watches/check` | 9 | ウォッチ状態確認 ✅ |
| GET | `/api/deals` | 9 | お買い得商品一覧 ✅ |
| GET | `/api/products/{id}/compare` | 10 | 店舗間比較 ✅ |

### 成功基準（Phase 3 完了条件）

1. **商品をウォッチリストに登録できる**
2. **底値が更新されたらアプリ内通知＋メールで通知される**
3. **お買い得商品（底値+10%以内）が自動判定され通知される**
4. **価格推移グラフで期間切り替え・店舗別表示ができる**
5. **店舗間の価格比較テーブルが表示される**

---
---

# Phase 4: 自動チラシ収集＋バッチ処理＋Instagram API検討

## 概要

主要スーパーの公式サイトからチラシ画像を自動取得し、OCR→価格登録を自動化する。
定期バッチ処理により、ユーザが手動で情報収集しなくても底値データが蓄積される状態を目指す。
また、Instagram Graph API の連携可能性を調査・検討する。

**期間目安:** 継続的（基盤2〜3週間 + スクレイパー追加は随時）
**前提:** Phase 3 完了

---

## Sprint 構成

### Sprint 11: スクレイピング基盤＋バッチ実行基盤（〜1.5週間）

#### 11-1. スクレイピング基盤

**Server:**
- [ ] スクレイパーインターフェース設計
  ```typescript
  interface BaseScraper {
    getFlyerImages(storeUrl: string): Promise<FlyerImage[]>;
    supports(storeUrl: string): boolean;
  }
  ```
- [ ] スクレイパーレジストリ（URLパターンから適切なスクレイパーを選択）
- [ ] Playwright (Node.js) でのスクレイピング実装
- [ ] robots.txt 準拠チェック
- [ ] User-Agent 設定、リクエスト間隔制御（Polite scraping）
- [ ] スクレイピング結果の保存
  - `ScrapingJob` モデル — id, store_id, status, started_at, completed_at, error_log
  - `ScrapedFlyer` モデル — id, job_id, image_url, local_image_path, processed (bool)

#### 11-2. 主要スーパーのスクレイパー実装（初期2〜3店舗）

- [x] **tokubai.co.jp 対応**（`src/lib/tokubai-scraper.ts`）
  - `cheerio` でサーバーサイドレンダリング済みHTMLを直接パース（Playwright 不要）
  - 店舗ページ → リーフレットIDリスト取得 → 各リーフレットページから `bargain_office_leaflets` 画像URL 抽出
  - マルチページ対応（`?page=N` リトライ）、リクエスト間隔制御（800ms）
  - 現状: **手動トリガーで動作済**。自動スケジュールは未実装。
- [ ] イオン系（イオン、マックスバリュ等）— tokubai.co.jp 経由で対応可能か検討
- [ ] イトーヨーカドー — tokubai.co.jp 経由で対応可能か検討
- [ ] 共通: チラシ画像のURL抽出 → ダウンロード → OCR パイプラインに投入

#### 11-3. バッチ実行基盤

**Server:**
- [ ] タスクキュー導入（BullMQ + Redis or Vercel Cron Jobs）
  - チラシ取得ジョブ
  - OCR 実行ジョブ
  - 通知送信ジョブ
- [ ] スケジューラー設定（Vercel Cron or 外部スケジューラ）
  - チラシ自動取得: 毎日朝7時に実行
  - 週次サマリ通知: 毎週月曜朝8時
- [ ] ジョブ管理 API
  - `GET /api/admin/jobs` — ジョブ一覧・実行状況
  - `POST /api/admin/jobs/{id}/retry` — 失敗ジョブのリトライ
- [ ] Redis 導入検討（Upstash 等のサーバーレスRedis）

### Sprint 12: 自動パイプライン＋Instagram API 検討（〜1.5週間）

#### 12-1. 自動チラシ→OCR→登録パイプライン

**Server:**
- [ ] パイプラインオーケストレーション
  1. スクレイパーでチラシ画像取得
  2. 画像を R2 にアップロード
  3. Gemini Flash で OCR＋構造化抽出
  4. 商品名寄せ実行
  5. 価格記録を PriceRecord に自動登録（source_type: "auto_flyer"）
  6. 底値判定 → 該当商品のウォッチャーに通知
- [ ] 自動登録された価格の信頼度管理
  - confidence スコアに基づく自動承認/手動確認の振り分け
  - confidence < 0.7 の場合はユーザの確認待ちキューに入れる
- [ ] 重複登録防止
  - 同一チラシの重複取得を検知（画像ハッシュ比較）

#### 12-2. 店舗のスクレイパー設定UI

**UI:**
- [ ] 店舗詳細ページに「自動チラシ取得設定」追加
  - 公式サイトURL入力
  - 対応スクレイパーの自動検出表示
  - 取得頻度設定（毎日 / 週1 等）
  - 最終取得日時・ステータス表示
- [ ] 管理ダッシュボード（自動取得の実行状況一覧）

#### 12-3. Instagram Graph API 検討

- [ ] Meta Developer アカウント申請
- [ ] Instagram Graph API の利用可能範囲を調査
  - ビジネスアカウントの投稿取得が可能か
  - レートリミットの確認
- [ ] 実現可能であれば基本的な連携実装
- [ ] 不可の場合はスクショアップロード方式を継続（Phase 3 のまま）

### 追加 API（Phase 4）

| Method | Path | Sprint | 説明 |
|---|---|---|---|
| GET | `/api/admin/jobs` | 11 | ジョブ一覧 |
| POST | `/api/admin/jobs/{id}/retry` | 11 | ジョブリトライ |
| PUT | `/api/stores/{id}/scraping` | 12 | スクレイピング設定更新 |
| GET | `/api/stores/{id}/scraping/status` | 12 | スクレイピング状況 |

### リスク・注意事項（Phase 4 固有）

| リスク | 影響 | 対策 |
|---|---|---|
| スクレイピング対象サイトの構造変更 | スクレイパーが動かなくなる | エラー監視 + 構造変更検知アラート |
| スクレイピングが利用規約で禁止 | 法的リスク | robots.txt 準拠、公式サイトの利用規約を事前確認 |
| Instagram Graph API 審査不通過 | 自動取得不可 | スクショアップロード方式を継続 |
| バッチ処理のインフラコスト増 | Redis の追加コスト | ホスティング先の無料枠・低コスト枠内で運用、Vercel Cron Jobs 活用、必要に応じてスケール |

### 成功基準（Phase 4 完了条件）

1. **2〜3店舗のチラシが自動取得される**
2. **取得したチラシから自動的に商品・価格が抽出・登録される**
3. **自動登録の信頼度が低い場合はユーザに確認が求められる**
4. **バッチジョブの実行状況を管理画面で確認できる**
5. **店舗ごとに自動取得の ON/OFF・頻度を設定できる**

---
---

# Phase 5: モバイルアプリ化

## 概要

React Native（Expo）を使い、Android / iOS ネイティブアプリを開発する。
Web 版の既存バックエンド API をそのまま利用し、モバイル特有の機能（カメラ直接起動、Push通知、GPS）を追加する。

**期間目安:** 6〜8週間
**前提:** Phase 3 以上が完了していること（Phase 4 は並行可能）

---

## 技術選定

| 項目 | 選定 | 理由 |
|---|---|---|
| **フレームワーク** | **React Native (Expo)** | Web 版が React (Next.js) なのでコード・知識を共有しやすい |
| **言語** | TypeScript | Web 版と統一 |
| **ナビゲーション** | Expo Router | ファイルベースルーティング（Next.js と概念が近い） |
| **UI** | React Native Paper or Tamagui | shadcn/ui の思想に近いカスタマイズ性 |
| **状態管理** | TanStack Query | Web 版と同じデータフェッチ層 |
| **Push通知** | Expo Notifications + Firebase Cloud Messaging | Android/iOS 両対応 |
| **カメラ** | Expo Camera | カメラ直接起動に対応 |

## Sprint 構成

### Sprint 13: Expo プロジェクトセットアップ＋認証（〜1.5週間）

#### 13-1. プロジェクト基盤

- [ ] Expo プロジェクト初期化（`npx create-expo-app`）
- [ ] `mobile/` ディレクトリとして追加
- [ ] TypeScript 設定
- [ ] Expo Router セットアップ
- [ ] UI ライブラリ導入
- [ ] 共通コンポーネント作成（ヘッダー、ボトムナビ、カード等）
- [ ] API クライアント共通層（axios / fetch ラッパー）
- [ ] 環境変数管理（`app.config.ts`）

#### 13-2. 認証

- [ ] Google OAuth（Expo AuthSession）
- [ ] JWT トークンの Secure Storage 保存
- [ ] 自動トークンリフレッシュ
- [ ] ログイン / ログアウト画面
- [ ] 認証状態によるナビゲーションガード

### Sprint 14: コア画面移植（〜1.5週間）

#### 14-1. ダッシュボード

- [ ] 底値概要カード
- [ ] 最近の価格登録リスト
- [ ] 商品別底値一覧（FlatList）
- [ ] プルリフレッシュ対応

#### 14-2. 商品一覧・検索

- [ ] 商品一覧（カテゴリタブ付き）
- [ ] 検索バー（デバウンス付き）
- [ ] フィルタ（ボトムシート）

#### 14-3. 商品詳細

- [ ] 価格推移グラフ（react-native-chart-kit or Victory Native）
- [ ] 店舗間比較テーブル
- [ ] ウォッチ登録ボタン

#### 14-4. 店舗管理

- [ ] 店舗一覧・追加・編集・削除

### Sprint 15: カメラ撮影→OCR フロー（〜1.5週間）

#### 15-1. カメラ統合

- [ ] カメラ直接起動 → 撮影 → プレビュー
- [ ] フォトライブラリからの画像選択
- [ ] 撮影画像の自動リサイズ・圧縮
- [ ] 複数枚連続撮影対応

#### 15-2. アップロード→OCR→確認フロー

- [ ] 店舗選択UI（ハイブリッド方式をモバイル最適化）
  - GPS から近くの店舗を自動候補（ネイティブ GPS）
  - 最近使った店舗を上位表示
- [ ] アップロードプログレス表示
- [ ] OCR 結果の確認・修正画面（モバイル最適化）
  - スワイプで商品切替
  - 大きめのタッチターゲット
- [ ] 価格登録完了 → ダッシュボードへ遷移

#### 15-3. オフライン対応

- [ ] 撮影した写真のローカルキュー保存
- [ ] ネットワーク復帰時に自動アップロード
- [ ] オフライン状態のUI表示

### Sprint 16: Push通知＋仕上げ（〜1.5週間）

#### 16-1. Push通知

**Server:**
- [ ] FCM（Firebase Cloud Messaging）連携
- [ ] デバイストークン登録 API
  - `POST /api/devices` — デバイストークン登録
  - `DELETE /api/devices/{token}` — トークン削除
- [ ] 通知送信サービスに Push チャネル追加

**Mobile:**
- [ ] Expo Notifications セットアップ
- [ ] Push通知受信ハンドラー
- [ ] 通知タップ → 該当画面への遷移（Deep Link）
- [ ] 通知設定画面

#### 16-2. 仕上げ・テスト

- [ ] Android ビルド（EAS Build）
- [ ] iOS ビルド（EAS Build）
- [ ] E2E テスト（Detox or Maestro）
- [ ] パフォーマンス最適化
  - 画像のキャッシュ戦略
  - リストの仮想化確認
  - 起動時間の最適化
- [ ] アプリアイコン・スプラッシュスクリーン
- [ ] ストア申請準備
  - Google Play Store（内部テスト→公開）
  - Apple App Store（TestFlight→公開）

### リポジトリ構成（Phase 5 追加分）

```
sokone/
├── ...（既存）
├── mobile/                        # React Native (Expo)
│   ├── app/                       # Expo Router (screens)
│   │   ├── (tabs)/               # タブナビゲーション
│   │   │   ├── index.tsx         # ダッシュボード
│   │   │   ├── search.tsx        # 商品検索
│   │   │   ├── camera.tsx        # カメラ/アップロード
│   │   │   └── settings.tsx      # 設定
│   │   ├── product/[id].tsx      # 商品詳細
│   │   ├── store/                # 店舗関連
│   │   └── login.tsx             # ログイン
│   ├── components/               # 共通コンポーネント
│   ├── lib/                      # API クライアント、ユーティリティ
│   ├── hooks/                    # カスタムフック
│   ├── app.config.ts
│   ├── package.json
│   └── tsconfig.json
```

### 追加 API（Phase 5）

| Method | Path | Sprint | 説明 |
|---|---|---|---|
| POST | `/api/devices` | 16 | デバイストークン登録 |
| DELETE | `/api/devices/{token}` | 16 | デバイストークン削除 |

### 成功基準（Phase 5 完了条件）

1. **Android / iOS でアプリをインストールできる**
2. **カメラ直接起動 → 撮影 → OCR → 価格登録のフローがシームレス**
3. **GPS で近くの店舗が自動候補表示される**
4. **底値更新・特売情報の Push 通知を受け取れる**
5. **オフラインで撮影した写真がネットワーク復帰時に自動アップロードされる**
6. **Web 版と同等の底値閲覧・検索機能が利用できる**

---
---

# 全 Phase API 一覧

| Phase | Method | Path | 説明 |
|---|---|---|---|
| 1 | GET | `/api/health` | ヘルスチェック |
| 1 | POST | `/api/auth/[...nextauth]` | NextAuth.js 認証 |
| 1 | GET | `/api/auth/[...nextauth]` | NextAuth.js セッション |
| 1 | GET | `/api/stores` | 店舗一覧 |
| 1 | POST | `/api/stores` | 店舗追加 |
| 1 | PUT | `/api/stores/{id}` | 店舗更新 |
| 1 | DELETE | `/api/stores/{id}` | 店舗削除 |
| 1 | POST | `/api/images/upload` | 画像アップロード |
| 1 | POST | `/api/images/from-url` | URL指定で画像取得 |
| 1 | GET | `/api/images` | アップロード画像一覧 |
| 1 | GET | `/api/images/{id}` | 画像詳細 |
| 1 | POST | `/api/images/{id}/analyze` | OCR 実行 |
| 1 | POST | `/api/prices/bulk` | 価格一括登録 |
| 1 | GET | `/api/prices` | 価格記録一覧 |
| 1 | GET | `/api/products` | 商品一覧 |
| 1 | GET | `/api/products/{id}` | 商品詳細 |
| 1 | GET | `/api/products/{id}/price-history` | 価格推移 |
| 1 | GET | `/api/dashboard` | ダッシュボード概要 |
| 1 | GET | `/api/dashboard/products` | 商品別底値一覧 |
| 1 | GET | `/api/categories` | カテゴリ一覧 |
| 1 | POST | `/api/favorites` | お気に入り登録 |
| 1 | GET | `/api/favorites` | お気に入り一覧 |
| 1 | DELETE | `/api/favorites/{product_id}` | お気に入り解除 |
| 1 | POST | `/api/products/auto-categorize` | 未分類商品をGeminiで一括カテゴリ設定 |
| 1 | PATCH | `/api/products/{id}` | 商品汎用更新（カテゴリ変更等） |
| 1 | POST | `/api/products/{id}/merge` | 重複商品統合 |
| 2 | POST | `/api/products/{id}/merge` | 商品マージ |
| 2 | POST | `/api/categories` | カテゴリ追加 |
| 2 | PUT | `/api/categories/{id}` | カテゴリ編集 |
| 2 | DELETE | `/api/categories/{id}` | カテゴリ削除 |
| 2 | DELETE | `/api/images/{id}` | 画像個別削除 |
| 2 | DELETE | `/api/images/cleanup` | 未登録画像一括削除 |
| 2 | GET | `/api/images/hashes` | 既存ファイルハッシュ一覧 |
| 2 | DELETE | `/api/prices/{id}` | 価格記録削除 |
| 2 | PATCH | `/api/prices/{id}` | 価格記録更新（編集） |
| 2 | PUT | `/api/categories/reorder` | カテゴリ並び替え（DnD） |
| 2 | POST | `/api/stores/{id}/scrape` | tokubaiチラシ自動取得 |
| 2 | GET | `/api/stores/{id}/scrape` | 取得済みチラシ一覧 |
| 3 | GET | `/api/notifications` | 通知一覧 |
| 3 | PUT | `/api/notifications/{id}/read` | 通知既読 |
| 3 | GET | `/api/notifications/unread-count` | 未読数 |
| 3 | POST | `/api/watches` | ウォッチ登録 |
| 3 | GET | `/api/watches` | ウォッチ一覧 |
| 3 | DELETE | `/api/watches/{id}` | ウォッチ解除 |
| 3 | GET | `/api/deals` | お買い得商品一覧 |
| 3 | GET | `/api/products/{id}/compare` | 店舗間比較 |
| 4 | GET | `/api/admin/jobs` | ジョブ一覧 |
| 4 | POST | `/api/admin/jobs/{id}/retry` | ジョブリトライ |
| 4 | PUT | `/api/stores/{id}/scraping` | スクレイピング設定 |
| 4 | GET | `/api/stores/{id}/scraping/status` | スクレイピング状況 |
| 5 | POST | `/api/devices` | デバイストークン登録 |
| 5 | DELETE | `/api/devices/{token}` | デバイストークン削除 |

---
---

# 将来構想（Phase 6以降 / 検討中）

下記は現時点では実装予定なしだが、将来的に検討する構想として残す。

## Amazon / Rakuten 自動価格ウォッチ（Q1）

### 概要

Amazon・Rakuten 等のオンラインショッピングサイトの商品ページを定期的に取得し、
実店の底値データとクロスチェックできるようにする。

### 検討事項

- [ ] Amazon Product Advertising API 利用資格要件の確認
  - アソシエイトプログラムへの登録が必要
  - 電商アフィリエイト報酬の制度上の制約を調査
- [ ] Rakuten API （楽天商品検索 API）での価格取得可能性調査
- [ ] スクレイピングと API どちらが実現性が高いか检討

### 実装イメージ（検討後）

**Server:**
- [ ] オンライン価格取得サービス（`src/lib/online-price.ts`）
  - Amazon / Rakuten から商品の現在価格を取得
  - `OnlinePrice` モデル — product_id, source (amazon/rakuten), url, price, fetched_at
- [ ] 定期バッチ取得（Vercel Cron Jobs）
  - お気に入り商品を毎日自動取得
- [ ] 実店底値との比較表示 API
  - `GET /api/products/{id}/online-prices` — オンライン価格履歴

**UI:**
- [ ] 商品詳細ページに「Amazon/Rakuten 最安値」表示カード追加
- [ ] 実店底値 vs オンライン価格の比較グラフ
- [ ] 「オンラインの方が安い!」アラート通知

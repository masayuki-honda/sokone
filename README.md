# Sokone（底値）

チラシ・Instagram・店頭写真から商品価格をAIで読み取り、底値データを蓄積・可視化するWebアプリ + モバイルアプリ（React Native / Expo）。

「本当に安いのか？」をデータで判断できるようにします。

## 主な機能

- 📸 **写真・チラシ・Instagramから価格を自動読み取り** — 店頭写真・チラシ画像・Instagramスクショをアップロードするだけ
- 🤖 **AI による商品名・価格の自動抽出** — Google Gemini 2.5 Flash で OCR＋構造化抽出＋画像識別を一発実行
- 📉 **底値トラッキング** — 商品×店舗ごとの価格履歴を記録し、底値を自動特定
- ⭐ **お気に入り・検索** — よく買う商品をピン留めして優先表示、商品名で素早く検索
- 🏪 **店舗管理** — 自分の生活圏のスーパーを登録して、パーソナライズされた価格比較
- 🔔 **底値アラート・特売通知** — 登録商品がお買い得価格になったらアプリ内通知＋メール通知
- 📊 **価格推移グラフ** — 期間切り替え・店舗別表示・底値ライン表示
- 🗞️ **自動チラシ収集** — tokubai.co.jp からチラシを自動取得 → OCR → 価格登録（Vercel Cron）
- 📱 **モバイルアプリ** — React Native (Expo) でカメラ直接撮影 → アップロード → OCR → 価格登録

## 技術スタック

| レイヤー | 技術 |
|---|---|
| **Web フルスタック** | Next.js 16 (App Router) / TypeScript / shadcn/ui / Tailwind CSS |
| **DB** | PostgreSQL 16 (Neon Serverless) / Prisma ORM |
| **AI/OCR** | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| **認証** | NextAuth.js (Auth.js) / Google OAuth |
| **画像ストレージ** | Cloudflare R2 (`@aws-sdk/client-s3`) |
| **メール** | Resend（底値・特売通知メール） |
| **ホスティング** | Vercel (Hobby) |
| **モバイル** | React Native (Expo SDK 55) / Expo Router / React Native Paper |

## 開発ロードマップ

| Phase | 内容 | 状態 |
|---|---|---|
| **Phase 1** | MVP — 全画像ソース → OCR → 底値ダッシュボード | ✅ 完了 |
| **Phase 2** | 高度チラシ機能 + 検索・フィルタ + UX改善 | ✅ 完了 |
| **Phase 3** | 底値アラート + 特売通知 + 価格推移グラフ | ✅ 完了 |
| **Phase 4** | 自動チラシ収集 + バッチ処理 | ✅ 完了 |
| **Phase 5** | React Native (Expo) モバイルアプリ化 | 🔄 進行中 |

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

### ローカル起動（Web）

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

---

## モバイルアプリ セットアップ（Android / iOS）

### 概要

`mobile/` ディレクトリに React Native (Expo SDK 55) のモバイルアプリがあります。
Web 版の既存バックエンド API をそのまま利用し、モバイル特有の機能（カメラ直接起動、GPS 自動候補）を追加しています。

### 前提条件

- Web 版のバックエンド（Next.js）がローカルまたは Vercel で稼働していること
- **Android の場合**: Android 端末（または Android エミュレータ）
- **iOS の場合**: iOS 端末（または iOS シミュレータ、Mac のみ）

### Step 1: Google Cloud Console で OAuth クライアントIDを作成

Google OAuth でモバイルからログインするには、**プラットフォームごとのクライアントID** が必要です。

#### 1-1. Google Cloud Console を開く

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. Web 版で使用しているプロジェクトを選択
3. 左メニュー「APIとサービス」→「認証情報」を開く

#### 1-2. Web クライアントID（既存のものを確認）

- Web 版で作成済みの「OAuth 2.0 クライアント ID」（ウェブアプリケーション）がそのまま使えます
- **クライアントID**（`xxxxx.apps.googleusercontent.com` 形式）をメモ → `EXPO_PUBLIC_GOOGLE_CLIENT_ID` に使用

#### 1-3. Android クライアントIDを作成

1. 「認証情報を作成」→「OAuth クライアント ID」をクリック
2. アプリケーションの種類: **Android**
3. 名前: `Sokone Android`（任意）
4. パッケージ名: `com.sokone.mobile`
5. **SHA-1 証明書フィンガープリント** の取得方法:

   **Expo Go で開発テストする場合**:

   Expo Go のデバッグ用 SHA-1 は固定値です:
   ```
   SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```
   > Expo 公式ドキュメントの [Google Sign-In](https://docs.expo.dev/guides/google-authentication/) に記載されています

   **EAS Build でリリースビルドする場合**（後日）:
   ```bash
   # EAS で自動生成されたキーストアの SHA-1 を確認
   eas credentials -p android
   ```

6. 「作成」をクリック → **クライアントID をメモ** → `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` に使用

#### 1-4. iOS クライアントIDを作成（iOS を使う場合）

1. 「認証情報を作成」→「OAuth クライアント ID」をクリック
2. アプリケーションの種類: **iOS**
3. 名前: `Sokone iOS`（任意）
4. バンドルID: `com.sokone.mobile`
5. 「作成」をクリック → **クライアントID をメモ** → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` に使用

### Step 2: モバイルの環境変数を設定

```bash
cd mobile
cp .env.example .env
```

`.env` を開いて以下を設定:

```env
# バックエンド API の URL（以下のいずれかを設定）
# ・Vercel デプロイ済み（推奨）: https://sokone-sigma.vercel.app
# ・ローカル開発（LAN接続可能な場合）: http://192.168.x.x:3000
# ・ローカル開発（VPN等でLAN不可の場合）: ngrok トンネルURL（後述）
EXPO_PUBLIC_API_BASE_URL=https://sokone-sigma.vercel.app

# Step 1-2 でメモした Web クライアントID
EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

# Step 1-3 で作成した Android クライアントID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxxxx.apps.googleusercontent.com

# Step 1-4 で作成した iOS クライアントID（iOS の場合）
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

> **`EXPO_PUBLIC_API_BASE_URL` の選び方**
>
> | 環境 | 設定値 | 備考 |
> |---|---|---|
> | Vercel デプロイ済み（推奨） | `https://sokone-sigma.vercel.app` | ネットワーク制約なし。最も簡単 |
> | ローカル（同一LAN、VPNなし） | `http://192.168.x.x:3000` | `ipconfig` で LAN IP を確認 |
> | ローカル（VPN/社内NW） | ngrok トンネルURL | 下記「VPN環境での開発」参照 |
> | Android エミュレータ | `http://10.0.2.2:3000` | エミュレータ→ホスト固有アドレス |

### Step 3: 依存パッケージのインストール

```bash
cd mobile
npm install
```

### Step 4: 開発サーバーの起動

```bash
# Web バックエンドが起動していることを確認（別ターミナルで）
# cd <プロジェクトルート> && npm run dev
# ※ Vercel デプロイ済みバックエンドを使う場合はローカル起動不要

# モバイル開発サーバーを起動
cd mobile
npx expo start
```

ターミナルにQRコードが表示されます。

#### VPN環境・社内ネットワークでの開発

会社VPNに接続中などで PC と Android 端末が直接通信できない場合は、**tunnel モード** を使います。

**バックエンドに Vercel を使う場合（推奨）:**

バックエンドは Vercel 経由でインターネットからアクセスできるため、Expo の開発サーバーだけ tunnel にすればOKです。

```bash
# mobile/.env に設定
# EXPO_PUBLIC_API_BASE_URL=https://sokone-sigma.vercel.app

# tunnel モードで起動（ngrok 経由でQRコードが生成される）
cd mobile
npx expo start --tunnel
```

> 初回実行時に `@expo/ngrok` のインストールを求められるので `y` で承認してください

`dev` ブランチに push すれば Vercel のプレビューデプロイが自動更新されるので、バックエンドの変更もリアルタイムに反映できます。

**ローカルバックエンドも tunnel にする場合:**

バックエンドのコードをローカルで変更しながらテストしたい場合は、ngrok でバックエンドもトンネルします。

```bash
# ターミナル1: Next.js 起動
npm run dev

# ターミナル2: ngrok でバックエンドをトンネル
npx ngrok http 3000
# → https://xxxx.ngrok-free.app のようなURLが発行される
```

発行されたURLを `mobile/.env` に設定:
```env
EXPO_PUBLIC_API_BASE_URL=https://xxxx.ngrok-free.app
```

```bash
# ターミナル3: Expo を tunnel モードで起動
cd mobile
npx expo start --tunnel
```

---

## Android へのインストール・実行方法

### 方法 A: Expo Go アプリで実行（開発テスト用、最も簡単）

Expo Go は Expo の開発ビルドを実機で即座に実行できるクライアントアプリです。
**APK のビルドや Android Studio は不要** で、QRコードを読むだけで動きます。

#### 手順

1. **Android 端末に Expo Go をインストール**
   - Google Play Store で「[Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)」を検索してインストール

2. **ネットワーク接続を確認**
   - **同一 LAN の場合**: PC と Android 端末を同じ Wi-Fi に接続
   - **VPN/社内NW の場合**: Android 端末はインターネットに接続できればOK（tunnel モードを使用）

3. **Expo 開発サーバーを起動**
   ```bash
   cd mobile

   # 同一 LAN の場合
   npx expo start

   # VPN/社内NW の場合（tunnel モード）
   npx expo start --tunnel
   ```

4. **QRコードを読み取る**
   - Android 端末の **Expo Go アプリ** を開く
   - 「Scan QR code」をタップ
   - PC のターミナルに表示された QR コードを読み取る
   - アプリが自動的にダウンロード・起動されます

5. **動作確認**
   - ログイン画面が表示されたら「Google でログイン」をタップ
   - Google アカウントで認証 → ダッシュボードが表示されれば成功

> **トラブルシューティング**:
> - QR コードが読めない場合: ターミナルで `s` キーを押して Expo アカウントでログインし、「My Projects」からアクセス
> - 接続エラーの場合: `EXPO_PUBLIC_API_BASE_URL` が正しいか確認（Vercel URL or LAN IP）
> - VPN 環境の場合: `--tunnel` オプションを付けて `npx expo start --tunnel` で起動
> - ファイアウォールにブロックされる場合: Windows Defender ファイアウォールで Node.js のプライベートネットワーク通信を許可

### 方法 B: Android エミュレータで実行

Android Studio のエミュレータを使う方法です。実機がない場合に便利です。

#### 前提

- [Android Studio](https://developer.android.com/studio) がインストール済み
- Android Studio の SDK Manager で以下がインストール済み:
  - Android SDK（API 34 以上推奨）
  - Android SDK Build-Tools
  - Android Emulator
  - Android SDK Platform-Tools
- AVD Manager でエミュレータが作成済み（Pixel 7 等）

#### 手順

1. **環境変数の設定**（初回のみ）

   Windows の場合、システム環境変数に以下を追加:
   ```
   ANDROID_HOME = C:\Users\<ユーザー名>\AppData\Local\Android\Sdk
   ```
   PATH に追加:
   ```
   %ANDROID_HOME%\platform-tools
   %ANDROID_HOME%\emulator
   ```

2. **エミュレータを起動**
   - Android Studio → Device Manager → エミュレータの「▶」ボタン
   - またはコマンドラインから:
     ```bash
     emulator -avd <AVD名>
     ```

3. **Expo 開発サーバーを起動**
   ```bash
   cd mobile
   npx expo start
   ```

4. **エミュレータに接続**
   - ターミナルで `a` キーを押す → 自動的にエミュレータで Expo Go が起動しアプリが開きます

> エミュレータの場合 `EXPO_PUBLIC_API_BASE_URL` は `http://10.0.2.2:3000` にすると PC の localhost にアクセスできます（Android エミュレータ固有の仕組み）

### 方法 C: EAS Build で APK / AAB をビルド（リリース用、後日）

ストアに公開する場合や、Expo Go では動かないネイティブモジュールを使う場合は EAS Build を使います。
Sprint 16 で実施予定です。

```bash
# EAS CLI をグローバルインストール
npm install -g eas-cli

# Expo アカウントにログイン
eas login

# Android APK ビルド（ローカル配布用）
eas build -p android --profile preview

# ビルド完了後、APK のダウンロードURLが表示される
# → Android 端末でダウンロード → インストール
```

---

## iOS での実行方法

### Expo Go で実行（Mac 不要）

1. iOS 端末に App Store から「[Expo Go](https://apps.apple.com/app/expo-go/id982107779)」をインストール
2. PC と iOS 端末を同じ Wi-Fi に接続（VPN 環境の場合は `--tunnel` を使用）
3. `cd mobile && npx expo start`（または `npx expo start --tunnel`）でサーバー起動
4. iOS のカメラアプリで QR コードを読み取る → Expo Go で開く

### iOS シミュレータで実行（Mac のみ）

```bash
cd mobile
npx expo start --ios
# または起動後に i キーを押す
```

---

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

## プロジェクト構成

```
sokone/
├── src/
│   ├── app/                    # App Router pages + API Routes
│   │   ├── api/                # Route Handlers（REST API）
│   │   └── ...                 # ページ（dashboard, stores, products 等）
│   ├── components/             # React components (shadcn/ui 含む)
│   ├── lib/                    # サービスロジック、ユーティリティ
│   ├── hooks/                  # Custom hooks
│   └── types/                  # TypeScript types
├── prisma/                     # DB スキーマ、マイグレーション、シード
├── mobile/                     # React Native (Expo) モバイルアプリ
│   ├── app/                    # Expo Router（画面）
│   ├── lib/                    # API クライアント、認証、設定
│   └── types/                  # TypeScript 型定義
├── docs/                       # 要件定義書、実装計画
└── public/                     # 静的ファイル
```

## ドキュメント

- [要件定義書](docs/requirements.md) — 機能一覧、データモデル、技術スタック
- [実装計画](docs/plan.md) — 全Phase実装計画（Sprint単位のタスク、API一覧、完了条件）

## ライセンス

[MIT](LICENSE)

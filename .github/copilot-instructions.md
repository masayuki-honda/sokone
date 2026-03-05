# Copilot Instructions for Sokone

## プロジェクト概要

Sokone（底値）は、チラシ・Instagram・店頭写真から商品価格をAIで読み取り、底値データを蓄積・可視化するWebアプリ。
日本語UIの個人向けアプリケーション。

## ドキュメント

実装前に必ず以下を参照すること：

- `docs/requirements.md` — 要件定義書（機能一覧、データモデル、技術スタック）
- `docs/plan.md` — 全Phase実装計画（Sprint単位のタスク、API一覧、完了条件）

## 技術スタック

### Next.js フルスタック

- **Next.js 14+**（App Router + Route Handlers）+ **TypeScript**
- **Prisma** (ORM) — PostgreSQL 接続、マイグレーション管理
- **NextAuth.js (Auth.js)** — Google OAuth認証（セッションベース）
- **@google/generative-ai** — Gemini 2.0 Flash API（OCR + 構造化抽出）
- **sharp** — 画像リサイズ・HEIC→JPEG変換
- **shadcn/ui** + **Tailwind CSS**
- **Node.js 22 LTS**
- パッケージマネージャ: npm

### データベース

- **PostgreSQL 16** on **Neon** (Free tier, 0.5GB)
- **@neondatabase/serverless** — Neon Serverless Driver

### 画像ストレージ

- **Cloudflare R2** — S3互換API（`@aws-sdk/client-s3`）
- 無料枠: 10GB ストレージ / 月

### ホスティング

- **Vercel** (Hobby) — 無料（非商用個人利用）

### 開発環境

- 開発・本番ともに **Neon**（クラウドPostgreSQL）を使用。ローカルDBは不要
- Next.js は `npm run dev` でローカル起動
- ローカルポート: App `3000`
- **シード実行:** Neon 無料枝は TCP ポート 5432 をブロックする場合があるため、WebSocket Adapter を使用する `npx tsx prisma/seed.ts` で実行する（`npx prisma db seed` は直接TCPのため失敗する場合あり）

## コーディング規約

### 共通

- コード内のコメント・変数名・関数名は **英語**
- UI テキスト・ユーザ向けメッセージは **日本語**
- Git コミットメッセージは **日本語** で書く
- ファイル名は **kebab-case**（例: `product-matcher.ts`, `price-history.tsx`）

### Git 操作

- Git 操作は **`git` コマンド**および **`gh` CLI** を使用すること
- GUI ツールや VS Code の Git 機能ではなく、ターミナルでコマンドを実行する
- **GitKraken MCP ツールは使用しない**（`mcp_gitkraken_*` 系のツールは呼び出さないこと）
- コミットメッセージは **日本語** で、変更内容が分かるように書く
- ブランチ戦略: `main`（本番）/ `dev`（開発）/ `feature/*`（機能ブランチ）
- PR マージは **squash を使わない**（`gh pr merge <id> --merge`）— コミット履歴をそのまま保持する
- **コミット前に必ず `npx tsc --noEmit` を実行**し、TypeScript コンパイルエラーがゼロであることを確認してからコミットする。エラーがある状態でコミットしてはならない

### TypeScript / Next.js

- **strict モード** 有効
- **App Router** を使用（`src/app/`）
- API Route Handlers は `src/app/api/` に配置
- コンポーネントは `src/components/` に配置
- `"use client"` は必要なコンポーネントのみに指定
- サービスロジック・ユーティリティは `src/lib/` に配置
- shadcn/ui コンポーネントは `src/components/ui/` に配置
- カスタムフックは `src/hooks/` に配置
- Prisma スキーマは `prisma/schema.prisma` に配置
- linter: **ESLint** (Next.js default)
- テスト: **Vitest** + **Testing Library**

```tsx
// コンポーネントの例
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  productId: string;
  onFavorite: (id: string) => void;
}

export function FavoriteButton({ productId, onFavorite }: Props) {
  // ...
}
```

```typescript
// API Route Handler の例
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...
}
```

## アーキテクチャ

### ディレクトリ構成

```
sokone/
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/ci.yml
├── docs/
│   ├── requirements.md
│   ├── plan.md
│   └── hosting-review.md
├── src/
│   ├── app/                   # App Router pages + API Routes
│   │   ├── api/               # Route Handlers
│   │   ├── auth/              # 認証関連ページ (signin/)
│   │   ├── dashboard/         # ダッシュボード
│   │   ├── stores/            # 店舗管理
│   │   ├── products/          # 商品一覧
│   │   ├── products/[id]/     # 商品詳細
│   │   ├── upload/            # 画像アップロード
│   │   └── layout.tsx
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui
│   │   ├── header.tsx
│   │   ├── ocr-results-view.tsx   │   ├── store-list.tsx│   │   └── session-provider.tsx
│   ├── lib/                   # サービスロジック、ユーティリティ
│   │   ├── prisma.ts          # Prisma client
│   │   ├── auth.ts            # NextAuth 設定
   │   ├── gemini.ts          # Geminiクライアント・モデルID一元管理 (GEMINI_MODEL)
   │   ├── ocr.ts             # OCR処理 (Gemini Flash)
   │   ├── r2.ts              # Cloudflare R2 クライアント
   │   ├── product-matcher.ts # 商品名寄せ
   │   ├── bottom-price.ts    # 底値計算サービス
   │   ├── geocode.ts         # GPS座標・近辺店舐検索
   │   ├── image-processing.ts # 画像リサイズ・HEIC変換 (sharp)
   │   └── utils.ts           # 共通ユーティリティ
│   ├── hooks/                 # Custom hooks
│   └── types/                 # TypeScript types
├── prisma/
│   ├── schema.prisma          # DB スキーマ定義
│   └── seed.ts                # 初期カテゴリデータ投入（`npx tsx prisma/seed.ts`）
├── public/
├── package.json
├── tsconfig.json
└── .env.example
```

### API 設計方針

- Next.js Route Handlers で RESTful API を実装（`/api/` プレフィックス）
- レスポンスは JSON（`NextResponse.json()`）
- 認証は NextAuth.js のセッションで管理（`getServerSession()`）
- ページネーション: カーソルベース（Phase 2 以降）
- エラーレスポンスの形式を統一

### DB 設計方針

- UUID を主キーに使用
- `created_at`, `updated_at` を全テーブルに設定
- 論理削除は使わない（物理削除）
- 価格は **整数**（円単位、税込）で保存

### OCR/AI

- メイン: **Gemini 2.5 Flash**（`@google/generative-ai` Node.js SDK）
- **モデルIDの一元管理**: `src/lib/gemini.ts` の `GEMINI_MODEL` 定数を変更するだけで全体に反映
- 無料枠: 1日1,500リクエスト / 1分15リクエスト
- フォールバック: GPT-4o-mini → Tesseract + Ollama
- 画像は **sharp** で長辺 1600px にリサイズしてから送信
- ソースタイプ（店頭写真/チラシ/Instagram/レシート）に応じてプロンプトを切り替え
- テキストがない商品（野菜等）は画像の見た目からAIが商品名を推定

## 進捗管理

### plan.md のチェック更新ルール

実装が完了したタスクは `docs/plan.md` のチェックボックスを更新する：

```diff
- - [ ] ヘルスチェックエンドポイント `GET /api/health`
+ - [x] ヘルスチェックエンドポイント `GET /api/health`
```

- 実装完了し、**動作確認済み**のタスクのみチェックを入れる
- Sprint 内のすべてのタスクが完了したら「完了条件」セクションも確認する
- チェック更新はコード変更と同じコミットに含めてよい

### ドキュメントの整合性維持

コード変更に伴い、関連ドキュメントを **常に最新の状態に保つ** こと：

- 技術スタック・アーキテクチャを変更した場合 → `docs/requirements.md`、`copilot-instructions.md` を更新
- 機能の追加・変更・削除を行った場合 → `docs/requirements.md`、`docs/plan.md` を更新
- API エンドポイントを追加・変更した場合 → `docs/plan.md` の API 一覧を更新
- ディレクトリ構成を変更した場合 → `copilot-instructions.md` のディレクトリ構成を更新
- ドキュメントの更新はコード変更と **同じコミットまたは同じ PR** に含める
- ドキュメントとコードの間に矛盾がある場合、**コードの実態を正** としてドキュメントを修正する

**Copilot の行動規則**:
- 実装変更を行ったら、コミット前に必ず関連ドキュメントの更新が必要か確認する
- ドキュメント更新が必要な場合は、ユーザーに確認を求めず自律的に更新してコミットに含める
- 「ドキュメントも更新しました」と報告してから次へ進む

## 重要な制約

- **税込価格に統一**（税抜表示は ×1.08 or ×1.10 で換算）
- **Google OAuth のみ**（MVPではメール/パスワード認証なし）
- **月額コスト 〜1,000円以内** を目指す（可能な限り無料枠を活用）
- Gemini Flash のレートリミット: 1分15リクエスト、1日1,500リクエスト
- 画像ストレージ: **Cloudflare R2**（Phase 1 から使用）

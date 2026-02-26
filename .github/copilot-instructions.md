# Copilot Instructions for Sokone

## プロジェクト概要

Sokone（底値）は、チラシ・Instagram・店頭写真から商品価格をAIで読み取り、底値データを蓄積・可視化するWebアプリ。
日本語UIの個人向けアプリケーション。

## ドキュメント

実装前に必ず以下を参照すること：

- `docs/requirements.md` — 要件定義書（機能一覧、データモデル、技術スタック）
- `docs/plan.md` — 全Phase実装計画（Sprint単位のタスク、API一覧、完了条件）

## 技術スタック

### Frontend（`frontend/`）

- **Next.js 14+**（App Router）+ **TypeScript**
- **shadcn/ui** + **Tailwind CSS**
- **NextAuth.js (Auth.js)** — Google OAuth認証
- **Node.js 22 LTS**
- パッケージマネージャ: npm

### Backend（`backend/`）

- **Python 3.12** + **FastAPI**
- **SQLAlchemy** (ORM) + **Alembic** (マイグレーション)
- **PostgreSQL 16**
- **google-generativeai** — Gemini 2.0 Flash API
- パッケージ管理: `requirements.txt` or `pyproject.toml`

### 開発環境

- **Docker Compose** — PostgreSQL + FastAPI + Next.js を一括起動
- ローカルポート: Frontend `3000`, Backend `8000`, PostgreSQL `5432`

## コーディング規約

### 共通

- コード内のコメント・変数名・関数名は **英語**
- UI テキスト・ユーザ向けメッセージは **日本語**
- Git コミットメッセージは **日本語** で書く
- ファイル名は **kebab-case**（例: `product-matcher.py`, `price-history.tsx`）

### Python / FastAPI

- **型ヒント必須** — すべての関数に引数・戻り値の型を明記
- Pydantic モデルで API スキーマ定義（`app/schemas/`）
- SQLAlchemy モデルは `app/models/` に配置
- ビジネスロジックは `app/services/` に分離
- API エンドポイントは `app/api/` に配置
- 非同期: `async def` を基本とする
- linter: **ruff**
- テスト: **pytest** + **httpx** (AsyncClient)
- エラーレスポンスは FastAPI の `HTTPException` を使用

```python
# API エンドポイントの例
@router.post("/", response_model=StoreResponse, status_code=201)
async def create_store(
    store_in: StoreCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StoreResponse:
```

### TypeScript / Next.js

- **strict モード** 有効
- **App Router** を使用（`src/app/`）
- コンポーネントは `src/components/` に配置
- `"use client"` は必要なコンポーネントのみに指定
- APIクライアントは `src/lib/` に配置
- shadcn/ui コンポーネントは `src/components/ui/` に配置
- カスタムフックは `src/hooks/` に配置
- linter: **ESLint** (Next.js default)

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

## アーキテクチャ

### ディレクトリ構成

```
sokone/
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/ci.yml
├── docs/
│   ├── requirements.md
│   └── plan.md
├── frontend/                  # Next.js
│   └── src/
│       ├── app/               # App Router pages
│       ├── components/        # React components
│       │   └── ui/            # shadcn/ui
│       ├── lib/               # API client, utils
│       ├── hooks/             # Custom hooks
│       └── types/             # TypeScript types
├── backend/                   # FastAPI
│   ├── app/
│   │   ├── api/               # APIエンドポイント
│   │   ├── core/              # 設定、認証、依存関数
│   │   ├── models/            # SQLAlchemy モデル
│   │   ├── schemas/           # Pydantic スキーマ
│   │   ├── services/          # ビジネスロジック
│   │   │   ├── ocr.py         # OCR処理 (Gemini Flash)
│   │   │   ├── price_extractor.py
│   │   │   └── product_matcher.py
│   │   └── main.py
│   ├── alembic/               # DBマイグレーション
│   └── tests/
├── docker-compose.yml
└── .env.example
```

### API 設計方針

- RESTful API（`/api/` プレフィックス）
- レスポンスは JSON
- 認証が必要なエンドポイントは JWT Bearer トークンで保護
- ページネーション: カーソルベース（Phase 2 以降）
- エラーレスポンスの形式を統一

### DB 設計方針

- UUID を主キーに使用
- `created_at`, `updated_at` を全テーブルに設定
- 論理削除は使わない（物理削除）
- 価格は **整数**（円単位、税込）で保存

### OCR/AI

- メイン: **Gemini 2.0 Flash**（無料枠: 1日1,500リクエスト）
- フォールバック: GPT-4o-mini → Tesseract + Ollama
- 画像は長辺 1600px にリサイズしてから送信
- ソースタイプ（店頭写真/チラシ/Instagram）に応じてプロンプトを切り替え
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

## 重要な制約

- **税込価格に統一**（税抜表示は ×1.08 or ×1.10 で換算）
- **Google OAuth のみ**（MVPではメール/パスワード認証なし）
- **月額コスト 〜1,000円以内** を目指す（可能な限り無料枠を活用）
- Gemini Flash のレートリミット: 1分15リクエスト、1日1,500リクエスト
- 画像ストレージ: Phase 1 はローカル（`/uploads/`）、Phase 2 で R2 に移行

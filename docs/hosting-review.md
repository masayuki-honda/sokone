# Sokone ホスティング構成 検討結果

> 調査日: 2026-02-26

## 1. 調査背景

- 要件定義では Docker Compose（ローカル開発用）のみ記載されており、本番デプロイのタスクが plan.md に含まれていなかった
- スマホから出先で使えるようにするため、本番環境へのデプロイが必須
- 要件: 月額コスト〜1,000円以内（可能な限り無料枠を活用）

## 2. 調査対象サービス

### 2.1 Frontend ホスティング

#### Vercel（Hobby プラン）— ✅ 採用確定

| 項目 | 内容 |
|---|---|
| **月額** | **$0（無料）** |
| **プラン名** | Hobby |
| **制約** | 非商用・個人利用のみ |
| **クレカ** | 不要 |
| **主なリソース** | Edge Requests 100万/月、Fast Data Transfer 100GB/月、Active CPU 4時間/月 |
| **カスタムドメイン** | 50個/project |
| **デプロイ** | GitHub 連携で自動デプロイ |
| **超過時** | 課金ではなく機能停止（翌月リセット） |
| **Sokone適合性** | ◎ 個人利用・少人数なので無料枠で十分 |

- 根拠: [vercel.com/pricing](https://vercel.com/pricing), [Hobby Plan ドキュメント](https://vercel.com/docs/accounts/plans/hobby)
- 公式記載: "The Hobby plan is free and aimed at developers with personal projects"
- Fair Use: "Hobby teams are restricted to non-commercial personal use only"

---

### 2.2 Backend + DB ホスティング

#### Railway（Hobby プラン）— 有料

| 項目 | 内容 |
|---|---|
| **月額** | **$5（約750円）** |
| **含まれるリソース使用クレジット** | $5/月 |
| **リソース上限** | 48 vCPU, 48 GB RAM, 5 GB Volume |
| **スリープ** | なし |
| **カスタムドメイン** | あり |
| **PostgreSQL** | ワンクリックでデプロイ可能 |

- 根拠: [railway.com/pricing](https://railway.com/pricing), [Plans ドキュメント](https://docs.railway.com/reference/pricing/plans)
- 公式FAQ: "Is the hobby plan free? **No.** The Hobby Plan is $5 a month, and it includes a resource usage credit of $5. Even if you do not use the $5 in usage, **you always pay the $5 subscription fee**."
- 使用量が $5 以下 → 請求 $5 のみ。超過分は追加課金。

#### Render（Free プラン）— 無料だが制約大

| 項目 | 内容 |
|---|---|
| **月額** | **$0** |
| **Web Service** | 0.1 vCPU, 512 MB RAM |
| **スリープ** | **15分無アクセスでスリープ（起動に約1分）** |
| **PostgreSQL Free** | **30日で期限切れ・削除される** |
| **カスタムドメイン** | あり |
| **永続ディスク** | 不可（Free では） |

- 根拠: [render.com/pricing](https://render.com/pricing), [Free ドキュメント](https://render.com/docs/free)
- 致命的問題: PostgreSQL が30日で強制期限切れ。データが消える。
- スリープ問題: "Render spins down a Free web service that goes 15 minutes without receiving any inbound traffic."

#### Fly.io — 無料プラン廃止済み

| 項目 | 内容 |
|---|---|
| **月額** | Pay As You Go（従量課金のみ） |
| **無料プラン** | **廃止済み**（Legacy Hobby plan は新規不可） |
| **クレカ** | 必須 |
| **最小構成の見積もり** | shared-cpu-1x 256MB ≈ $1.94/月 + Volume $0.15/GB/月 |

- 根拠: [fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/)
- "Fly.io no longer offers plans to new customers."
- レガシー無料枠（3 VM + 3GB volume）は既存ユーザのみ。

#### Koyeb — 無料プランなし

| 項目 | 内容 |
|---|---|
| **最低月額** | **$29（Pro）** |
| **無料プラン** | なし |

- 根拠: [koyeb.com/pricing](https://www.koyeb.com/pricing)

---

### 2.3 データベース単体（外部 PostgreSQL）

#### Neon（Free プラン）— ✅ 無料構成の候補

| 項目 | 内容 |
|---|---|
| **月額** | **$0** |
| **ストレージ** | 0.5 GB/project |
| **コンピュート** | 100 CU-hours/月/project |
| **スリープ** | 5分無アクセスでスリープ（起動 350ms と高速） |
| **データ永続性** | 期限なし（Render と違い消えない） |
| **プロジェクト数** | 100 |

- 根拠: [neon.com/pricing](https://neon.com/pricing)
- Render PostgreSQL（30日期限）の代替として有効

#### Supabase（Free プラン）

| 項目 | 内容 |
|---|---|
| **月額** | **$0** |
| **DB サイズ** | 500 MB |
| **停止** | **1週間非アクティブでプロジェクト停止** |
| **アクティブプロジェクト数** | 2 |

- 根拠: [supabase.com/pricing](https://supabase.com/pricing)
- 1週間でプロジェクト停止は厳しい

---

## 3. 構成プラン比較

### プランA: 完全無料構成（$0/月）

| サービス | 用途 | 月額 |
|---|---|---|
| Vercel (Hobby) | Frontend (Next.js) | $0 |
| Render (Free) | Backend (FastAPI) | $0 |
| Neon (Free) | PostgreSQL | $0 |
| **合計** | | **$0** |

**メリット:**
- 完全無料、クレカ不要
- Neon の起動は 350ms と高速
- DB データは永続（30日期限なし）

**デメリット:**
- Render のスリープ: 15分放置後、スマホで開くと **約1分待ち**
- Neon のストレージ 0.5GB（個人利用なら当面十分）
- Backend と DB が別サービスなのでレイテンシが若干増える

### プランB: 低コスト構成（$5/月 ≈ 750円）

| サービス | 用途 | 月額 |
|---|---|---|
| Vercel (Hobby) | Frontend (Next.js) | $0 |
| Railway (Hobby) | Backend (FastAPI) + PostgreSQL | $5 |
| **合計** | | **$5（約750円）** |

**メリット:**
- スリープなし（スマホで即座にレスポンス）
- Backend と DB が同一プラットフォーム（低レイテンシ）
- セットアップがシンプル

**デメリット:**
- 月額 $5 が必ず発生（使わなくても）

### プランC: 段階的アプローチ

1. **開発初期**: プランA（完全無料）で開始
2. **スリープが不満になったら**: Backend を Railway に移行（$5/月）
3. **DB は Neon のまま or Railway PostgreSQL に移行**

**メリット:**
- 初期コストゼロで検証できる
- 必要に応じてスケールアップ

**デメリット:**
- 移行作業が発生する

---

## 4. AWS 構成案

### 4.1 アーキテクチャ: サーバーレス構成

FastAPI を AWS Lambda 上で動かす（[Mangum](https://github.com/jordanh/mangum) アダプタ使用）。

| コンポーネント | AWSサービス | 役割 |
|---|---|---|
| Backend | **AWS Lambda** | FastAPI（Mangum経由） |
| API ルーティング | **API Gateway (HTTP API)** | RESTエンドポイント |
| データベース | **Neon (外部)** | PostgreSQL（無期限無料） |
| 画像ストレージ | **Amazon S3** | アップロード画像の保存 |

### 4.2 各サービスの料金

#### AWS Lambda

| 項目 | 内容 |
|---|---|
| **無料枠** | **Always Free（永久無料）** |
| リクエスト | 1M リクエスト/月 |
| コンピュート | 400,000 GB-seconds/月 |
| Sokone 想定使用量 | ~3,000 リクエスト/月、256MB × 500ms ≈ 375 GB-s/月 |
| **Sokone コスト** | **$0/月（永久に無料枠内）** |

- 根拠: [aws.amazon.com/lambda/pricing](https://aws.amazon.com/lambda/pricing/)
- "The AWS Lambda free tier includes one million free requests per month and 400,000 GB-seconds of compute time per month"
- Lambda の無料枠は「Always Free」であり、12ヶ月の期限なし

#### API Gateway (HTTP API)

| 項目 | 内容 |
|---|---|
| **無料枠** | 1M HTTP API コール/月（**12ヶ月限定**） |
| 無料枠後の料金 | $1.00/百万リクエスト |
| Sokone 想定使用量 | ~3,000 コール/月 |
| **12ヶ月以内** | **$0/月** |
| **12ヶ月以降** | **~$0.003/月（実質無料）** |

- 根拠: [aws.amazon.com/api-gateway/pricing](https://aws.amazon.com/api-gateway/pricing/)
- HTTP API は REST API（$3.50/百万）より安価（$1.00/百万）

#### Amazon S3（画像ストレージ）

| 項目 | 内容 |
|---|---|
| **無料枠** | 5GB Standard、20,000 GET、2,000 PUT（**12ヶ月限定**） |
| 無料枠後の料金 | $0.023/GB/月 + リクエスト料金 |
| Sokone 想定使用量 | ~1-5GB（画像、長辺1600pxリサイズ済み） |
| **12ヶ月以内** | **$0/月** |
| **12ヶ月以降** | **~$0.02-0.12/月** |

#### Neon（PostgreSQL）— AWS外サービス

- 前述のとおり **$0/月（永久無料、0.5GB）**

#### RDS PostgreSQL（参考 — AWS内 DB の場合）

| 項目 | 内容 |
|---|---|
| **無料枠** | 750時間/月 db.t3.micro or db.t4g.micro Single-AZ、20GB gp2、20GB バックアップ（**12ヶ月限定**） |
| 無料枠後 | db.t4g.micro: ~$0.016/時間 × 730時間 ≈ **$11.68/月** + ストレージ $2.30/月 |
| **12ヶ月以内** | **$0/月** |
| **12ヶ月以降** | **~$14/月（高い）** |

- 根拠: [aws.amazon.com/rds/postgresql/pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- RDS は 12ヶ月後に高額になるため、**Neon との組み合わせを推奨**

### 4.3 AWS構成コスト試算

#### プランD: Lambda + API Gateway + Neon + S3（推奨AWS構成）

| 期間 | Lambda | API Gateway | S3 | Neon | 合計 |
|---|---|---|---|---|---|
| **1年目** | $0 | $0 | $0 | $0 | **$0/月** |
| **2年目以降** | $0 (Always Free) | ~$0.003 | ~$0.05 | $0 | **~$0.05/月** |

#### プランE: Lambda + API Gateway + RDS + S3（非推奨）

| 期間 | Lambda | API Gateway | RDS | S3 | 合計 |
|---|---|---|---|---|---|
| **1年目** | $0 | $0 | $0 | $0 | **$0/月** |
| **2年目以降** | $0 | ~$0.003 | ~$14 | ~$0.05 | **~$14/月** |

→ RDS を使うと2年目以降のコストが跳ね上がるため、Neon との組み合わせが合理的。

### 4.4 AWS構成のメリット・デメリット

**メリット:**
- Lambda の無料枠は **永久無料**（Render/Railway と違いサブスク料金なし）
- Neon 併用でDB費用もゼロ
- 2年目以降も実質 **$0/月** で運用可能
- AWS は信頼性・可用性が高い

**デメリット:**
- ⚠️ **コールドスタート**: Python Lambda は **1〜3秒** の起動遅延がある（リクエストのたびにアイドル状態から復帰する場合）
- ⚠️ **構築の複雑さ**: SAM / CDK / Serverless Framework の学習コスト
  - Mangum アダプタの導入が必要
  - Docker Compose（ローカル）と Lambda デプロイで環境差異が生まれる
- ⚠️ **画像アップロード**: ローカル `/uploads/` が使えず S3 連携が必須
- ⚠️ **WebSocket 非対応**（将来リアルタイム機能が必要な場合）
- AWS の無料枠は **アカウント作成から12ヶ月** でAPI Gateway/S3分が有料化（ただし金額は極小）

### 4.5 AWS 無料枠に関する重要な変更（2025年7月15日〜）

- 新規AWSアカウントには **最大 $200 のクレジット** が付与される
- 「Free Plan」（6ヶ月、課金なし）と「Paid Plan」を選択可能
- Lambda の Always Free 枠はプランに関係なく適用
- 根拠: [aws.amazon.com/free](https://aws.amazon.com/free/)

---

## 5. Next.js フルスタック構成の検討

> 調査日: 2026-02-26

### 5.1 背景: Python FastAPI は本当に必要か？

現在の設計は「Next.js (Frontend) + FastAPI (Backend) + PostgreSQL」の3層構成だが、
Sokone の Backend 処理を分析すると：

| 処理 | Python が必須か？ |
|---|---|
| Gemini API 呼び出し (OCR/価格抽出) | ❌ REST API なので **どの言語からでも呼べる** |
| CRUD (店舗・商品・価格) | ❌ 汎用的 |
| 画像リサイズ (長辺 1600px) | ❌ Node.js `sharp` で対応可 |
| Google OAuth | ❌ NextAuth.js が**Frontend 側に既にある** |
| ローカル ML 推論 (Tesseract + Ollama) | ⚠️ Phase 2 以降のフォールバック。その時だけ Python microservice を追加する手もある |

→ **Python でなければならない理由がない**

### 5.2 構成比較

| 項目 | 現在（Python + Next.js 分離） | 代替（Next.js フルスタック） |
|---|---|---|
| **Backend** | FastAPI (Python) | Next.js API Routes / Server Actions |
| **DB ORM** | SQLAlchemy + Alembic | Prisma or Drizzle ORM |
| **認証** | JWT (Backend) + NextAuth (Frontend) | NextAuth のみ（一元化） |
| **OCR** | Python → Gemini REST API | TypeScript → Gemini REST API |
| **画像処理** | Pillow | sharp |
| **デプロイ先** | Vercel + **別途 Backend ホスティング必要** | **Vercel だけ** |
| **月額コスト** | $0〜$5 | **$0（Vercel Hobby + 無料DB）** |
| **コールドスタート** | Render 1分 / Lambda 1-3秒 | **Vercel Serverless ~200ms** |
| **管理言語** | Python + TypeScript の2言語 | **TypeScript のみ** |

### 5.3 Next.js フルスタックのメリット

1. **Backend ホスティング問題が完全に消える** — Vercel 1つで完結、$0/月
2. **スリープなし** — Vercel Serverless Functions は呼ばれた時だけ起動（常時起動不要）、起動も ~200ms と高速
3. **1言語で統一** — TypeScript のみで Frontend と Backend を開発・保守
4. **認証がシンプル** — NextAuth.js に一元化、JWT の Backend 受け渡し不要
5. **デプロイがシンプル** — GitHub Push → Vercel 自動デプロイ（1サービスだけ管理）
6. **Vercel Marketplace** でDB連携が容易（Neon等をダッシュボードから直接セットアップ）

### 5.4 Next.js フルスタックのデメリット・リスク

1. **ドキュメント書き直し** — `requirements.md` と `plan.md` を大幅改修する必要がある
2. **学習コスト** — Prisma / Drizzle の学習（SQLAlchemy の代替）
3. **Python エコシステム喪失** — ruff, pytest, SQLAlchemy が不要になる一方、Python の学習目的があれば機会損失
4. **Phase 2 フォールバック** — Tesseract + Ollama（ローカル ML 推論）は Python が得意。ただしこれは Phase 2 以降の話で、その時だけ Python microservice を追加する設計も可能
5. **API Routes の制約** — Vercel Serverless Functions はタイムアウト 60秒（Hobby）。Gemini API の応答が遅い場合に注意（通常は数秒で収まる）

---

## 6. データベース候補（Next.js フルスタック構成向け）

Vercel 自体は DB を持たないため、外部 DB サービスが必要。

### 6.1 候補一覧

#### Neon（Serverless PostgreSQL）— ✅ 最有力

| 項目 | 内容 |
|---|---|
| **月額** | **$0** |
| **ストレージ** | 0.5 GB/project |
| **コンピュート** | 100 CU-hours/月 |
| **スリープ** | 5分無アクセスでスリープ（**起動 ~350ms と高速**） |
| **データ永続性** | **期限なし**（消えない） |
| **Vercel 連携** | ◎ **公式 Marketplace 統合あり**（ダッシュボードから直接セットアップ） |
| **Prisma/Drizzle 対応** | ◎ PostgreSQL なので完全互換 |

- 根拠: [neon.com/pricing](https://neon.com/pricing)
- Vercel が公式に推奨する DB パートナー

#### Turso（libSQL / SQLite ベース）— 🔶 無料枠が最も充実

| 項目 | 内容 |
|---|---|
| **月額** | **$0** |
| **ストレージ** | **5 GB**（Neon の 10倍） |
| **データベース数** | 100 |
| **月間 Rows Read** | 500M |
| **月間 Rows Written** | 10M |
| **Point-in-Time Restore** | 1日 |
| **Prisma/Drizzle 対応** | △ Prisma は `@prisma/adapter-libsql` 経由。Drizzle は `drizzle-orm/libsql` で良好 |

- 根拠: [turso.tech/pricing](https://turso.tech/pricing)
- 注意: PostgreSQL ではなく **SQLite ベース（libSQL）**
  - SQL 方言が異なる（UUID 型なし、JSON サポートが限定的）
  - 現在の要件定義のデータモデル（UUID 主キー）と相性が悪い
  - Vercel Marketplace には **未統合**

#### CockroachDB（分散 SQL）— 🔶 ストレージが最も充実

| 項目 | 内容 |
|---|---|
| **月額** | **$0（Basic プラン）** |
| **ストレージ** | **10 GiB**（Neon の 20倍） |
| **Request Units** | 50M RU/月 |
| **可用性** | 99.99% SLA |
| **PostgreSQL 互換** | ◎ ほぼ PostgreSQL 互換（一部非互換あり） |
| **Prisma 対応** | ◎ `cockroachdb` プロバイダで公式対応 |
| **クレカ** | 不要 |

- 根拠: [cockroachlabs.com/pricing](https://www.cockroachlabs.com/pricing/)
- メリット: 10 GiB 無料は非常に大きい。$400 トライアルクレジットも付与
- 注意: 分散 SQL のため単純なクエリでも若干のレイテンシオーバーヘッドあり
- Vercel Marketplace には **未統合**（直接接続は可能）

#### Supabase — ❌ 非推奨

| 項目 | 内容 |
|---|---|
| **月額** | **$0** |
| **ストレージ** | 500 MB |
| **停止** | **1週間非アクティブでプロジェクト一時停止** |
| **アクティブプロジェクト数** | 2 |

- 根拠: [supabase.com/pricing](https://supabase.com/pricing)
- "Free projects are paused after 1 week of inactivity. Limit of 2 active projects."
- 1週間の非アクティブで停止は個人アプリには不都合

#### Xata — ❌ 無料プランなし

| 項目 | 内容 |
|---|---|
| **最低月額** | **$9/月（micro）** |
| **無料プラン** | なし（14日トライアルのみ） |

- 根拠: [xata.io/pricing](https://xata.io/pricing)

### 6.2 DB 選定まとめ

| サービス | 月額 | 無料ストレージ | 永続性 | PostgreSQL互換 | Vercel連携 | 評価 |
|---|---|---|---|---|---|---|
| **Neon** | $0 | 0.5 GB | ◎ 無期限 | ◎ ネイティブ | ◎ 公式統合 | **⭐ 最推奨** |
| **CockroachDB** | $0 | 10 GiB | ◎ 無期限 | ○ ほぼ互換 | △ 直接接続 | ⭐ ストレージ重視なら |
| **Turso** | $0 | 5 GB | ◎ 無期限 | ✗ SQLite系 | ✗ 未統合 | △ データモデル変更必要 |
| **Supabase** | $0 | 500 MB | ✗ 1週間停止 | ◎ ネイティブ | ○ Marketplace | ✗ 停止が厳しい |
| **Xata** | $9〜 | なし | ◎ | ◎ | △ | ✗ 有料 |

**推奨: Neon**
- 0.5 GB は個人利用で当面十分（テキストデータ中心、画像は Vercel Blob / 別ストレージ）
- Vercel 公式統合でセットアップが最も簡単
- PostgreSQL ネイティブなので Prisma/Drizzle と完全互換
- 将来データが増えた場合 → Launch プラン $19/月 or CockroachDB への移行も可能

**次点: CockroachDB（Basic）**
- 10 GiB 無料はストレージに余裕がある場合に魅力的
- PostgreSQL ほぼ互換だが一部制約あり

---

## 7. 全プラン総合比較（最終版）

### 従来アーキテクチャ（Python FastAPI + Next.js 分離構成）

| プラン | 月額 | スリープ/遅延 | 構築難易度 | 永続性 |
|---|---|---|---|---|
| **A: Render+Neon** | $0 | 15分放置→1分待ち | ★☆☆ | ◎ |
| **B: Railway** | $5 (750円) | なし | ★☆☆ | ◎ |
| **C: 段階的** | $0→$5 | 初期は待ちあり | ★☆☆ | ◎ |
| **D: AWS Lambda+Neon** | $0 (永久) | コールドスタート1-3秒 | ★★★ | ◎ |
| **E: AWS Lambda+RDS** | $0→$14 | コールドスタート1-3秒 | ★★★ | ◎ |

### 新アーキテクチャ（Next.js フルスタック構成）

| プラン | 月額 | スリープ/遅延 | 構築難易度 | 永続性 |
|---|---|---|---|---|
| **F: Vercel+Neon** | **$0 (永久)** | **~200ms** | ★☆☆ | ◎ |
| **G: Vercel+CockroachDB** | **$0 (永久)** | **~200ms** | ★★☆ | ◎ |

### 最終推奨

| 優先事項 | 推奨プラン |
|---|---|
| **🏆 総合ベスト** | **F: Next.js フルスタック + Vercel + Neon** |
| 永久無料 + 大容量DB | G: Next.js フルスタック + Vercel + CockroachDB |
| Python を学びたい | C: 段階的（Render → Railway） |
| UX最優先 + Python維持 | B: Railway $5/月 |

**プラン F が最も合理的な理由:**
- $0/月（永久無料）
- スリープなし、起動 ~200ms
- 1言語（TypeScript）で完結
- 1プラットフォーム（Vercel）で管理
- DB はVercel 公式統合の Neon

---

## 8. 未決定事項

- [ ] アーキテクチャの最終決定（Python 分離 or Next.js フルスタック）
- [ ] DB サービスの最終決定（Neon or CockroachDB）
- [ ] requirements.md の全面改修（フルスタック化の場合）
- [ ] plan.md の全面改修（フルスタック化の場合）
- [ ] copilot-instructions.md の技術スタック更新

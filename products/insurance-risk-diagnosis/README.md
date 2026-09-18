# 保険リスク診断ツール(Financial Risk Diagnosis)

個人・保険代理店向けに、入力情報から死亡・医療・就業不能・老後・介護・資産・相続の7領域にわたる
Financial Risk Gap(必要な備え−公的保障・自己資産・既存の保険=不足額)を診断するツールです。
単純な「年収×◯倍」ではなく、公的保障(遺族年金・高額療養費・傷病手当金・障害年金・介護保険等)を
考慮したうえで、各リスクの判定理由(Why?)まで確認できる設計にしています。

- フロントエンド: React + TypeScript + Tailwind CSS (Vite) / `web/`
- 診断計算ロジック: `web/src/calc/`(ブラウザ内で実行する純粋関数)
- 診断履歴の保存: ブラウザの`localStorage`(サーバーには一切送信しない)
- 認証: Firebase Authentication(メール/パスワード、簡易ログイン)
- ホスティング: Firebase Hosting
- 可視化: Recharts(レーダーチャート)
- PDF出力: html2canvas + jsPDF(クライアントサイド)

**この構成はFirebaseの無料プラン(Spark)だけで完結し、課金設定・クレジットカード登録は一切不要です。**

## なぜCloud Functions・Firestoreを使っていないか

当初はバックエンドをFirebase Cloud Functions + Cloud Firestoreで実装していましたが、実際にデプロイを試したところ以下が判明しました。

- Cloud Functions(Gen 1/Gen 2とも)は**Blazeプラン(従量課金制、要クレジットカード登録)への加入が必須**
- Cloud Firestoreも、このプロジェクトでは**データベースを新規作成する時点でBlazeプランへの加入が必須**(「無料枠はある」がプラン自体はBlazeでないと管理APIが使えない)

このツールは「計算式を画面に表示して透明性を保つ」設計であり、計算ロジック自体を秘匿する必要がありません。またサーバー側でデータを一元管理する必然性も薄いため、次のように完全無料で運用できる構成に変更しました。

- 診断計算はブラウザ側の`web/src/calc`で実行(サーバーに計算ロジックを置かない)
- 診断履歴はそのブラウザの`localStorage`にのみ保存(**他の端末・他のブラウザからは見返せません**。これが唯一のトレードオフです)
- Firebase Hosting(静的ファイル配信)とFirebase Authentication(ログイン)だけを使用。どちらもSparkプラン(無料)の範囲内

`functions/` ディレクトリは参考実装として残しています(将来Blazeプランへ移行しサーバー側にロジックや共有データベースを持ちたくなった場合の移行元)。CIではビルド・テストのみ継続実行し、デプロイはしていません。

## ディレクトリ構成

```
insurance-risk-diagnosis/
  firebase.json / .firebaserc
  functions/        (未デプロイの参考実装。旧バージョンのロジックのまま、7領域化には未追従)
  web/              React SPA
    src/calc/        診断ロジック本体(純粋関数)。DiagnosisInput → 7領域のRiskCategoryResult → DiagnosisResult
    src/components/  ステップ入力フォーム・結果ダッシュボード(RiskMap/FinancialGap/Why等)
    src/pages/       画面
    src/lib/         Firebase Auth接続・診断履歴/下書きのlocalStorage読み書き・PDF出力
```

## 診断ロジックについて

- `web/src/calc/params.ts`: 生活費割合・教育費テーブル等、計算モデル全般の前提パラメータ
- `web/src/calc/publicSystemParams.ts`: 公的保障制度(高額療養費・傷病手当金・障害年金・老齢年金・介護保険・相続税基礎控除)の金額・料率。出典と確認時点をコメントで明記しており、制度改定時はこのファイルのみ更新すればよい構造
- `web/src/calc/riskProfile.ts`: 死亡・医療・就業不能・老後・介護・資産・相続の7領域を集約し、総合スコア(overallScore)と優先度(critical/high/medium/low)を算出

特定の保険商品名・保険会社名は一切出力しません(保険の「種類」のみ提案)。相続・税務に関する内容は簡易チェックであり、個別の税務・法律相談の代替にはなりません。診断結果画面の前提条件(Assumptions)に、制度の適用時点と簡略化している旨を必ず表示します。

**既知の制約**: `functions/` (未デプロイの参考実装)は今回の7領域化に追従していません。デプロイには使用していないため実害はありませんが、将来`functions/`側を復活させる場合は`web/src/calc`の内容を移植し直す必要があります。

## セットアップ

### 1. 依存関係のインストール

```bash
cd web && npm install
```

(`functions/` はデプロイ対象外ですが、参考実装として `cd functions && npm install` でテストは実行できます)

### 2. Firebaseプロジェクトの準備(要ユーザー作業)

```bash
npm install -g firebase-tools   # または npx firebase-tools を都度使用
firebase login
```

`.firebaserc` の `default` を実際のプロジェクトIDに書き換えるか、以下で紐付けてください。

```bash
firebase use --add
```

Firebase Consoleで以下を有効化してください:
- Authentication(メール/パスワード プロバイダ)
- Hosting

Cloud FunctionsもCloud Firestoreも有効化不要です(Sparkプランのままで構いません)。

### 3. フロントエンドの環境変数

`web/.env.example` を `web/.env` にコピーし、Firebase ConsoleのWebアプリ設定値を入力してください。

```bash
cp web/.env.example web/.env
```

### 4. ローカル動作確認(エミュレータ)

```bash
# ターミナル1: エミュレータ起動
firebase emulators:start --only auth

# ターミナル2: フロントエンド起動(.envでVITE_USE_FIREBASE_EMULATOR=trueにしておく)
cd web && npm run dev
```

### 5. テスト実行

```bash
cd web && npm test
```

複数の家族構成パターン・雇用形態・7領域それぞれの境界値について、必要額・不足額・スコアの妥当性を検証しています(Vitest、34件)。

### 6. デプロイ

```bash
cd web && npm run build
firebase deploy --only hosting
```

## セキュリティ・プライバシー

診断の入力内容・結果はブラウザの`localStorage`にのみ保存され、サーバーやFirebaseには一切送信されません。ブラウザのデータを消去する(キャッシュクリア、別ブラウザ・別端末で開く等)と履歴は失われます。ログイン機能自体は画面へのアクセス制御として残していますが、データの保存先はログインユーザーと紐付いていません。

## CI/CD (GitHub Actions)

`main` ブランチへのマージ(このディレクトリ配下の変更のみ)をトリガーに、リポジトリルートの `.github/workflows/deploy.yml` が自動実行され、web側のテスト・ビルド → `firebase deploy --only hosting` を実行します(Cloud FunctionsもFirestoreもデプロイしません)。`workflow_dispatch` にも対応しているため、GitHub Actionsの画面から手動実行も可能です。

初回セットアップとして、以下をご自身の環境で実施してください。

### 1. `.firebaserc` に実際のプロジェクトIDを設定してコミット

```bash
firebase use --add   # または .firebaserc の default を直接書き換える
git add .firebaserc && git commit -m "Set Firebase project id" && git push
```

(プロジェクトIDは秘密情報ではないため、リポジトリにコミットして問題ありません。)

### 2. フロントエンドのFirebase設定を本番ビルドに反映

Vite は `web/.env.production` を本番ビルド時に読み込みます。Firebase ConsoleのWebアプリ設定値(`apiKey`等)は公開されても問題ない値のため、そのままコミットして構いません。

```bash
cp web/.env.example web/.env.production
# web/.env.production を実際の値で編集(VITE_USE_FIREBASE_EMULATOR=false のまま)
git add web/.env.production && git commit -m "Add production Firebase web config" && git push
```

### 3. CI用サービスアカウントの作成(Google Cloud Console)

1. [Google Cloud Console](https://console.cloud.google.com/) で対象のFirebaseプロジェクトを選択
2. **IAMと管理 > サービスアカウント > サービスアカウントを作成** で `github-actions-deploy` などの名前で作成
3. 作成したサービスアカウントに、プロジェクトレベルで以下のロールを付与(**IAMと管理 > IAM > アクセス権を付与**):
   - `Firebase Hosting 管理者` (roles/firebasehosting.admin)
   - `Service Usage 閲覧者` (roles/serviceusage.serviceUsageViewer) — firebase-toolsがデプロイ前にAPIの有効化状態を確認するために必要

   Cloud FunctionsもFirestoreもデプロイしないため、それ以外のロールは不要です。
4. 作成したサービスアカウントの **キー** タブ > **鍵を追加 > 新しい鍵を作成 > JSON** でJSON鍵ファイルをダウンロード

### 4. GitHub Secretsへの登録

リポジトリの **Settings > Secrets and variables > Actions > New repository secret** で、以下の名前でダウンロードしたJSON鍵ファイルの中身をそのまま貼り付けて登録してください。

| Secret名 | 値 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 手順3でダウンロードしたJSON鍵ファイルの中身(全文) |

登録後、`main` ブランチにこのディレクトリの変更をマージするか、Actions画面から手動実行(`workflow_dispatch`)すると自動デプロイが実行されます。

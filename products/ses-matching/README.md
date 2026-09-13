# SES Matching（現行プロダクト・実装中）

SES案件×要員のマッチングプロダクト。スマホから開ける最小PWAとして、既存の
Matching Engineの結果を画面で確認できます（データはダミー、DB/Gmail/認証は未接続）。

全体の処理フロー:

```
PWA (React + vite-plugin-pwa)
        ↓
  Demo Data (src/demo/dummyData.ts — 匿名ダミーの ProjectRecord[] / EngineerRecord[])
        ↓ (呼び出し側が事前に実施する想定。今回のダミーデータは検証済み前提で直接使用)
  validateProjectRecord / validateEngineerRecord
        ↓
  matchProjectToEngineers()
        ├─ toProjectInput / toEngineerInput
        └─ calcTotalScore (Scoring Engine)
        ↓
  スコア降順のcandidate一覧を画面表示
```

将来的にはDemo Dataの部分を「Gmail → Parser/Normalizer → ProjectRecord/EngineerRecord」
に差し替える想定。`ProjectRecord`/`EngineerRecord`を「外部データの正規化後の境界」として
維持しているのはそのためで、UI・Matching Engine側にメール解析ロジックは書かない。

## 現在の実装状況

- `src/scoring/` — 案件(`ProjectInput`)と要員(`EngineerInput`)を受け取り、
  スキル/単価/勤務地/稼働時期の4軸スコアと重み付き総合スコア(0〜100)を返す
  純粋関数群。フレームワーク（Firebase/React等）に非依存。
  - [`legacy/ses-matching-reference/web/src/scoring/`](../../legacy/ses-matching-reference/web/src/scoring/)
    のロジックとテスト(41件)を、Firebase/React依存部分を含めずそのまま移植したもの。
  - `npm test` で41件のテストが通ることを確認済み。
- `src/intake/` — 外部から受け取る案件・要員データの入力型と最小validation。
  - `ProjectRecord` / `EngineerRecord`: Scoring Engineの`ProjectInput`/`EngineerInput`に
    `id`(識別用)を加えただけの入力型。DB/API/CSV等どこから来たデータかは問わない。
  - `validateProjectRecord` / `validateEngineerRecord`: 必須項目の存在・型・
    明らかに不正な値(負の単価、単価レンジの逆転、不正な日付、未知のjapaneseLevel等)
    のみを検査する。SES固有の複雑な業務ルールはまだ実装していない。
  - `toProjectInput` / `toEngineerInput`: 検証済みRecordから`id`を除いて
    Scoring Engineの入力型へ変換する。
  - `npm test` で18件のテスト(validationの正常系/異常系 + Scoring Engineへの
    実際の受け渡し確認)が通ることを確認済み。
- `src/matching/` — 1案件に対する複数要員の候補ランキング。
  - `matchProjectToEngineers(project, engineers)`: `ProjectRecord`と
    `EngineerRecord[]`を受け取り、各要員を`toProjectInput`/`toEngineerInput`で
    変換した上でScoring Engineの`calcTotalScore`にそのまま委譲してスコアを求め、
    `{ engineerId, score }`の配列をスコア降順で返す。スコア計算式は一切持たず、
    複数要員の処理・`engineerId`の付与・並べ替えのみを行う薄い層。
  - project/engineersは呼び出し側で`validateProjectRecord`/`validateEngineerRecord`
    を通過済みであることを前提とし、この層ではvalidationを行わない。
  - 同点の場合はJavaScriptの安定ソートにより、渡した`engineers`配列内の順序を
    維持する(決定論的)。`engineers`が空配列なら空配列を返す。
  - `npm test` で8件のテスト(降順・同点順序・空配列・Scoring Engineとの結果一致等)
    が通ることを確認済み。

- `src/demo/dummyData.ts` — 画面表示用の匿名ダミーデータ(`dummyProjects` / `dummyEngineers`)。
  実在の企業・人物・案件ではない。DB/APIが無いため、現時点ではここに直接定義している。
- `src/web/` — 最小PWA本体(React + react-router-dom + vite-plugin-pwa)。
  - **Dashboard**(`/`): 案件数・要員数と、先頭案件に対する最新マッチングの1位候補を表示。
  - **Projects**(`/projects`): 案件一覧(必須/歓迎スキル・単価・勤務地・remote可否・開始日)。
  - **Engineers**(`/engineers`): 要員一覧(スキル・希望単価・希望勤務地・remote希望・稼働開始日)。
  - **Matching**(`/matching/:projectId`): 案件を選択すると`matchProjectToEngineers()`を
    呼び出し、候補要員をスコア降順で表示。UI側にスコア計算ロジックは一切持たない。
  - PWA対応: `manifest.webmanifest`・Service Worker(`vite-plugin-pwa`)・
    mobile viewport設定込み。`npm run build`でインストール可能なPWAとしてビルドされることを確認済み。
- `src/gmail/` — Gmail APIから**1通だけ**メッセージを取得する最小adapter(独自実装)。
  - [`ai/automation-engine/app/gmail_client.py`](../../ai/automation-engine/app/gmail_client.py)
    と同じ設計(OAuth installed-appフロー、`gmail.readonly`のみ、credentials.json/token.json、
    ページング無し)をTypeScriptで独立実装したもの。Automation Engineの機能を呼び出す
    構成にはせず、Gmail API固有の型(`GmailApiMessage`)は`src/gmail/`の外に一切漏らさない。
  - `RawEmail`型(`id`/`threadId`/`from`/`subject`/`date`/`bodyText`)がGmail API本来の
    レスポンス形状をアプリ全体から隠す境界。
  - `npm run gmail:fetch-one` で実行(認証情報は環境変数`GMAIL_CREDENTIALS_PATH`/
    `GMAIL_TOKEN_PATH`で指定。デフォルトはカレントディレクトリの`credentials.json`/
    `token.json`。**どちらもGitへコミットしない**、`.gitignore`済み)。
  - ログには`id`/`threadId`/`from`/`subject`/`date`/本文の文字数と、Parser/Validationの
    結果のみを出力し、メール本文そのものは絶対に出力しない。
- `src/parser/` — `RawEmail`を案件/要員メールと判定し、既存の`validateProjectRecord`/
  `validateEngineerRecord`にそのまま渡せる候補オブジェクトへ変換する最小Parser。
  - キーワード(「必須スキル」「単価」「勤務地」等)による決定論的な行抽出のみ。
    LLM/AI分類は使わない。
  - 抽出できなかったフィールドは候補オブジェクトにキーごと含めない(値を推測して
    埋めない)。正当性チェックは既存validationにすべて委譲する。
  - 案件/要員のいずれとも判別できない場合は`{ status: 'unparsed', reason: '...' }`を返す。
    想定外フォーマットで例外を投げない。
  - 案件メールとして解析でき、かつvalidationを通過した場合は、`src/demo/dummyData.ts`の
    ダミー要員に対して`matchProjectToEngineers()`まで自然に接続できることを確認済み
    (`npm run gmail:fetch-one`実行時、または`src/parser/__tests__/`のテストで確認)。
  - 実際のSESメールが多様な形式を取ることは十分あり得るため、このParserで拾えない
    メールは`unparsed`になる(想定内)。ルールベースで実際に限界が見えてから、
    LLM Parserの検討に進む。
- 未実装: Gmailメールの大量取り込み・定期同期、DB永続化、REST/GraphQL等のAPI、
  本番認証、ユーザー管理、LLMベースのParser、Gmail送信・自動返信、通知、
  フィードバックによる重み自動学習(`weightLearning`は移植済みだがまだどこからも
  呼び出されていない)。

## 位置付け

- 実行基盤（Planner/Router/Executor/Evaluator/Repair/Retry、Gmail連携等）は [`ai/automation-engine/`](../../ai/automation-engine/) の共通Automation Engineを利用する想定です。SES Matchingは、このEngineが複数プロダクトから利用されることを示す最初の主要ユースケースという位置付けであり、Engine自体はSES専用ではありません。
- 共通LLM/AI基盤が必要な場合は [`ai/llm-platform/`](../../ai/llm-platform/) を利用します。現在のスコアリングはルールベースのみで、LLMには依存していません。
- 過去に作成されたFirebase/Firestore版の実装（4軸スコアリング、フィードバックによる重み自動学習、41件のテスト、業務UI一式）は [`legacy/ses-matching-reference/`](../../legacy/ses-matching-reference/) に参考資産として保存されています。スコアリングロジックのみ移植済みですが、Firestore連携・認証・UIはそのまま復活させず、必要になった時点で改めて設計します。

## 開発コマンド

```bash
npm install
npm test        # vitest: scoring/intake/matching/PWA画面/gmail/parserのユニットテスト
npm run build   # tsc(型チェック) + vite build(PWAビルド)
npm run dev -- --host 0.0.0.0   # 開発サーバーをLAN上のスマホから開けるようにする
npm run preview -- --host 0.0.0.0  # npm run build後の成果物をプレビュー
npm run gmail:fetch-one  # Gmailから最新の1通だけ取得しParser/Validationまで確認(要credentials.json/token.json)
```

### Gmail連携のセットアップ(`npm run gmail:fetch-one`)

1. Google Cloud ConsoleでOAuthクライアント(種類: デスクトップアプリ)を作成し、
   `credentials.json`としてダウンロードして`products/ses-matching/`直下に置く
   (`.gitignore`済みでコミットされない)。
2. `npm run gmail:fetch-one`を実行すると、初回はブラウザでの同意画面が開き
   (`@google-cloud/local-auth`)、完了すると`token.json`にトークンがキャッシュされる
   (同じくコミットされない)。以降は再認証なしで実行できる。
3. スコープは`gmail.readonly`のみ。メールの送信・削除・変更は一切行わない。

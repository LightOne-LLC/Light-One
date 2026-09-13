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
- 未実装: Gmail API接続、実データの取り込み(DB)、REST/GraphQL等のAPI、本番認証、
  ユーザー管理、LLM/AI自動解析、通知、フィードバックによる重み自動学習
  (`weightLearning`は移植済みだがまだどこからも呼び出されていない)。

## 位置付け

- 実行基盤（Planner/Router/Executor/Evaluator/Repair/Retry、Gmail連携等）は [`ai/automation-engine/`](../../ai/automation-engine/) の共通Automation Engineを利用する想定です。SES Matchingは、このEngineが複数プロダクトから利用されることを示す最初の主要ユースケースという位置付けであり、Engine自体はSES専用ではありません。
- 共通LLM/AI基盤が必要な場合は [`ai/llm-platform/`](../../ai/llm-platform/) を利用します。現在のスコアリングはルールベースのみで、LLMには依存していません。
- 過去に作成されたFirebase/Firestore版の実装（4軸スコアリング、フィードバックによる重み自動学習、41件のテスト、業務UI一式）は [`legacy/ses-matching-reference/`](../../legacy/ses-matching-reference/) に参考資産として保存されています。スコアリングロジックのみ移植済みですが、Firestore連携・認証・UIはそのまま復活させず、必要になった時点で改めて設計します。

## 開発コマンド

```bash
npm install
npm test        # vitest: scoring/intake/matching/PWA画面のユニットテスト
npm run build   # tsc(型チェック) + vite build(PWAビルド)
npm run dev -- --host 0.0.0.0   # 開発サーバーをLAN上のスマホから開けるようにする
npm run preview -- --host 0.0.0.0  # npm run build後の成果物をプレビュー
```

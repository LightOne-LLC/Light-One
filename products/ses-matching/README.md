# SES Matching（現行プロダクト・実装中）

SES案件×要員のマッチングプロダクト。現時点では、案件情報・要員情報から4軸スコアを
算出する**マッチングスコアリングエンジン**のみを実装しています（データ取得、DB、
API、UIは未実装）。

## 現在の実装状況

- `src/scoring/` — 案件(`ProjectInput`)と要員(`EngineerInput`)を受け取り、
  スキル/単価/勤務地/稼働時期の4軸スコアと重み付き総合スコア(0〜100)を返す
  純粋関数群。フレームワーク（Firebase/React等）に非依存。
  - [`legacy/ses-matching-reference/web/src/scoring/`](../../legacy/ses-matching-reference/web/src/scoring/)
    のロジックとテスト(41件)を、Firebase/React依存部分を含めずそのまま移植したもの。
  - `npm test` で41件のテストが通ることを確認済み。
- 未実装: 案件/要員データの取り込み・永続化(DB)、マッチング結果の提示UI、
  営業/担当者による確認フロー、フィードバックによる重み自動学習(`weightLearning`は
  移植済みだがまだどこからも呼び出されていない)。

## 位置付け

- 実行基盤（Planner/Router/Executor/Evaluator/Repair/Retry、Gmail連携等）は [`ai/automation-engine/`](../../ai/automation-engine/) の共通Automation Engineを利用する想定です。SES Matchingは、このEngineが複数プロダクトから利用されることを示す最初の主要ユースケースという位置付けであり、Engine自体はSES専用ではありません。
- 共通LLM/AI基盤が必要な場合は [`ai/llm-platform/`](../../ai/llm-platform/) を利用します。現在のスコアリングはルールベースのみで、LLMには依存していません。
- 過去に作成されたFirebase/Firestore版の実装（4軸スコアリング、フィードバックによる重み自動学習、41件のテスト、業務UI一式）は [`legacy/ses-matching-reference/`](../../legacy/ses-matching-reference/) に参考資産として保存されています。スコアリングロジックのみ移植済みですが、Firestore連携・認証・UIはそのまま復活させず、必要になった時点で改めて設計します。

## 開発コマンド

```bash
npm install
npm test    # vitest: スコアリングエンジンのユニットテスト
npm run build  # tsc: 型チェック込みビルド
```

import type { KnowledgeSource } from './types';

/*
  RAG knowledge base。

  Tier 1: 公的制度そのものの説明(厚生労働省・日本年金機構・全国健康保険協会・国税庁 等、一次情報を優先)。
  Tier 2: 既存の決定論的診断ロジック(web/src/calc)が前提としている計算方法の説明。

  重要な制約:
  - ここに書く内容は、既存の web/src/calc/publicSystemParams.ts および各 *Risk.ts の
    reasons文字列としてすでにコードに存在する記述の範囲に留める。診断ロジックが
    参照していない新しい数値・制度を勝手に追加しない。
  - 金額・条件は publicSystemParams.ts の PUBLIC_SYSTEM_ASOF と同じ効力発生時点
    (2024年度・令和6年度時点)を明記する。将来の制度改定時は、まず
    web/src/calc/publicSystemParams.ts を更新し、その変更に合わせてこのファイルの
    該当エントリの version / effectiveDate / content を更新する運用とする。
  - url は一次情報の発行機関の公式サイト(トップページ)。個別ページへの深いリンクは
    リンク切れ・改定によるずれのリスクがあるため、本MVPでは組織の公式サイトを
    確実な参照先として採用する。
*/

const RETRIEVED_DATE = '2026-09-19';
const EFFECTIVE_DATE = '2024年度(令和6年度)時点の制度';

export const KNOWLEDGE_BASE: KnowledgeSource[] = [
  // --- Tier 1: 公的制度 ---
  {
    sourceId: 'public-survivor-pension',
    title: '遺族年金(遺族基礎年金・遺族厚生年金)',
    organization: '日本年金機構',
    url: 'https://www.nenkin.go.jp/',
    category: 'death',
    content:
      '遺族基礎年金は、国民年金加入者が死亡した場合に、生計を維持されていた「子のある配偶者」または「子」に支給される。' +
      '子は18歳到達年度末までの子(障害がある場合は20歳未満)を対象とする。' +
      '遺族厚生年金は、厚生年金加入者(会社員・公務員)が死亡した場合に上乗せで支給され、自営業者(国民年金のみ)は対象外。' +
      '金額は報酬比例部分に基づく計算式であり、本診断では簡易概算値を用いている。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['遺族年金', '遺族基礎年金', '遺族厚生年金', '死亡', '国民年金', '厚生年金'],
  },
  {
    sourceId: 'public-sick-leave-benefit',
    title: '傷病手当金',
    organization: '全国健康保険協会(協会けんぽ)',
    url: 'https://www.kyoukaikenpo.or.jp/',
    category: 'disability',
    content:
      '健康保険(協会けんぽ・組合健保)加入者が業務外の病気・けがで働けず、給与が支払われない場合に支給される。' +
      '支給額は原則、休業1日につき直近12か月間の標準報酬月額を平均した額の30分の1相当額の3分の2。' +
      '支給期間は同一の傷病について通算1年6か月。' +
      '国民健康保険加入者(自営業者・フリーランス)には原則この制度がない。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['傷病手当金', '就業不能', '健康保険', '自営業', '国民健康保険'],
  },
  {
    sourceId: 'public-high-cost-medical',
    title: '高額療養費制度',
    organization: '厚生労働省',
    url: 'https://www.mhlw.go.jp/',
    category: 'medical',
    content:
      '医療機関や薬局の窓口で支払う医療費が、年齢や所得に応じた自己負担限度額を超えた場合、その超えた金額が支給される制度。' +
      '69歳以下の自己負担限度額は所得区分により月額の目安が段階的に定められている(年収約1160万円以上で約25.26万円、' +
      '約770万〜1160万円で約16.74万円、約370万〜770万円で約8.01万円、約370万円未満で約5.76万円)。' +
      '多数回該当・世帯合算・住民税非課税区分による軽減は別途あり、本診断では考慮していない。' +
      '差額ベッド代・食費等、保険適用外の費用はこの制度の対象外。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['高額療養費', '医療', '自己負担限度額', '健康保険'],
  },
  {
    sourceId: 'public-disability-pension',
    title: '障害年金(障害基礎年金・障害厚生年金)',
    organization: '日本年金機構',
    url: 'https://www.nenkin.go.jp/',
    category: 'disability',
    content:
      '病気やけがによって法令に定める障害の状態になった場合に支給される公的年金。' +
      '国民年金加入者には障害基礎年金(1級・2級)、厚生年金加入者(会社員・公務員)には障害基礎年金に加えて障害厚生年金が上乗せされる。' +
      '令和6年度(2024年度)額は障害基礎年金2級が年額約81.6万円、1級が約102.0万円(子の加算は別途)。' +
      '自営業者は障害基礎年金のみが対象。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['障害年金', '障害基礎年金', '障害厚生年金', '就業不能'],
  },
  {
    sourceId: 'public-long-term-care-insurance',
    title: '介護保険制度',
    organization: '厚生労働省',
    url: 'https://www.mhlw.go.jp/',
    category: 'care',
    content:
      '65歳以上(第1号被保険者)は原因を問わず、40〜64歳(第2号被保険者)は特定疾病により要介護・要支援と認定された場合に介護サービスを利用できる。' +
      '利用者の自己負担割合は所得に応じて1〜3割(多くの場合は1割)。' +
      '本診断では最も一般的な1割負担を前提として概算している。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['介護保険', '要介護', '要支援', '自己負担割合'],
  },
  {
    sourceId: 'public-old-age-pension',
    title: '老齢年金(老齢基礎年金・老齢厚生年金)',
    organization: '日本年金機構',
    url: 'https://www.nenkin.go.jp/',
    category: 'retirement',
    content:
      '老齢基礎年金は国民年金加入者に65歳から支給される。' +
      '自営業者は老齢基礎年金のみ、会社員・公務員(厚生年金加入者)は報酬比例部分の老齢厚生年金が上乗せされる。' +
      '実際の年金見込み額は毎年届く「ねんきん定期便」やねんきんネットで確認できる。' +
      '本診断の年金額は簡易概算であり、実際の報酬比例部分の計算式とは異なる目安値。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['老齢年金', '老齢基礎年金', '老齢厚生年金', 'ねんきん定期便', '老後'],
  },
  {
    sourceId: 'public-inheritance-tax-deduction',
    title: '相続税の基礎控除',
    organization: '国税庁',
    url: 'https://www.nta.go.jp/',
    category: 'inheritance',
    content:
      '相続税の基礎控除額は「3,000万円+600万円×法定相続人の数」で計算される' +
      '(2015年(平成27年)の税制改正以降、この算式に変更はない)。' +
      '相続財産の総額がこの基礎控除額以下であれば、原則として相続税は課税されない。' +
      '法定相続人の範囲(配偶者・子・直系尊属・兄弟姉妹等)や各種特例(配偶者の税額軽減、小規模宅地等の特例等)の' +
      '適用可否によって実際の納税額は大きく変わるため、正確な判定には税理士等への相談が必要。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['相続税', '基礎控除', '法定相続人', '相続'],
  },

  // --- Tier 2: 診断ロジックの計算根拠 ---
  {
    sourceId: 'diagnosis-assumptions-general',
    title: '本診断の計算前提',
    organization: 'LIGHT ONE',
    url: 'https://www.mhlw.go.jp/',
    category: 'general',
    content:
      '本診断は2024年度(令和6年度)時点で確認できる公的制度をもとにした概算であり、実際の制度・金額とは異なる場合がある。' +
      '特定の保険商品・保険会社を推奨するものではなく、保障の「種類」と大まかな過不足の目安を示すもの。' +
      '相続・税務に関する内容は簡易チェックであり、個別の税務・法律相談の代替にはならない。' +
      '制度は改定されるため、最終判断の前には各制度の最新情報を一次情報(発行機関の公式情報)で確認することを推奨する。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['前提条件', 'assumptions', '概算', '制度改定'],
  },
  {
    sourceId: 'diagnosis-death-coverage-methodology',
    title: '死亡保障必要額の計算方法',
    organization: 'LIGHT ONE',
    url: 'https://www.mhlw.go.jp/',
    category: 'death',
    content:
      '必要死亡保障額は「遺族の生活費(末子が独立するまでの期間と、その後の配偶者のみの期間の2段階)+教育費の残り総額' +
      '+葬儀費用等の一時費用+団体信用生命保険未加入の場合の住宅ローン残高等」から、' +
      '「遺族年金の見込み額+貯蓄+投資性資産+既存の死亡保険金」を差し引いて算出する。' +
      'リスクスコアは、生活費・教育費等の総額に対して実際に不足している金額の割合として計算される。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['死亡保障', '必要保障額', '教育費', '生活費', '葬儀費用'],
  },
  {
    sourceId: 'diagnosis-disability-risk-methodology',
    title: '就業不能リスクの評価方法',
    organization: 'LIGHT ONE',
    url: 'https://www.mhlw.go.jp/',
    category: 'disability',
    content:
      '就業不能リスクは、会社員・公務員は傷病手当金の支給上限期間である1年6か月、自営業者は公的な所得保障がないことを踏まえ' +
      '一律12か月、就業不能状態が続くと仮定して必要額を算出する。必要額は月間生活費×想定月数。' +
      '傷病手当金・配偶者収入・既存の就業不能保険・生活防衛資金(貯蓄)を順に差し引いた残りを不足額とする。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['就業不能', '傷病手当金', '生活防衛資金'],
  },
  {
    sourceId: 'diagnosis-retirement-risk-methodology',
    title: '老後資金の評価方法',
    organization: 'LIGHT ONE',
    url: 'https://www.nenkin.go.jp/',
    category: 'retirement',
    content:
      '老後の必要資金は、希望する老後生活費(未入力の場合は現役生活費の8割を概算使用)から公的年金の見込み額を差し引いた' +
      '月々の不足分に、退職から想定余命年齢までの年数を掛けて算出する。' +
      '現有資産(貯蓄+投資性資産+退職金見込み額)と比較し、不足額を算出する。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['老後資金', '退職金', '老後生活費'],
  },
  {
    sourceId: 'diagnosis-care-risk-methodology',
    title: '介護資金の評価方法',
    organization: 'LIGHT ONE',
    url: 'https://www.mhlw.go.jp/',
    category: 'care',
    content:
      '介護資金の必要額は、介護保険の自己負担(1割負担を前提とした月額の自己負担平均目安)×12か月×平均的な介護期間' +
      '(目安として5年)に、住宅改修・介護用品購入等の一時費用の目安を加えて算出する。' +
      '既存の介護保険(民間)への加入がある場合は、その保障で一定割合をカバーすると仮定して不足額を調整する。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['介護資金', '介護期間', '住宅改修'],
  },
  {
    sourceId: 'diagnosis-inheritance-risk-methodology',
    title: '相続税評価の簡易モデルについて',
    organization: 'LIGHT ONE',
    url: 'https://www.nta.go.jp/',
    category: 'inheritance',
    content:
      '本診断における法定相続人数は「配偶者の有無+子の人数」のみから簡易的に推定しており、' +
      '親・兄弟姉妹が法定相続人になるケースは考慮していない。' +
      '推定相続財産は貯蓄・投資性資産・不動産評価額・死亡保険金の合計から負債を差し引いた金額であり、' +
      '実際の相続税評価額(不動産の相続税評価額は時価と異なる、生命保険金の非課税枠等)とは異なる簡易な目安にとどまる。',
    effectiveDate: EFFECTIVE_DATE,
    retrievedDate: RETRIEVED_DATE,
    version: '1.0',
    tags: ['相続税評価', '法定相続人数', '簡易モデル'],
  },
];

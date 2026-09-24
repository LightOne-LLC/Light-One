import type { RawEmail } from '../gmail/types';
import {
  extractBulletValueNoColonNumeric,
  extractCompanyName,
  extractGreetingCompanyName,
  extractLabeledBulletBlock,
  extractLabeledValue,
  extractNestedSkillSections,
  extractSignatureCompanyName,
  findRateInFreeText,
  findRemoteInFreeText,
  parseDateValue,
  parseEngineerSkillList,
  parseJapaneseLevel,
  parseLocationList,
  parseNestedRequirementList,
  parseRateRange,
  parseRequiredSkillList,
  parseYesNo,
  sanitizeDisplayName,
  stripNoteSuffix,
  stripTrailingGenderAnnotation,
  truncateAtSignature,
} from './extractors';
import type { ParsedEmailResult } from './types';

const PROJECT_KEYWORDS = ['案件', '募集', '必須スキル'];
const ENGINEER_KEYWORDS = ['要員', 'スキルシート', '希望単価', '稼働可能日', '経歴'];

// 「商流」は案件・要員どちらのメールにも現れるSES業界共通語(契約形態の
// 話であり案件固有ではない)であることをQuick Match実案件監査(30日間・
// 16,768件の実測)で確認したため、PROJECT_KEYWORDSから外した
// (Project/Engineerを決める強い根拠にしない)。

// Quick Match実案件("■概要"見出し形式の案件メール)が、汎用キーワードだけ
// では「要員数」(ENGINEER_KEYWORDSの「要員」に部分一致)と「案件」が同点
// になり、後述のタイブレークで誤ってengineer判定されることが分かった。
// 実データ(500件監査)で、以下は案件メール側にのみ高頻度で現れ、要員
// メール側にはほぼ現れないことを確認した固有の構造的見出し語のため、
// 案件側の強いシグナルとして追加する。見出し記号は「■」だけでなく
// 「●」を使う実テンプレート(例:「●案件 ：顧客管理システム新規構築」
// 「●期間 ：10月～中長期」)も500件回帰確認で見つかったため、両方の記号
// で用意する(extractors.tsのLIST_MARKER_PREFIX_SRCが従来から□■◆★▼●を
// 同種の見出し記号として扱っているのと同じ考え方)。
const PROJECT_STRUCTURAL_MARKERS = [
  '■概要',
  '案件概要',
  '■作業内容',
  '●内容',
  '■就業時間',
  '■期間',
  '●期間',
  '■作業場所',
  '●場所',
  '■要員数',
  '募集人数',
  '■面談',
  '●面談',
  '●単金',
  '案件名',
];

// 同じ実データ監査で、要員1名分のプロフィールを【】見出しで列挙する形式
// (FREE BRAIN等)が、これらのフィールドを複数まとめて持つことを確認した。
// 個々の語(例:「氏名」「最寄駅」)は案件メールの署名・連絡先欄にも高頻度で
// 現れ単独では判別力が無いため含めない(実データで「other」に多く出現し、
// 判別力が無いことを確認済み)。ここに含めるのは、要員プロフィール特有の
// 語彙で、案件メール側にはほぼ現れないことを確認できたものだけ。
//
// 「並行」は当初この一覧に含めていたが、Quick Match修正後の500件回帰
// 確認で、案件メール側にも「※並行状況のご記載をお願い申し上げます」と
// いう提案時の定型的な確認事項(他社への並行提案有無の確認)として高頻度で
// 使われており、案件/要員どちらにも現れる共通語であることが分かったため
// 除外した(このリストに残す語は、この回帰確認で実際に案件メール側への
// 誤判定を起こさなかったものだけ)。
const ENGINEER_PROFILE_MARKERS = ['要員番号', '所属種類', '契約形態', '週稼働', '面談可能日', '希望条件'];

function countProjectStructuralSignals(body: string): number {
  return countMatches(body, PROJECT_STRUCTURAL_MARKERS);
}

function countEngineerProfileSignals(body: string): number {
  return countMatches(body, ENGINEER_PROFILE_MARKERS);
}

// 「氏名：」「■スキル」「【単価】」のような見出し・ラベル記号は、
// 案件・要員メールのほぼ全てに(ごく短いテストフィクスチャや、コロンを
// 使わない単独■見出し形式も含め)最低1つは存在する。逆に「チョータツ
// ブーストの新着案件・人材情報」のような、実データを一切含まない外部
// ポータルへの通知メール(実データで確認済み)には、これらの見出し記号が
// 一切現れない(「・」は通常の文中の区切りとしても頻出するため、この
// 判定には使わない)。この違いを使って、案件/要員固有の構造的シグナルも
// 無く、かつ判定の根拠が汎用キーワード1個だけ(スコア差が最小の1点)の
// 場合に、見出し構造の有無で実データを含む短いメールと空の通知メールを
// 区別する(本文の文字数という不安定な閾値には頼らない)。
const LABEL_MARKER_PATTERN = /[：:■【]/;

// 実メール(100〜200件規模)の調査で「案件名：」ラベルが最も高頻度・高信頼で
// 観測された(明示ラベル優先)。「氏名：」は要員メールのほぼ全件で観測された。
const PROJECT_NAME_LABELS = ['案件名', 'PJ名', 'プロジェクト名', '案件タイトル'];
const ENGINEER_NAME_LABELS = ['氏名', 'お名前', '名前'];

// 実メール調査(500件、要員134件)で「所属：」ラベルが要員メールの約9割で
// 確認されたが、その98%以上は契約形態(商流)の記述であり会社名ではな
// かった(下記commercialFlowで使う)。要員本人の所属会社を示す専用ラベル
// (所属会社/所属先/企業名/法人名/勤務先/会社名等)は1件も確認できな
// かった。「会社名：」のような単一ラベルは案件メール側にも存在しな
// かったため、案件側の会社名はextractCompanyName()(自己紹介文パターン)
// で取得する。
const AFFILIATION_LABELS = ['所属', '所属会社', '所属企業'];
// 「商流：」「☆商流：」の2表記が実メールで確認された(値は「貴社まで」
// 「現場→弊社」のような短い自由文で、根拠なく構造化しない)。
const COMMERCIAL_FLOW_LABELS = ['商流', '☆商流'];

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
}

// 実際のBP要員紹介メール(HTML由来で改行が失われ1行化するケースが多い)で
// 観察された、■見出し(■基本情報/■希望条件/■スキル/■経験/■PR/■備考)による
// セクション構造と、・ラベル：の箇条書き(・稼働：/・出社頻度：)。
// いずれも記号込みの複数文字からなる固有性の高い表現であり、通常の無関係な
// メール本文に偶然出現することは考えにくいため、単独の一致でも
// 「BP要員メールらしい構造的シグナル」として扱う(単純な1単語一致による
// 粗い判定とは異なる)。
//
// 「■スキル」は案件メール側でも(「■スキル：開発～結合テストフェーズ」の
// ように)ごく普通に使われる見出しであることをQuick Match実案件監査で
// 確認したため、単独では判定に使わない方が良いのでは、と一度この一覧から
// 外したが、その場合でも他のBP固有見出し(■希望条件等)が無い実データの
// 要員メール(単独■見出し・コロン無し形式)まで判定できなくなる回帰が
// 見つかった。実際には、下記のPROJECT_STRUCTURAL_MARKERS追加により、案件
// メール側は「■スキル」に頼らずとも(■概要/■作業内容等の複数の案件固有
// 見出しで)このタイブレークに到達する前にスコア差で決着するようになった
// ため、「■スキル」はこのリストに残したままで問題ない。
const BP_ENGINEER_STRUCTURAL_MARKERS = [
  '■基本情報',
  '■希望条件',
  '■スキル',
  '■経験',
  '■PR',
  '■ＰＲ',
  '■備考',
  '・稼働：',
  '・稼働:',
  '・出社頻度：',
  '・出社頻度:',
];

function hasBpEngineerStructuralSignal(body: string): boolean {
  return BP_ENGINEER_STRUCTURAL_MARKERS.some((marker) => body.includes(marker));
}

// Quick Match(貼り付けテキストの手動種別切り替え)がparseEmail()を経由せず
// 直接この判定・変換を呼べるよう公開する。ロジック・挙動は一切変更しない
// (parseEmail()自体はこれまで通りこの関数をそのまま呼ぶ)。
export function detectEmailType(subject: string, body: string): 'project' | 'engineer' | null {
  const text = `${subject}\n${body}`;
  const projectStructuralScore = countProjectStructuralSignals(body);
  const engineerStructuralScore = countEngineerProfileSignals(body);
  const hasBpSignal = hasBpEngineerStructuralSignal(body);

  // 汎用キーワード(「案件」「要員」等、案件・要員どちらのメールにも現れ
  // うる単語)に、案件/要員固有の構造的シグナルの件数を加算する。単語1個
  // だけでは弱い判定材料でも、複数の固有フィールドが揃えば強い根拠になる
  // という考え方(実データ監査で確認済み)。
  const projectScore = countMatches(text, PROJECT_KEYWORDS) + projectStructuralScore;
  const engineerScore = countMatches(text, ENGINEER_KEYWORDS) + engineerStructuralScore;

  if (projectScore === 0 && engineerScore === 0) return null;

  // 案件/要員固有の構造的シグナルが双方とも一切無く、かつ判定の根拠が
  // 汎用キーワード1個だけ(スコア差が最小の1点)で、本文にラベル区切りの
  // 「：」「:」が一切無い場合は、その1語の偶然の一致だけでは種別を確定
  // させない(外部ポータルへの誘導のみのdigest通知メール等への対処、
  // 実データで確認済み)。複数のキーワードが一致している場合(経歴+
  // 稼働可能日+希望単価等、それ自体で十分な根拠になる)や、ラベル構造が
  // 1つでもある場合は対象外とする — ラベル付きの短い実メールまで
  // 巻き込まないため。
  const hasAnyStructuralSignal = projectStructuralScore > 0 || engineerStructuralScore > 0 || hasBpSignal;
  const decisiveScore = Math.max(projectScore, engineerScore);
  if (!hasAnyStructuralSignal && decisiveScore <= 1 && !LABEL_MARKER_PATTERN.test(body)) {
    return null;
  }

  if (projectScore === engineerScore) {
    // 通常のキーワード判定が同点で決着しない場合のみ、BP要員メール特有の
    // 構造的シグナルでタイブレークする。既存の非同点判定(明確にproject/
    // engineerと判別できるメール)には一切影響しない。
    return hasBpSignal ? 'engineer' : null;
  }
  return projectScore > engineerScore ? 'project' : 'engineer';
}

export function parseProjectCandidate(subject: string, body: string, id: string): Record<string, unknown> {
  const candidate: Record<string, unknown> = { id };

  // 表示用の案件名。「案件名：」等の明示ラベルを最優先、無ければ件名を
  // フォールバックとして使う(既にPIIではない表示用途として既存コードで
  // 使われている値)。件名フォールバックは、営業担当者名・電話番号まで
  // 埋め込まれた長い件名を根拠なく採用しないよう、sanitizeDisplayNameの
  // 長さ上限でも制限される。どちらも得られない場合はcandidateに含めず、
  // 呼び出し側(UI)で内部IDによる安全なフォールバック表示に委ねる。
  const projectName = sanitizeDisplayName(extractLabeledValue(body, PROJECT_NAME_LABELS)) ?? sanitizeDisplayName(subject);
  if (projectName) candidate.projectName = projectName;

  // 案件を出している会社。「会社名：」のような単一の明示ラベルは実メール上
  // 確認できなかったため、日本のビジネスメールで標準的な自己紹介文
  // (「◯◯株式会社の△△です」等)から取得する(extractCompanyName参照)。
  // 取得できない場合は推測せずcandidateに含めない。
  const sourceCompany = sanitizeDisplayName(extractCompanyName(body));
  if (sourceCompany) candidate.sourceCompany = sourceCompany;

  // 商流。実メールに書かれている表現をそのまま保持するだけで、構造化・
  // 推測は行わない(例: "貴社まで" "現場→弊社")。
  const commercialFlow = sanitizeDisplayName(extractLabeledValue(body, COMMERCIAL_FLOW_LABELS));
  if (commercialFlow) candidate.commercialFlow = commercialFlow;

  // extractLabeledValueの各セクション抽出は、見出し記号の様式が本文内で
  // 混在する(【】見出しの後に■見出しが続く等)実データで、次の見出しを
  // 認識できず末尾の署名ブロック(社名・氏名・メールアドレス)まで値に
  // 取り込んでしまう不具合が確認された。誤抽出するとマッチング精度を
  // 壊すため、requiredSkills/尚可スキルの値には安全側の切り詰めを必ず通す。
  const requiredValue = truncateAtSignature(
    extractLabeledValue(body, ['必須スキル', '必要スキル', '必須スキル・経験', '必須要件', '必須']) ?? '',
  ) || undefined;
  const preferredValue =
    truncateAtSignature(extractLabeledValue(body, ['歓迎スキル', '尚可スキル', '尚可要件', '尚可', '歓迎']) ?? '') ||
    undefined;
  // 株式会社キャリアビート形式で観察された「■スキル■」+「<<必須>>」/
  // 「<<尚可>>」(稀に【必須】【尚可】)のネスト構造。明示的な必須/歓迎スキル
  // ラベルが無い場合のみのフォールバックとして使う(優先順位を維持)。
  const rawSkillSectionValue = requiredValue || preferredValue ? undefined : extractLabeledValue(body, ['スキル']);
  const skillSectionValue = rawSkillSectionValue ? truncateAtSignature(rawSkillSectionValue) || undefined : undefined;
  const nestedSkills = skillSectionValue ? extractNestedSkillSections(skillSectionValue) : {};

  // 見出し行の直後に「・」「•」箇条書きが複数行続く形式(番号/□等の見出し
  // + 尚可：等のサブラベルで必須/尚可が分かれるケースを含む)。上記2経路の
  // いずれでも取得できなかった場合のみのフォールバックとして使う
  // (優先順位を維持し、誤って先勝ちさせない)。
  const needsBulletFallback = !requiredValue && !preferredValue && !nestedSkills.required && !nestedSkills.preferred;
  const PREFERRED_SUB_LABELS = ['尚可要件', '尚可スキル', '尚可', '歓迎スキル', '歓迎'];
  const bulletBlockRequired = needsBulletFallback
    ? extractLabeledBulletBlock(body, ['必須スキル・経験', '必須要件', '必須スキル', '必要スキル'], PREFERRED_SUB_LABELS)
    : {};
  // 「スキル」という見出し単独では、必須/尚可のどちらかを示す根拠が本文中
  // に無く、内容全体を「必須」と決めつけると捏造になる。そのため、この
  // 汎用見出しは、見出し内部で実際に尚可等のサブラベル分離が検出できた
  // 場合(例:「□スキル：...尚可：...」)のみ採用する。
  const bulletBlockGeneric =
    needsBulletFallback && !bulletBlockRequired.main
      ? extractLabeledBulletBlock(body, ['スキル'], PREFERRED_SUB_LABELS)
      : {};
  const bulletBlock = bulletBlockRequired.main ? bulletBlockRequired : bulletBlockGeneric.sub ? bulletBlockGeneric : {};

  // 「◆必須スキル： ・Azureの要件定義、設計、構築経験 ・Azure環境における…」
  // のように、ラベル直後の値自体が「・」区切りの自然文列挙になる実データが
  // 見つかった。この形式にparseRequiredSkillList(短い技術名+年数のカンマ/
  // スラッシュ区切り列挙を想定)を使うと、文中の読点「、」でも誤って
  // 分割してしまう(例:"Azureの要件定義、設計、構築経験"が3件に分裂)。
  // 値が「・」始まりかどうかで、自然文の箇条書き(parseNestedRequirementList)
  // か、短い技術名列挙(parseRequiredSkillList)かを判定する。
  const parseSkillValue = (value: string, required: boolean) =>
    /^[・•]/.test(value.trim()) ? parseNestedRequirementList(value, required) : parseRequiredSkillList(value, required);

  const requiredSkills = [
    ...(requiredValue
      ? parseSkillValue(requiredValue, true)
      : nestedSkills.required
        ? parseNestedRequirementList(nestedSkills.required, true)
        : bulletBlock.main
          ? parseNestedRequirementList(bulletBlock.main, true)
          : []),
    ...(preferredValue
      ? parseSkillValue(preferredValue, false)
      : nestedSkills.preferred
        ? parseNestedRequirementList(nestedSkills.preferred, false)
        : bulletBlock.sub
          ? parseNestedRequirementList(bulletBlock.sub, false)
          : []),
  ];
  if (requiredSkills.length > 0) candidate.requiredSkills = requiredSkills;

  // 「■単価：55万円\n　※140H～190H 時間精算 中間割り」のように、単価ラベルの
  // 値の直後に精算時間等の※注記が(改行を挟んでも)続く実データで、注記内の
  // 数値(140/190)がparseRateRangeの数値カウントを狂わせ、本来1つだけの
  // 単価(55)を検出できなくなる不具合が見つかった。他のラベル値抽出と同様、
  // ※注記はstripNoteSuffixで切り落としてから数値解析する。
  const rateValue = stripNoteSuffix(extractLabeledValue(body, ['単価', '金額', '契約金額', '単金']) ?? '') || undefined;
  const rateRange = rateValue ? parseRateRange(rateValue) : findRateInFreeText(subject);
  if (rateRange) {
    candidate.rateMin = rateRange.min;
    candidate.rateMax = rateRange.max;
  }

  const location = extractLabeledValue(body, ['勤務地', '作業場所', '場所']);
  if (location) candidate.location = location;

  const remoteValue = extractLabeledValue(body, ['リモート', '通勤', '出社']);
  const remoteAllowed =
    (remoteValue ? parseYesNo(remoteValue) : undefined) ??
    (location ? findRemoteInFreeText(location) : undefined) ??
    findRemoteInFreeText(subject);
  if (remoteAllowed !== undefined) candidate.remoteAllowed = remoteAllowed;

  const startDateValue = extractLabeledValue(body, ['稼働開始', '開始日', '作業期間', '期間']);
  const startDate = startDateValue ? parseDateValue(startDateValue) : undefined;
  if (startDate) candidate.startDate = startDate;

  const japaneseLevelValue = extractLabeledValue(body, ['日本語レベル', '日本語']);
  const japaneseLevel = japaneseLevelValue ? parseJapaneseLevel(japaneseLevelValue) : undefined;
  if (japaneseLevel) candidate.japaneseLevel = japaneseLevel;

  return candidate;
}

export function parseEngineerCandidate(subject: string, body: string, id: string): Record<string, unknown> {
  const candidate: Record<string, unknown> = { id };

  // 表示用の人材名。「氏名：」ラベルが要員メールのほぼ全件で観測された
  // ため最優先とする(件名は要員メールでは氏名を表さないためフォール
  // バックにしない)。得られない場合はcandidateに含めず、呼び出し側(UI)
  // で内部IDによる安全なフォールバック表示に委ねる。実メール調査で、値に
  // "S.F（男性）"のように性別が直接続けて記載される形式(60件中26件)が
  // 確認されたため、性別は表示不要な属性として取り除く。
  const rawEngineerName = extractLabeledValue(body, ENGINEER_NAME_LABELS);
  const engineerName = sanitizeDisplayName(rawEngineerName ? stripTrailingGenderAnnotation(rawEngineerName) : undefined);
  if (engineerName) candidate.engineerName = engineerName;

  // companyName = その要員情報を送信してきた会社名。「所属」欄とは完全に
  // 独立して、(1)本文冒頭の名乗り(自己紹介文) > (2)署名ブロック(会社名の
  // 近傍に連絡先ラベルがある箇所)の優先順位でのみ抽出する。案件側
  // sourceCompanyの単独会社名フォールバック(本文中で最初に見つかった
  // 法人格表記)は要員メールには使わない — 実メール調査で、本文中の
  // 複数の法人格表記の中には返信引用ヘッダ等に混入した無関係な会社名
  // (受信者自身の会社名)も確認されており、単純な最初の一致では送信元を
  // 誤認するリスクが実証されたため。どちらのパターンにも一致しなければ、
  // 要員本人の所属先を推測する機能ではないためcompanyNameは設定しない。
  const companyName = extractGreetingCompanyName(body) ?? extractSignatureCompanyName(body);
  if (companyName) candidate.companyName = companyName;

  // 商流・契約形態。「商流：」「☆商流：」の明示ラベルを最優先する(実
  // メールで確認された表記)。要員メール側にはこの明示ラベルはほぼ存在
  // しないため、無い場合は「所属：」欄の値をそのまま契約形態として使う
  // (実メール調査で98%以上が契約形態の記述だったため。会社名部分を
  // 抜き出す処理はしない — companyNameは上記の名乗りからのみ取得する
  // 設計に一本化したため)。
  const commercialFlow =
    sanitizeDisplayName(extractLabeledValue(body, COMMERCIAL_FLOW_LABELS)) ??
    sanitizeDisplayName(extractLabeledValue(body, AFFILIATION_LABELS));
  if (commercialFlow) candidate.commercialFlow = commercialFlow;

  const skillsValue = extractLabeledValue(body, ['スキル']);
  if (skillsValue) candidate.skills = parseEngineerSkillList(skillsValue);

  // BP-A形式の「・単金（税抜）：」もここに接続する(単金＝要員側の希望単価と同義)。
  // 括弧の全角/半角ゆれを個別のラベルとして扱う(注釈込みでラベルの一部とする)。
  // 一部の実メールではコロンが省略される("・単金（税抜）85万円")ため、
  // その場合は数字直前フォールバックで補う。
  const rateLabels = ['希望単価', '単価', '単金（税抜）', '単金(税抜)', '単金'];
  const rateValue = stripNoteSuffix(
    extractLabeledValue(body, rateLabels) ?? extractBulletValueNoColonNumeric(body, rateLabels) ?? '',
  ) || undefined;
  const rateRange = rateValue ? parseRateRange(rateValue) : findRateInFreeText(subject);
  if (rateRange) {
    candidate.desiredRateMin = rateRange.min;
    candidate.desiredRateMax = rateRange.max;
  }

  // BP-A形式の実メールには「勤務地」「作業場所」「希望勤務地」に相当するラベルは
  // 存在せず、「・最寄駅：」(要員の最寄駅、居住地に近い情報)のみが記載される。
  // 「最寄駅」は「希望勤務地」そのものではないが、BP-A形式では他に代替の
  // 位置情報が無いため、既存の【最寄駅】形式(非BP-A、通常のスキルシート形式)
  // と同様にdesiredLocationsの値として採用する。実際に「勤務地」「作業場所」
  // 相当のラベルが記載されているメールでは、そちらが優先される(labels配列の
  // 先頭に「希望勤務地」を置いているため)。「最寄り駅」(り入り)という表記
  // ゆれも実メールで観測されたため候補に加える。
  const locationsValue = extractLabeledValue(body, ['希望勤務地', '最寄駅', '最寄り駅']);
  // 一部の実メール(単独■見出し形式)では、最寄駅の値に直接
  // "※リモート希望（週1~4日出社可）"のような注記が続けて書かれ、次の■まで
  // 丸ごと1つの値として抽出される。注記込みで勤務地とみなすと汚染される
  // ため、勤務地としてはstripNoteSuffixで※以降を切り落とす(remoteDesiredの
  // 判定には注記込みの元の値を別途使う、下記参照)。
  if (locationsValue) {
    const location = stripNoteSuffix(locationsValue);
    if (location) candidate.desiredLocations = parseLocationList(location);
  }

  // BP-A形式の「・出社頻度：」は「稼働●回まで出社可能」「常駐可能」等、
  // リモートの可否を直接表さない自由文が多い(「可」の一致だけでtrue判定すると
  // 「出社可能」「常駐可能」まで誤ってリモート希望=trueにしてしまう)。そのため
  // 出社頻度の値は、直接的な「リモート」ラベルの値(parseYesNoで柔軟に判定)とは
  // 別に、フルリモート/リモートメイン等の強いキーワードのみで判定する
  // findRemoteInFreeTextを使う(該当が無ければ無理に推測せずundefinedのまま)。
  // 最寄駅の値に埋め込まれた注記(上記)も同様にfindRemoteInFreeTextで拾う
  // (案件側のfindRemoteInFreeText(location)フォールバックと同じ考え方)。
  const directRemoteValue = extractLabeledValue(body, ['リモート希望', 'リモート', '通勤']);
  const commuteFrequencyValue = extractLabeledValue(body, ['出社頻度']);
  const remoteDesired =
    (directRemoteValue ? parseYesNo(directRemoteValue) : undefined) ??
    (commuteFrequencyValue ? findRemoteInFreeText(commuteFrequencyValue) : undefined) ??
    (locationsValue ? findRemoteInFreeText(locationsValue) : undefined) ??
    findRemoteInFreeText(subject);
  if (remoteDesired !== undefined) candidate.remoteDesired = remoteDesired;

  // BP-A形式の実メールは「・稼働：」(開始/可能日を表す接頭辞無しの単独ラベル)
  // のみを使うため、末尾に素の'稼働'も候補として追加する(より具体的な
  // ラベルを優先する順序は維持)。
  const availableFromValue = extractLabeledValue(body, ['稼働可能日', '稼働開始日', '稼働開始', '稼働']);
  const availableFrom = availableFromValue ? parseDateValue(availableFromValue) : undefined;
  if (availableFrom) candidate.availableFrom = availableFrom;

  const japaneseLevelValue = extractLabeledValue(body, ['日本語レベル', '日本語']);
  const japaneseLevel = japaneseLevelValue ? parseJapaneseLevel(japaneseLevelValue) : undefined;
  if (japaneseLevel) candidate.japaneseLevel = japaneseLevel;

  return candidate;
}

/**
 * RawEmailを案件/要員メールとして判定し、既存のvalidateProjectRecord /
 * validateEngineerRecordにそのまま渡せる候補オブジェクトへ変換する。
 *
 * このParserはvalidationを行わない(既存validationとの責務分離)。
 * 抽出できなかったフィールドはcandidateにキーごと含めず、
 * validateProjectRecord/validateEngineerRecordの必須項目チェックに委ねる。
 * 万能パーサーではなく、想定外フォーマットでは例外を投げず"unparsed"を返す。
 */
export function parseEmail(raw: RawEmail): ParsedEmailResult {
  try {
    const body = raw.bodyText ?? '';
    const subject = raw.subject ?? '';
    const type = detectEmailType(subject, body);

    if (type === 'project') {
      return { status: 'parsed', recordType: 'project', candidate: parseProjectCandidate(subject, body, raw.id) };
    }
    if (type === 'engineer') {
      return { status: 'parsed', recordType: 'engineer', candidate: parseEngineerCandidate(subject, body, raw.id) };
    }
    return { status: 'unparsed', reason: 'could not determine whether this is a project or engineer email' };
  } catch {
    return { status: 'unparsed', reason: 'unexpected email format' };
  }
}

// スキル名の表記ゆれを吸収する正規化ロジック。
//
// SKILL_SYNONYMS は「正規名 -> 表記ゆれのリスト」を持つ辞書。
// normalizeSkillName() はスキル名を小文字化・記号除去した上でこの辞書を引き、
// マッチすれば正規名を、しなければ正規化した入力そのものを返す。

const SKILL_SYNONYMS: Record<string, string[]> = {
  javascript: ['javascript', 'js', 'ecmascript'],
  typescript: ['typescript', 'ts'],
  react: ['react', 'reactjs', 'react.js'],
  vue: ['vue', 'vuejs', 'vue.js'],
  angular: ['angular', 'angularjs', 'angular.js'],
  nodejs: ['nodejs', 'node.js', 'node'],
  java: ['java'],
  spring: ['spring', 'springboot', 'spring boot', 'springframework'],
  python: ['python', 'py'],
  django: ['django'],
  flask: ['flask'],
  php: ['php'],
  laravel: ['laravel'],
  ruby: ['ruby'],
  rails: ['rails', 'ruby on rails', 'ror'],
  csharp: ['c#', 'csharp', 'c sharp', '.net', 'dotnet'],
  golang: ['go', 'golang'],
  aws: ['aws', 'amazon web services'],
  gcp: ['gcp', 'google cloud', 'google cloud platform'],
  azure: ['azure', 'microsoft azure'],
  docker: ['docker'],
  kubernetes: ['kubernetes', 'k8s'],
  sql: ['sql'],
  mysql: ['mysql'],
  postgresql: ['postgresql', 'postgres'],
  oracle: ['oracle', 'oracledb', 'oracle database'],
  mongodb: ['mongodb', 'mongo'],
  linux: ['linux'],
  git: ['git'],
  swift: ['swift'],
  kotlin: ['kotlin'],
  flutter: ['flutter'],
  cplusplus: ['c++', 'cpp'],
  c: ['c言語', 'c language'],
  html: ['html', 'html5'],
  css: ['css', 'css3'],
  pmo: ['pmo', 'プロジェクトマネジメントオフィス'],
  pm: ['pm', 'プロジェクトマネージャー', 'project manager'],
  pl: ['pl', 'プロジェクトリーダー', 'project leader'],
  infrastructure: ['インフラ', 'infrastructure', 'infra'],
  network: ['ネットワーク', 'network'],
  salesforce: ['salesforce', 'セールスフォース'],
};

/** 表記ゆれ -> 正規名 の逆引きマップ（初回アクセス時に構築） */
let reverseIndex: Map<string, string> | null = null;

function buildReverseIndex(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(SKILL_SYNONYMS)) {
    for (const variant of variants) {
      map.set(cleanToken(variant), canonical);
    }
    map.set(cleanToken(canonical), canonical);
  }
  return map;
}

/** 小文字化・前後空白除去・記号(.・スペース)の除去などの基本正規化 */
function cleanToken(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[.\-_]/g, '')
    .replace(/\s+/g, '');
}

/**
 * スキル名を正規化する。
 * 辞書に登録された表記ゆれであれば正規名（英小文字）を返す。
 * 未登録のスキル名は cleanToken() 相当の正規化のみ行った文字列を返す
 * （案件側・要員側で同じ表記ゆれをしていれば一致判定できる）。
 */
export function normalizeSkillName(raw: string): string {
  if (!reverseIndex) {
    reverseIndex = buildReverseIndex();
  }
  const cleaned = cleanToken(raw);
  return reverseIndex.get(cleaned) ?? cleaned;
}

export function isSameSkill(a: string, b: string): boolean {
  return normalizeSkillName(a) === normalizeSkillName(b);
}

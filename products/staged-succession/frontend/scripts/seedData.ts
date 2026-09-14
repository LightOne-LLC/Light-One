import { Company, Talent } from '../src/types';

/**
 * All entries here are clearly-fictional demo/test data (see names below) —
 * never a real person or company. Used only to populate a dev/staging
 * Supabase project so the Search screen has candidates to browse.
 */

export interface SeedTalent extends Omit<Talent, 'id' | 'uid'> {
  email: string;
}
export interface SeedCompany extends Omit<Company, 'id' | 'uid'> {
  email: string;
}

export const SEED_TALENTS: SeedTalent[] = [
  {
    email: 'seed-talent-1@example.com',
    name: 'サンプル 太郎',
    skills: ['経理', 'EC運営', 'Webマーケ'],
    interestedIndustries: ['製造業', '卸売業'],
    weeklyAvailableHours: 10,
    workStyle: 'both',
    relocatable: true,
    prefecture: '長野県',
    successionInterestLevel: 5,
    fundingCapacity: 1200,
    bio: '開発・検証用のダミープロフィールです（架空の人物）。製造業の経理・EC運営を想定。',
  },
  {
    email: 'seed-talent-2@example.com',
    name: 'テスト 花子',
    skills: ['Webデザイン', 'SNS運用', 'EC運営'],
    interestedIndustries: ['飲食業', '観光業'],
    weeklyAvailableHours: 5,
    workStyle: 'remote',
    relocatable: false,
    prefecture: '東京都',
    successionInterestLevel: 2,
    fundingCapacity: 100,
    bio: 'テスト用のダミープロフィールです（架空の人物）。',
  },
  {
    email: 'seed-talent-3@example.com',
    name: '検証 次郎',
    skills: ['製造業経験', '生産管理', '品質管理'],
    interestedIndustries: ['製造業'],
    weeklyAvailableHours: 15,
    workStyle: 'onsite',
    relocatable: true,
    prefecture: '愛知県',
    successionInterestLevel: 4,
    fundingCapacity: 800,
    bio: '検証用のダミープロフィールです（架空の人物）。',
  },
  {
    email: 'seed-talent-4@example.com',
    name: 'ダミー 三郎',
    skills: ['経営企画', '財務', 'M&A'],
    interestedIndustries: ['小売業', '卸売業'],
    weeklyAvailableHours: 8,
    workStyle: 'both',
    relocatable: true,
    prefecture: '大阪府',
    successionInterestLevel: 5,
    fundingCapacity: 2000,
    bio: 'ダミーデータです。実在の人物ではありません。',
  },
  {
    email: 'seed-talent-5@example.com',
    name: '架空 四郎',
    skills: ['農業経験', 'EC運営', '観光開発'],
    interestedIndustries: ['農業', '観光業'],
    weeklyAvailableHours: 20,
    workStyle: 'onsite',
    relocatable: false,
    prefecture: '北海道',
    successionInterestLevel: 3,
    fundingCapacity: 300,
    bio: '架空の人物として作成したテストデータです。',
  },
];

export const SEED_COMPANIES: SeedCompany[] = [
  {
    email: 'seed-company-1@example.com',
    name: 'サンプル製作所',
    industry: '製造業',
    prefecture: '長野県',
    overview: '開発・検証用のダミー企業です（架空）。味噌・漬物製造業を想定したテストデータ。',
    financialHealth: 'average',
    wantedPersonaTags: ['経理', 'EC運営', 'Webマーケ'],
    wantedPersonaTagWeights: { 経理: 2, EC運営: 1.5, Webマーケ: 1 },
    sideJobAcceptable: true,
    requiredWeeklyHours: { min: 5, max: 15 },
    successionTimeframe: '1-3y',
  },
  {
    email: 'seed-company-2@example.com',
    name: 'テスト商事株式会社',
    industry: '飲食業',
    prefecture: '神奈川県',
    overview: '検証用のダミー企業です（架空）。カフェ運営業を想定したテストデータ。',
    financialHealth: 'good',
    wantedPersonaTags: ['Webデザイン', 'SNS運用'],
    sideJobAcceptable: true,
    requiredWeeklyHours: { min: 3, max: 8 },
    successionTimeframe: '5y+',
  },
  {
    email: 'seed-company-3@example.com',
    name: '架空精密株式会社',
    industry: '製造業',
    prefecture: '愛知県',
    overview: 'テスト用の架空企業です。精密加工業を想定したダミーデータ。',
    financialHealth: 'needs_improvement',
    wantedPersonaTags: ['生産管理', '品質管理', '製造業経験'],
    wantedPersonaTagWeights: { 製造業経験: 2 },
    sideJobAcceptable: true,
    requiredWeeklyHours: { min: 10, max: 20 },
    successionTimeframe: 'immediate',
  },
  {
    email: 'seed-company-4@example.com',
    name: 'ダミーフーズ株式会社',
    industry: '卸売業',
    prefecture: '大阪府',
    overview: 'ダミーデータとして作成した卸売業の架空企業です。',
    financialHealth: 'good',
    wantedPersonaTags: ['経営企画', '財務', 'M&A'],
    sideJobAcceptable: true,
    requiredWeeklyHours: { min: 5, max: 10 },
    successionTimeframe: '1-3y',
  },
  {
    email: 'seed-company-5@example.com',
    name: '検証観光株式会社',
    industry: '農業',
    prefecture: '北海道',
    overview: '検証用の架空農業法人です。副業からの受け入れは現状不可という設定のテストデータ。',
    financialHealth: 'average',
    wantedPersonaTags: ['農業経験', 'EC運営'],
    sideJobAcceptable: false,
    requiredWeeklyHours: { min: 30, max: 40 },
    successionTimeframe: '3-5y',
  },
];

export const SEED_PASSWORD = 'password123!';

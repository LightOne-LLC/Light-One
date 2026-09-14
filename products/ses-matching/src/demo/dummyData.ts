// PWA画面表示用の匿名ダミーデータ。実在の案件・企業・要員ではない。
//
// 将来的にはGmail等の外部データソースをParser/Normalizerで
// ProjectRecord/EngineerRecordへ変換したものに差し替える想定だが、
// 現時点ではDB/APIが存在しないため、ここに直接定義した固定データを使う。

import type { EngineerRecord, ProjectRecord } from '../intake/types';

export const dummyProjects: ProjectRecord[] = [
  {
    id: 'project-001',
    requiredSkills: [
      { name: 'Java', minYears: 3, required: true },
      { name: 'AWS', minYears: 1, required: false },
    ],
    rateMin: 60,
    rateMax: 80,
    location: '東京都',
    remoteAllowed: true,
    startDate: { precision: 'day', value: '2026-04-01' },
    japaneseLevel: 'business',
  },
  {
    id: 'project-002',
    requiredSkills: [
      { name: 'React', minYears: 2, required: true },
      { name: 'TypeScript', minYears: 2, required: true },
    ],
    rateMin: 55,
    rateMax: 75,
    location: '大阪府',
    remoteAllowed: false,
    startDate: { precision: 'day', value: '2026-05-01' },
    japaneseLevel: 'business',
  },
];

export const dummyEngineers: EngineerRecord[] = [
  {
    id: 'engineer-a',
    skills: [
      { name: 'Java', years: 5 },
      { name: 'AWS', years: 3 },
    ],
    desiredRateMin: 70,
    desiredRateMax: 70,
    desiredLocations: ['東京都'],
    remoteDesired: true,
    availableFrom: { precision: 'day', value: '2026-04-01' },
    japaneseLevel: 'business',
  },
  {
    id: 'engineer-b',
    skills: [{ name: 'Java', years: 4 }],
    desiredRateMin: 80,
    desiredRateMax: 80,
    desiredLocations: ['東京都'],
    remoteDesired: false,
    availableFrom: { precision: 'day', value: '2026-07-01' },
    japaneseLevel: 'business',
  },
  {
    id: 'engineer-c',
    skills: [
      { name: 'Java', years: 6 },
      { name: 'AWS', years: 2 },
    ],
    desiredRateMin: 65,
    desiredRateMax: 65,
    desiredLocations: ['東京都'],
    remoteDesired: true,
    availableFrom: { precision: 'day', value: '2026-04-01' },
    japaneseLevel: 'business',
  },
  {
    id: 'engineer-d',
    skills: [
      { name: 'React', years: 3 },
      { name: 'TypeScript', years: 4 },
    ],
    desiredRateMin: 60,
    desiredRateMax: 70,
    desiredLocations: ['大阪府', '東京都'],
    remoteDesired: false,
    availableFrom: { precision: 'day', value: '2026-05-01' },
    japaneseLevel: 'business',
  },
];

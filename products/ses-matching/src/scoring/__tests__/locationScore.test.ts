import { calcLocationScore } from '../locationScore';

describe('calcLocationScore', () => {
  it('案件・要員ともにリモート希望なら満点', () => {
    expect(calcLocationScore('東京都', true, ['大阪府'], true)).toBe(1);
  });

  it('リモート不可でも希望勤務地が一致すれば満点', () => {
    expect(calcLocationScore('東京都', false, ['東京都', '神奈川県'], false)).toBe(1);
  });

  it('案件がリモート可で要員が出社希望のみだが勤務地一致なら満点', () => {
    expect(calcLocationScore('東京都', true, ['東京都'], false)).toBe(1);
  });

  it('案件がリモート可だが要員が別の勤務地を希望する出社希望のみの場合は中程度スコア', () => {
    expect(calcLocationScore('東京都', true, ['大阪府'], false)).toBe(0.7);
  });

  it('リモート不可かつ勤務地不一致の場合は0点', () => {
    expect(calcLocationScore('東京都', false, ['大阪府'], true)).toBe(0);
  });
});

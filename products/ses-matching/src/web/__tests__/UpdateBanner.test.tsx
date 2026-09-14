import { act, fireEvent, render, screen } from '@testing-library/react';
import { UpdateBanner } from '../components/UpdateBanner';

// registerSWの内部呼び出しをテストごとに差し替えられるよう、モジュール自体をmockする
// (vitest.config.tsのaliasは実運用でno-opにするためのもので、ここでは
// onNeedReload等のコールバックを直接呼び出して動作を検証する)。
const registerSWMock = vi.fn();

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: unknown) => registerSWMock(options),
}));

type RegisterSWOptions = {
  immediate?: boolean;
  onNeedReload?: () => void;
  onRegisteredSW?: (swUrl: string, registration: { update: () => Promise<void> } | undefined) => void;
};

afterEach(() => {
  registerSWMock.mockReset();
});

describe('UpdateBanner', () => {
  it('マウント時にimmediate:trueでService Workerを登録する', () => {
    render(<UpdateBanner />);
    expect(registerSWMock).toHaveBeenCalledTimes(1);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    expect(options.immediate).toBe(true);
  });

  it('更新が無い間はバナーを表示しない(強制reloadもしない)', () => {
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    render(<UpdateBanner />);

    expect(screen.queryByText(/新しいバージョン/)).toBeNull();
    expect(reloadSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('onNeedReloadが呼ばれるとバナーを表示する(自動reloadはしない)', () => {
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    act(() => options.onNeedReload?.());

    expect(screen.getByText('新しいバージョンがあります。更新しますか？')).toBeTruthy();
    // バナー表示だけで、ユーザー操作前にreloadはしない
    expect(reloadSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('「更新」ボタンを押すとreloadする', () => {
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    act(() => options.onNeedReload?.());

    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('登録完了時に定期的な更新チェック(registration.update)を開始する', () => {
    vi.useFakeTimers();
    const updateSpy = vi.fn().mockResolvedValue(undefined);

    render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    options.onRegisteredSW?.('/sw.js', { update: updateSpy });

    expect(updateSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

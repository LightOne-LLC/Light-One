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

  it('登録完了後、1時間待たず起動直後に一度更新チェック(registration.update)を行う', () => {
    vi.useFakeTimers();
    const updateSpy = vi.fn().mockResolvedValue(undefined);

    render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    options.onRegisteredSW?.('/sw.js', { update: updateSpy });

    // 1時間経過を待たず、登録完了直後に1回呼ばれている。
    expect(updateSpy).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('登録完了後は、起動直後のチェックに加えて1時間間隔でも定期的に更新チェックを行う', () => {
    vi.useFakeTimers();
    const updateSpy = vi.fn().mockResolvedValue(undefined);

    render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    options.onRegisteredSW?.('/sw.js', { update: updateSpy });

    expect(updateSpy).toHaveBeenCalledTimes(1); // 起動直後の分

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(updateSpy).toHaveBeenCalledTimes(2); // + 1時間経過分

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(updateSpy).toHaveBeenCalledTimes(3); // + さらに1時間経過分

    vi.useRealTimers();
  });

  it('document.visibilitychangeでvisibleに戻ったとき、更新チェックを行う', () => {
    const updateSpy = vi.fn().mockResolvedValue(undefined);

    render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    options.onRegisteredSW?.('/sw.js', { update: updateSpy });

    expect(updateSpy).toHaveBeenCalledTimes(1); // 起動直後の分
    updateSpy.mockClear();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('document.visibilitychangeでhiddenになったときは、更新チェックを行わない', () => {
    const updateSpy = vi.fn().mockResolvedValue(undefined);

    render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    options.onRegisteredSW?.('/sw.js', { update: updateSpy });

    updateSpy.mockClear(); // 起動直後の分を除外して、以降の呼び出しだけを見る

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('アンマウント後はvisibilitychange listenerもintervalも残らない(メモリリーク・多重登録を防ぐ)', () => {
    vi.useFakeTimers();
    const updateSpy = vi.fn().mockResolvedValue(undefined);
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    options.onRegisteredSW?.('/sw.js', { update: updateSpy });

    updateSpy.mockClear();
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    // アンマウント後にvisibilitychangeが飛んできても、intervalが進んでも、
    // もう更新チェックは呼ばれない。
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(updateSpy).not.toHaveBeenCalled();

    removeEventListenerSpy.mockRestore();
    vi.useRealTimers();
  });

  it('登録完了(onRegisteredSW)より先にアンマウントされた場合、その後の登録完了でlistener/intervalを残さない', () => {
    vi.useFakeTimers();
    const updateSpy = vi.fn().mockResolvedValue(undefined);

    const { unmount } = render(<UpdateBanner />);
    const options = registerSWMock.mock.calls[0][0] as RegisterSWOptions;
    unmount();

    // registerSWの登録処理が非同期に完了するケースを模す
    // (アンマウント後にonRegisteredSWが呼ばれても何もしない)。
    options.onRegisteredSW?.('/sw.js', { update: updateSpy });

    expect(updateSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(updateSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

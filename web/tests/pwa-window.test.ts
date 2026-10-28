import { describe, expect, it, vi } from 'vitest';
import { initializePwaWindow } from '../src/pwaWindow';

function target(standalone: boolean, width = 1920, height = 1040) {
  return {
    matchMedia: vi.fn(() => ({ matches: standalone }) as MediaQueryList),
    screen: { availWidth: width, availHeight: height } as Screen,
    resizeTo: vi.fn(),
  };
}
describe('размер окна PWA', () => {
  it('задаёт начальный размер только установленному приложению', () => {
    const app = target(true);
    initializePwaWindow(app);
    expect(app.resizeTo).toHaveBeenCalledWith(1360, 960);
    const tab = target(false);
    initializePwaWindow(tab);
    expect(tab.resizeTo).not.toHaveBeenCalled();
  });
  it('учитывает рабочую область экрана и ограничение браузера', () => {
    const small = target(true, 1280, 720);
    initializePwaWindow(small);
    expect(small.resizeTo).toHaveBeenCalledWith(1280, 720);
    const blocked = target(true);
    blocked.resizeTo.mockImplementation(() => {
      throw new Error('Not allowed');
    });
    expect(() => initializePwaWindow(blocked)).not.toThrow();
    const mobile = target(true, 390, 800);
    initializePwaWindow(mobile);
    expect(mobile.resizeTo).not.toHaveBeenCalled();
  });
});

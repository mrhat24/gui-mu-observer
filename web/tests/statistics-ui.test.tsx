// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Statistics from '../src/components/Statistics';
import { defaultSetup, fromSetup } from '../src/domain/dungeon';
const mock = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../src/storage/database', () => ({ Repository: { open: mock.open } }));
const now = 1_000_000_000;
const normal = {
  ...fromSetup(defaultSetup(), now - 600_000, 'normal'),
  status: 'stopped' as const,
  endedAt: now - 300_000,
};
const debug = { ...normal, id: 'debug', createdAt: now - 3_600_000, debug: true };
const close = vi.fn();
const repo = { history: vi.fn(), sessionEvents: vi.fn(), close };
beforeEach(() => {
  vi.clearAllMocks();
  mock.open.mockResolvedValue(repo);
  repo.history.mockResolvedValue({ sessions: [normal, debug], skipped: 0 });
  repo.sessionEvents.mockResolvedValue([
    { sessionId: normal.id, at: normal.createdAt, kind: 'start', snapshot: normal },
  ]);
});
afterEach(cleanup);
describe('экран статистики', () => {
  it('скрывает отладочные заходы по умолчанию и позволяет включить их', async () => {
    render(<Statistics revision={0} now={now} onTracker={() => undefined} />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Подробнее о заходе/ })).toHaveLength(1),
    );
    fireEvent.click(screen.getByLabelText('Показать отладочные'));
    expect(screen.getAllByRole('button', { name: /^Подробнее о заходе/ })).toHaveLength(2);
    expect(screen.getByText('Отладка')).toBeTruthy();
  });
  it('открывает сохранённый журнал и закрывает подключения', async () => {
    const { unmount } = render(<Statistics revision={0} now={now} onTracker={() => undefined} />);
    const details = await screen.findByRole('button', { name: /^Подробнее о заходе/ });
    fireEvent.click(details);
    await screen.findByText('Начало прохождения');
    expect(repo.sessionEvents).toHaveBeenCalledWith('normal');
    expect(screen.getByText('АФК 3: Не наступил')).toBeTruthy();
    unmount();
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('показывает ошибку чтения и восстанавливается после повторной загрузки', async () => {
    mock.open.mockRejectedValueOnce(new Error('Нет доступа'));
    render(<Statistics revision={0} now={now} onTracker={() => undefined} />);
    await screen.findByText('Нет доступа');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    await screen.findByRole('button', { name: /^Подробнее о заходе/ });
    expect(screen.queryByText('Нет доступа')).toBeNull();
  });
  it('закрывает поздно открывшуюся базу после ухода с экрана', async () => {
    let resolve!: (value: typeof repo) => void;
    mock.open.mockImplementationOnce(
      () =>
        new Promise<typeof repo>((done) => {
          resolve = done;
        }),
    );
    const { unmount } = render(<Statistics revision={0} now={now} onTracker={() => undefined} />);
    unmount();
    await act(async () => {
      resolve(repo);
    });
    expect(close).toHaveBeenCalledOnce();
  });
});

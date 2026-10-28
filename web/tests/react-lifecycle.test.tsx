// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultSetup,
  emptySnapshot,
  fromSetup,
  transition,
  type Snapshot,
} from '../src/domain/dungeon';
import { useTracker } from '../src/hooks/useTracker';
import type { TrackerRepository } from '../src/services/TrackerService';
import SetupDialog from '../src/components/SetupDialog';

const mock = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../src/storage/database', () => ({ Repository: { open: mock.open } }));
const start = 1_000_000;

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function repository(shared: { state: Snapshot }) {
  return {
    read: vi.fn(async () => structuredClone(shared.state)),
    execute: vi.fn(async (...args: Parameters<TrackerRepository['execute']>) => {
      const [command, now, revision] = args;
      if (revision !== undefined && revision !== shared.state.revision)
        throw new Error('Revision conflict');
      shared.state = transition(shared.state, command, now).snapshot;
      return structuredClone(shared.state);
    }),
    close: vi.fn(),
  };
}

describe('React lifecycle', () => {
  it('обрабатывает нажатие во время tick и держит busy до сохранения', async () => {
    let tick: (() => void) | undefined;
    const originalInterval = globalThis.setInterval;
    const interval = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation((callback, delay, ...args) => {
        if (delay === 1000) tick = callback as () => void;
        return originalInterval(callback, delay, ...args);
      });
    const shared = {
      state: { ...emptySnapshot(), session: fromSetup(defaultSetup(), start, 'test') },
    };
    const repo = repository(shared);
    mock.open.mockResolvedValue(repo);
    const { result } = renderHook(useTracker);
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.ready).toBe(true);
    });
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const original = repo.execute;
    repo.execute = vi.fn(async (...args) => {
      if (args[0].type === 'tick') await gate;
      return original(...args);
    });
    await act(async () => {
      tick?.();
    });
    let request!: Promise<boolean>;
    act(() => {
      request = result.current.execute({ type: 'next-stage' });
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      finish();
      expect(await request).toBe(true);
    });
    expect(result.current.snapshot.session?.stage).toBe(2);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
    interval.mockRestore();
  });

  it('корректно закрывает отдельные подключения при StrictMode mount/cleanup/mount', async () => {
    const shared = { state: emptySnapshot() };
    const connections: ReturnType<typeof repository>[] = [];
    mock.open.mockImplementation(async () => {
      const repo = repository(shared);
      connections.push(repo);
      return repo;
    });
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, unmount } = renderHook(useTracker, { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    unmount();
    await waitFor(() => {
      for (const connection of connections) expect(connection.close).toHaveBeenCalledTimes(1);
    });
    const previous = connections.length;
    const remounted = renderHook(useTracker, { wrapper });
    await waitFor(() => expect(remounted.result.current.ready).toBe(true));
    expect(connections.length).toBeGreaterThan(previous);
    remounted.unmount();
    await waitFor(() => {
      for (const connection of connections) expect(connection.close).toHaveBeenCalledTimes(1);
    });
  });
});

describe('открытая форма синхронизации', () => {
  it('после ожидания не откатывает фазу и не продлевает чек', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start);
    const setup = defaultSetup();
    setup.stage = 4;
    setup.wave = 5;
    setup.elapsed = 100;
    setup.afk[0] = { status: 'pending', remaining: 90 };
    const session = fromSetup(setup, start, 'test');
    const closed = vi.fn();
    let result: Snapshot | undefined;
    render(
      <SetupDialog
        session={session}
        syncing
        busy={false}
        onClose={closed}
        onSubmit={async (draft, edits) => {
          result = transition(
            { ...emptySnapshot(), session },
            { type: 'sync', setup: draft, edits },
            Date.now(),
          ).snapshot;
          return true;
        }}
      />,
    );
    vi.setSystemTime(start + 30_000);
    fireEvent.click(screen.getByRole('button', { name: 'Применить состояние' }));
    await waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(result?.session?.phase).toEqual({ kind: 'boss', number: 1 });
    expect(result?.session?.phaseStartedAt).toBe(start + 20_000);
    expect(result?.session?.afk[0]).toEqual({ status: 'pending', deadline: start + 90_000 });
  });

  it('отличает вручную изменённое время от нетронутых чеков', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start);
    const setup = defaultSetup();
    setup.stage = 4;
    setup.afk[0] = { status: 'pending', remaining: 90 };
    const session = fromSetup(setup, start, 'test');
    const submit = vi.fn(async () => true);
    render(
      <SetupDialog
        session={session}
        syncing
        busy={false}
        onClose={() => undefined}
        onSubmit={submit}
      />,
    );
    vi.setSystemTime(start + 30_000);
    fireEvent.change(screen.getByLabelText('Прошло с появления, сек'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Применить состояние' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0]).toEqual([
      expect.objectContaining({ elapsed: 10 }),
      { phase: true, afk: [false, false] },
    ]);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { defaultSetup, emptySnapshot, transition } from '../src/domain/dungeon';
import { TrackerService, type TrackerRepository } from '../src/services/TrackerService';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  let state = transition(
    emptySnapshot(),
    { type: 'start', setup: defaultSetup(), id: 'test' },
    1_000_000,
  ).snapshot;
  const repo: TrackerRepository = {
    read: vi.fn(async () => structuredClone(state)),
    execute: vi.fn(async (command, now, revision) => {
      if (revision !== undefined && revision !== state.revision)
        throw new Error('Revision conflict');
      state = transition(state, command, now).snapshot;
      return structuredClone(state);
    }),
    close: vi.fn(),
  };
  const published = vi.fn();
  let now = 1_000_000;
  const service = new TrackerService(repo, published, () => now);
  return {
    repo,
    service,
    published,
    state: () => state,
    setNow: (value: number) => {
      now = value;
    },
  };
}

describe('очередь операций трекера', () => {
  it('выполняет нажатие после занятого tick ровно один раз с новой ревизией', async () => {
    const f = fixture();
    await f.service.initialize();
    const gate = deferred();
    const entered = deferred();
    const original = f.repo.execute;
    f.repo.execute = vi.fn(async (...args: Parameters<TrackerRepository['execute']>) => {
      if (args[0].type === 'tick') {
        entered.resolve();
        await gate.promise;
      }
      return original(...args);
    });
    f.setNow(1_120_000);
    const tick = f.service.tick();
    await entered.promise;
    f.setNow(1_121_000);
    const command = f.service.execute({ type: 'next-stage' });
    expect(f.state().session?.stage).toBe(1);
    gate.resolve();
    await Promise.all([tick, command]);
    expect(f.state().session?.stage).toBe(2);
    expect(f.state().session?.phaseStartedAt).toBe(1_121_000);
    expect(
      vi.mocked(f.repo.execute).mock.calls.filter(([cmd]) => cmd.type === 'next-stage'),
    ).toHaveLength(1);
    expect(vi.mocked(f.repo.execute).mock.calls.at(-1)?.[2]).toBe(2);
  });

  it('не накапливает фоновые ticks, пока операция занята', async () => {
    const f = fixture();
    await f.service.initialize();
    const gate = deferred();
    const entered = deferred();
    const original = f.repo.execute;
    f.repo.execute = vi.fn(async (...args: Parameters<TrackerRepository['execute']>) => {
      entered.resolve();
      await gate.promise;
      return original(...args);
    });
    const first = f.service.tick();
    await entered.promise;
    await Promise.all([f.service.tick(), f.service.tick(), f.service.tick()]);
    gate.resolve();
    await first;
    expect(f.repo.execute).toHaveBeenCalledTimes(1);
  });

  it('после ошибки выполняет следующую команду', async () => {
    const f = fixture();
    await f.service.initialize();
    const invalid = f.service.execute({ type: 'boss-killed' });
    const valid = f.service.execute({ type: 'next-stage' });
    await expect(invalid).rejects.toThrow();
    await valid;
    expect(f.state().session?.stage).toBe(2);
    expect(f.repo.read).toHaveBeenCalledTimes(2);
  });

  it('при закрытии дожидается транзакции и отменяет ожидающие команды', async () => {
    const f = fixture();
    await f.service.initialize();
    const gate = deferred();
    const entered = deferred();
    const original = f.repo.execute;
    f.repo.execute = vi.fn(async (...args: Parameters<TrackerRepository['execute']>) => {
      entered.resolve();
      await gate.promise;
      return original(...args);
    });
    const tick = f.service.tick();
    await entered.promise;
    const queued = f.service.execute({ type: 'next-stage' });
    const rejected = expect(queued).rejects.toThrow('Трекер уже закрыт');
    f.service.dispose();
    expect(f.repo.close).not.toHaveBeenCalled();
    gate.resolve();
    await tick;
    await rejected;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.repo.execute).toHaveBeenCalledTimes(1);
    expect(f.state().session?.stage).toBe(1);
    expect(f.published).toHaveBeenCalledTimes(1);
    expect(f.repo.close).toHaveBeenCalledTimes(1);
  });
});

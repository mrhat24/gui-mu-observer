import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { defaultSetup, emptySnapshot, fromSetup, transition } from '../src/domain/dungeon';
import { Repository } from '../src/storage/database';
import { BOSS_MS, RUN_MS } from '../src/domain/rules';
import { phaseElapsed } from '../src/domain/dungeon';

const repositories: Repository[] = [];
const names: string[] = [];
async function database(name = crypto.randomUUID()) {
  names.push(name);
  const repo = await Repository.open(name);
  repositories.push(repo);
  return repo;
}
afterEach(async () => {
  repositories.splice(0).forEach((repo) => repo.close());
  for (const name of names.splice(0)) await deleteDB(name);
});

describe('атомарное локальное хранение', () => {
  it('мигрирует базу 0.1 без потери текущей сессии, истории и журнала', async () => {
    const name = crypto.randomUUID();
    names.push(name);
    const initial = transition(
      emptySnapshot(),
      { type: 'start', id: 'old-session', setup: defaultSetup() },
      1_000_000,
    );
    const old = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('meta', { keyPath: 'key' });
        db.createObjectStore('sessions', { keyPath: 'id' });
        db.createObjectStore('events', { autoIncrement: true });
      },
    });
    await old.put('meta', initial.snapshot);
    await old.put('sessions', initial.snapshot.session!);
    await old.add('events', initial.events[0]);
    const other = fromSetup(defaultSetup(), 2_000_000, 'other');
    await old.put('sessions', other);
    await old.add('events', { sessionId: other.id, at: 2_000_000, kind: 'start', snapshot: other });
    old.close();
    const repo = await Repository.open(name);
    repositories.push(repo);
    expect(await repo.read()).toEqual(initial.snapshot);
    expect((await repo.history()).sessions.map((s) => s.id)).toEqual(['other', 'old-session']);
    expect(await repo.sessionEvents('old-session')).toEqual(initial.events);
    const raw = await openDB(name);
    expect(raw.version).toBe(2);
    expect(await raw.count('events')).toBe(2);
    raw.close();
  });

  it('изолирует повреждённую запись статистики, сохраняя остальную историю', async () => {
    const name = crypto.randomUUID();
    const repo = await database(name);
    await repo.execute({ type: 'start', setup: defaultSetup(), id: 'good' }, 1_000_000);
    const raw = await openDB(name);
    await raw.put('sessions', { id: 'bad', phase: null });
    const history = await repo.history();
    expect(history.skipped).toBe(1);
    expect(history.sessions.map((s) => s.id)).toEqual(['good']);
    expect(await raw.get('sessions', 'bad')).toEqual({ id: 'bad', phase: null });
    raw.close();
  });
  it.each(['wave', 'boss-1'] as const)(
    'после закрытия и открытия сохраняет таймер %s и начало данжа',
    async (phase) => {
      const name = crypto.randomUUID();
      const repo = await database(name);
      const now = 1_000_000_000;
      const initial = await repo.execute(
        {
          type: 'start',
          id: 'reload',
          setup: { ...defaultSetup(), stage: 2, phase, elapsed: 20, runElapsed: 3600 },
        },
        now,
      );
      repo.close();
      const reopened = await database(name);
      const restored = await reopened.execute({ type: 'tick' }, now + 30_000);
      expect(restored.session?.phaseStartedAt).toBe(initial.session?.phaseStartedAt);
      expect(restored.session?.runStartedAt).toBe(initial.session?.runStartedAt);
      expect(phaseElapsed(restored.session!, now + 30_000)).toBe(50_000);
      expect(restored.session?.status).toBe('running');
      const failed = await reopened.execute({ type: 'tick' }, now + RUN_MS);
      expect(failed.session?.status).toBe('failed');
      expect(failed.session?.endedAt).toBe(
        phase === 'wave' ? now - 20_000 + 600_000 + BOSS_MS : now - 20_000 + BOSS_MS,
      );
      reopened.close();
      const again = await database(name);
      expect(await again.execute({ type: 'tick' }, now + RUN_MS * 2)).toEqual(failed);
    },
  );
  it('отклоняет повреждённые данные, не стирая исходную запись и журнал', async () => {
    const name = crypto.randomUUID();
    const repo = await database(name);
    const initial = await repo.execute(
      { type: 'start', setup: defaultSetup(), id: 'one' },
      1_000_000,
    );
    const raw = await openDB(name);
    const corrupted = { ...initial, history: null };
    await raw.put('meta', corrupted);
    await expect(repo.read()).rejects.toThrow('история');
    await expect(repo.execute({ type: 'tick' }, 1_100_000)).rejects.toThrow('история');
    expect(await raw.get('meta', 'current')).toEqual(corrupted);
    expect(await raw.count('events')).toBe(1);
    raw.close();
  });
  it('восстанавливает сессию и сохраняет предыдущие прохождения', async () => {
    const name = crypto.randomUUID();
    const repo = await database(name);
    let value = await repo.execute({ type: 'start', setup: defaultSetup(), id: 'one' }, 1_000_000);
    value = await repo.execute({ type: 'stop' }, 1_000_100, value.revision);
    await repo.execute(
      { type: 'start', setup: defaultSetup(), id: 'two' },
      2_000_000,
      value.revision,
    );
    const reopened = await database(name);
    expect((await reopened.read()).session?.id).toBe('two');
    const db = await openDB(name);
    expect(await db.count('sessions')).toBe(2);
    expect(await db.count('events')).toBe(3);
    db.close();
  });

  it('отклоняет устаревшую команду из второй вкладки', async () => {
    const name = crypto.randomUUID();
    const first = await database(name);
    const second = await database(name);
    const initial = await first.execute(
      { type: 'start', setup: defaultSetup(), id: 'one' },
      1_000_000,
    );
    const results = await Promise.allSettled([
      first.execute({ type: 'next-wave' }, 1_000_010, initial.revision),
      second.execute({ type: 'next-stage' }, 1_000_010, initial.revision),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await second.read()).revision).toBe(initial.revision + 1);
  });

  it('при невалидной команде не сохраняет часть изменений', async () => {
    const name = crypto.randomUUID();
    const repo = await database(name);
    const initial = await repo.execute(
      { type: 'start', setup: defaultSetup(), id: 'one' },
      1_000_000,
    );
    await expect(
      repo.execute({ type: 'boss-killed' }, 1_240_000, initial.revision),
    ).rejects.toThrow();
    expect(await repo.read()).toEqual(initial);
    const db = await openDB(name);
    expect(await db.count('events')).toBe(1);
    db.close();
    const caughtUp = await repo.execute({ type: 'tick' }, 1_240_000);
    expect(caughtUp.session?.phase).toEqual({ kind: 'wave', number: 3 });
  });

  it('после перезагрузки сохраняет возможность отменить ручное действие', async () => {
    const name = crypto.randomUUID();
    const repo = await database(name);
    await repo.execute({ type: 'start', setup: defaultSetup(), id: 'one' }, 1_000_000);
    await repo.execute({ type: 'next-stage' }, 1_000_010);
    const reopened = await database(name);
    const value = await reopened.execute({ type: 'undo' }, 1_000_020);
    expect(value.session?.stage).toBe(1);
  });
});

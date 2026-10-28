import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { defaultSetup } from '../src/domain/dungeon';
import { Repository } from '../src/storage/database';

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

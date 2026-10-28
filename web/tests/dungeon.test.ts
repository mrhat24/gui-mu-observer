import { describe, expect, it } from 'vitest';
import {
  AFK_MS,
  WAVE_MS,
  advance,
  defaultSetup,
  effectiveNow,
  emptySnapshot,
  fromSetup,
  phaseElapsed,
  toSetup,
  transition,
  type Command,
  type Snapshot,
} from '../src/domain/dungeon';

const START = 1_000_000;
const fresh = () => fromSetup(defaultSetup(), START, 'session-1');
const envelope = (session = fresh()): Snapshot => ({ ...emptySnapshot(), session });
const apply = (snapshot: Snapshot, command: Command, now = START) =>
  transition(snapshot, command, now).snapshot;

describe('расписание на респе', () => {
  it('сразу начинает первую волну и соблюдает точные двухминутные границы', () => {
    const s = fresh();
    expect(s.phase).toEqual({ kind: 'wave', number: 1 });
    expect(advance(s, START + WAVE_MS - 1).events).toHaveLength(0);
    expect(advance(s, START + WAVE_MS).session.phase).toEqual({ kind: 'wave', number: 2 });
    expect(advance(s, START + 4 * WAVE_MS).session.phase).toEqual({ kind: 'wave', number: 5 });
    const boss = advance(s, START + 5 * WAVE_MS).session;
    expect(boss.phase).toEqual({ kind: 'boss', number: 1 });
    expect(boss.phaseStartedAt).toBe(START + 600_000);
  });

  it('после долгого отсутствия не угадывает убийство босса', () => {
    const { session, events } = advance(fresh(), START + 20_000_000);
    expect(session.stage).toBe(1);
    expect(session.phase).toEqual({ kind: 'boss', number: 1 });
    expect(session.status).toBe('failed');
    expect(session.failureReason).toBe('boss-timeout');
    expect(events.map((e) => e.at)).toEqual([
      ...[1, 2, 3, 4, 5].map((n) => START + n * WAVE_MS),
      START + 1_500_000,
    ]);
  });

  it.each([2, 5])('застава %i требует обоих боссов', (stage) => {
    const s = fresh();
    s.stage = stage;
    s.phase = { kind: 'boss', number: 1 };
    let current = apply(envelope(s), { type: 'boss-killed' }, START + 1);
    expect(current.session?.stage).toBe(stage);
    expect(current.session?.phase).toEqual({ kind: 'boss', number: 2 });
    current = apply(current, { type: 'boss-killed' }, START + 10_000);
    expect(current.session?.stage).toBe(stage + 1);
    expect(current.session?.phase).toEqual({ kind: 'wave', number: 1 });
    expect(current.session?.phaseStartedAt).toBe(START + 10_000);
  });

  it('полный маршрут содержит 45 волн и 12 боссов', () => {
    let current = envelope();
    let now = START;
    let waves = 0;
    let bosses = 0;
    while (current.session?.status === 'running') {
      if (current.session.phase.kind === 'wave') {
        waves++;
        now += WAVE_MS;
        current = apply(current, { type: 'tick' }, now);
      } else {
        bosses++;
        now += 10_000;
        current = apply(current, { type: 'boss-killed' }, now);
      }
      expect(bosses).toBeLessThanOrEqual(12);
    }
    expect({ waves, bosses }).toEqual({ waves: 45, bosses: 12 });
    expect(current.session?.status).toBe('completed');
    expect(current.session?.phase).toEqual({ kind: 'final' });
  });
});

describe('отладочная кнопка «Далее»', () => {
  it('позволяет прокликать весь маршрут и запускает оба АФК-чека', () => {
    let current = envelope();
    let clicks = 0;
    const seen: string[] = [];
    while (current.session?.status === 'running') {
      const s = current.session;
      seen.push(`${s.stage}:${s.phase.kind}:${'number' in s.phase ? s.phase.number : ''}`);
      const result = transition(current, { type: 'debug-next' }, START + ++clicks * 1000);
      expect(result.events.at(-1)?.kind).toBe('debug:next');
      current = result.snapshot;
      expect(clicks).toBeLessThanOrEqual(57);
    }
    expect(clicks).toBe(57);
    expect(seen.filter((label) => label.includes(':wave:'))).toHaveLength(45);
    expect(seen).toContain('2:boss:2');
    expect(seen).toContain('5:boss:2');
    expect(seen.at(-1)).toBe('9:final:');
    expect(current.session?.status).toBe('completed');
    expect(current.session?.debug).toBe(true);
    expect(current.session?.afk.map((check) => check.status)).toEqual(['pending', 'pending']);
    expect(() => apply(current, { type: 'debug-next' }, START + 60_000)).toThrow(
      'Нет активного прохождения',
    );
  });

  it('сбрасывает таймер фазы и позволяет отменить имитацию убийства', () => {
    let current = apply(envelope(), { type: 'debug-next' }, START + 30_000);
    expect(current.session?.phase).toEqual({ kind: 'wave', number: 2 });
    expect(current.session?.phaseStartedAt).toBe(START + 30_000);
    const s = fresh();
    s.stage = 3;
    s.phase = { kind: 'boss', number: 1 };
    current = apply(envelope(s), { type: 'debug-next' }, START + 40_000);
    expect(current.session?.afk[0]).toEqual({
      status: 'pending',
      deadline: START + 40_000 + AFK_MS,
    });
    current = apply(current, { type: 'undo' }, START + 41_000);
    expect(current.session?.stage).toBe(3);
    expect(current.session?.phase).toEqual({ kind: 'boss', number: 1 });
    expect(current.session?.afk[0].status).toBe('not-yet');
  });
});

describe('АФК-чеки', () => {
  it('запускает независимые 15-минутные сроки и не останавливает волны', () => {
    const s = fresh();
    s.stage = 3;
    s.phase = { kind: 'boss', number: 1 };
    let current = apply(envelope(s), { type: 'boss-killed' });
    expect(current.session?.stage).toBe(4);
    expect(current.session?.afk[0]).toEqual({ status: 'pending', deadline: START + AFK_MS });
    current.session!.stage = 6;
    current.session!.phase = { kind: 'boss', number: 1 };
    current = apply(current, { type: 'boss-killed' }, START + 100_000);
    expect(current.session?.stage).toBe(7);
    current = apply(current, { type: 'tick' }, START + AFK_MS);
    expect(current.session?.afk[0].status).toBe('expired');
    expect(current.session?.afk[1]).toEqual({
      status: 'pending',
      deadline: START + 100_000 + AFK_MS,
    });
    current = apply(current, { type: 'afk-passed', index: 1 }, START + AFK_MS + 1000);
    current = apply(current, { type: 'tick' }, START + AFK_MS + 200_000);
    expect(current.session?.afk[1].status).toBe('passed');
    expect(current.session?.status).toBe('running');
  });

  it('ручной пропуск заставы не выдумывает срок сдачи квеста', () => {
    const s = fresh();
    s.stage = 3;
    const current = apply(envelope(s), { type: 'next-stage' });
    expect(current.session?.afk[0]).toEqual({ status: 'unknown' });
  });
});

describe('восстановление и коррекции', () => {
  it('подключается к боссу без выдуманного времени начала данжа', () => {
    const setup = defaultSetup();
    setup.stage = 5;
    setup.phase = 'boss-2';
    setup.elapsed = 40;
    const s = fromSetup(setup, START, 'joined');
    expect(s.runStartedAt).toBeNull();
    expect(s.stageStartedAt).toBeNull();
    expect(s.phaseStartedAt).toBe(START - 40_000);
    expect(s.afk[0].status).toBe('unknown');
    expect(toSetup(s, START).phase).toBe('boss-2');
  });

  it('отменяет ошибочное убийство с восстановлением АФК-чека', () => {
    const s = fresh();
    s.stage = 3;
    s.phase = { kind: 'boss', number: 1 };
    const killed = apply(envelope(s), { type: 'boss-killed' });
    const undone = apply(killed, { type: 'undo' }, START + 10_000);
    expect(undone.session?.stage).toBe(3);
    expect(undone.session?.phase).toEqual({ kind: 'boss', number: 1 });
    expect(undone.session?.afk[0].status).toBe('not-yet');
    expect(undone.history).toHaveLength(0);
  });

  it('останавливает все показания и сохраняет возможность отмены', () => {
    const stopped = apply(envelope(), { type: 'stop' }, START + 30_000);
    const result = apply(stopped, { type: 'tick' }, START + 600_000);
    expect(result.session?.phase.kind).toBe('wave');
    expect(effectiveNow(result.session!, START + 600_000)).toBe(START + 30_000);
    expect(phaseElapsed(result.session!, START + 600_000)).toBe(30_000);
    expect(apply(result, { type: 'undo' }, START + 600_000).session?.phase.kind).toBe('boss');
  });

  it('корректирует ближайший спавн, не меняя прошедшее время всей сессии', () => {
    const current = apply(envelope(), { type: 'shift', milliseconds: -10_000 }, START + 20_000);
    expect(current.session?.phaseStartedAt).toBe(START - 10_000);
    expect(current.session?.runStartedAt).toBe(START);
    expect(current.session?.stageStartedAt).toBeNull();
  });

  it('отклоняет невозможные состояния и не меняет исходные данные', () => {
    const badSetup = defaultSetup();
    badSetup.stage = 4;
    badSetup.phase = 'boss-2';
    expect(() => fromSetup(badSetup, START, 'bad')).toThrow();
    const current = envelope();
    const copy = structuredClone(current);
    expect(() => apply(current, { type: 'boss-killed' })).toThrow();
    expect(current).toEqual(copy);
  });
});

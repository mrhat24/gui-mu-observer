import { describe, expect, it } from 'vitest';
import {
  advance,
  defaultSetup,
  emptySnapshot,
  fromSetup,
  toSetup,
  transition,
  type Setup,
} from '../src/domain/dungeon';
import { BOSS_MS, RUN_MS } from '../src/domain/rules';
import { timerView } from '../src/domain/timerView';

const now = 1_000_000_000;
const snapshot = (setup: Setup) => ({
  ...emptySnapshot(),
  session: fromSetup(setup, now, 'limit-test'),
});

describe('лимиты данжа', () => {
  it('позволяет исправить устаревшее состояние после истечения срока, сохраняя начало данжа', () => {
    const state = snapshot({ ...defaultSetup(), stage: 2, phase: 'boss-1', runElapsed: 3600 });
    const expired = transition(state, { type: 'tick' }, now + BOSS_MS).snapshot;
    const setup = {
      ...toSetup(expired.session!, now + BOSS_MS),
      phase: 'wave' as const,
      stage: 3,
      wave: 2,
      elapsed: 10,
    };
    const restored = transition(
      expired,
      { type: 'sync', setup, edits: { phase: true, afk: [false, false] } },
      now + BOSS_MS + 30_000,
    ).snapshot.session!;
    expect(restored.status).toBe('running');
    expect(restored.failureReason).toBeUndefined();
    expect(restored.runStartedAt).toBe(state.session.runStartedAt);
    expect(restored.phaseStartedAt).toBe(now + BOSS_MS + 20_000);
  });
  it.each(['boss-1', 'boss-2', 'final'] as const)('даёт ровно 15 минут на %s', (phase) => {
    const state = snapshot({ ...defaultSetup(), stage: phase === 'final' ? 9 : 2, phase });
    expect(advance(state.session, now + BOSS_MS - 1).session.status).toBe('running');
    const result = advance(state.session, now + BOSS_MS);
    expect(result.session).toMatchObject({
      status: 'failed',
      failureReason: 'boss-timeout',
      endedAt: now + BOSS_MS,
    });
    expect(result.events.map((e) => e.kind)).toEqual(['boss-timeout']);
    expect(advance(result.session, now + RUN_MS).events).toEqual([]);
    expect(timerView(state.session, now + 60_000).time).toBe('14:00');
  });

  it('запускает отдельные 15 минут на второго босса', () => {
    const state = snapshot({ ...defaultSetup(), stage: 5, phase: 'boss-1' });
    const killedAt = now + BOSS_MS - 1;
    const result = transition(state, { type: 'boss-killed' }, killedAt).snapshot.session!;
    expect(result.phase).toEqual({ kind: 'boss', number: 2 });
    expect(advance(result, killedAt + BOSS_MS - 1).session.status).toBe('running');
    expect(advance(result, killedAt + BOSS_MS).session.endedAt).toBe(killedAt + BOSS_MS);
  });

  it('четырёхчасовой лимит обрывает даже текущую волну в точное время', () => {
    const state = snapshot({ ...defaultSetup(), stage: 7, runElapsed: RUN_MS / 1000 - 60 });
    const result = advance(state.session, now + 600_000);
    expect(result.session).toMatchObject({
      status: 'failed',
      failureReason: 'run-timeout',
      endedAt: now + 60_000,
    });
    expect(result.events.map((e) => e.kind)).toEqual(['run-timeout']);
  });

  it('применяет ближайший срок, при совпадении приоритет у лимита данжа', () => {
    const state = snapshot({
      ...defaultSetup(),
      stage: 9,
      phase: 'final',
      runElapsed: RUN_MS / 1000 - 900,
    });
    expect(advance(state.session, now + BOSS_MS).session.failureReason).toBe('run-timeout');
  });

  it('не засчитывает убийство на истёкшем лимите и сохраняет причину', () => {
    const state = snapshot({ ...defaultSetup(), stage: 9, phase: 'final' });
    const result = transition(state, { type: 'boss-killed' }, now + BOSS_MS);
    expect(result.snapshot.session?.status).toBe('failed');
    expect(result.events.map((e) => e.kind)).toEqual(['boss-timeout']);
  });

  it('не выдумывает общий срок при неизвестном начале', () => {
    const state = snapshot({ ...defaultSetup(), stage: 5 });
    expect(state.session.runStartedAt).toBeNull();
    expect(advance(state.session, now + 60_000).session.status).toBe('running');
  });

  it('нетронутое общее время в открытой форме не продлевает лимит', () => {
    const state = snapshot({ ...defaultSetup(), stage: 7, runElapsed: 6000 });
    const setup = toSetup(state.session, now);
    const result = transition(
      state,
      { type: 'sync', setup, edits: { phase: false, afk: [false, false] } },
      now + 30_000,
    ).snapshot.session!;
    expect(result.runStartedAt).toBe(state.session.runStartedAt);
    setup.runElapsed = 6100;
    const edited = transition(
      state,
      { type: 'sync', setup, edits: { phase: false, run: true, afk: [false, false] } },
      now + 30_000,
    ).snapshot.session!;
    expect(edited.runStartedAt).toBe(now + 30_000 - 6_100_000);
    expect(edited.phaseStartedAt).toBe(state.session.phaseStartedAt);
  });
});

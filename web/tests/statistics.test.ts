import { describe, expect, it } from 'vitest';
import {
  defaultSetup,
  emptySnapshot,
  fromSetup,
  transition,
  type Session,
} from '../src/domain/dungeon';
import { bossFights, recordedDuration, summarize } from '../src/domain/statistics';
const start = 1_000_000_000;
function session(id: string, duration: number, status: Session['status'] = 'completed'): Session {
  const s = fromSetup(defaultSetup(), start, id);
  s.status = status;
  if (status === 'completed') {
    s.phase = { kind: 'final' };
    s.stage = 9;
  }
  if (status === 'failed') s.failureReason = 'boss-timeout';
  s.endedAt = status === 'running' ? null : start + duration;
  return s;
}
describe('статистика прохождений', () => {
  it('считает рекорды только по полным успешным заходам и исключает активные из процента', () => {
    const complete = session('first', 600_000);
    const slower = session('second', 900_000);
    const joined = { ...session('joined', 10_000), joined: true, runStartedAt: null };
    const debug = { ...session('debug', 1000), debug: true };
    const result = summarize(
      [
        complete,
        slower,
        joined,
        debug,
        session('stopped', 20_000, 'stopped'),
        session('failed', 30_000, 'failed'),
        session('running', 0, 'running'),
      ],
      start + 60_000,
    );
    expect(result).toMatchObject({
      total: 7,
      finished: 6,
      recordCount: 2,
      best: 600_000,
      average: 750_000,
      completionRate: 67,
    });
    expect(result.counts).toEqual({ running: 1, completed: 4, stopped: 1, failed: 1 });
  });
  it('не создаёт рекорды из пустой выборки, неизвестного начала или неуспешных попыток', () => {
    expect(summarize([], start)).toMatchObject({ best: null, average: null, completionRate: null });
    expect(
      summarize(
        [{ ...session('unknown', 500), runStartedAt: null }, session('failed', 30_000, 'failed')],
        start,
      ),
    ).toMatchObject({ best: null, average: null, recordCount: 0 });
  });
  it('фиксирует длительность завершённых сессий, а для подключений считает время наблюдения', () => {
    const stopped = session('stopped', 30_000, 'stopped');
    expect(recordedDuration(stopped, start + 1_000_000)).toBe(30_000);
    expect(recordedDuration({ ...stopped, runStartedAt: null }, start + 2_000_000)).toBe(30_000);
    expect(recordedDuration(session('running', 0, 'running'), start + 50_000)).toBe(50_000);
  });
  it('рассчитывает отдельные бои обоих боссов по подтверждениям', () => {
    const setup = { ...defaultSetup(), stage: 2, phase: 'boss-1' as const };
    const initial = transition(emptySnapshot(), { type: 'start', setup, id: 'two' }, start);
    const first = transition(initial.snapshot, { type: 'boss-killed' }, start + 10_000);
    const second = transition(first.snapshot, { type: 'boss-killed' }, start + 30_000);
    expect(bossFights([...initial.events, ...first.events, ...second.events])).toEqual({
      corrected: false,
      fights: [
        { label: 'Застава 2 · Босс 1', duration: 10_000, debug: false },
        { label: 'Застава 2 · Босс 2', duration: 20_000, debug: false },
      ],
    });
  });
  it('после отмены не выдаёт повторные убийства за достоверные замеры', () => {
    const initial = transition(
      emptySnapshot(),
      { type: 'start', setup: { ...defaultSetup(), stage: 2, phase: 'boss-1' }, id: 'undo' },
      start,
    );
    const kill = transition(initial.snapshot, { type: 'boss-killed' }, start + 10_000);
    const undo = transition(kill.snapshot, { type: 'undo' }, start + 11_000);
    expect(bossFights([...initial.events, ...kill.events, ...undo.events])).toEqual({
      corrected: true,
      fights: [],
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  defaultSetup,
  emptySnapshot,
  fromSetup,
  toSetup,
  transition,
  type SyncEdits,
} from '../src/domain/dungeon';

const start = 1_000_000;
function fixture() {
  const setup = defaultSetup();
  setup.stage = 7;
  setup.wave = 5;
  setup.elapsed = 100;
  setup.afk = [
    { status: 'pending', remaining: 90 },
    { status: 'pending', remaining: 300 },
  ];
  const session = fromSetup(setup, start, 'sync-test');
  return { ...emptySnapshot(), session };
}
const untouched: SyncEdits = { phase: false, afk: [false, false] };

describe('синхронизация открытой формы', () => {
  it('не возвращает прошедшую волну и не продлевает АФК-чеки без изменений', () => {
    const before = fixture();
    const setup = toSetup(before.session!, start);
    const result = transition(before, { type: 'sync', setup, edits: untouched }, start + 30_000)
      .snapshot.session!;
    expect(result.phase).toEqual({ kind: 'boss', number: 1 });
    expect(result.phaseStartedAt).toBe(start + 20_000);
    expect(result.afk).toEqual(before.session!.afk);
  });

  it('редактирование одного чека не сдвигает другой и не откатывает фазу', () => {
    const before = fixture();
    const setup = toSetup(before.session!, start);
    setup.afk[0].status = 'passed';
    const result = transition(
      before,
      { type: 'sync', setup, edits: { phase: false, afk: [true, false] } },
      start + 100_000,
    ).snapshot.session!;
    expect(result.phase.kind).toBe('boss');
    expect(result.afk[0].status).toBe('passed');
    expect(result.afk[1]).toEqual(before.session!.afk[1]);
  });

  it('явно изменённый интервал отсчитывает от момента подтверждения', () => {
    const before = fixture();
    const setup = toSetup(before.session!, start);
    setup.phase = 'wave';
    setup.wave = 2;
    setup.elapsed = 10;
    setup.afk[0].remaining = 60;
    const result = transition(
      before,
      { type: 'sync', setup, edits: { phase: true, afk: [true, false] } },
      start + 30_000,
    ).snapshot.session!;
    expect(result.phase).toEqual({ kind: 'wave', number: 2 });
    expect(result.phaseStartedAt).toBe(start + 20_000);
    expect(result.afk[0]).toEqual({ status: 'pending', deadline: start + 90_000 });
    expect(result.afk[1]).toEqual(before.session!.afk[1]);
  });
});

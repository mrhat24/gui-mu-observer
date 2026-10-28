import { describe, expect, it } from 'vitest';
import { advance, defaultSetup, fromSetup } from '../src/domain/dungeon';

describe('хронология восстановления', () => {
  it('записывает ранний АФК-чек до будущих волн со снимком своего времени', () => {
    const setup = defaultSetup();
    setup.stage = 7;
    setup.afk = [
      { status: 'pending', remaining: 60 },
      { status: 'pending', remaining: 240 },
    ];
    const { events, session } = advance(fromSetup(setup, 1_000_000, 'test'), 1_600_000);
    expect(events.map((e) => e.at)).toEqual([
      1_060_000, 1_120_000, 1_240_000, 1_240_000, 1_360_000, 1_480_000, 1_600_000,
    ]);
    expect(events[0].kind).toBe('afk-expired:0');
    expect(events[0].snapshot.phase).toEqual({ kind: 'wave', number: 1 });
    for (const event of events) expect(event.snapshot.phaseStartedAt).toBeLessThanOrEqual(event.at);
    expect(session.phase.kind).toBe('boss');
    expect(session.afk.map((check) => check.status)).toEqual(['expired', 'expired']);
  });
});

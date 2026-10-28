import { describe, expect, it } from 'vitest';
import { defaultSetup, fromSetup } from '../src/domain/dungeon';
import { timerView } from '../src/domain/timerView';

describe('представление итогового таймера', () => {
  it('показывает всё прохождение, а не только бой с финалкой', () => {
    const s = fromSetup(defaultSetup(), 1_000_000, 'test');
    s.stage = 9;
    s.phase = { kind: 'final' };
    s.phaseStartedAt = 4_600_000;
    s.status = 'completed';
    s.endedAt = 4_660_000;
    expect(timerView(s, 10_000_000).time).toBe('1:01:00');
    expect(timerView(s, 10_000_000).label).toBe('ОБЩЕЕ ВРЕМЯ ПРОХОЖДЕНИЯ');
    expect(timerView(structuredClone(s), 20_000_000)).toEqual(timerView(s, 10_000_000));
  });
  it('не выдаёт время с подключения за полное время данжа', () => {
    const setup = defaultSetup();
    setup.stage = 9;
    setup.phase = 'final';
    setup.elapsed = 100;
    const s = fromSetup(setup, 1_000_000, 'joined');
    s.status = 'completed';
    s.endedAt = 1_030_000;
    expect(timerView(s, 2_000_000).time).toBe('00:30');
    expect(timerView(s, 2_000_000).label).toBe('ВРЕМЯ С ПОДКЛЮЧЕНИЯ');
  });
});

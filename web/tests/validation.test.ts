import { describe, expect, it } from 'vitest';
import {
  defaultSetup,
  emptySnapshot,
  fromSetup,
  validateSession,
  validateSnapshot,
} from '../src/domain/dungeon';

const session = () => fromSetup(defaultSetup(), 1_000_000, 'test');
describe('проверка данных из IndexedDB', () => {
  it.each(['pending', 'expired'])('отклоняет %s без срока', (status) => {
    const bad = { ...session(), afk: [{ status }, { status: 'not-yet' }] };
    expect(() => validateSession(bad)).toThrow('нет срока');
  });
  it.each([null, NaN, -1, '123'])('отклоняет неправильный deadline %s', (deadline) => {
    const bad = { ...session(), afk: [{ status: 'pending', deadline }, { status: 'not-yet' }] };
    expect(() => validateSession(bad)).toThrow();
  });
  it('требует время завершения и финальную фазу для completed', () => {
    expect(() => validateSession({ ...session(), status: 'completed' })).toThrow();
    expect(() =>
      validateSession({ ...session(), status: 'completed', endedAt: 1_001_000 }),
    ).toThrow('финального');
  });
  it.each([null, {}, { revision: -1 }, { history: null }, { session: undefined }])(
    'отклоняет повреждённый снимок %s',
    (fields) => {
      expect(() =>
        validateSnapshot(
          fields === null
            ? null
            : {
                ...emptySnapshot(),
                ...fields,
                ...(Object.keys(fields).length === 0 ? { revision: undefined } : {}),
              },
        ),
      ).toThrow();
    },
  );
  it('проверяет элементы истории и принадлежность текущей сессии', () => {
    expect(() =>
      validateSnapshot({ ...emptySnapshot(), session: session(), history: [null] }),
    ).toThrow();
    expect(() =>
      validateSnapshot({
        ...emptySnapshot(),
        session: session(),
        history: [{ ...session(), id: 'other' }],
      }),
    ).toThrow('другой сессии');
  });
});

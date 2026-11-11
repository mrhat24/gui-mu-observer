export type Mechanic =
  'Стан' | 'Слип' | 'Рут' | 'Сбитие каста' | 'АоЕ-слип' | 'АоЕ-ДоТ' | 'Драконы';

const waves: Partial<Record<number, Partial<Record<number, readonly Mechanic[]>>>> = {
  3: {
    4: ['Стан'],
    5: ['Рут', 'Сбитие каста'],
  },
  9: {
    1: ['Стан'],
    2: ['Слип'],
    3: ['Стан', 'Слип'],
    4: ['Стан', 'Слип'],
    5: ['Слип'],
  },
};

export const waveMechanics = (stage: number, wave: number) => waves[stage]?.[wave];

export const ninthStageBoss: readonly Mechanic[] = ['АоЕ-слип', 'Стан', 'АоЕ-ДоТ', 'Драконы'];

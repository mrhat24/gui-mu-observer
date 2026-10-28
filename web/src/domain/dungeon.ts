import { validateSession, validateSetup, validateSnapshot } from './validation';
import {
  AFK_MS,
  AFK_STAGES,
  MAX_UNDO,
  STAGE_COUNT,
  WAVES_PER_STAGE,
  WAVE_MS,
  bossCount,
} from './rules';
export { validateSession, validateSnapshot } from './validation';
export { WAVE_MS, AFK_MS, bossCount } from './rules';
export type Phase =
  { kind: 'wave'; number: number } | { kind: 'boss'; number: number } | { kind: 'final' };
export type Afk =
  | { status: 'not-yet' | 'unknown' }
  | { status: 'pending' | 'expired'; deadline: number }
  | { status: 'passed'; confirmedAt: number };
export interface Session {
  id: string;
  createdAt: number;
  runStartedAt: number | null;
  stageStartedAt: number | null;
  phaseStartedAt: number;
  stage: number;
  phase: Phase;
  status: 'running' | 'stopped' | 'completed';
  endedAt: number | null;
  joined: boolean;
  debug?: boolean;
  afk: [Afk, Afk];
}
export interface Setup {
  stage: number;
  phase: 'wave' | 'boss-1' | 'boss-2' | 'final';
  wave: number;
  elapsed: number;
  afk: [AfkSetup, AfkSetup];
}
export interface AfkSetup {
  status: 'unknown' | 'pending' | 'passed' | 'expired';
  remaining: number;
}
export interface SyncEdits {
  phase: boolean;
  afk: [boolean, boolean];
}
export interface Snapshot {
  key: 'current';
  revision: number;
  session: Session | null;
  history: Session[];
}
export interface Event {
  sessionId: string;
  at: number;
  kind: string;
  snapshot: Session;
}
export type Command =
  | { type: 'tick' }
  | { type: 'start'; setup: Setup; id: string }
  | { type: 'sync'; setup: Setup; edits: SyncEdits }
  | { type: 'boss-killed' }
  | { type: 'next-wave' }
  | { type: 'next-stage' }
  | { type: 'stop' }
  | { type: 'undo' }
  | { type: 'debug-next' }
  | { type: 'afk-passed'; index: 0 | 1 }
  | { type: 'shift'; milliseconds: number };

export const emptySnapshot = (): Snapshot => ({
  key: 'current',
  revision: 0,
  session: null,
  history: [],
});
export const defaultSetup = (): Setup => ({
  stage: 1,
  phase: 'wave',
  wave: 1,
  elapsed: 0,
  afk: [
    { status: 'unknown', remaining: 900 },
    { status: 'unknown', remaining: 900 },
  ],
});
export const effectiveNow = (s: Session, now: number) => s.endedAt ?? now;
export const phaseElapsed = (s: Session, now: number) =>
  Math.max(0, effectiveNow(s, now) - s.phaseStartedAt);
export const phaseLabel = (phase: Phase) =>
  phase.kind === 'wave'
    ? `Волна ${phase.number}`
    : phase.kind === 'boss'
      ? `Босс ${phase.number}`
      : 'Финальный босс';
export const nextLabel = (s: Session) => {
  if (s.phase.kind === 'wave')
    return s.phase.number < WAVES_PER_STAGE ? `Волна ${s.phase.number + 1}` : 'Босс 1';
  if (s.phase.kind === 'final') return 'Завершение прохождения';
  if (s.phase.number < bossCount(s.stage)) return 'Босс 2';
  return s.stage === STAGE_COUNT ? 'Финальный босс' : `Застава ${s.stage + 1} · волна 1`;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function fromSetup(setup: Setup, now: number, id: string): Session {
  validateSetup(setup);
  assert(
    Number.isInteger(setup.elapsed) &&
      setup.elapsed >= 0 &&
      setup.elapsed <= (setup.phase === 'wave' ? 119 : 86400),
    'Проверьте прошедшее время фазы',
  );
  assert(['wave', 'boss-1', 'boss-2', 'final'].includes(setup.phase), 'Неизвестная фаза');
  const phase: Phase =
    setup.phase === 'wave'
      ? { kind: 'wave', number: setup.wave }
      : setup.phase === 'final'
        ? { kind: 'final' }
        : { kind: 'boss', number: setup.phase === 'boss-2' ? 2 : 1 };
  const joined =
    setup.stage !== 1 || setup.phase !== 'wave' || setup.wave !== 1 || setup.elapsed !== 0;
  const phaseStartedAt = now - setup.elapsed * 1000;
  const afk = AFK_STAGES.map((stage, i): Afk => {
    if (setup.stage <= stage && phase.kind !== 'final') return { status: 'not-yet' };
    const check = setup.afk[i];
    if (check.status === 'pending') {
      assert(
        Number.isInteger(check.remaining) && check.remaining > 0 && check.remaining <= 900,
        'Остаток АФК-чека должен быть от 1 до 900 секунд',
      );
      return { status: 'pending', deadline: now + check.remaining * 1000 };
    }
    if (check.status === 'passed') return { status: 'passed', confirmedAt: now };
    if (check.status === 'expired') return { status: 'expired', deadline: now };
    return { status: 'unknown' };
  }) as [Afk, Afk];
  const s: Session = {
    id,
    createdAt: now,
    runStartedAt: joined ? null : now,
    stageStartedAt: phase.kind === 'wave' ? phaseStartedAt - (phase.number - 1) * WAVE_MS : null,
    phaseStartedAt,
    stage: setup.stage,
    phase,
    status: 'running',
    endedAt: null,
    joined,
    afk,
  };
  validateSession(s);
  return s;
}

export function toSetup(s: Session, now: number): Setup {
  return {
    stage: s.stage,
    phase:
      s.phase.kind === 'wave'
        ? 'wave'
        : s.phase.kind === 'final'
          ? 'final'
          : s.phase.number === 2
            ? 'boss-2'
            : 'boss-1',
    wave: s.phase.kind === 'wave' ? s.phase.number : 1,
    elapsed: Math.min(
      s.phase.kind === 'wave' ? 119 : 86400,
      Math.floor(phaseElapsed(s, now) / 1000),
    ),
    afk: s.afk.map((check): AfkSetup => ({
      status: check.status === 'not-yet' ? 'unknown' : check.status,
      remaining:
        'deadline' in check
          ? Math.max(1, Math.min(900, Math.ceil((check.deadline - now) / 1000)))
          : 900,
    })) as [AfkSetup, AfkSetup],
  };
}

function event(s: Session, at: number, kind: string): Event {
  return { sessionId: s.id, at, kind, snapshot: structuredClone(s) };
}

export function advance(input: Session, now: number): { session: Session; events: Event[] } {
  validateSession(input);
  const s = structuredClone(input);
  const events: Event[] = [];
  if (s.status !== 'running') return { session: s, events };
  while (true) {
    const waveAt = s.phase.kind === 'wave' ? s.phaseStartedAt + WAVE_MS : Infinity;
    let nextAfk: { index: 0 | 1; deadline: number } | undefined;
    for (const index of [0, 1] as const) {
      const check = s.afk[index];
      if (check.status === 'pending' && (!nextAfk || check.deadline < nextAfk.deadline)) {
        nextAfk = { index, deadline: check.deadline };
      }
    }
    const dueAt = Math.min(waveAt, nextAfk?.deadline ?? Infinity);
    if (!Number.isFinite(dueAt) || dueAt > now) break;
    if (s.phase.kind === 'wave' && waveAt <= (nextAfk?.deadline ?? Infinity)) {
      s.phaseStartedAt = waveAt;
      s.phase =
        s.phase.number < WAVES_PER_STAGE
          ? { kind: 'wave', number: s.phase.number + 1 }
          : { kind: 'boss', number: 1 };
      events.push(event(s, waveAt, 'scheduled-spawn'));
    } else if (nextAfk) {
      s.afk[nextAfk.index] = { status: 'expired', deadline: nextAfk.deadline };
      events.push(event(s, nextAfk.deadline, `afk-expired:${nextAfk.index}`));
    }
  }
  return { session: s, events };
}

function nextStage(s: Session, now: number) {
  if (s.stage === STAGE_COUNT) {
    assert(s.phase.kind !== 'final', 'Уже идёт финалка');
    s.phase = { kind: 'final' };
    s.stageStartedAt = null;
  } else {
    s.stage += 1;
    s.phase = { kind: 'wave', number: 1 };
    s.stageStartedAt = now;
  }
  s.phaseStartedAt = now;
}

function nextWave(s: Session, now: number) {
  assert(s.phase.kind === 'wave', 'В фазе босса нет следующей волны');
  s.phase =
    s.phase.number < WAVES_PER_STAGE
      ? { kind: 'wave', number: s.phase.number + 1 }
      : { kind: 'boss', number: 1 };
  s.phaseStartedAt = now;
  s.stageStartedAt = null;
}

function bossKilled(s: Session, now: number) {
  assert(s.phase.kind !== 'wave', 'Сейчас идёт волна. Сначала синхронизируйте фазу');
  if (s.phase.kind === 'final') {
    s.status = 'completed';
    s.endedAt = now;
  } else if (s.phase.number < bossCount(s.stage)) {
    s.phase = { kind: 'boss', number: 2 };
    s.phaseStartedAt = now;
  } else {
    AFK_STAGES.forEach((stage, index) => {
      if (s.stage === stage) s.afk[index] = { status: 'pending', deadline: now + AFK_MS };
    });
    nextStage(s, now);
  }
}

export function transition(
  input: Snapshot,
  command: Command,
  now: number,
): { snapshot: Snapshot; events: Event[] } {
  validateSnapshot(input);
  const snapshot = structuredClone(input);
  const events: Event[] = [];
  if (snapshot.session) {
    validateSession(snapshot.session);
    const advanced = advance(snapshot.session, now);
    snapshot.session = advanced.session;
    events.push(...advanced.events);
  }
  if (command.type === 'start') {
    assert(snapshot.session?.status !== 'running', 'Сначала остановите текущее прохождение');
    snapshot.session = fromSetup(command.setup, now, command.id);
    snapshot.history = [];
    events.push(event(snapshot.session, now, snapshot.session.joined ? 'join' : 'start'));
  } else if (command.type === 'undo') {
    const previous = snapshot.history.pop();
    assert(previous, 'Нет действий для отмены');
    snapshot.session = advance(previous, now).session;
    events.push(event(snapshot.session, now, 'undo'));
  } else if (command.type !== 'tick') {
    const s = snapshot.session;
    assert(s?.status === 'running', 'Нет активного прохождения');
    snapshot.history.push(structuredClone(s));
    snapshot.history = snapshot.history.slice(-MAX_UNDO);
    switch (command.type) {
      case 'sync': {
        const effectiveSetup = command.edits.phase
          ? command.setup
          : { ...toSetup(s, now), afk: command.setup.afk };
        const replacement = fromSetup(effectiveSetup, now, s.id);
        if (!command.edits.phase) {
          replacement.phaseStartedAt = s.phaseStartedAt;
          replacement.stageStartedAt = s.stageStartedAt;
        }
        for (const index of [0, 1] as const) {
          const eligible =
            replacement.stage > AFK_STAGES[index] || replacement.phase.kind === 'final';
          if (!command.edits.afk[index] && eligible && s.afk[index].status !== 'not-yet') {
            replacement.afk[index] = structuredClone(s.afk[index]);
          }
        }
        snapshot.session = {
          ...replacement,
          createdAt: s.createdAt,
          runStartedAt: s.runStartedAt,
          joined: s.joined,
          debug: s.debug,
        };
        break;
      }
      case 'boss-killed':
        bossKilled(s, now);
        break;
      case 'next-wave':
        nextWave(s, now);
        break;
      case 'debug-next':
        s.debug = true;
        if (s.phase.kind === 'wave') nextWave(s, now);
        else bossKilled(s, now);
        break;
      case 'next-stage':
        if (s.stage === 3 || s.stage === 6) {
          const index = s.stage === 3 ? 0 : 1;
          if (s.afk[index].status === 'not-yet') s.afk[index] = { status: 'unknown' };
        }
        nextStage(s, now);
        break;
      case 'afk-passed':
        assert(command.index === 0 || command.index === 1, 'Неверный АФК-чек');
        assert(
          !['not-yet', 'passed'].includes(s.afk[command.index].status),
          'Этот чек ещё не наступил или уже пройден',
        );
        s.afk[command.index] = { status: 'passed', confirmedAt: now };
        break;
      case 'shift':
        assert(s.phase.kind === 'wave', 'Коррекция времени доступна на волнах');
        assert([-10_000, 10_000].includes(command.milliseconds), 'Неверная коррекция времени');
        s.phaseStartedAt = Math.min(now, s.phaseStartedAt + command.milliseconds);
        s.stageStartedAt = null;
        break;
      case 'stop':
        s.status = 'stopped';
        s.endedAt = now;
        break;
      default:
        assertNever(command);
    }
    validateSession(snapshot.session!);
    events.push(
      event(
        snapshot.session!,
        now,
        command.type === 'debug-next' ? 'debug:next' : `manual:${command.type}`,
      ),
    );
    const advanced = advance(snapshot.session!, now);
    snapshot.session = advanced.session;
    events.push(...advanced.events);
  }
  if (events.length > 0) snapshot.revision += 1;
  return { snapshot, events };
}

function assertNever(command: never): never {
  throw new Error(`Неизвестная команда: ${JSON.stringify(command)}`);
}

export function formatDuration(milliseconds: number, rounding: 'ceil' | 'floor' = 'ceil') {
  const seconds = Math.max(0, Math[rounding](milliseconds / 1000));
  const rest =
    `${Math.floor(seconds / 60) % 60}`.padStart(2, '0') + ':' + `${seconds % 60}`.padStart(2, '0');
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}:${rest}`
    : `${Math.floor(seconds / 60)}`.padStart(2, '0') + ':' + `${seconds % 60}`.padStart(2, '0');
}

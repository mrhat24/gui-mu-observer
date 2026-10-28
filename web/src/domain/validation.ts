import type { Session, Setup, Snapshot } from './dungeon';
import { MAX_UNDO, RUN_MS, STAGE_COUNT, WAVES_PER_STAGE, bossCount } from './rules';

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Повреждены локальные данные: ${message}`);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function oneOf(value: unknown, options: readonly string[]): boolean {
  return typeof value === 'string' && options.includes(value);
}

export function validateSession(value: unknown): asserts value is Session {
  requireValue(record(value), 'неверная сессия');
  requireValue(typeof value.id === 'string' && value.id.length > 0, 'нет идентификатора сессии');
  requireValue(integer(value.stage, 1, STAGE_COUNT), 'неверная застава');
  requireValue(record(value.phase), 'нет текущей фазы');
  const phase = value.phase;
  requireValue(oneOf(phase.kind, ['wave', 'boss', 'final']), 'неверная фаза');
  if (phase.kind === 'wave')
    requireValue(integer(phase.number, 1, WAVES_PER_STAGE), 'неверная волна');
  if (phase.kind === 'boss')
    requireValue(integer(phase.number, 1, bossCount(value.stage)), 'неверный босс');
  if (phase.kind === 'final')
    requireValue(value.stage === STAGE_COUNT, 'финалка до последней заставы');
  requireValue(
    oneOf(value.status, ['running', 'stopped', 'completed', 'failed']),
    'неверный статус',
  );
  if (value.status === 'failed')
    requireValue(
      oneOf(value.failureReason, ['boss-timeout', 'run-timeout']),
      'неверная причина завершения',
    );
  requireValue(integer(value.createdAt) && integer(value.phaseStartedAt), 'неверное время фазы');
  for (const time of [value.runStartedAt, value.stageStartedAt, value.endedAt]) {
    requireValue(time === null || integer(time), 'неверная временная метка');
  }
  requireValue(
    value.status === 'running' ? value.endedAt === null : integer(value.endedAt),
    'статус не соответствует времени завершения',
  );
  if (value.status === 'completed')
    requireValue(phase.kind === 'final', 'завершение до финального босса');
  requireValue(typeof value.joined === 'boolean', 'неверная отметка подключения');
  requireValue(
    value.debug === undefined || typeof value.debug === 'boolean',
    'неверная отметка отладки',
  );
  requireValue(Array.isArray(value.afk) && value.afk.length === 2, 'неверный список АФК-чеков');
  for (const check of value.afk) {
    requireValue(
      record(check) && oneOf(check.status, ['not-yet', 'unknown', 'pending', 'expired', 'passed']),
      'неверный АФК-чек',
    );
    if (check.status === 'pending' || check.status === 'expired')
      requireValue(integer(check.deadline), 'нет срока АФК-чека');
    if (check.status === 'passed')
      requireValue(integer(check.confirmedAt), 'нет времени сдачи АФК-чека');
  }
}

export function validateSnapshot(value: unknown): asserts value is Snapshot {
  requireValue(record(value) && value.key === 'current', 'неверный снимок');
  requireValue(integer(value.revision), 'неверная ревизия');
  requireValue(
    Array.isArray(value.history) && value.history.length <= MAX_UNDO,
    'неверная история отмены',
  );
  if (value.session !== null) validateSession(value.session);
  for (const previous of value.history) {
    validateSession(previous);
    requireValue(
      value.session !== null && previous.id === (value.session as Session).id,
      'история другой сессии',
    );
  }
}

export function validateSetup(value: unknown): asserts value is Setup {
  requireValue(record(value), 'неверная форма состояния');
  requireValue(
    value.runElapsed === undefined || integer(value.runElapsed, 0, RUN_MS / 1000),
    'неверное время прохождения',
  );
  requireValue(integer(value.stage, 1, STAGE_COUNT), 'неверная застава');
  requireValue(oneOf(value.phase, ['wave', 'boss-1', 'boss-2', 'final']), 'неверная фаза');
  requireValue(integer(value.wave, 1, WAVES_PER_STAGE), 'неверная волна');
  requireValue(
    integer(value.elapsed, 0, value.phase === 'wave' ? 119 : 86400),
    'неверное прошедшее время',
  );
  requireValue(Array.isArray(value.afk) && value.afk.length === 2, 'неверный список чеков формы');
  for (const check of value.afk) {
    requireValue(
      record(check) && oneOf(check.status, ['unknown', 'pending', 'expired', 'passed']),
      'неверный статус чека формы',
    );
    if (check.status === 'pending')
      requireValue(integer(check.remaining, 1, 900), 'неверное оставшееся время');
  }
}

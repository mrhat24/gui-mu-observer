import { effectiveNow, phaseLabel, type Event, type Session } from './dungeon';

export const outcomeLabels: Record<Session['status'], string> = {
  running: 'В процессе',
  completed: 'Пройдено',
  stopped: 'Остановлено',
  failed: 'Время вышло',
};

export function recordedDuration(session: Session, now: number): number {
  return Math.max(0, effectiveNow(session, now) - (session.runStartedAt ?? session.createdAt));
}

export function summarize(sessions: Session[], now: number) {
  const counts = { running: 0, completed: 0, stopped: 0, failed: 0 };
  for (const session of sessions) counts[session.status] += 1;
  const finished = sessions.filter((s) => s.status !== 'running');
  const records = sessions.filter(
    (s) => s.status === 'completed' && !s.debug && !s.joined && s.runStartedAt !== null,
  );
  const durations = records.map((s) => recordedDuration(s, now));
  return {
    counts,
    total: sessions.length,
    finished: finished.length,
    completionRate: finished.length ? Math.round((counts.completed / finished.length) * 100) : null,
    recordCount: records.length,
    best: durations.length ? Math.min(...durations) : null,
    average: durations.length
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : null,
  };
}

export function eventLabel(kind: string): string {
  const labels: Record<string, string> = {
    start: 'Начало прохождения',
    join: 'Подключение к данжу',
    'scheduled-spawn': 'Появление волны / босса',
    'manual:boss-killed': 'Босс побеждён',
    'manual:next-wave': 'Ручная смена волны',
    'manual:next-stage': 'Ручная смена заставы',
    'manual:sync': 'Синхронизация с игрой',
    'manual:shift': 'Коррекция таймера',
    'manual:stop': 'Прохождение остановлено',
    'manual:afk-passed': 'АФК-чек пройден',
    undo: 'Отмена действия',
    'debug:next': 'Отладочный переход',
    'boss-timeout': 'Истёк лимит босса',
    'run-timeout': 'Истёк лимит данжа',
    'afk-expired:0': 'Истёк АФК-чек заставы 3',
    'afk-expired:1': 'Истёк АФК-чек заставы 6',
  };
  return labels[kind] ?? kind;
}

/** Only explicit confirmed kills count; corrections and undo are not invented victories. */
export function bossFights(events: Event[]) {
  const fights: { label: string; duration: number; debug: boolean }[] = [];
  let corrected = false;
  for (let i = 1; i < events.length; i += 1) {
    const event = events[i];
    if (
      ['undo', 'manual:sync', 'manual:next-stage', 'manual:next-wave', 'manual:shift'].includes(
        event.kind,
      )
    )
      corrected = true;
    const previous = events[i - 1].snapshot;
    if (
      previous.phase.kind !== 'wave' &&
      ['manual:boss-killed', 'debug:next'].includes(event.kind)
    ) {
      fights.push({
        label: `${previous.phase.kind === 'final' ? '' : `Застава ${previous.stage} · `}${phaseLabel(previous.phase)}`,
        duration: Math.max(0, event.at - previous.phaseStartedAt),
        debug: event.kind === 'debug:next',
      });
    }
  }
  return { fights: corrected ? [] : fights, corrected };
}

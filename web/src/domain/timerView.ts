import {
  effectiveNow,
  formatDuration,
  nextLabel,
  phaseElapsed,
  phaseLabel,
  type Session,
} from './dungeon';
import { BOSS_MS, WAVES_PER_STAGE, WAVE_MS } from './rules';

export interface TimerView {
  title: string;
  phaseChip: string | null;
  status: string;
  subtitle: string;
  label: string;
  time: string;
  hint: string;
  wave: number | null;
  progress: number;
  next: { label: string; title: string; detail: string };
}
const clock = (at: number) =>
  new Date(at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function timerView(s: Session | null, now: number): TimerView {
  if (!s)
    return {
      title: 'Всё готово к заходу',
      phaseChip: null,
      status: 'Готов к старту',
      subtitle: 'Запустите таймеры, когда ПЛ возьмёт квест',
      label: 'ДО СЛЕДУЮЩЕГО СОБЫТИЯ',
      time: '00:00',
      hint: 'Интервал волн — 2 минуты',
      wave: null,
      progress: 0,
      next: { label: 'Далее', title: 'Застава 1 · волна 1', detail: 'Сразу после старта' },
    };
  if (s.status === 'completed') {
    const partial = s.runStartedAt === null;
    return {
      title: 'Прохождение завершено',
      phaseChip: null,
      status: 'Данж пройден',
      subtitle: 'Финальный босс побеждён. Результат сохранён.',
      label: partial ? 'ВРЕМЯ С ПОДКЛЮЧЕНИЯ' : 'ОБЩЕЕ ВРЕМЯ ПРОХОЖДЕНИЯ',
      time: formatDuration(s.endedAt! - (s.runStartedAt ?? s.createdAt), 'floor'),
      hint: partial
        ? 'Начало данжа неизвестно — показано время с подключения'
        : 'От взятия квеста ПЛ до убийства финального босса',
      wave: null,
      progress: 100,
      next: { label: 'Завершено', title: clock(s.endedAt!), detail: 'Результат сохранён' },
    };
  }
  if (s.status === 'failed') {
    return {
      title: 'Время вышло',
      phaseChip: phaseLabel(s.phase),
      status: 'Лимит истёк',
      subtitle:
        s.failureReason === 'run-timeout'
          ? 'Истёк лимит 4 часа на прохождение Гуй Му.'
          : 'Истёк лимит 15 минут на убийство босса.',
      label: 'ВРЕМЯ ДО ЗАВЕРШЕНИЯ',
      time: formatDuration(s.endedAt! - (s.runStartedAt ?? s.createdAt), 'floor'),
      hint:
        s.runStartedAt === null ? 'Показано время с подключения' : 'Результат сохранён в истории',
      wave: s.phase.kind === 'wave' ? s.phase.number : null,
      progress: 100,
      next: { label: 'Завершено', title: clock(s.endedAt!), detail: 'Лимит времени' },
    };
  }
  const wave = s.phase.kind === 'wave' ? s.phase.number : null;
  const elapsed = phaseElapsed(s, now);
  const status = s.status === 'running' ? 'Прохождение идёт' : 'Сессия остановлена';
  const phaseChip = wave ? `${phaseLabel(s.phase)} из ${WAVES_PER_STAGE}` : phaseLabel(s.phase);
  const title = s.phase.kind === 'final' ? 'Финальный босс' : `Застава ${s.stage}`;
  if (wave)
    return {
      title,
      phaseChip,
      status,
      wave,
      subtitle: 'Отсчёт от появления волны на респе',
      label: wave === WAVES_PER_STAGE ? 'ДО ПЕРВОГО БОССА' : `ДО ВОЛНЫ ${wave + 1}`,
      time: formatDuration(Math.max(0, WAVE_MS - elapsed)),
      hint: `Волна ${wave} · ${formatDuration(elapsed, 'floor')} из ${formatDuration(WAVE_MS)}`,
      progress: Math.min(100, (elapsed / WAVE_MS) * 100),
      next: { label: 'Далее', title: nextLabel(s), detail: clock(s.phaseStartedAt + WAVE_MS) },
    };
  return {
    title,
    phaseChip,
    status,
    wave,
    progress: Math.min(100, (elapsed / BOSS_MS) * 100),
    subtitle: 'Подтвердите убийство, чтобы продолжить прохождение',
    label: 'ОСТАЛОСЬ НА БОССА',
    time: formatDuration(BOSS_MS - (effectiveNow(s, now) - s.phaseStartedAt)),
    hint: `Бой идёт ${formatDuration(elapsed, 'floor')} · лимит 15:00`,
    next: { label: 'Далее', title: nextLabel(s), detail: 'По подтверждению' },
  };
}

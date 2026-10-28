import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import LinearProgress from '@mui/material/LinearProgress';
import { effectiveNow, formatDuration, type Session } from '../domain/dungeon';
import { RUN_MS } from '../domain/rules';
import styles from '../styles/App.module.scss';

export default function RunLimit({ session, now }: { session: Session | null; now: number }) {
  const elapsed =
    session?.runStartedAt != null ? effectiveNow(session, now) - session.runStartedAt : null;
  const remaining = elapsed === null ? null : Math.max(0, RUN_MS - elapsed);
  const urgent = remaining !== null && remaining <= 5 * 60_000;
  return (
    <section className={styles.card} aria-label="Лимит прохождения">
      <div className={styles.metricLabel}>
        <AccessTimeRounded />
        До лимита прохождения
      </div>
      <strong style={urgent ? { color: 'var(--mui-palette-error-main)' } : undefined}>
        {remaining === null ? '--:--' : formatDuration(remaining)}
      </strong>
      <span>
        {elapsed === null
          ? 'Лимит 4 часа · укажите время начала в синхронизации'
          : `Прошло ${formatDuration(elapsed, 'floor')} из 4:00:00`}
      </span>
      {elapsed !== null && (
        <LinearProgress
          aria-label="Использовано времени прохождения"
          variant="determinate"
          value={Math.max(0, Math.min(100, (elapsed / RUN_MS) * 100))}
          color={urgent ? 'error' : 'primary'}
          sx={{ mt: 1 }}
        />
      )}
    </section>
  );
}

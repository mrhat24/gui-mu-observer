import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import UndoRounded from '@mui/icons-material/UndoRounded';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import { phaseElapsed, type Command, type Session } from '../domain/dungeon';
import { BOSS_MS, WAVES_PER_STAGE } from '../domain/rules';
import { timerView } from '../domain/timerView';
import styles from '../styles/App.module.scss';

interface Props {
  session: Session | null;
  now: number;
  ready: boolean;
  busy: boolean;
  canUndo: boolean;
  onAction: (command: Command) => void;
  onStart: () => void;
  onStop: () => void;
}

export default function TimerPanel({
  session,
  now,
  ready,
  busy,
  canUndo,
  onAction,
  onStart,
  onStop,
}: Props) {
  const [lastBossClick, setLastBossClick] = useState(0);
  const view = timerView(session, now);
  const running = session?.status === 'running';
  const completed = session?.status === 'completed' || session?.status === 'failed';
  const startLabel = session ? 'Новое прохождение' : 'Старт';
  const urgent =
    session?.status === 'failed' ||
    (running && session.phase.kind !== 'wave' && phaseElapsed(session, now) >= BOSS_MS - 60_000);
  return (
    <section
      className={`${styles.card} ${styles.timerCard} ${urgent ? styles.timerUrgent : ''}`}
      aria-label="Текущее состояние"
    >
      <div className={styles.cardTop}>
        <span className={styles.sectionLabel}>ТЕКУЩЕЕ СОСТОЯНИЕ</span>
        <span className={`${styles.status} ${running ? styles.statusLive : ''}`}>
          <span className={styles.dot} />
          {view.status}
        </span>
      </div>
      <div className={styles.phaseHeading}>
        <h2>{view.title}</h2>
        {view.phaseChip && <Chip size="small" variant="outlined" label={view.phaseChip} />}
        {session?.debug && <Chip size="small" color="warning" variant="outlined" label="Отладка" />}
      </div>
      <p className={styles.muted}>{view.subtitle}</p>
      <div className={styles.countdownBlock}>
        <div className={styles.countdownLabel}>{view.label}</div>
        <div
          className={`${styles.countdown} ${!session ? styles.countdownIdle : ''}`}
          aria-live="off"
          data-testid="main-timer"
        >
          {view.time}
        </div>
        <span className={styles.interval}>{view.hint}</span>
      </div>
      <div className={styles.waveSegments} aria-label="Прогресс волн">
        {Array.from({ length: WAVES_PER_STAGE }, (_, index) => index + 1).map((n) => (
          <div key={n}>
            <div
              className={`${styles.segment} ${session && (!view.wave || n < view.wave) ? styles.segmentDone : ''}`}
            >
              {view.wave === n && <span style={{ width: `${view.progress}%` }} />}
            </div>
            <span className={view.wave === n ? styles.activeText : ''}>Волна {n}</span>
          </div>
        ))}
      </div>
      <div className={styles.nextEvent}>
        <span>
          {completed ? <CheckRounded /> : <AccessTimeRounded />}
          {view.next.label}
        </span>
        <strong>{view.next.title}</strong>
        <span>{view.next.detail}</span>
      </div>
      <div className={styles.controls}>
        {running ? (
          <Button
            variant="contained"
            startIcon={<CheckRounded />}
            disabled={busy || !!view.wave || now - lastBossClick < 1000}
            onClick={() => {
              setLastBossClick(now);
              onAction({ type: 'boss-killed' });
            }}
          >
            Убили босса
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<PlayArrowRounded />}
            onClick={onStart}
            disabled={!ready || busy}
          >
            {startLabel}
          </Button>
        )}
        <Tooltip title="Отменить последнее ручное действие">
          <span>
            <IconButton
              aria-label="Отменить последнее действие"
              disabled={!canUndo || busy}
              onClick={() => onAction({ type: 'undo' })}
            >
              <UndoRounded />
            </IconButton>
          </span>
        </Tooltip>
        <span className={styles.controlSpacer} />
        <Button
          variant="text"
          color="inherit"
          startIcon={<StopRounded />}
          disabled={!running || busy}
          onClick={onStop}
        >
          Стоп
        </Button>
      </div>
    </section>
  );
}

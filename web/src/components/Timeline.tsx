import FlagOutlined from '@mui/icons-material/FlagOutlined';
import WavesRounded from '@mui/icons-material/WavesRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { formatDuration, nextLabel, type Session } from '../domain/dungeon';
import { WAVE_MS } from '../domain/rules';
import styles from '../styles/App.module.scss';
const clock = (at: number) =>
  new Date(at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export default function Timeline({ session, now }: { session: Session | null; now: number }) {
  if (!session)
    return (
      <div className={styles.timelineEmpty}>
        <WavesRounded />
        <p>Здесь появится расписание волн и боссов</p>
        <span>Начните прохождение, чтобы включить отсчёт</span>
      </div>
    );
  if (session.status !== 'running')
    return (
      <div className={styles.timelineEmpty}>
        <FlagOutlined />
        <p>{session.status === 'completed' ? 'Все этапы пройдены' : 'Таймеры остановлены'}</p>
        <span>События сохранены в истории</span>
      </div>
    );
  if (session.phase.kind !== 'wave')
    return (
      <div className={styles.bossNext}>
        <span className={styles.timelineIcon}>
          <FlagOutlined />
        </span>
        <div>
          <strong>{nextLabel(session)}</strong>
          <span>Сразу после убийства текущего босса</span>
        </div>
      </div>
    );
  const wave = session.phase.number;
  const entries = Array.from({ length: 6 - wave }, (_, i) => {
    const n = wave + i + 1;
    return {
      title: n === 6 ? 'Босс 1' : `Волна ${n}`,
      boss: n === 6,
      at: session.phaseStartedAt + (i + 1) * WAVE_MS,
    };
  });
  return (
    <div className={styles.timelineList}>
      {entries.map((entry, i) => (
        <div className={styles.timelineRow} key={entry.title}>
          <span className={`${styles.timelineIcon} ${i === 0 ? styles.timelineFirst : ''}`}>
            {entry.boss ? <FlagOutlined /> : <WavesRounded />}
          </span>
          <div>
            <strong>{entry.title}</strong>
            <span>{clock(entry.at)}</span>
          </div>
          <span className={styles.timelineRemaining}>{formatDuration(entry.at - now)}</span>
          {i === 0 && <ArrowForwardRounded className={styles.timelineArrow} />}
        </div>
      ))}
    </div>
  );
}

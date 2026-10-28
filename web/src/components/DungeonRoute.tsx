import CheckRounded from '@mui/icons-material/CheckRounded';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import { type Session } from '../domain/dungeon';
import { AFK_STAGES, DOUBLE_BOSS_STAGES, STAGE_COUNT, WAVES_PER_STAGE } from '../domain/rules';
import styles from '../styles/App.module.scss';

export default function DungeonRoute({ session }: { session: Session | null }) {
  const steps = Array.from({ length: STAGE_COUNT + 1 }, (_, i) => i + 1);
  return (
    <section className={`${styles.card} ${styles.routeCard}`}>
      <div className={styles.cardTitle}>
        <h3>Маршрут прохождения</h3>
        <span>{STAGE_COUNT} застав + финалка</span>
      </div>
      <div className={styles.route}>
        {steps.map((n) => {
          const final = n === STAGE_COUNT + 1;
          const current =
            !!session &&
            (final
              ? session.phase.kind === 'final'
              : session.stage === n && session.phase.kind !== 'final');
          const done =
            !!session &&
            (session.status === 'completed' ||
              n < session.stage ||
              (n === STAGE_COUNT && session.phase.kind === 'final'));
          let hint = `${WAVES_PER_STAGE} волн`;
          if (final) hint = 'Последний босс';
          else if (DOUBLE_BOSS_STAGES.includes(n)) hint = '2 босса';
          else if (AFK_STAGES.some((stage) => stage === n)) hint = 'АФК-чек';
          let marker = <>{n}</>;
          if (done) marker = <CheckRounded />;
          else if (final) marker = <FlagOutlined />;
          return (
            <div
              className={`${styles.routeItem} ${current ? styles.routeCurrent : ''} ${done ? styles.routeDone : ''}`}
              key={n}
              aria-current={current ? 'step' : undefined}
            >
              <span className={styles.routeCircle}>{marker}</span>
              <strong>{final ? 'Финалка' : `Застава ${n}`}</strong>
              <span>{hint}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

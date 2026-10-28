import Button from '@mui/material/Button';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import { formatDuration, type Afk } from '../domain/dungeon';
import styles from '../styles/App.module.scss';

export default function AfkCard({
  stage,
  check,
  now,
  disabled,
  onPass,
}: {
  stage: number;
  check: Afk;
  now: number;
  disabled: boolean;
  onPass: () => void;
}) {
  const left = 'deadline' in check ? Math.max(0, check.deadline - now) : 900_000;
  const pending = check.status === 'pending';
  const expired = check.status === 'expired' || (pending && left === 0);
  const passed = check.status === 'passed';
  const waiting = check.status === 'not-yet';
  const urgent = expired || (pending && left <= 60_000);
  const title = passed
    ? 'Чек пройден'
    : expired
      ? 'Время истекло'
      : waiting
        ? 'Ещё не наступил'
        : pending
          ? 'Нужно сдать квест'
          : 'Статус неизвестен';
  return (
    <section
      className={`${styles.card} ${styles.afkCard} ${pending ? styles.afkPending : ''} ${urgent ? styles.afkUrgent : ''}`}
      aria-label={`АФК-чек заставы ${stage}`}
    >
      <div className={styles.afkHeading}>
        <span className={styles.afkIcon}>{passed ? <CheckRounded /> : <ShieldOutlined />}</span>
        <div>
          <strong>После заставы {stage}</strong>
          <span>{title}</span>
        </div>
        <span className={styles.afkNumber}>0{stage}</span>
      </div>
      <div className={`${styles.afkTime} ${waiting ? styles.dim : ''}`}>
        {passed ? (
          <span className={styles.passedText}>Готово</span>
        ) : check.status === 'unknown' ? (
          '--:--'
        ) : (
          formatDuration(left)
        )}
      </div>
      <p>
        {passed
          ? 'Сдача квеста отмечена'
          : waiting
            ? 'Отсчёт начнётся после убийства босса'
            : expired
              ? 'Проверьте результат квеста в игре'
              : pending
                ? 'Осталось на квест в бобовнике'
                : 'Проверьте квест или задайте остаток времени'}
      </p>
      <Button
        fullWidth
        size="small"
        variant={pending ? 'contained' : 'outlined'}
        startIcon={<CheckRounded />}
        disabled={disabled || waiting || passed}
        onClick={onPass}
      >
        АФК-чек пройден
      </Button>
    </section>
  );
}

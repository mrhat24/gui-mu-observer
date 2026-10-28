import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TuneRounded from '@mui/icons-material/TuneRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { nextLabel, type Command, type Session } from '../domain/dungeon';
import styles from '../styles/App.module.scss';

export default function ManualControls({
  session,
  busy,
  onAction,
}: {
  session: Session | null;
  busy: boolean;
  onAction: (command: Command) => void;
}) {
  const running = session?.status === 'running';
  const wave = session?.phase.kind === 'wave';
  const tooltip =
    running && session
      ? `Отладка → ${nextLabel(session)}. Переход без ожидания таймера; на боссе имитирует убийство.`
      : 'Начните прохождение, чтобы прокликать этапы';
  return (
    <Accordion className={styles.manual} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <TuneRounded />
        <span>Ручная синхронизация</span>
        <span className={styles.manualHint}>Если таймер разошёлся с игрой</span>
      </AccordionSummary>
      <AccordionDetails>
        <p className={styles.smallNote}>
          Переходы записываются как коррекции. Убийство босса подтверждается отдельной кнопкой.
        </p>
        <div className={styles.manualButtons}>
          <Tooltip title={tooltip}>
            <span>
              <Button
                variant="outlined"
                startIcon={<ArrowForwardRounded />}
                disabled={!running || busy}
                onClick={() => onAction({ type: 'debug-next' })}
              >
                Далее
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            disabled={!running || !wave || busy}
            onClick={() => onAction({ type: 'next-wave' })}
          >
            Следующая волна
          </Button>
          <Button
            variant="outlined"
            disabled={!running || session?.phase.kind === 'final' || busy}
            onClick={() => onAction({ type: 'next-stage' })}
          >
            Следующая застава
          </Button>
          <Button
            variant="outlined"
            disabled={!running || !wave || busy}
            onClick={() => onAction({ type: 'shift', milliseconds: -10_000 })}
          >
            До события −10 с
          </Button>
          <Button
            variant="outlined"
            disabled={!running || !wave || busy}
            onClick={() => onAction({ type: 'shift', milliseconds: 10_000 })}
          >
            До события +10 с
          </Button>
        </div>
      </AccordionDetails>
    </Accordion>
  );
}

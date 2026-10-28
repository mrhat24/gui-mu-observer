import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import { phaseLabel, type Session } from '../domain/dungeon';
import { bossFights, eventLabel, outcomeLabels, recordedDuration } from '../domain/statistics';
import { useSessionEvents } from '../hooks/useStatistics';
import { date, duration, statusColor } from './statisticsPresentation';
import styles from '../styles/Statistics.module.scss';

export default function SessionDetails({
  session,
  revision,
  now,
  onClose,
}: {
  session: Session;
  revision: number;
  now: number;
  onClose: () => void;
}) {
  const history = useSessionEvents(session.id, revision);
  const { fights, corrected } = bossFights(history.events);
  const [eventPage, setEventPage] = useState(0);
  const currentPage = Math.min(eventPage, Math.max(0, Math.ceil(history.events.length / 20) - 1));
  const afk = {
    'not-yet': 'Не наступил',
    unknown: 'Неизвестно',
    pending: 'Не отмечен',
    expired: 'Время истекло',
    passed: 'Пройден',
  };
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Заход от {date(session.createdAt)}</DialogTitle>
      <DialogContent>
        <div className={styles.detailsSummary}>
          <Chip label={outcomeLabels[session.status]} color={statusColor(session.status)} />
          <Typography>
            {duration(recordedDuration(session, now))}
            {session.runStartedAt === null ? ' с подключения' : ' от начала данжа'}
          </Typography>
        </div>
        <Typography variant="body2" color="text.secondary">
          Начало данжа: {session.runStartedAt === null ? 'неизвестно' : date(session.runStartedAt)}{' '}
          · Завершение: {session.endedAt === null ? 'ещё идёт' : date(session.endedAt)}
        </Typography>
        {session.failureReason && (
          <Alert severity="error" sx={{ my: 2 }}>
            {session.failureReason === 'boss-timeout'
              ? 'Истёк лимит 15 минут на босса.'
              : 'Истёк общий лимит 4 часа.'}
          </Alert>
        )}
        <div className={styles.detailsSummary}>
          {session.afk.map((check, i) => (
            <Chip
              key={i}
              variant="outlined"
              label={`АФК ${i === 0 ? 3 : 6}: ${afk[check.status]}`}
            />
          ))}
        </div>
        {history.loading && <LinearProgress aria-label="Загрузка событий" />}
        {history.error && <Alert severity="error">{history.error}</Alert>}
        {corrected && (
          <Alert severity="info" sx={{ my: 2 }}>
            В этом заходе есть ручные коррекции или отмены. Время боёв не рассчитывается: журнал мог
            содержать повторные подтверждения.
          </Alert>
        )}
        {fights.length > 0 && (
          <>
            <Typography component="h3" variant="subtitle1" sx={{ mt: 2 }}>
              Время боёв
            </Typography>
            <div className={styles.fights}>
              {fights.map((fight, i) => (
                <div key={i}>
                  <span>
                    {fight.label}
                    {fight.debug ? ' · отладка' : ''}
                  </span>
                  <strong>{duration(fight.duration)}</strong>
                </div>
              ))}
            </div>
          </>
        )}
        <Typography component="h3" variant="subtitle1" sx={{ mt: 2 }}>
          Журнал событий · {history.events.length}
        </Typography>
        {!history.loading && !history.error && history.events.length === 0 && (
          <Typography color="text.secondary">Для этого захода события не сохранились.</Typography>
        )}
        <ol className={styles.events}>
          {history.events.slice(currentPage * 20, currentPage * 20 + 20).map((event, index) => (
            <li key={`${event.at}:${index}`}>
              <time dateTime={new Date(event.at).toISOString()}>
                {new Date(event.at).toLocaleTimeString('ru-RU')}
              </time>
              <div>
                <strong>{eventLabel(event.kind)}</strong>
                <span>
                  Застава {event.snapshot.stage} · {phaseLabel(event.snapshot.phase)}
                </span>
              </div>
            </li>
          ))}
        </ol>
        {history.events.length > 20 && (
          <TablePagination
            component="div"
            count={history.events.length}
            page={currentPage}
            rowsPerPage={20}
            rowsPerPageOptions={[20]}
            onPageChange={(_, value) => setEventPage(value)}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
            getItemAriaLabel={(type) =>
              type === 'next' ? 'Следующая страница событий' : 'Предыдущая страница событий'
            }
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

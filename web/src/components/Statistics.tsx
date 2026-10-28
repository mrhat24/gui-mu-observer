import SessionDetails from './SessionDetails';
import { date, duration, statusColor } from './statisticsPresentation';
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import BarChartRounded from '@mui/icons-material/BarChartRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { phaseLabel, type Session } from '../domain/dungeon';
import { outcomeLabels, recordedDuration, summarize } from '../domain/statistics';
import { useStatistics } from '../hooks/useStatistics';
import styles from '../styles/Statistics.module.scss';

export default function Statistics({
  revision,
  now,
  onTracker,
}: {
  revision: number;
  now: number;
  onTracker: () => void;
}) {
  const history = useStatistics(revision);
  const [showDebug, setShowDebug] = useState(false);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const sessions = history.sessions.filter(
    (s) =>
      (showDebug || !s.debug) &&
      (period === 'all' || s.createdAt >= now - Number(period) * 86_400_000),
  );
  const summary = summarize(sessions, now);
  const filtered = sessions.filter((s) => status === 'all' || s.status === status);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1));
  const selectedSession = history.sessions.find((s) => s.id === selected);

  return (
    <div className={styles.statistics}>
      <div className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>КАЖДЫЙ ЗАХОД — В ИСТОРИИ</span>
          <h2>Твой Гуй в цифрах</h2>
          <p>Результаты, темп и история прохождений на этом устройстве.</p>
        </div>
        <Button
          variant="outlined"
          startIcon={<RefreshRounded />}
          disabled={history.loading}
          onClick={history.reload}
        >
          Обновить
        </Button>
      </div>
      {history.loading && <LinearProgress aria-label="Загрузка статистики" />}
      {history.error && (
        <Alert severity="error">
          {history.error}{' '}
          <Button color="inherit" onClick={history.reload}>
            Повторить
          </Button>
        </Alert>
      )}
      {history.skipped > 0 && (
        <Alert severity="warning">
          Не удалось прочитать записей: {history.skipped}. Исходные данные сохранены.
        </Alert>
      )}
      <div className={styles.filters}>
        <TextField
          select
          size="small"
          label="Период"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(0);
          }}
        >
          <MenuItem value="all">За всё время</MenuItem>
          <MenuItem value="7">За 7 дней</MenuItem>
          <MenuItem value="30">За 30 дней</MenuItem>
        </TextField>
        <FormControlLabel
          control={
            <Switch
              checked={showDebug}
              onChange={(_, value) => {
                setShowDebug(value);
                setPage(0);
              }}
            />
          }
          label="Показать отладочные"
        />
      </div>
      <div className={styles.metrics}>
        <Metric
          title="Всего заходов"
          value={String(summary.total)}
          detail={`${summary.counts.running} в процессе · ${summary.finished} завершено`}
        />
        <Metric
          title="Пройдено"
          value={String(summary.counts.completed)}
          detail={
            summary.completionRate === null
              ? 'Пока нет завершённых попыток'
              : `${summary.completionRate}% от завершённых попыток`
          }
        />
        <Metric
          title="Лучшее время"
          value={duration(summary.best)}
          detail="Полные прохождения без отладки"
          accent
        />
        <Metric
          title="Среднее время"
          value={duration(summary.average)}
          detail={`В расчёте: ${summary.recordCount} прохождений`}
        />
      </div>
      <p className={styles.note}>
        Рекорды и среднее время учитывают успешные заходы с отслеживанием от старта. Подключения
        посреди данжа и отладка в них не входят. Остановленные и просроченные попытки входят в
        процент прохождений; активные — нет.
      </p>
      {summary.total > 0 && (
        <section className={styles.card} aria-label="Результаты прохождений">
          <h3>Как закончились заходы</h3>
          <div className={styles.outcomes}>
            {(Object.keys(outcomeLabels) as Session['status'][]).map((outcome) => (
              <div key={outcome}>
                <span>{outcomeLabels[outcome]}</span>
                <LinearProgress
                  aria-label={outcomeLabels[outcome]}
                  variant="determinate"
                  value={(summary.counts[outcome] / summary.total) * 100}
                  color={outcome === 'failed' ? 'error' : 'primary'}
                />
                <strong>{summary.counts[outcome]}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className={styles.card}>
        <div className={styles.historyHeading}>
          <h3>История заходов</h3>
          <TextField
            select
            size="small"
            label="Результат"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="all">Все результаты</MenuItem>
            {(Object.keys(outcomeLabels) as Session['status'][]).map((outcome) => (
              <MenuItem key={outcome} value={outcome}>
                {outcomeLabels[outcome]}
              </MenuItem>
            ))}
          </TextField>
        </div>
        {!history.loading && filtered.length === 0 ? (
          <div className={styles.empty}>
            <BarChartRounded />
            <h3>
              {history.sessions.length === 0 ? 'Первый заход — начало истории' : 'Здесь пока пусто'}
            </h3>
            <p>
              {history.sessions.length === 0
                ? 'Запусти трекер: результаты появятся здесь автоматически.'
                : 'Попробуй другой период, результат или включи отладочные заходы.'}
            </p>
            <Button onClick={onTracker}>К трекеру</Button>
          </div>
        ) : (
          <>
            <TableContainer>
              <Table size="small" aria-label="История прохождений">
                <TableHead>
                  <TableRow>
                    <TableCell>Начало</TableCell>
                    <TableCell>Результат</TableCell>
                    <TableCell>Время</TableCell>
                    <TableCell>Последний этап</TableCell>
                    <TableCell>Особенности</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.slice(currentPage * 10, currentPage * 10 + 10).map((s) => (
                    <TableRow hover key={s.id}>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => setSelected(s.id)}
                          aria-label={`Подробнее о заходе от ${date(s.createdAt)}`}
                        >
                          {date(s.createdAt)}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={statusColor(s.status)}
                          label={outcomeLabels[s.status]}
                        />
                      </TableCell>
                      <TableCell>
                        <strong className={styles.time}>
                          {duration(recordedDuration(s, now))}
                        </strong>
                        {s.runStartedAt === null && <small>с подключения</small>}
                      </TableCell>
                      <TableCell>
                        {s.phase.kind === 'final'
                          ? 'Финалка'
                          : `Застава ${s.stage} · ${phaseLabel(s.phase)}`}
                      </TableCell>
                      <TableCell>
                        <div className={styles.tags}>
                          {s.debug && (
                            <Chip size="small" label="Отладка" color="warning" variant="outlined" />
                          )}
                          {s.joined && <Chip size="small" label="Подключение" variant="outlined" />}
                          {!s.debug && !s.joined && <span>От старта</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={currentPage}
              rowsPerPage={10}
              rowsPerPageOptions={[10]}
              onPageChange={(_, value) => setPage(value)}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
              getItemAriaLabel={(type) =>
                type === 'next' ? 'Следующая страница' : 'Предыдущая страница'
              }
            />
          </>
        )}
      </section>
      <p className={styles.note}>
        История хранится в этом браузере. Локальная версия и GitHub Pages используют разные данные;
        обновление приложения не очищает историю.
      </p>
      {selectedSession && (
        <SessionDetails
          key={selectedSession.id}
          session={selectedSession}
          revision={revision}
          now={now}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  detail,
  accent = false,
}: {
  title: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <section className={`${styles.card} ${accent ? styles.accent : ''}`}>
      <span className={styles.metricTitle}>{title}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <span className={styles.metricDetail}>{detail}</span>
    </section>
  );
}

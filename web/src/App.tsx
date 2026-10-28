import TimerPanel from './components/TimerPanel';
import RunLimit from './components/RunLimit';
import ManualControls from './components/ManualControls';
import DungeonRoute from './components/DungeonRoute';
import AfkCard from './components/AfkCard';
import Timeline from './components/Timeline';
import { lazy, Suspense, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import SyncRounded from '@mui/icons-material/SyncRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import BarChartRounded from '@mui/icons-material/BarChartRounded';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import CloseFullscreenRounded from '@mui/icons-material/CloseFullscreenRounded';
import {
  effectiveNow,
  formatDuration,
  phaseElapsed,
  WAVE_MS,
  type Command,
} from './domain/dungeon';
import { useTracker } from './hooks/useTracker';
import SetupDialog from './components/SetupDialog';
import PwaControls from './components/PwaControls';
import styles from './styles/App.module.scss';
import { APP_VERSION } from './version';

const Statistics = lazy(() => import('./components/Statistics'));

function loadCompact() {
  try {
    return localStorage.getItem('gui-mu:compact') === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const tracker = useTracker();
  const { snapshot, now, ready, busy, execute } = tracker;
  const session = snapshot.session;
  const running = session?.status === 'running';
  const [setup, setSetup] = useState<'start' | 'sync' | null>(null);
  const [stopOpen, setStopOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compact, setCompact] = useState(loadCompact);
  const [page, setPage] = useState<'tracker' | 'statistics'>('tracker');
  const wave = session?.phase.kind === 'wave' ? session.phase.number : null;
  const elapsed = session ? phaseElapsed(session, now) : 0;
  const stageElapsed = wave ? (wave - 1) * WAVE_MS + Math.min(WAVE_MS, elapsed) : 600_000;

  const changeCompact = (value: boolean) => {
    setCompact(value);
    try {
      localStorage.setItem('gui-mu:compact', String(value));
    } catch {
      /* Session persistence is independent of this preference. */
    }
  };
  const act = (command: Command) => {
    void execute(command);
  };

  return (
    <div className={`${styles.app} ${compact && page === 'tracker' ? styles.compact : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" />
          <div>
            <strong>ГУЙ МУ</strong>
            <span>MAGISTER TRACKER</span>
          </div>
        </div>
        <div className={styles.server}>
          <span className={styles.dot} />
          Comeback PW<span>01</span>
        </div>
        <div className={styles.navCaption}>ПРОХОЖДЕНИЕ</div>
        <nav aria-label="Основная навигация">
          <button
            className={page === 'tracker' ? styles.navActive : ''}
            aria-current={page === 'tracker' ? 'page' : undefined}
            onClick={() => setPage('tracker')}
          >
            <DashboardOutlined />
            Трекер
          </button>
          <button
            className={page === 'statistics' ? styles.navActive : ''}
            aria-current={page === 'statistics' ? 'page' : undefined}
            onClick={() => setPage('statistics')}
          >
            <BarChartRounded />
            Статистика
          </button>
        </nav>
        <div className={styles.sidebarBottom}>
          <button onClick={() => setHelpOpen(true)}>
            <HelpOutlineRounded />
            Как пользоваться
          </button>
          <button onClick={() => setSettingsOpen(true)}>
            <TuneRounded />
            Настройки
          </button>
          <div className={styles.localNote}>
            <ShieldOutlined />
            <div>
              <strong>Только на этом устройстве</strong>
              <span>Сессия сохраняется в браузере</span>
            </div>
          </div>
          <div className={styles.version}>
            GUI MU OBSERVER<span>v{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>PERFECT WORLD / COMEBACK</div>
            <h1>
              {page === 'tracker' ? 'Обзор прохождения' : 'Статистика'}{' '}
              <span className={styles.releaseVersion}>v{APP_VERSION}</span>
            </h1>
            <p>Гуй Му · Магистр</p>
          </div>
          <div className={styles.headerActions}>
            <PwaControls running={!!running} busy={busy} />
            <Button
              variant="text"
              startIcon={page === 'tracker' ? <BarChartRounded /> : <DashboardOutlined />}
              onClick={() => setPage(page === 'tracker' ? 'statistics' : 'tracker')}
            >
              {page === 'tracker' ? 'Статистика' : 'К трекеру'}
            </Button>
            <Tooltip title={compact ? 'Полный вид' : 'Компактный вид'}>
              <IconButton
                aria-label={compact ? 'Полный вид' : 'Компактный вид'}
                onClick={() => changeCompact(!compact)}
              >
                {compact ? <OpenInFullRounded /> : <CloseFullscreenRounded />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Как пользоваться">
              <IconButton aria-label="Как пользоваться" onClick={() => setHelpOpen(true)}>
                <HelpOutlineRounded />
              </IconButton>
            </Tooltip>
            {running || session?.status === 'failed' ? (
              <Button
                variant="outlined"
                startIcon={<SyncRounded />}
                onClick={() => setSetup('sync')}
                disabled={busy}
              >
                Синхронизация
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<PlayArrowRounded />}
                onClick={() => setSetup('start')}
                disabled={!ready || busy}
              >
                Начать прохождение
              </Button>
            )}
          </div>
        </header>

        {tracker.error && (
          <Alert severity="error" onClose={tracker.clearError} sx={{ mb: 2 }}>
            {tracker.error}
          </Alert>
        )}
        {tracker.restored && (
          <Alert severity="info" onClose={tracker.dismissRestored} sx={{ mb: 2 }}>
            Сессия восстановлена. Волны пересчитаны по времени. Если за время отсутствия убили
            босса, синхронизируйте состояние с игрой.
          </Alert>
        )}
        {!ready && !tracker.error && (
          <LinearProgress aria-label="Загрузка сохранённой сессии" sx={{ mb: 2 }} />
        )}

        {page === 'statistics' ? (
          <Suspense fallback={<LinearProgress aria-label="Открытие статистики" />}>
            <Statistics
              revision={snapshot.revision}
              now={now}
              onTracker={() => setPage('tracker')}
            />
          </Suspense>
        ) : (
          <>
            <div className={styles.contentGrid}>
              <div className={styles.primaryColumn}>
                <TimerPanel
                  session={session}
                  now={now}
                  ready={ready}
                  busy={busy}
                  canUndo={snapshot.history.length > 0}
                  onAction={act}
                  onStart={() => setSetup('start')}
                  onStop={() => setStopOpen(true)}
                />

                <div className={styles.metrics}>
                  <section className={styles.card}>
                    <div className={styles.metricLabel}>
                      <FlagOutlined />
                      Время заставы
                    </div>
                    <strong>
                      {session?.stageStartedAt != null
                        ? formatDuration(
                            effectiveNow(session, now) - session.stageStartedAt,
                            'floor',
                          )
                        : '--:--'}
                    </strong>
                    <span>
                      {session && session.stageStartedAt === null
                        ? 'Начало неизвестно'
                        : 'С появления первой волны'}
                    </span>
                  </section>
                  <RunLimit session={session} now={now} />
                </div>

                <section className={`${styles.card} ${styles.stageCard}`}>
                  <div className={styles.cardTitle}>
                    <h3>Прогресс заставы</h3>
                    <span>
                      {session
                        ? wave
                          ? `${formatDuration(stageElapsed, 'floor')} / 10:00`
                          : 'Волны завершены'
                        : '00:00 / 10:00'}
                    </span>
                  </div>
                  <LinearProgress
                    variant="determinate"
                    value={!session ? 0 : Math.min(100, (stageElapsed / 600_000) * 100)}
                    aria-label="Прогресс до первого босса заставы"
                  />
                  <div className={styles.stageFoot}>
                    <span>Волна 1</span>
                    <span>5 волн × 2 минуты</span>
                    <span>Босс</span>
                  </div>
                  <p className={styles.smallNote}>
                    Шкала до появления первого босса. Время боя учитывается отдельно.
                  </p>
                </section>

                <ManualControls session={session} busy={busy} onAction={act} />
              </div>

              <aside className={styles.secondaryColumn}>
                <div className={styles.sectionHeading}>
                  <h3>АФК-чеки</h3>
                  <Chip size="small" label="15 минут на сдачу" variant="outlined" />
                </div>
                {([3, 6] as const).map((stage, i) => (
                  <AfkCard
                    key={stage}
                    stage={stage}
                    check={session?.afk[i] ?? { status: 'not-yet' }}
                    now={session ? effectiveNow(session, now) : now}
                    disabled={!running || busy}
                    onPass={() => act({ type: 'afk-passed', index: i as 0 | 1 })}
                  />
                ))}
                <section className={`${styles.card} ${styles.timeline}`}>
                  <div className={styles.cardTitle}>
                    <h3>Ближайшие события</h3>
                    <AccessTimeRounded />
                  </div>
                  <Timeline session={session} now={now} />
                </section>
                <div className={styles.tip}>
                  <ShieldOutlined />
                  <p>
                    После боссов 3 и 6 застав сдайте квест в бобовнике. Следующая застава уже идёт —
                    таймер не останавливается.
                  </p>
                </div>
              </aside>
            </div>

            <DungeonRoute session={session} />

            <footer className={styles.footer}>
              <span>
                <span className={styles.dot} />
                {ready ? 'Автосохранение включено' : 'Подключение к хранилищу'}
              </span>
              <span>Расписание на респе · интервал 02:00</span>
              <span>Хорошего захода.</span>
            </footer>
          </>
        )}
      </main>

      {setup && (
        <SetupDialog
          syncing={setup === 'sync'}
          session={session}
          busy={busy}
          onClose={() => setSetup(null)}
          onSubmit={(value, edits) =>
            execute(
              setup === 'start'
                ? { type: 'start', setup: value, id: crypto.randomUUID() }
                : { type: 'sync', setup: value, edits },
            )
          }
        />
      )}
      <Dialog open={stopOpen} onClose={() => setStopOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Остановить прохождение?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Сессия сохранится как незавершённая, а таймеры зафиксируются. Если нужно просто закрыть
            браузер, нажимать «Стоп» не требуется.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button color="inherit" onClick={() => setStopOpen(false)}>
            Продолжить
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              if (await execute({ type: 'stop' })) setStopOpen(false);
            }}
          >
            Остановить
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Как пользоваться трекером</DialogTitle>
        <DialogContent className={styles.helpContent}>
          <Typography>
            Нажмите «Старт» и запустите таймеры в момент взятия квеста ПЛ. Первая волна появляется
            сразу; следующие — каждые 2 минуты.
          </Typography>
          <Typography>
            После пятой волны отсчитываются ещё 2 минуты до босса. Подтвердите его убийство —
            следующая волна или второй босс начнутся сразу. На заставах 2 и 5 нужно подтвердить
            обоих боссов.
          </Typography>
          <Typography>
            После боссов застав 3 и 6 начинается 15-минутный АФК-чек. Сдайте квест НИПу в бобовнике
            и отметьте его пройденным.
          </Typography>
          <Typography>
            На каждого босса, включая второго и финалку, даётся 15 минут, на весь данж — 4 часа. При
            истечении лимита сессия завершается с сохранением причины. Перезагрузка страницы не
            обнуляет сроки. При позднем подключении укажите время от начала данжа, если оно
            известно.
          </Typography>
          <Typography>
            При позднем подключении выберите текущее состояние в форме старта. После перезапуска
            восстановится сохранённая сессия; пропущенные убийства боссов укажите через
            синхронизацию.
          </Typography>
          <Alert severity="info">
            Данные привязаны к этому браузеру и адресу сайта. Используйте один адрес:{' '}
            {location.origin}
            {import.meta.env.BASE_URL}. Очистка данных сайта удалит локальную историю.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            В фоне браузер может задерживать обновления. При возвращении на вкладку таймеры
            пересчитываются по времени. Задержку 2 минуты между пятой волной и боссом ещё нужно
            подтвердить в игре.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button variant="contained" onClick={() => setHelpOpen(false)}>
            Понятно
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Настройки</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={<Switch checked={compact} onChange={(_, value) => changeCompact(value)} />}
            label="Компактный вид"
          />
          <Typography variant="body2" color="text.secondary">
            Оставляет таймеры, управление и АФК-чеки. Настройка сохраняется в браузере.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            Версия {APP_VERSION}. Статистика доступна из верхней панели. Звуковые предупреждения
            запланированы для следующей версии.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button variant="contained" onClick={() => setSettingsOpen(false)}>
            Готово
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

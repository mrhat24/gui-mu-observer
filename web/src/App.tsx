import { useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Button, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, IconButton, LinearProgress,
  Switch, FormControlLabel, Tooltip, Typography,
} from '@mui/material';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import UndoRounded from '@mui/icons-material/UndoRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import WavesRounded from '@mui/icons-material/WavesRounded';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import SyncRounded from '@mui/icons-material/SyncRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import BarChartRounded from '@mui/icons-material/BarChartRounded';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import CloseFullscreenRounded from '@mui/icons-material/CloseFullscreenRounded';
import { effectiveNow, formatDuration, nextLabel, phaseElapsed, phaseLabel, WAVE_MS, type Afk, type Command, type Session } from './domain/dungeon';
import { useTracker } from './hooks/useTracker';
import SetupDialog from './components/SetupDialog';
import PwaControls from './components/PwaControls';
import styles from './styles/App.module.scss';

function loadCompact() { try { return localStorage.getItem('gui-mu:compact') === 'true'; } catch { return false; } }
const clock = (at: number) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function App() {
  const tracker = useTracker();
  const { snapshot, now, ready, busy, execute } = tracker;
  const session = snapshot.session;
  const running = session?.status === 'running';
  const completed = session?.status === 'completed';
  const completionElapsed = session?.endedAt != null
    ? session.endedAt - (session.runStartedAt ?? session.createdAt) : 0;
  const [setup, setSetup] = useState<'start' | 'sync' | null>(null);
  const [stopOpen, setStopOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compact, setCompact] = useState(loadCompact);
  const [lastBossClick, setLastBossClick] = useState(0);
  const wave = session?.phase.kind === 'wave' ? session.phase.number : null;
  const elapsed = session ? phaseElapsed(session, now) : 0;
  const waveProgress = wave ? Math.min(100, elapsed / WAVE_MS * 100) : 0;
  const stageElapsed = wave ? (wave - 1) * WAVE_MS + Math.min(WAVE_MS, elapsed) : 600_000;
  const statusLabel = !session ? 'Готов к старту' : running ? 'Прохождение идёт' : session.status === 'completed' ? 'Данж пройден' : 'Сессия остановлена';

  const changeCompact = (value: boolean) => {
    setCompact(value);
    try { localStorage.setItem('gui-mu:compact', String(value)); } catch { /* Session persistence is independent of this preference. */ }
  };
  const act = (command: Command) => { void execute(command); };

  return <div className={`${styles.app} ${compact ? styles.compact : ''}`}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" /><div><strong>ГУЙ МУ</strong><span>MAGISTER TRACKER</span></div></div>
      <div className={styles.server}><span className={styles.dot} />Comeback PW<span>01</span></div>
      <div className={styles.navCaption}>ПРОХОЖДЕНИЕ</div>
      <nav aria-label="Основная навигация">
        <button className={styles.navActive} aria-current="page"><DashboardOutlined />Трекер</button>
        <Tooltip title="Статистика сохраняется. Экран просмотра появится позже." placement="right"><span><button disabled><BarChartRounded />Статистика<span className={styles.soon}>скоро</span></button></span></Tooltip>
      </nav>
      <div className={styles.sidebarBottom}>
        <button onClick={() => setHelpOpen(true)}><HelpOutlineRounded />Как пользоваться</button>
        <button onClick={() => setSettingsOpen(true)}><TuneRounded />Настройки</button>
        <div className={styles.localNote}><ShieldOutlined /><div><strong>Только на этом устройстве</strong><span>Сессия сохраняется в браузере</span></div></div>
        <div className={styles.version}>GUI MU OBSERVER<span>v0.1</span></div>
      </div>
    </aside>

    <main className={styles.main}>
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>PERFECT WORLD / COMEBACK</div><h1>Обзор прохождения</h1><p>Гуй Му · Магистр</p></div>
        <div className={styles.headerActions}>
          <PwaControls running={!!running} busy={busy} />
          <Tooltip title={compact ? 'Полный вид' : 'Компактный вид'}><IconButton aria-label={compact ? 'Полный вид' : 'Компактный вид'} onClick={() => changeCompact(!compact)}>
            {compact ? <OpenInFullRounded /> : <CloseFullscreenRounded />}
          </IconButton></Tooltip>
          <Tooltip title="Как пользоваться"><IconButton aria-label="Как пользоваться" onClick={() => setHelpOpen(true)}><HelpOutlineRounded /></IconButton></Tooltip>
          {running ? <Button variant="outlined" startIcon={<SyncRounded />} onClick={() => setSetup('sync')} disabled={busy}>Синхронизация</Button>
            : <Button variant="contained" startIcon={<PlayArrowRounded />} onClick={() => setSetup('start')} disabled={!ready || busy}>Начать прохождение</Button>}
        </div>
      </header>

      {tracker.error && <Alert severity="error" onClose={tracker.clearError} sx={{ mb: 2 }}>{tracker.error}</Alert>}
      {tracker.restored && <Alert severity="info" onClose={tracker.dismissRestored} sx={{ mb: 2 }}>Сессия восстановлена. Волны пересчитаны по времени. Если за время отсутствия убили босса, синхронизируйте состояние с игрой.</Alert>}
      {!ready && !tracker.error && <LinearProgress aria-label="Загрузка сохранённой сессии" sx={{ mb: 2 }} />}

      <div className={styles.contentGrid}>
        <div className={styles.primaryColumn}>
          <section className={`${styles.card} ${styles.timerCard}`} aria-label="Текущая волна">
            <div className={styles.cardTop}><span className={styles.sectionLabel}>ТЕКУЩЕЕ СОСТОЯНИЕ</span><span className={`${styles.status} ${running ? styles.statusLive : ''}`}><span className={styles.dot} />{statusLabel}</span></div>
            <div className={styles.phaseHeading}><h2>{completed ? 'Прохождение завершено' : session ? session.phase.kind === 'final' ? 'Финальный босс' : `Застава ${session.stage}` : 'Всё готово к заходу'} </h2>
              {session && !completed && <Chip size="small" variant="outlined" label={session.phase.kind === 'wave' ? `${phaseLabel(session.phase)} из 5` : phaseLabel(session.phase)} />}
              {session?.debug && <Chip size="small" color="warning" variant="outlined" label="Отладка" />}
            </div>
            <p className={styles.muted}>{completed ? 'Финальный босс побеждён. Результат сохранён.' : session ? session.phase.kind === 'wave' ? 'Отсчёт от появления волны на респе' : 'Подтвердите убийство, чтобы продолжить прохождение' : 'Запустите таймеры, когда ПЛ возьмёт квест'}</p>
            <div className={styles.countdownBlock}>
              <div className={styles.countdownLabel}>{completed ? session.runStartedAt === null ? 'ВРЕМЯ С ПОДКЛЮЧЕНИЯ' : 'ОБЩЕЕ ВРЕМЯ ПРОХОЖДЕНИЯ' : !session ? 'ДО СЛЕДУЮЩЕГО СОБЫТИЯ' : wave ? `ДО ${wave === 5 ? 'ПЕРВОГО БОССА' : `ВОЛНЫ ${wave + 1}`}` : 'ВРЕМЯ БОЯ'}</div>
              <div className={`${styles.countdown} ${!session ? styles.countdownIdle : ''}`} aria-live="off" data-testid="main-timer">{completed ? formatDuration(completionElapsed, 'floor') : !session ? '00:00' : formatDuration(wave ? Math.max(0, WAVE_MS - elapsed) : elapsed, wave ? 'ceil' : 'floor')}</div>
              <span className={styles.interval}>{completed ? session.runStartedAt === null ? 'Начало данжа неизвестно — показано время с подключения' : 'От взятия квеста ПЛ до убийства финального босса' : !session ? 'Интервал волн — 2 минуты' : wave ? `Волна ${wave} · ${formatDuration(elapsed, 'floor')} из 02:00` : 'Следующий этап — после убийства босса'}</span>
            </div>
            <div className={styles.waveSegments} aria-label="Прогресс волн">{[1, 2, 3, 4, 5].map(n => <div key={n}>
              <div className={`${styles.segment} ${session && (!wave || n < wave) ? styles.segmentDone : ''}`}>
                {wave === n && <span style={{ width: `${waveProgress}%` }} />}
              </div><span className={wave === n ? styles.activeText : ''}>Волна {n}</span>
            </div>)}</div>
            {completed ? <div className={styles.nextEvent}><span><CheckRounded />Завершено</span><strong>{clock(session.endedAt!)}</strong><span>Результат сохранён</span></div>
              : <div className={styles.nextEvent}><span><AccessTimeRounded />Далее</span><strong>{session ? nextLabel(session) : 'Застава 1 · волна 1'}</strong><span>{!session ? 'Сразу после старта' : wave ? clock(session.phaseStartedAt + WAVE_MS) : 'По подтверждению'}</span></div>}
            <div className={styles.controls}>
              {!running ? <Button variant="contained" startIcon={<PlayArrowRounded />} onClick={() => setSetup('start')} disabled={!ready || busy}>{session ? 'Новое прохождение' : 'Старт'}</Button>
                : <Button variant="contained" startIcon={<CheckRounded />} disabled={busy || !!wave || now - lastBossClick < 1000} onClick={() => { setLastBossClick(Date.now()); act({ type: 'boss-killed' }); }}>Убили босса</Button>}
              <Tooltip title="Отменить последнее ручное действие"><span><IconButton aria-label="Отменить последнее действие" disabled={!snapshot.history.length || busy} onClick={() => act({ type: 'undo' })}><UndoRounded /></IconButton></span></Tooltip>
              <span className={styles.controlSpacer} />
              <Button variant="text" color="inherit" startIcon={<StopRounded />} disabled={!running || busy} onClick={() => setStopOpen(true)}>Стоп</Button>
            </div>
          </section>

          <div className={styles.metrics}>
            <section className={styles.card}><div className={styles.metricLabel}><FlagOutlined />Время заставы</div><strong>{session?.stageStartedAt != null ? formatDuration(effectiveNow(session, now) - session.stageStartedAt, 'floor') : '--:--'}</strong><span>{session && session.stageStartedAt === null ? 'Начало неизвестно' : 'С появления первой волны'}</span></section>
            <section className={styles.card}><div className={styles.metricLabel}><AccessTimeRounded />Время прохождения</div><strong>{session?.runStartedAt != null ? formatDuration(effectiveNow(session, now) - session.runStartedAt, 'floor') : '--:--'}</strong><span>{session?.joined ? 'Подключились посреди данжа' : 'От взятия квеста ПЛ'}</span></section>
          </div>

          <section className={`${styles.card} ${styles.stageCard}`}>
            <div className={styles.cardTitle}><h3>Прогресс заставы</h3><span>{session ? wave ? `${formatDuration(stageElapsed, 'floor')} / 10:00` : 'Волны завершены' : '00:00 / 10:00'}</span></div>
            <LinearProgress variant="determinate" value={!session ? 0 : Math.min(100, stageElapsed / 600_000 * 100)} aria-label="Прогресс до первого босса заставы" />
            <div className={styles.stageFoot}><span>Волна 1</span><span>5 волн × 2 минуты</span><span>Босс</span></div>
            <p className={styles.smallNote}>Шкала до появления первого босса. Время боя учитывается отдельно.</p>
          </section>

          <Accordion className={styles.manual} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreRounded />}><TuneRounded /><span>Ручная синхронизация</span><span className={styles.manualHint}>Если таймер разошёлся с игрой</span></AccordionSummary>
            <AccordionDetails>
              <p className={styles.smallNote}>Переходы записываются как коррекции. Убийство босса подтверждается отдельной кнопкой.</p>
              <div className={styles.manualButtons}>
                <Tooltip title={running && session ? `Отладка → ${nextLabel(session)}. Переход без ожидания таймера; на боссе имитирует убийство.` : 'Начните прохождение, чтобы прокликать этапы'}><span>
                  <Button variant="outlined" startIcon={<ArrowForwardRounded />} disabled={!running || busy} onClick={() => act({ type: 'debug-next' })}>Далее</Button>
                </span></Tooltip>
                <Button variant="outlined" disabled={!running || !wave || busy} onClick={() => act({ type: 'next-wave' })}>Следующая волна</Button>
                <Button variant="outlined" disabled={!running || session?.phase.kind === 'final' || busy} onClick={() => act({ type: 'next-stage' })}>Следующая застава</Button>
                <Button variant="outlined" disabled={!running || !wave || busy} onClick={() => act({ type: 'shift', milliseconds: -10_000 })}>До события −10 с</Button>
                <Button variant="outlined" disabled={!running || !wave || busy} onClick={() => act({ type: 'shift', milliseconds: 10_000 })}>До события +10 с</Button>
              </div>
            </AccordionDetails>
          </Accordion>
        </div>

        <aside className={styles.secondaryColumn}>
          <div className={styles.sectionHeading}><h3>АФК-чеки</h3><Chip size="small" label="15 минут на сдачу" variant="outlined" /></div>
          {([3, 6] as const).map((stage, i) => <AfkCard key={stage} stage={stage} check={session?.afk[i] ?? { status: 'not-yet' }} now={session ? effectiveNow(session, now) : now} disabled={!running || busy} onPass={() => act({ type: 'afk-passed', index: i as 0 | 1 })} />)}
          <section className={`${styles.card} ${styles.timeline}`}>
            <div className={styles.cardTitle}><h3>Ближайшие события</h3><AccessTimeRounded /></div>
            <Timeline session={session} now={now} />
          </section>
          <div className={styles.tip}><ShieldOutlined /><p>После боссов 3 и 6 застав сдайте квест в бобовнике. Следующая застава уже идёт — таймер не останавливается.</p></div>
        </aside>
      </div>

      <section className={`${styles.card} ${styles.routeCard}`}>
        <div className={styles.cardTitle}><h3>Маршрут прохождения</h3><span>9 застав + финалка</span></div>
        <div className={styles.route}>{Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const current = !!session && (n === 10 ? session.phase.kind === 'final' : session.stage === n && session.phase.kind !== 'final');
          const done = !!session && (session.status === 'completed' || n < session.stage || n === 9 && session.phase.kind === 'final');
          return <div className={`${styles.routeItem} ${current ? styles.routeCurrent : ''} ${done ? styles.routeDone : ''}`} key={n} aria-current={current ? 'step' : undefined}>
            <span className={styles.routeCircle}>{done ? <CheckRounded /> : n === 10 ? <FlagOutlined /> : n}</span>
            <strong>{n === 10 ? 'Финалка' : `Застава ${n}`}</strong><span>{[2, 5].includes(n) ? '2 босса' : [3, 6].includes(n) ? 'АФК-чек' : n === 10 ? 'Последний босс' : '5 волн'}</span>
          </div>;
        })}</div>
      </section>

      <footer className={styles.footer}><span><span className={styles.dot} />{ready ? 'Автосохранение включено' : 'Подключение к хранилищу'}</span><span>Расписание на респе · интервал 02:00</span><span>Хорошего захода.</span></footer>
    </main>

    {setup && <SetupDialog syncing={setup === 'sync'} session={session} busy={busy} onClose={() => setSetup(null)} onSubmit={value => execute({ type: setup, setup: value, id: crypto.randomUUID() })} />}
    <Dialog open={stopOpen} onClose={() => setStopOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Остановить прохождение?</DialogTitle><DialogContent><Typography color="text.secondary">Сессия сохранится как незавершённая, а таймеры зафиксируются. Если нужно просто закрыть браузер, нажимать «Стоп» не требуется.</Typography></DialogContent>
      <DialogActions sx={{ p: 3 }}><Button color="inherit" onClick={() => setStopOpen(false)}>Продолжить</Button><Button variant="contained" disabled={busy} onClick={async () => { if (await execute({ type: 'stop' })) setStopOpen(false); }}>Остановить</Button></DialogActions>
    </Dialog>
    <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Как пользоваться трекером</DialogTitle><DialogContent className={styles.helpContent}>
        <Typography>Нажмите «Старт» и запустите таймеры в момент взятия квеста ПЛ. Первая волна появляется сразу; следующие — каждые 2 минуты.</Typography>
        <Typography>После пятой волны отсчитываются ещё 2 минуты до босса. Подтвердите его убийство — следующая волна или второй босс начнутся сразу. На заставах 2 и 5 нужно подтвердить обоих боссов.</Typography>
        <Typography>После боссов застав 3 и 6 начинается 15-минутный АФК-чек. Сдайте квест НИПу в бобовнике и отметьте его пройденным.</Typography>
        <Typography>При позднем подключении выберите текущее состояние в форме старта. После перезапуска восстановится сохранённая сессия; пропущенные убийства боссов укажите через синхронизацию.</Typography>
        <Alert severity="info">Данные привязаны к этому браузеру и адресу сайта. Используйте один адрес: {location.origin}{import.meta.env.BASE_URL}. Очистка данных сайта удалит локальную историю.</Alert>
        <Typography variant="body2" color="text.secondary">В фоне браузер может задерживать обновления. При возвращении на вкладку таймеры пересчитываются по времени. Задержку 2 минуты между пятой волной и боссом ещё нужно подтвердить в игре.</Typography>
      </DialogContent><DialogActions sx={{ p: 3 }}><Button variant="contained" onClick={() => setHelpOpen(false)}>Понятно</Button></DialogActions>
    </Dialog>
    <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Настройки</DialogTitle><DialogContent>
        <FormControlLabel control={<Switch checked={compact} onChange={(_, value) => changeCompact(value)} />} label="Компактный вид" />
        <Typography variant="body2" color="text.secondary">Оставляет таймеры, управление и АФК-чеки. Настройка сохраняется в браузере.</Typography>
        <Divider sx={{ my: 2 }} /><Typography variant="body2" color="text.secondary">Звуковые предупреждения и просмотр статистики запланированы для следующей версии. История событий уже сохраняется.</Typography>
      </DialogContent><DialogActions sx={{ p: 3 }}><Button variant="contained" onClick={() => setSettingsOpen(false)}>Готово</Button></DialogActions>
    </Dialog>
  </div>;
}

function AfkCard({ stage, check, now, disabled, onPass }: { stage: number; check: Afk; now: number; disabled: boolean; onPass: () => void }) {
  const left = 'deadline' in check ? Math.max(0, check.deadline - now) : 900_000;
  const pending = check.status === 'pending';
  const expired = check.status === 'expired' || pending && left === 0;
  const passed = check.status === 'passed';
  const waiting = check.status === 'not-yet';
  const urgent = expired || pending && left <= 60_000;
  const title = passed ? 'Чек пройден' : expired ? 'Время истекло' : waiting ? 'Ещё не наступил' : pending ? 'Нужно сдать квест' : 'Статус неизвестен';
  return <section className={`${styles.card} ${styles.afkCard} ${pending ? styles.afkPending : ''} ${urgent ? styles.afkUrgent : ''}`} aria-label={`АФК-чек заставы ${stage}`}>
    <div className={styles.afkHeading}><span className={styles.afkIcon}>{passed ? <CheckRounded /> : <ShieldOutlined />}</span><div><strong>После заставы {stage}</strong><span>{title}</span></div><span className={styles.afkNumber}>0{stage}</span></div>
    <div className={`${styles.afkTime} ${waiting ? styles.dim : ''}`}>{passed ? <span className={styles.passedText}>Готово</span> : check.status === 'unknown' ? '--:--' : formatDuration(left)}</div>
    <p>{passed ? 'Сдача квеста отмечена' : waiting ? 'Отсчёт начнётся после убийства босса' : expired ? 'Проверьте результат квеста в игре' : pending ? 'Осталось на квест в бобовнике' : 'Проверьте квест или задайте остаток времени'}</p>
    <Button fullWidth size="small" variant={pending ? 'contained' : 'outlined'} startIcon={<CheckRounded />} disabled={disabled || waiting || passed} onClick={onPass}>
      АФК-чек пройден
    </Button>
  </section>;
}

function Timeline({ session, now }: { session: Session | null; now: number }) {
  if (!session) return <div className={styles.timelineEmpty}><WavesRounded /><p>Здесь появится расписание волн и боссов</p><span>Начните прохождение, чтобы включить отсчёт</span></div>;
  if (session.status !== 'running') return <div className={styles.timelineEmpty}><FlagOutlined /><p>{session.status === 'completed' ? 'Все этапы пройдены' : 'Таймеры остановлены'}</p><span>События сохранены в истории</span></div>;
  if (session.phase.kind !== 'wave') return <div className={styles.bossNext}><span className={styles.timelineIcon}><FlagOutlined /></span><div><strong>{nextLabel(session)}</strong><span>Сразу после убийства текущего босса</span></div></div>;
  const wave = session.phase.number;
  const entries = Array.from({ length: 6 - wave }, (_, i) => {
    const n = wave + i + 1;
    return { title: n === 6 ? 'Босс 1' : `Волна ${n}`, boss: n === 6, at: session.phaseStartedAt + (i + 1) * WAVE_MS };
  });
  return <div className={styles.timelineList}>{entries.map((entry, i) => <div className={styles.timelineRow} key={entry.title}>
    <span className={`${styles.timelineIcon} ${i === 0 ? styles.timelineFirst : ''}`}>{entry.boss ? <FlagOutlined /> : <WavesRounded />}</span>
    <div><strong>{entry.title}</strong><span>{clock(entry.at)}</span></div><span className={styles.timelineRemaining}>{formatDuration(entry.at - now)}</span>
    {i === 0 && <ArrowForwardRounded className={styles.timelineArrow} />}
  </div>)}</div>;
}

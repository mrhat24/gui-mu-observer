import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { defaultSetup, toSetup, type Session, type Setup, type SyncEdits } from '../domain/dungeon';
import styles from '../styles/App.module.scss';
import { RUN_MS } from '../domain/rules';

interface Props {
  session: Session | null;
  syncing: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (setup: Setup, edits: SyncEdits) => Promise<boolean>;
}

export default function SetupDialog({ session, syncing, busy, onClose, onSubmit }: Props) {
  const [setup, setSetup] = useState(() =>
    syncing && session ? toSetup(session, Date.now()) : defaultSetup(),
  );
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<SyncEdits>({ phase: false, afk: [false, false] });
  const editPhase = () => setEdits((old) => ({ ...old, phase: true }));
  const editAfk = (index: number) =>
    setEdits((old) => ({
      ...old,
      afk: old.afk.map((value, i) => value || i === index) as [boolean, boolean],
    }));
  const set = <K extends keyof Setup>(key: K, value: Setup[K]) => {
    editPhase();
    setSetup((old) => ({ ...old, [key]: value }));
  };
  const changeStage = (stage: number) => {
    editPhase();
    setSetup((old) => ({
      ...old,
      stage,
      phase:
        old.phase === 'boss-2' && ![2, 5].includes(stage)
          ? 'boss-1'
          : old.phase === 'final' && stage !== 9
            ? 'boss-1'
            : old.phase,
    }));
  };
  const maxElapsed = setup.phase === 'wave' ? 119 : 86400;
  const valid =
    (setup.runElapsed === undefined ||
      (Number.isInteger(setup.runElapsed) &&
        setup.runElapsed >= 0 &&
        setup.runElapsed <= RUN_MS / 1000)) &&
    Number.isInteger(setup.stage) &&
    setup.stage >= 1 &&
    setup.stage <= 9 &&
    Number.isInteger(setup.elapsed) &&
    setup.elapsed >= 0 &&
    setup.elapsed <= maxElapsed &&
    Number.isInteger(setup.wave) &&
    setup.wave >= 1 &&
    setup.wave <= 5 &&
    setup.afk.every(
      (check, index) =>
        (setup.stage <= [3, 6][index] && setup.phase !== 'final') ||
        check.status !== 'pending' ||
        (Number.isInteger(check.remaining) && check.remaining >= 1 && check.remaining <= 900),
    );
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="setup-title"
    >
      <DialogTitle id="setup-title">
        {syncing ? 'Синхронизация с игрой' : 'Начать прохождение'}
        <Typography variant="body2" color="text.secondary" mt={1}>
          {syncing
            ? 'Укажите то, что сейчас происходит на респе. Это действие можно отменить.'
            : 'Новый заход или подключение к уже начавшемуся данжу.'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <div className={styles.formGrid}>
          <TextField
            select
            label="Застава"
            value={setup.stage}
            onChange={(e) => changeStage(Number(e.target.value))}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <MenuItem key={i} value={i + 1}>
                Застава {i + 1}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Текущая фаза"
            value={setup.phase}
            onChange={(e) => {
              editPhase();
              setSetup((old) => ({ ...old, phase: e.target.value as Setup['phase'], elapsed: 0 }));
            }}
          >
            <MenuItem value="wave">Волны</MenuItem>
            <MenuItem value="boss-1">Босс 1</MenuItem>
            {[2, 5].includes(setup.stage) && <MenuItem value="boss-2">Босс 2</MenuItem>}
            {setup.stage === 9 && <MenuItem value="final">Финальный босс</MenuItem>}
          </TextField>
          {setup.phase === 'wave' && (
            <TextField
              select
              label="Волна"
              value={setup.wave}
              onChange={(e) => set('wave', Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <MenuItem key={n} value={n}>
                  Волна {n}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Прошло с появления, сек"
            type="number"
            value={setup.elapsed}
            onChange={(e) => set('elapsed', Number(e.target.value))}
            error={
              !Number.isInteger(setup.elapsed) || setup.elapsed < 0 || setup.elapsed > maxElapsed
            }
            helperText={`От 0 до ${maxElapsed} секунд`}
            slotProps={{ htmlInput: { min: 0, max: maxElapsed } }}
          />
        </div>
        <TextField
          fullWidth
          sx={{ mt: 2 }}
          label="Прошло с начала данжа, сек"
          type="number"
          value={setup.runElapsed ?? ''}
          onChange={(e) => {
            setEdits((old) => ({ ...old, run: true }));
            setSetup((old) => ({
              ...old,
              runElapsed: e.target.value === '' ? undefined : Number(e.target.value),
            }));
          }}
          slotProps={{ htmlInput: { min: 0, max: RUN_MS / 1000 } }}
          helperText="Для лимита 4 часа. При подключении посреди данжа оставьте пустым, если начало неизвестно. Нетронутое время продолжает идти."
          error={
            setup.runElapsed !== undefined &&
            (!Number.isInteger(setup.runElapsed) ||
              setup.runElapsed < 0 ||
              setup.runElapsed > RUN_MS / 1000)
          }
        />
        {[3, 6].map(
          (stage, i) =>
            (setup.stage > stage || setup.phase === 'final') && (
              <div className={styles.afkSetup} key={stage}>
                <Typography variant="body2" fontWeight={600}>
                  АФК-чек после заставы {stage}
                </Typography>
                <div className={styles.formGrid}>
                  <TextField
                    select
                    size="small"
                    label="Состояние"
                    value={setup.afk[i].status}
                    onChange={(e) => {
                      editAfk(i);
                      setSetup((old) => ({
                        ...old,
                        afk: old.afk.map((v, index) =>
                          index === i ? { ...v, status: e.target.value } : v,
                        ) as Setup['afk'],
                      }));
                    }}
                  >
                    <MenuItem value="unknown">Неизвестно</MenuItem>
                    <MenuItem value="pending">Ожидает сдачи</MenuItem>
                    <MenuItem value="passed">Пройден</MenuItem>
                    <MenuItem value="expired">Время истекло</MenuItem>
                  </TextField>
                  {setup.afk[i].status === 'pending' && (
                    <TextField
                      size="small"
                      type="number"
                      label="Осталось, сек"
                      value={setup.afk[i].remaining}
                      slotProps={{ htmlInput: { min: 1, max: 900 } }}
                      helperText="От 1 до 900 секунд"
                      error={
                        setup.afk[i].remaining < 1 ||
                        setup.afk[i].remaining > 900 ||
                        !Number.isInteger(setup.afk[i].remaining)
                      }
                      onChange={(e) => {
                        editAfk(i);
                        setSetup((old) => ({
                          ...old,
                          afk: old.afk.map((v, index) =>
                            index === i ? { ...v, remaining: Number(e.target.value) } : v,
                          ) as Setup['afk'],
                        }));
                      }}
                    />
                  )}
                </div>
              </div>
            ),
        )}
        <Alert severity="info" icon={false} sx={{ mt: 2 }}>
          {syncing
            ? 'Неизменённые таймеры продолжают идти. Введённое вручную время считается на момент применения. Коррекция попадёт в журнал.'
            : 'Для нового захода оставьте заставу 1, волну 1 и запустите таймеры в момент взятия квеста ПЛ.'}
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button
          variant="contained"
          disabled={!valid || busy}
          onClick={async () => {
            setError('');
            if (await onSubmit(setup, edits)) onClose();
            else setError('Не удалось сохранить состояние. Проверьте сообщение на главном экране.');
          }}
        >
          {syncing ? 'Применить состояние' : 'Запустить таймеры'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySnapshot, type Command, type Snapshot } from '../domain/dungeon';
import { Repository } from '../storage/database';

export function useTracker() {
  const repository = useRef<Repository | null>(null);
  const snapshotRef = useRef<Snapshot>(emptySnapshot());
  const pending = useRef(false);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const publish = useCallback((value: Snapshot) => {
    snapshotRef.current = value;
    setSnapshot(value);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ownRepository: Repository | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      setNow(Date.now());
      if (pending.current || !repository.current) return;
      pending.current = true;
      try {
        const value = await repository.current.execute({ type: 'tick' }, Date.now());
        if (!cancelled) publish(value);
      } catch (e) {
        if (!cancelled) setError(`Не удалось обновить сохранённую сессию: ${message(e)}`);
      } finally { pending.current = false; }
    };
    const wake = () => { if (document.visibilityState === 'visible') void tick(); };
    void (async () => {
      try {
        ownRepository = await Repository.open();
        if (cancelled) { ownRepository.close(); return; }
        repository.current = ownRepository;
        const previous = await ownRepository.read();
        const value = await ownRepository.execute({ type: 'tick' }, Date.now());
        if (cancelled) return;
        publish(value);
        setRestored(previous.session?.status === 'running');
        setReady(true);
        timer = setInterval(() => { void tick(); }, 1000);
        document.addEventListener('visibilitychange', wake);
      } catch (e) {
        if (!cancelled) setError(`Локальное хранилище недоступно: ${message(e)}. Перезапустите страницу; сохранённые данные не будут перезаписаны.`);
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      if (repository.current === ownRepository) repository.current = null;
      ownRepository?.close();
    };
  }, [publish]);

  const execute = useCallback(async (command: Command): Promise<boolean> => {
    if (!repository.current || pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      const value = await repository.current.execute(command, Date.now(), snapshotRef.current.revision);
      publish(value);
      setError(null);
      setRestored(false);
      return true;
    } catch (e) {
      setError(`${message(e)} Изменение не применено.`);
      try { publish(await repository.current.read()); } catch { /* Keep the last known state visible. */ }
      return false;
    } finally { pending.current = false; setBusy(false); }
  }, [publish]);

  return { snapshot, now, ready, busy, error, restored, execute, dismissRestored: () => setRestored(false), clearError: () => setError(null) };
}

function message(error: unknown) { return error instanceof Error ? error.message : String(error); }

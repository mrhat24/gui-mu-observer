import { useCallback, useEffect, useRef, useState } from 'react';
import { emptySnapshot, type Command, type Snapshot } from '../domain/dungeon';
import { Repository } from '../storage/database';
import { TrackerService } from '../services/TrackerService';

export function useTracker() {
  const serviceRef = useRef<TrackerService | null>(null);
  const manualRequests = useRef(0);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [now, setNow] = useState(Date.now);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const publish = useCallback((value: Snapshot) => {
    setSnapshot(value);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ownService: TrackerService | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      setNow(Date.now());
      try {
        await ownService?.tick();
      } catch (e) {
        if (!cancelled) setError(`Не удалось обновить сохранённую сессию: ${message(e)}`);
      }
    };
    const wake = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    void (async () => {
      try {
        const repository = await Repository.open();
        if (cancelled) {
          repository.close();
          return;
        }
        ownService = new TrackerService(repository, (value) => {
          if (!cancelled) publish(value);
        });
        serviceRef.current = ownService;
        const wasRunning = await ownService.initialize();
        if (cancelled) return;
        setRestored(wasRunning);
        setReady(true);
        timer = setInterval(() => {
          void tick();
        }, 1000);
        document.addEventListener('visibilitychange', wake);
      } catch (e) {
        if (!cancelled)
          setError(
            `Локальное хранилище недоступно: ${message(e)}. Перезапустите страницу; сохранённые данные не будут перезаписаны.`,
          );
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      if (serviceRef.current === ownService) serviceRef.current = null;
      ownService?.dispose();
    };
  }, [publish]);

  const execute = useCallback(async (command: Command): Promise<boolean> => {
    const service = serviceRef.current;
    if (!service) {
      setError('Трекер ещё не готов. Дождитесь загрузки хранилища.');
      return false;
    }
    manualRequests.current += 1;
    setBusy(true);
    try {
      await service.execute(command);
      if (serviceRef.current === service) {
        setError(null);
        setRestored(false);
      }
      return true;
    } catch (e) {
      if (serviceRef.current === service) setError(`${message(e)} Изменение не применено.`);
      return false;
    } finally {
      manualRequests.current -= 1;
      if (serviceRef.current === service) setBusy(manualRequests.current > 0);
    }
  }, []);

  return {
    snapshot,
    now,
    ready,
    busy,
    error,
    restored,
    execute,
    dismissRestored: () => setRestored(false),
    clearError: () => setError(null),
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

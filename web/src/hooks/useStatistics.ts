import { useEffect, useState } from 'react';
import type { Event, Session } from '../domain/dungeon';
import { Repository } from '../storage/database';

export function useStatistics(revision: number) {
  const [state, setState] = useState<{
    sessions: Session[];
    skipped: number;
    loading: boolean;
    error: string | null;
  }>({ sessions: [], skipped: 0, loading: true, error: null });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState((old) => ({ ...old, loading: true, error: null }));
    void (async () => {
      let repository: Repository | undefined;
      try {
        repository = await Repository.open();
        const history = await repository.history();
        if (!cancelled) setState({ ...history, loading: false, error: null });
      } catch (error) {
        if (!cancelled)
          setState((old) => ({
            ...old,
            loading: false,
            error: error instanceof Error ? error.message : 'Не удалось прочитать историю',
          }));
      } finally {
        repository?.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [revision, refresh]);
  return { ...state, reload: () => setRefresh((value) => value + 1) };
}

export function useSessionEvents(id: string, revision: number) {
  const [state, setState] = useState<{ events: Event[]; loading: boolean; error: string | null }>({
    events: [],
    loading: true,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    setState({ events: [], loading: true, error: null });
    void (async () => {
      let repository: Repository | undefined;
      try {
        repository = await Repository.open();
        const events = await repository.sessionEvents(id);
        if (!cancelled) setState({ events, loading: false, error: null });
      } catch (error) {
        if (!cancelled)
          setState({
            events: [],
            loading: false,
            error: error instanceof Error ? error.message : 'Не удалось прочитать события',
          });
      } finally {
        repository?.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, revision]);
  return state;
}

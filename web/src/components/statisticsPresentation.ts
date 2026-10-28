import { formatDuration, type Session } from '../domain/dungeon';
export const date = (at: number) =>
  new Date(at).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export const duration = (value: number | null) =>
  value === null ? '—' : formatDuration(value, 'floor');
export const statusColor = (status: Session['status']) =>
  status === 'completed'
    ? 'success'
    : status === 'failed'
      ? 'error'
      : status === 'running'
        ? 'primary'
        : 'default';

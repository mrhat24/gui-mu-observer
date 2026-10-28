import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  emptySnapshot,
  transition,
  validateSnapshot,
  validateSession,
  type Command,
  type Event,
  type Session,
  type Snapshot,
} from '../domain/dungeon';

interface DungeonDatabase extends DBSchema {
  meta: { key: string; value: Snapshot };
  sessions: { key: string; value: Session };
  events: { key: number; value: Event; indexes: { 'by-session': string } };
}

export class Repository {
  private constructor(private db: IDBPDatabase<DungeonDatabase>) {}

  static async open(name = 'gui-mu-observer-v1') {
    const db = await openDB<DungeonDatabase>(name, 2, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('meta', { keyPath: 'key' });
          db.createObjectStore('sessions', { keyPath: 'id' });
          db.createObjectStore('events', { autoIncrement: true });
        }
        if (oldVersion < 2)
          transaction.objectStore('events').createIndex('by-session', 'sessionId');
      },
      blocking() {
        db.close();
      },
    });
    return new Repository(db);
  }

  async read(): Promise<Snapshot> {
    const snapshot = (await this.db.get('meta', 'current')) ?? emptySnapshot();
    validateSnapshot(snapshot);
    return snapshot;
  }

  async history(): Promise<{ sessions: Session[]; skipped: number }> {
    const records = await this.db.getAll('sessions');
    const sessions: Session[] = [];
    let skipped = 0;
    for (const record of records) {
      try {
        validateSession(record);
        sessions.push(record);
      } catch {
        skipped += 1;
      }
    }
    return {
      sessions: sessions.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
      skipped,
    };
  }

  async sessionEvents(id: string): Promise<Event[]> {
    const events = await this.db.getAllFromIndex('events', 'by-session', id);
    for (const event of events) {
      if (
        event.sessionId !== id ||
        !Number.isSafeInteger(event.at) ||
        event.at < 0 ||
        typeof event.kind !== 'string'
      )
        throw new Error('Повреждены события прохождения');
      validateSession(event.snapshot);
    }
    return events.sort((a, b) => a.at - b.at);
  }

  async execute(command: Command, now: number, expectedRevision?: number): Promise<Snapshot> {
    // One read/write transaction serializes commands from all tabs and atomically stores the audit trail.
    const tx = this.db.transaction(['meta', 'sessions', 'events'], 'readwrite', {
      durability: 'strict',
    });
    try {
      const before = (await tx.objectStore('meta').get('current')) ?? emptySnapshot();
      validateSnapshot(before);
      if (expectedRevision !== undefined && before.revision !== expectedRevision) {
        throw new Error(
          'Состояние изменилось в другой вкладке или по таймеру. Повторите действие.',
        );
      }
      const { snapshot, events } = transition(before, command, now);
      if (events.length) {
        await tx.objectStore('meta').put(snapshot);
        await tx.objectStore('sessions').put(snapshot.session!);
        for (const event of events) await tx.objectStore('events').add(event);
      }
      await tx.done;
      return snapshot;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* The transaction may already have aborted. */
      }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { emptySnapshot, transition, validateSession, type Command, type Event, type Session, type Snapshot } from '../domain/dungeon';

interface DungeonDatabase extends DBSchema {
  meta: { key: string; value: Snapshot };
  sessions: { key: string; value: Session };
  events: { key: number; value: Event };
}

export class Repository {
  private constructor(private db: IDBPDatabase<DungeonDatabase>) {}

  static async open(name = 'gui-mu-observer-v1') {
    const db = await openDB<DungeonDatabase>(name, 1, {
      upgrade(db) {
        db.createObjectStore('meta', { keyPath: 'key' });
        db.createObjectStore('sessions', { keyPath: 'id' });
        db.createObjectStore('events', { autoIncrement: true });
      },
      blocking() { db.close(); },
    });
    return new Repository(db);
  }

  async read(): Promise<Snapshot> {
    const snapshot = await this.db.get('meta', 'current') ?? emptySnapshot();
    if (snapshot.session) validateSession(snapshot.session);
    return snapshot;
  }

  async execute(command: Command, now: number, expectedRevision?: number): Promise<Snapshot> {
    // One read/write transaction serializes commands from all tabs and atomically stores the audit trail.
    const tx = this.db.transaction(['meta', 'sessions', 'events'], 'readwrite', { durability: 'strict' });
    try {
      const before = await tx.objectStore('meta').get('current') ?? emptySnapshot();
      if (expectedRevision !== undefined && before.revision !== expectedRevision) {
        throw new Error('Состояние изменилось в другой вкладке или по таймеру. Повторите действие.');
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
      try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  close() { this.db.close(); }
}

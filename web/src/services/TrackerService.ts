import { emptySnapshot, type Command, type Snapshot } from '../domain/dungeon';

export interface TrackerRepository {
  read(): Promise<Snapshot>;
  execute(command: Command, now: number, expectedRevision?: number): Promise<Snapshot>;
  close(): void;
}

/** Serializes local operations; the repository still arbitrates between tabs. */
export class TrackerService {
  private snapshot = emptySnapshot();
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private disposed = false;

  constructor(
    private readonly repository: TrackerRepository,
    private readonly publish: (snapshot: Snapshot) => void,
    private readonly clock = Date.now,
  ) {}

  initialize(): Promise<boolean> {
    return this.enqueue(async () => {
      this.ensureActive();
      const previous = await this.repository.read();
      this.ensureActive();
      this.update(await this.repository.execute({ type: 'tick' }, this.clock()));
      return previous.session?.status === 'running';
    });
  }

  tick(): Promise<void> {
    // A queued command already refreshes state. Do not accumulate background ticks.
    if (this.disposed || this.pending > 0) return Promise.resolve();
    return this.enqueue(async () => {
      this.ensureActive();
      this.update(await this.repository.execute({ type: 'tick' }, this.clock()));
    });
  }

  execute(command: Command): Promise<void> {
    const requestedAt = this.clock();
    return this.enqueue(async () => {
      this.ensureActive();
      try {
        this.update(await this.repository.execute(command, requestedAt, this.snapshot.revision));
      } catch (error) {
        if (!this.disposed) {
          try {
            this.update(await this.repository.read());
          } catch {
            /* Preserve the original error. */
          }
        }
        throw error;
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Let an in-flight transaction settle before closing the connection.
    void this.enqueue(async () => {
      this.repository.close();
    });
  }

  private update(snapshot: Snapshot): void {
    if (this.disposed) return;
    this.snapshot = snapshot;
    this.publish(snapshot);
  }

  private ensureActive(): void {
    if (this.disposed) throw new Error('Трекер уже закрыт');
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    this.pending += 1;
    const result = this.tail.then(async () => {
      try {
        return await operation();
      } finally {
        this.pending -= 1;
      }
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

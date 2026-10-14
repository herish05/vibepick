/** Offline-tolerant queue for learning signals. Storage is injected so it is unit-testable. */
import type { InteractionEvent } from './types';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const KEY = 'vp.eventQueue.v1';
const MAX_QUEUE = 500;
const BATCH = 50;

export function createEventQueue(store: KeyValueStore, send: (events: InteractionEvent[]) => Promise<unknown>) {
  async function read(): Promise<InteractionEvent[]> {
    try {
      const raw = await store.getItem(KEY);
      return raw ? (JSON.parse(raw) as InteractionEvent[]) : [];
    } catch {
      return [];
    }
  }
  async function write(events: InteractionEvent[]): Promise<void> {
    await store.setItem(KEY, JSON.stringify(events.slice(-MAX_QUEUE)));
  }
  let flushing: Promise<void> | null = null;

  async function flush(): Promise<void> {
    let q = await read();
    while (q.length > 0) {
      const batch = q.slice(0, BATCH);
      try {
        await send(batch);
      } catch {
        return; // keep queued; retry on next flush
      }
      q = (await read()).slice(batch.length);
      await write(q);
    }
  }

  return {
    /** Record an event with its true timestamp; deliver opportunistically. */
    async track(event: InteractionEvent): Promise<void> {
      const e = { ...event, occurredAt: event.occurredAt ?? new Date().toISOString() };
      await write([...(await read()), e]);
      void this.flush();
    },
    flush(): Promise<void> {
      flushing ??= flush().finally(() => {
        flushing = null;
      });
      return flushing;
    },
    size: async () => (await read()).length,
  };
}

import type { Request, Responses, WorkerMessage } from './protocol';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; progress?: (m: string) => void };

/** Promise wrapper around the engine worker. */
export class EngineClient {
  private readonly worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private readonly pending = new Map<number, Pending>();
  private next = 1;

  constructor() {
    this.worker.onmessage = (ev: MessageEvent<WorkerMessage>) => {
      const msg = ev.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      if ('progress' in msg) {
        p.progress?.(msg.progress);
        return;
      }
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error));
    };
    this.worker.onerror = (ev) => {
      for (const p of this.pending.values()) p.reject(new Error(ev.message || 'Engine worker crashed'));
      this.pending.clear();
    };
  }

  call<T extends Request>(
    req: T,
    opts: { transfer?: Transferable[]; progress?: (m: string) => void } = {},
  ): Promise<Responses[T['type']]> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress: opts.progress });
      // Vue reactive proxies cannot be structured-cloned; requests without binary payloads are plain JSON.
      const plain = req.type === 'addZip' || req.type === 'addImage' ? req : JSON.parse(JSON.stringify(req));
      this.worker.postMessage({ id, req: plain }, opts.transfer ?? []);
    });
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class UserMessageLock {
  private readonly queue = new Map<string, Promise<void>>();

  run<T>(phone: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queue.get(phone) ?? Promise.resolve();
    const next = previous.then(() => task(), () => task());
    const cleanup = next.finally(() => {
      if (this.queue.get(phone) === next) this.queue.delete(phone);
    });
    this.queue.set(phone, cleanup.then(() => {}, () => {}));
    return next;
  }
}

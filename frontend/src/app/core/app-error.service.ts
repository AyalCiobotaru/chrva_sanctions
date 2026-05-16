import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppErrorService {
  private clearTimer: ReturnType<typeof setTimeout> | null = null;
  readonly message = signal('');

  report(message: string): void {
    this.message.set(message);
    this.scheduleClear();
  }

  clear(): void {
    this.cancelScheduledClear();
    this.message.set('');
  }

  private scheduleClear(): void {
    this.cancelScheduledClear();
    this.clearTimer = setTimeout(() => {
      this.clearTimer = null;
      this.message.set('');
    }, 5000);
  }

  private cancelScheduledClear(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
  }
}

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppErrorService {
  readonly message = signal('');

  report(message: string): void {
    this.message.set(message);
  }

  clear(): void {
    this.message.set('');
  }
}

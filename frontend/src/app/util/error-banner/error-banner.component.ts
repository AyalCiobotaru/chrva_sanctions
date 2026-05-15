import { Component } from '@angular/core';
import { AppErrorService } from '../../core/app-error.service';

@Component({
  selector: 'app-error-banner',
  standalone: true,
  templateUrl: './error-banner.component.html',
  styleUrl: './error-banner.component.scss'
})
export class ErrorBannerComponent {
  readonly message = this.errors.message;

  constructor(private readonly errors: AppErrorService) {}

  clear(): void {
    this.errors.clear();
  }
}

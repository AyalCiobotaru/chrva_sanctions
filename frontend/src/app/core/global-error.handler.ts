import { ErrorHandler, Injectable } from '@angular/core';
import { AppErrorService } from './app-error.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private readonly errors: AppErrorService) {}

  handleError(error: unknown): void {
    console.error(error);
    this.errors.report(getRuntimeErrorMessage(error));
  }
}

function getRuntimeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'An unexpected application error occurred.';
}

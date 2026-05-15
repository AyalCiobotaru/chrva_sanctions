import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AppErrorService } from './app-error.service';
import { getHttpErrorMessage } from './http-error';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const appError = inject(AppErrorService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && request.url.includes('/api/')) {
        appError.report(getHttpErrorMessage(error, 'API request failed.'));
      }

      return throwError(() => error);
    })
  );
};

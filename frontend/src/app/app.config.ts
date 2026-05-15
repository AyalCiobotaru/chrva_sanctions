import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideQuillConfig } from 'ngx-quill/config';

import { apiErrorInterceptor } from './core/api-error.interceptor';
import { GlobalErrorHandler } from './core/global-error.handler';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideQuillConfig({
      theme: 'snow',
      format: 'html',
      suppressGlobalRegisterWarning: true
    })
  ]
};

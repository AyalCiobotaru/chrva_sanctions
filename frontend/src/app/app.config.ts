import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideQuillConfig } from 'ngx-quill/config';

import { routes } from '@app/app.routes';
import { apiErrorInterceptor } from '@core/api-error.interceptor';
import { GlobalErrorHandler } from '@core/global-error.handler';

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

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requiredRole = route.data['requiredRole'] as string | undefined;

  return auth.loadSession().pipe(
    map((session) => {
      if (!session.authenticated) {
        return router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url }
        });
      }

      if (requiredRole && session.user?.role !== requiredRole) {
        return router.createUrlTree(['/']);
      }

      return true;
    })
  );
};

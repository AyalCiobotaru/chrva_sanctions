import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { SanctionClubAuthService } from './sanction-club-auth.service';

export const sanctionClubGuard: CanActivateFn = (_route, state) => {
  const auth = inject(SanctionClubAuthService);
  const router = inject(Router);

  return auth.loadSession().pipe(
    map((session) => {
      if (session.authenticated) {
        return true;
      }

      return router.createUrlTree(['/sanction-requests/login'], {
        queryParams: { returnUrl: state.url }
      });
    })
  );
};

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { SanctionClubLoginRequest, SanctionClubSession } from './api.models';
import { ChrvaApiService } from './chrva-api.service';

@Injectable({ providedIn: 'root' })
export class SanctionClubAuthService {
  private readonly sessionSubject = new BehaviorSubject<SanctionClubSession>({
    authenticated: false,
    club: null
  });
  private loaded = false;

  readonly session$ = this.sessionSubject.asObservable();

  constructor(private readonly api: ChrvaApiService) {}

  loadSession(): Observable<SanctionClubSession> {
    if (this.loaded) {
      return of(this.sessionSubject.value);
    }

    return this.api.getSanctionClubSession().pipe(
      tap((session) => {
        this.loaded = true;
        this.sessionSubject.next(session);
      }),
      catchError(() => {
        const session = { authenticated: false, club: null };
        this.loaded = true;
        this.sessionSubject.next(session);
        return of(session);
      })
    );
  }

  login(credentials: SanctionClubLoginRequest): Observable<SanctionClubSession> {
    return this.api.loginSanctionClub(credentials).pipe(
      tap((session) => {
        this.loaded = true;
        this.sessionSubject.next(session);
      })
    );
  }

  logout(): Observable<SanctionClubSession> {
    return this.api.logoutSanctionClub().pipe(
      tap((session) => {
        this.loaded = true;
        this.sessionSubject.next(session);
      })
    );
  }
}

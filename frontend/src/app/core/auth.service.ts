import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { AuthSession, LoginRequest } from './api.models';
import { ChrvaApiService } from './chrva-api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<AuthSession>({
    authenticated: false,
    user: null
  });
  private loaded = false;

  readonly session$ = this.sessionSubject.asObservable();

  constructor(private readonly api: ChrvaApiService) {}

  loadSession(): Observable<AuthSession> {
    if (this.loaded) {
      return of(this.sessionSubject.value);
    }

    return this.api.getAuthSession().pipe(
      tap((session) => {
        this.loaded = true;
        this.sessionSubject.next(session);
      }),
      catchError(() => {
        const session = { authenticated: false, user: null };
        this.loaded = true;
        this.sessionSubject.next(session);
        return of(session);
      })
    );
  }

  login(credentials: LoginRequest): Observable<AuthSession> {
    return this.api.login(credentials).pipe(
      tap((session) => {
        this.loaded = true;
        this.sessionSubject.next(session);
      })
    );
  }

  logout(): Observable<AuthSession> {
    return this.api.logout().pipe(
      tap((session) => {
        this.loaded = true;
        this.sessionSubject.next(session);
      })
    );
  }

  canAccessRole(requiredRole?: string): Observable<boolean> {
    return this.loadSession().pipe(
      map((session) => {
        if (!requiredRole) {
          return session.authenticated;
        }

        return session.user?.role === requiredRole;
      })
    );
  }
}

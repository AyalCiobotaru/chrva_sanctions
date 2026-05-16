import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ClubSearch,
  ClubSearchResult,
  ClubSummary,
  ClubEmailBroadcast,
  ClubEmailBroadcastRequest,
  ClubEmailBroadcastResult,
  AuthSession,
  CreateSanctionRequestResult,
  CoordinatorSearch,
  CoordinatorSummary,
  LegacyConfig,
  MigrationInventory,
  NewClubRequest,
  NewSanctionRequest,
  CurrentSanctionRequestsResult,
  SanctionClubLoginRequest,
  SanctionClubSession,
  SanctionHistoryResult,
  SanctionRequestFormOptions,
  TournamentSearch,
  TournamentSummary,
  UpdateTournamentAddedToAesRequest,
  UpdateTournamentAddedToAesResult,
  UpdateTournamentOkToPayRequest,
  UpdateTournamentOkToPayResult,
  LoginRequest
} from './api.models';

@Injectable({ providedIn: 'root' })
export class ChrvaApiService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  getConfig(): Observable<LegacyConfig> {
    return this.http.get<LegacyConfig>(`${this.baseUrl}/config`);
  }

  getAuthSession(): Observable<AuthSession> {
    return this.http.get<AuthSession>(`${this.baseUrl}/auth/session`);
  }

  login(credentials: LoginRequest): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/login`, credentials);
  }

  logout(): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/logout`, {});
  }

  getSanctionClubSession(): Observable<SanctionClubSession> {
    return this.http.get<SanctionClubSession>(`${this.baseUrl}/sanction-requests/auth/session`);
  }

  loginSanctionClub(credentials: SanctionClubLoginRequest): Observable<SanctionClubSession> {
    return this.http.post<SanctionClubSession>(`${this.baseUrl}/sanction-requests/auth/login`, credentials);
  }

  logoutSanctionClub(): Observable<SanctionClubSession> {
    return this.http.post<SanctionClubSession>(`${this.baseUrl}/sanction-requests/auth/logout`, {});
  }

  getSanctionHistory(): Observable<SanctionHistoryResult> {
    return this.http.get<SanctionHistoryResult>(`${this.baseUrl}/sanction-requests/history`);
  }

  getCurrentSanctionRequests(): Observable<CurrentSanctionRequestsResult> {
    return this.http.get<CurrentSanctionRequestsResult>(`${this.baseUrl}/sanction-requests/current`);
  }

  getSanctionRequestFormOptions(): Observable<SanctionRequestFormOptions> {
    return this.http.get<SanctionRequestFormOptions>(`${this.baseUrl}/sanction-requests/form-options`);
  }

  createSanctionRequest(request: NewSanctionRequest): Observable<CreateSanctionRequestResult> {
    return this.http.post<CreateSanctionRequestResult>(`${this.baseUrl}/sanction-requests`, request);
  }

  searchClubs(search: ClubSearch): Observable<ClubSearchResult> {
    return this.http.get<ClubSearchResult>(`${this.baseUrl}/clubs`, {
      params: this.toParams(search)
    });
  }

  createClub(club: NewClubRequest): Observable<ClubSummary> {
    return this.http.post<ClubSummary>(`${this.baseUrl}/clubs`, club);
  }

  updateClub(clubCode: string, club: NewClubRequest): Observable<ClubSummary> {
    return this.http.put<ClubSummary>(`${this.baseUrl}/clubs/${encodeURIComponent(clubCode)}`, club);
  }

  getClubEmailBroadcast(clubType = 'R'): Observable<ClubEmailBroadcast> {
    return this.http.get<ClubEmailBroadcast>(`${this.baseUrl}/clubs/email-broadcast`, {
      params: new HttpParams().set('clubType', clubType)
    });
  }

  sendClubEmailBroadcast(message: ClubEmailBroadcastRequest): Observable<ClubEmailBroadcastResult> {
    return this.http.post<ClubEmailBroadcastResult>(`${this.baseUrl}/clubs/email-broadcast`, message);
  }

  searchCoordinators(search: CoordinatorSearch): Observable<CoordinatorSummary[]> {
    return this.http.get<CoordinatorSummary[]>(`${this.baseUrl}/coordinators`, {
      params: this.toParams(search)
    });
  }

  searchTournaments(search: TournamentSearch): Observable<TournamentSummary[]> {
    return this.http.get<TournamentSummary[]>(`${this.baseUrl}/tournaments`, {
      params: this.toParams(search)
    });
  }

  updateTournamentAddedToAes(
    tournamentId: string,
    request: UpdateTournamentAddedToAesRequest
  ): Observable<UpdateTournamentAddedToAesResult> {
    return this.http.put<UpdateTournamentAddedToAesResult>(
      `${this.baseUrl}/tournaments/${encodeURIComponent(tournamentId)}/added-to-aes`,
      request
    );
  }

  updateTournamentOkToPay(
    tournamentId: string,
    request: UpdateTournamentOkToPayRequest
  ): Observable<UpdateTournamentOkToPayResult> {
    return this.http.put<UpdateTournamentOkToPayResult>(
      `${this.baseUrl}/tournaments/${encodeURIComponent(tournamentId)}/ok-to-pay`,
      request
    );
  }

  getMigrationInventory(): Observable<MigrationInventory> {
    return this.http.get<MigrationInventory>(`${this.baseUrl}/migration/inventory`);
  }

  private toParams(values: object): HttpParams {
    return Object.entries(values).reduce((params, [key, value]) => {
      return typeof value === 'string' && value ? params.set(key, value) : params;
    }, new HttpParams());
  }
}

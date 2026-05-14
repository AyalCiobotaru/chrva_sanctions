import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ClubSearch,
  ClubSummary,
  LegacyConfig,
  MigrationInventory,
  TournamentSearch,
  TournamentSummary
} from './api.models';

@Injectable({ providedIn: 'root' })
export class LegacyApiService {
  private readonly baseUrl = '/api';

  constructor(private readonly http: HttpClient) {}

  getConfig(): Observable<LegacyConfig> {
    return this.http.get<LegacyConfig>(`${this.baseUrl}/config`);
  }

  searchClubs(search: ClubSearch): Observable<ClubSummary[]> {
    return this.http.get<ClubSummary[]>(`${this.baseUrl}/clubs`, {
      params: this.toParams(search)
    });
  }

  searchTournaments(search: TournamentSearch): Observable<TournamentSummary[]> {
    return this.http.get<TournamentSummary[]>(`${this.baseUrl}/tournaments`, {
      params: this.toParams(search)
    });
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

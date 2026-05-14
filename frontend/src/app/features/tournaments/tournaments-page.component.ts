import { AsyncPipe, CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap, tap } from 'rxjs';
import { TournamentSearch } from '../../core/api.models';
import { ChrvaApiService } from '../../core/chrva-api.service';

@Component({
  selector: 'app-tournaments-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, NgFor, NgIf, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <h1>Tournaments</h1>
        <p>Search AES tournament requests by season, program, division, host, and name.</p>
      </div>
    </section>

    <form [formGroup]="form" class="filters">
      <label>
        Season
        <select formControlName="season">
          <ng-container *ngIf="config$ | async as config">
            <option [value]="config.previousSeason">{{ config.previousSeason }}</option>
            <option [value]="config.currentSeason">{{ config.currentSeason }}</option>
            <option [value]="config.nextSeason">{{ config.nextSeason }}</option>
          </ng-container>
        </select>
      </label>
      <label>
        Program
        <select formControlName="program">
          <option value="jr">Girls Juniors</option>
          <option value="boys">Boys</option>
          <option value="adt">Adults</option>
        </select>
      </label>
      <label>
        Division
        <input formControlName="division" />
      </label>
      <label>
        Host
        <input formControlName="host" />
      </label>
      <label>
        Name
        <input formControlName="name" />
      </label>
      <label>
        Has notes
        <input type="checkbox" formControlName="hasNotes" />
      </label>
      <label>
        Not posted
        <input type="checkbox" formControlName="notPosted" />
      </label>
    </form>

    <table *ngIf="tournaments$ | async as tournaments">
      <thead>
        <tr>
          <th>AES</th>
          <th>Date</th>
          <th>Tournament</th>
          <th>Host</th>
          <th>Spots / Min</th>
          <th>Site</th>
          <th>Payment</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let tournament of tournaments">
          <td>
            {{ tournament.addedToAesDate ?? 'Not posted' }}
            <small>{{ tournament.okToPay ? 'Okay to pay' : '' }}</small>
          </td>
          <td>{{ tournament.date }}</td>
          <td>
            {{ tournament.name }}
            <small>{{ tournament.division }} &middot; {{ tournament.type }} &middot; {{ tournament.uniqueId }}</small>
            <small *ngIf="tournament.startTime">Start {{ tournament.startTime }}</small>
          </td>
          <td>
            {{ tournament.host }}
            <small>{{ tournament.clubName || tournament.clubCode }}</small>
          </td>
          <td>{{ tournament.teamCount ?? 'TBD' }} / {{ tournament.minimumTeamCount ?? 'TBD' }}</td>
          <td>
            {{ tournament.site }}
            <small>{{ tournament.siteAddress }}</small>
          </td>
          <td>
            {{ tournament.paymentType || 'TBD' }}
            <small>{{ tournament.checkPayableTo }}</small>
            <small *ngIf="tournament.fee !== null">{{ tournament.fee | currency }}</small>
          </td>
          <td>{{ tournament.priority ?? '' }}</td>
        </tr>
      </tbody>
    </table>
  `,
  styles: [`
    .page-header {
      margin-bottom: 20px;
    }

    .eyebrow {
      color: #6a3d09;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 8px;
    }

    p {
      color: #5c6878;
      margin: 0;
    }

    .filters {
      background: #ffffff;
      border: 1px solid #d9e1ec;
      border-radius: 6px;
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(5, minmax(0, 1fr)) repeat(2, max-content);
      margin-bottom: 20px;
      padding: 18px;
    }

    label {
      color: #34465c;
      display: grid;
      font-size: 13px;
      font-weight: 700;
      gap: 6px;
    }

    input,
    select {
      border: 1px solid #bcc8d6;
      border-radius: 4px;
      font: inherit;
      padding: 9px 10px;
    }

    input[type="checkbox"] {
      height: 20px;
      justify-self: start;
      padding: 0;
      width: 20px;
    }

    table {
      background: #ffffff;
      border-collapse: collapse;
      border: 1px solid #d9e1ec;
      width: 100%;
    }

    th,
    td {
      border-bottom: 1px solid #e3e9f1;
      padding: 11px 12px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #edf2f7;
      color: #27384c;
      font-size: 13px;
    }

    small {
      color: #718093;
      display: block;
      margin-top: 3px;
    }

    @media (max-width: 860px) {
      .filters {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class TournamentsPageComponent {
  readonly form = this.fb.nonNullable.group({
    season: '2027',
    program: 'jr' as const,
    division: '',
    host: '',
    name: '',
    hasNotes: false,
    notPosted: false
  });

  readonly config$ = this.api.getConfig().pipe(
    tap((config) => this.form.controls.season.setValue(config.currentSeason))
  );

  readonly tournaments$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    switchMap((search) => this.api.searchTournaments(this.toSearch(search)))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}

  private toSearch(search: typeof this.form.value): TournamentSearch {
    return {
      season: search.season,
      program: search.program ?? 'jr',
      division: search.division,
      host: search.host,
      name: search.name,
      hasNotes: search.hasNotes ? 'true' : '',
      notPosted: search.notPosted ? 'true' : ''
    };
  }
}

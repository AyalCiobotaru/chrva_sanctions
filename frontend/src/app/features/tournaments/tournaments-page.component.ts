import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { TournamentSearch } from '../../core/api.models';
import { LegacyApiService } from '../../core/legacy-api.service';

@Component({
  selector: 'app-tournaments-page',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Legacy source: tournadmin</p>
        <h1>Tournaments</h1>
        <p>Angular replacement for tourn_findDetail*.CFM and tourn_findDetailResults.CFM.</p>
      </div>
    </section>

    <form [formGroup]="form" class="filters">
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
    </form>

    <table *ngIf="tournaments$ | async as tournaments">
      <thead>
        <tr>
          <th>Level</th>
          <th>Date</th>
          <th>Entry Form</th>
          <th>Host</th>
          <th>Teams</th>
          <th>Site</th>
          <th>Close</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let tournament of tournaments">
          <td>
            <strong>{{ tournament.division }}</strong>
            <small>{{ tournament.type }}</small>
          </td>
          <td>{{ tournament.date }}</td>
          <td>
            {{ tournament.name }}
            <small>{{ tournament.uniqueId }}</small>
          </td>
          <td>{{ tournament.host }}</td>
          <td>{{ tournament.teamCount ?? 'TBD' }}</td>
          <td>{{ tournament.site }}</td>
          <td>{{ tournament.closeDate ?? 'TBD' }}</td>
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
      grid-template-columns: repeat(4, minmax(0, 1fr));
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
    program: 'jr' as const,
    division: '',
    host: '',
    name: ''
  });

  readonly tournaments$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    switchMap((search) => this.api.searchTournaments(search as TournamentSearch))
  );

  constructor(
    private readonly api: LegacyApiService,
    private readonly fb: FormBuilder
  ) {}
}

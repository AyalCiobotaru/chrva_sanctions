import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { ClubSearch } from '../../core/api.models';
import { LegacyApiService } from '../../core/legacy-api.service';

@Component({
  selector: 'app-clubs-page',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Legacy source: contacts_clubs</p>
        <h1>Club Contacts</h1>
        <p>Angular replacement for clubs_search.CFM, clubs_results.CFM, and clubs_Detail.CFM.</p>
      </div>
    </section>

    <form [formGroup]="form" class="filters">
      <label>
        Club Name
        <input formControlName="clubName" />
      </label>
      <label>
        First Name
        <input formControlName="contactFirstName" />
      </label>
      <label>
        Last Name
        <input formControlName="contactLastName" />
      </label>
      <label>
        State
        <select formControlName="state">
          <option value="">All</option>
          <option value="DC">DC</option>
          <option value="DE">DE</option>
          <option value="MD">MD</option>
          <option value="VA">VA</option>
          <option value="WV">WV</option>
        </select>
      </label>
    </form>

    <table *ngIf="clubs$ | async as clubs">
      <thead>
        <tr>
          <th>Club</th>
          <th>Contact</th>
          <th>Address</th>
          <th>State</th>
          <th>Website</th>
          <th>Phone</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let club of clubs">
          <td>
            <strong>{{ club.clubName }}</strong>
            <small>{{ club.clubCode }}</small>
          </td>
          <td>{{ club.contactFirstName }} {{ club.contactLastName }}</td>
          <td>{{ club.address }} {{ club.zip }}</td>
          <td>{{ club.state }}</td>
          <td>
            <a *ngIf="club.website" [href]="'https://' + club.website" target="_blank" rel="noreferrer">
              Web Page
            </a>
          </td>
          <td>{{ club.phone }}</td>
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
export class ClubsPageComponent {
  readonly form = this.fb.nonNullable.group({
    clubName: '',
    contactFirstName: '',
    contactLastName: '',
    state: ''
  });

  readonly clubs$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    switchMap((search) => this.api.searchClubs(search as ClubSearch))
  );

  constructor(
    private readonly api: LegacyApiService,
    private readonly fb: FormBuilder
  ) {}
}

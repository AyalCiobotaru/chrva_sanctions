import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { CoordinatorSearch } from '../../core/api.models';
import { ChrvaApiService } from '../../core/chrva-api.service';

@Component({
  selector: 'app-coordinators-page',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf, ReactiveFormsModule],
  template: `
    <section class="page-header">
      <div>
        <h1>Regional Junior Contacts</h1>
        <p>Search regional contacts from the configured SQL Server environment.</p>
      </div>
    </section>

    <form [formGroup]="form" class="filters">
      <label>
        Category
        <select formControlName="category">
          <option value="">All</option>
          <option value="Coordinator">Age Group Coordinators</option>
          <option value="Officials">Officials/Scorekeepers</option>
          <option value="Administrators">Administration</option>
        </select>
      </label>
      <label>
        First Name
        <input formControlName="firstName" />
      </label>
      <label>
        Last Name
        <input formControlName="lastName" />
      </label>
    </form>

    <table *ngIf="coordinators$ | async as coordinators">
      <thead>
        <tr>
          <th>Category</th>
          <th>Contact</th>
          <th>Address</th>
          <th>Phone</th>
          <th>Email</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let coordinator of coordinators">
          <td>
            <strong>{{ coordinator.category }}</strong>
            <small>{{ coordinator.grouping }}</small>
          </td>
          <td>{{ coordinator.firstName }} {{ coordinator.lastName }}</td>
          <td>
            {{ coordinator.address }}
            <small>{{ coordinator.city }} {{ coordinator.state }} {{ coordinator.zip }}</small>
          </td>
          <td>
            {{ coordinator.phonePrimary }}
            <small *ngIf="coordinator.phoneSecondary">
              {{ coordinator.phoneSecondary }}
              <span *ngIf="coordinator.extension">ext. {{ coordinator.extension }}</span>
            </small>
            <small *ngIf="coordinator.fax">Fax: {{ coordinator.fax }}</small>
          </td>
          <td>
            <a *ngIf="coordinator.email" [href]="'mailto:' + coordinator.email">
              {{ coordinator.email }}
            </a>
          </td>
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
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
export class CoordinatorsPageComponent {
  readonly form = this.fb.nonNullable.group({
    category: '',
    firstName: '',
    lastName: ''
  });

  readonly coordinators$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    switchMap((search) => this.api.searchCoordinators(search as CoordinatorSearch))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}
}

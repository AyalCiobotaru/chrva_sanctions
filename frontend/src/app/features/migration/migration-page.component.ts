import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { LegacyApiService } from '../../core/legacy-api.service';

@Component({
  selector: 'app-migration-page',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <p class="eyebrow">Local mirror analysis</p>
        <h1>Migration Inventory</h1>
        <p>Feature-area counts generated from .migration/cfml-route-inventory.json.</p>
      </div>
    </section>

    <table *ngIf="inventory$ | async as inventory">
      <thead>
        <tr>
          <th>Feature Area</th>
          <th>Files</th>
          <th>Query Files</th>
          <th>Write Files</th>
          <th>Mail Files</th>
          <th>Session Files</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let feature of inventory.features">
          <td><strong>{{ feature.featureArea }}</strong></td>
          <td>{{ feature.files }}</td>
          <td>{{ feature.hasQuery }}</td>
          <td>{{ feature.hasWrite }}</td>
          <td>{{ feature.hasMail }}</td>
          <td>{{ feature.hasSession }}</td>
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
    }

    th {
      background: #edf2f7;
      color: #27384c;
      font-size: 13px;
    }
  `]
})
export class MigrationPageComponent {
  readonly inventory$ = this.api.getMigrationInventory();

  constructor(private readonly api: LegacyApiService) {}
}

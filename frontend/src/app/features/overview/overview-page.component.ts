import { AsyncPipe, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { LegacyApiService } from '../../core/legacy-api.service';

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [AsyncPipe, NgIf],
  template: `
    <section class="page">
      <div>
        <p class="eyebrow">Migration Slice 1</p>
        <h1>Public clubs and tournaments</h1>
        <p>
          The current ColdFusion application is a page-controller app:
          CFML pages render HTML directly, run SQL through shared datasource
          variables, and carry state through ColdFusion sessions.
        </p>
      </div>

      <aside *ngIf="config$ | async as config" class="panel">
        <h2>Legacy Season State</h2>
        <dl>
          <dt>Previous</dt>
          <dd>{{ config.previousSeason }}</dd>
          <dt>Current</dt>
          <dd>{{ config.currentSeason }}</dd>
          <dt>Next</dt>
          <dd>{{ config.nextSeason }}</dd>
          <dt>Season</dt>
          <dd>{{ config.seasonStatus }}</dd>
          <dt>Sanctions</dt>
          <dd>{{ config.sanctionStatus }}</dd>
        </dl>
      </aside>
    </section>

    <section class="grid">
      <article>
        <h2>What moved first</h2>
        <p>
          This shell maps the legacy club-contact and tournament search pages
          into Angular routes backed by API contracts. The API currently returns
          fixtures until real database connectivity is wired in.
        </p>
      </article>
      <article>
        <h2>ColdFusion responsibilities</h2>
        <p>
          SQL, session/auth, redirects, mail, and form validation belong in the
          backend API. Angular owns navigation, views, forms, and client-side
          validation.
        </p>
      </article>
      <article>
        <h2>Next migration target</h2>
        <p>
          Replace the mock club and tournament data with database-backed API
          queries that preserve the filtering behavior from the CFML pages.
        </p>
      </article>
    </section>
  `,
  styles: [`
    .page {
      display: grid;
      gap: 28px;
      grid-template-columns: minmax(0, 1fr) 340px;
    }

    .eyebrow {
      color: #6a3d09;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    h1 {
      font-size: 42px;
      line-height: 1.05;
      margin: 0 0 16px;
    }

    p {
      color: #526071;
      line-height: 1.65;
      margin: 0;
    }

    .panel,
    article {
      background: #ffffff;
      border: 1px solid #d9e1ec;
      border-radius: 6px;
      padding: 20px;
    }

    dl {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr auto;
      margin: 0;
    }

    dt {
      color: #637083;
    }

    dd {
      font-weight: 700;
      margin: 0;
    }

    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 28px;
    }

    @media (max-width: 860px) {
      .page,
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class OverviewPageComponent {
  readonly config$ = this.api.getConfig();

  constructor(private readonly api: LegacyApiService) {}
}

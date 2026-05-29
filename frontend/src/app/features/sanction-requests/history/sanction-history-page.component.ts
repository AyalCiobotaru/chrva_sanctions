import { AsyncPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChrvaApiService } from '@core/chrva-api.service';
import { SanctionRequestPageHeaderComponent } from '../page-header/sanction-request-page-header.component';

@Component({
  selector: 'app-sanction-history-page',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, SanctionRequestPageHeaderComponent],
  templateUrl: './sanction-history-page.component.html',
  styleUrl: '../sanction-requests-table.scss'
})
export class SanctionHistoryPageComponent {
  readonly history$ = this.api.getSanctionHistory();

  constructor(private readonly api: ChrvaApiService) {}
}

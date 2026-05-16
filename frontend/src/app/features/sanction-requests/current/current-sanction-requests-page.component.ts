import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { ChrvaApiService } from '../../../core/chrva-api.service';
import { SanctionRequestPageHeaderComponent } from '../page-header/sanction-request-page-header.component';

@Component({
  selector: 'app-current-sanction-requests-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, SanctionRequestPageHeaderComponent],
  templateUrl: './current-sanction-requests-page.component.html',
  styleUrl: '../sanction-requests-table.scss'
})
export class CurrentSanctionRequestsPageComponent {
  readonly current$ = this.api.getCurrentSanctionRequests();

  constructor(private readonly api: ChrvaApiService) {}
}

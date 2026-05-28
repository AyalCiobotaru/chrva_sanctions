import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ChrvaApiService } from '../../../core/chrva-api.service';
import { getHttpErrorMessage } from '../../../core/http-error';
import { SanctionRequestPageHeaderComponent } from '../page-header/sanction-request-page-header.component';

@Component({
  selector: 'app-current-sanction-requests-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, DatePipe, RouterLink, SanctionRequestPageHeaderComponent],
  templateUrl: './current-sanction-requests-page.component.html',
  styleUrl: '../sanction-requests-table.scss'
})
export class CurrentSanctionRequestsPageComponent {
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  readonly current$ = this.refresh$.pipe(
    switchMap(() => this.api.getCurrentSanctionRequests())
  );
  actionError = '';
  actionStatus = '';
  deletingId = '';

  constructor(private readonly api: ChrvaApiService) {
    this.actionStatus = window.sessionStorage.getItem('chrvaEmailStatus') ?? '';
    window.sessionStorage.removeItem('chrvaEmailStatus');
  }

  deleteRequest(requestId: string, requestName: string): void {
    this.actionError = '';

    if (!window.confirm(`Delete the sanction request for ${requestName}?`)) {
      return;
    }

    this.deletingId = requestId;
    this.api.deleteSanctionRequest(requestId).subscribe({
      next: () => {
        this.deletingId = '';
        this.refresh$.next();
      },
      error: (error: unknown) => {
        this.deletingId = '';
        this.actionError = getHttpErrorMessage(error, 'Unable to delete sanction request.');
      }
    });
  }
}

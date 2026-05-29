import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { SanctionRequestDetailResult } from '@core/api.models';
import { SANCTION_FEE_PER_TEAM } from '@core/business-rules';
import { ChrvaApiService } from '@core/chrva-api.service';
import { getHttpErrorMessage } from '@core/http-error';

@Component({
  selector: 'app-sanction-request-print-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './sanction-request-print-page.component.html',
  styleUrl: './sanction-request-print-page.component.scss'
})
export class SanctionRequestPrintPageComponent implements OnInit, OnDestroy {
  request: SanctionRequestDetailResult | null = null;
  error = '';
  loading = true;
  printed = false;
  backLink = '/sanction-requests/current';
  backLabel = 'Back to current requests';
  readonly sanctionFeePerTeam = SANCTION_FEE_PER_TEAM;
  private readonly afterPrint = () => {
    this.printed = true;
    this.changeDetector.detectChanges();
  };

  constructor(
    private readonly api: ChrvaApiService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly route: ActivatedRoute
  ) {}

  ngOnDestroy(): void {
    window.removeEventListener('afterprint', this.afterPrint);
    document.body.classList.remove('printing-sanction-request');
  }

  ngOnInit(): void {
    window.addEventListener('afterprint', this.afterPrint);
    document.body.classList.add('printing-sanction-request');
    this.setBackLink();

    this.route.paramMap.pipe(take(1)).subscribe((params) => {
      const requestId = params.get('id');

      if (!requestId) {
        this.loading = false;
        this.error = 'Sanction request was not found.';
        return;
      }

      this.api.getSanctionRequest(requestId).subscribe({
        next: (request) => {
          this.request = request;
          this.loading = false;
          this.changeDetector.detectChanges();
        },
        error: (error: unknown) => {
          this.loading = false;
          this.error = getHttpErrorMessage(error, 'Unable to load sanction request.');
          this.changeDetector.detectChanges();
        }
      });
    });
  }

  print(): void {
    window.print();
  }

  private setBackLink(): void {
    const source = this.route.snapshot.queryParamMap.get('from');

    if (source === 'history') {
      this.backLink = '/sanction-requests/history';
      this.backLabel = 'Back to sanction history';
      return;
    }

    this.backLink = '/sanction-requests/current';
    this.backLabel = 'Back to current requests';
  }
}

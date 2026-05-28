import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { SanctionRequestDetailResult } from '../../../core/api.models';
import { ChrvaApiService } from '../../../core/chrva-api.service';
import { getHttpErrorMessage } from '../../../core/http-error';

@Component({
  selector: 'app-sanction-request-print-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './sanction-request-print-page.component.html',
  styleUrl: './sanction-request-print-page.component.scss'
})
export class SanctionRequestPrintPageComponent implements OnInit {
  request: SanctionRequestDetailResult | null = null;
  error = '';

  constructor(
    private readonly api: ChrvaApiService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(take(1)).subscribe((params) => {
      const requestId = params.get('id');

      if (!requestId) {
        this.error = 'Sanction request was not found.';
        return;
      }

      this.api.getSanctionRequest(requestId).subscribe({
        next: (request) => {
          this.request = request;
          setTimeout(() => window.print());
        },
        error: (error: unknown) => {
          this.error = getHttpErrorMessage(error, 'Unable to load sanction request.');
        }
      });
    });
  }

  print(): void {
    window.print();
  }
}

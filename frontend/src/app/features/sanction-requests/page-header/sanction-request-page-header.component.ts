import { AsyncPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SanctionClubAuthService } from '../../../core/sanction-club-auth.service';

@Component({
  selector: 'app-sanction-request-page-header',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './sanction-request-page-header.component.html',
  styleUrl: './sanction-request-page-header.component.scss'
})
export class SanctionRequestPageHeaderComponent {
  @Input({ required: true }) title = '';

  readonly session$ = this.auth.session$;

  constructor(private readonly auth: SanctionClubAuthService) {}
}

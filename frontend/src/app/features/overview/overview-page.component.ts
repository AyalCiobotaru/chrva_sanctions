import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { ChrvaApiService } from '../../core/chrva-api.service';

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './overview-page.component.html',
  styleUrl: './overview-page.component.scss'
})
export class OverviewPageComponent {
  readonly config$ = this.api.getConfig();

  constructor(private readonly api: ChrvaApiService) {}
}

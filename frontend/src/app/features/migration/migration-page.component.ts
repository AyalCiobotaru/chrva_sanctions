import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { ChrvaApiService } from '../../core/chrva-api.service';

@Component({
  selector: 'app-migration-page',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './migration-page.component.html',
  styleUrl: './migration-page.component.scss'
})
export class MigrationPageComponent {
  readonly inventory$ = this.api.getMigrationInventory();

  constructor(private readonly api: ChrvaApiService) {}
}

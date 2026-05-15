import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { CoordinatorSearch } from '../../core/api.models';
import { ChrvaApiService } from '../../core/chrva-api.service';

@Component({
  selector: 'app-coordinators-page',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule],
  templateUrl: './coordinators-page.component.html',
  styleUrl: './coordinators-page.component.scss'
})
export class CoordinatorsPageComponent {
  readonly form = this.fb.nonNullable.group({
    category: '',
    firstName: '',
    lastName: ''
  });

  readonly coordinators$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    switchMap((search) => this.api.searchCoordinators(search as CoordinatorSearch))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}
}

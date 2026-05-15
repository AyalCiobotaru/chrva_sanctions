import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap, tap } from 'rxjs';
import { TournamentSearch } from '../../core/api.models';
import { ChrvaApiService } from '../../core/chrva-api.service';

@Component({
  selector: 'app-tournaments-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, ReactiveFormsModule],
  templateUrl: './tournaments-page.component.html',
  styleUrl: './tournaments-page.component.scss'
})
export class TournamentsPageComponent {
  readonly form = this.fb.nonNullable.group({
    season: '2027',
    program: 'jr' as const,
    division: '',
    host: '',
    name: '',
    hasNotes: false,
    notPosted: false
  });

  readonly config$ = this.api.getConfig().pipe(
    tap((config) => this.form.controls.season.setValue(config.currentSeason))
  );

  readonly tournaments$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    switchMap((search) => this.api.searchTournaments(this.toSearch(search)))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}

  private toSearch(search: typeof this.form.value): TournamentSearch {
    return {
      season: search.season,
      program: search.program ?? 'jr',
      division: search.division,
      host: search.host,
      name: search.name,
      hasNotes: search.hasNotes ? 'true' : '',
      notPosted: search.notPosted ? 'true' : ''
    };
  }
}

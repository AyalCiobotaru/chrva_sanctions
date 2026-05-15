import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { merge, startWith, Subject, switchMap, tap } from 'rxjs';
import { getHttpErrorMessage } from '../../core/http-error';
import { TournamentSearch } from '../../core/api.models';
import { ChrvaApiService } from '../../core/chrva-api.service';
import { InlineCheckboxFieldComponent } from '../../util/inline-checkbox-field/inline-checkbox-field.component';
import { InlineDateFieldComponent } from '../../util/inline-date-field/inline-date-field.component';

@Component({
  selector: 'app-tournaments-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, InlineCheckboxFieldComponent, InlineDateFieldComponent, ReactiveFormsModule],
  templateUrl: './tournaments-page.component.html',
  styleUrl: './tournaments-page.component.scss'
})
export class TournamentsPageComponent {
  readonly savingAddedToAes = new Set<string>();
  readonly addedToAesErrors = new Map<string, string>();
  readonly savingOkToPay = new Set<string>();
  readonly okToPayErrors = new Map<string, string>();

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

  private readonly refresh$ = new Subject<void>();

  readonly tournaments$ = merge(this.form.valueChanges, this.refresh$).pipe(
    startWith(this.form.getRawValue()),
    switchMap(() => this.api.searchTournaments(this.toSearch(this.form.getRawValue())))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}

  updateAddedToAes(tournamentId: string, addedToAesDate: string | null): void {
    this.savingAddedToAes.add(tournamentId);
    this.addedToAesErrors.delete(tournamentId);

    this.api.updateTournamentAddedToAes(tournamentId, { addedToAesDate }).subscribe({
      next: () => {
        this.savingAddedToAes.delete(tournamentId);
        this.refresh$.next();
      },
      error: (error) => {
        this.savingAddedToAes.delete(tournamentId);
        this.addedToAesErrors.set(tournamentId, getHttpErrorMessage(error, 'Unable to update Added to AES.'));
      }
    });
  }

  updateOkToPay(tournamentId: string, okToPay: boolean): void {
    this.savingOkToPay.add(tournamentId);
    this.okToPayErrors.delete(tournamentId);

    this.api.updateTournamentOkToPay(tournamentId, { okToPay }).subscribe({
      next: () => {
        this.savingOkToPay.delete(tournamentId);
        this.refresh$.next();
      },
      error: (error) => {
        this.savingOkToPay.delete(tournamentId);
        this.okToPayErrors.set(tournamentId, getHttpErrorMessage(error, 'Unable to update Okay to pay.'));
      }
    });
  }

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

import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, startWith, switchMap } from 'rxjs';
import { PublicClubSearch, PublicClubSummary } from '@core/api.models';
import { ChrvaApiService } from '@core/chrva-api.service';
import { MultiSelectDropdownComponent, MultiSelectOption } from '@util/multi-select-dropdown/multi-select-dropdown.component';

@Component({
  selector: 'app-club-directory-page',
  standalone: true,
  imports: [AsyncPipe, MultiSelectDropdownComponent, ReactiveFormsModule],
  templateUrl: './club-directory-page.component.html',
  styleUrl: './club-directory-page.component.scss'
})
export class ClubDirectoryPageComponent {
  readonly stateOptions: MultiSelectOption[] = [
    { value: 'DC', label: 'DC' },
    { value: 'DE', label: 'DE' },
    { value: 'MD', label: 'MD' },
    { value: 'VA', label: 'VA' },
    { value: 'WV', label: 'WV' }
  ];

  readonly clubTypeOptions: MultiSelectOption[] = [
    { value: 'G', label: 'Girls' },
    { value: 'B', label: 'Boys' },
    { value: 'O', label: 'Outdoor' }
  ];

  readonly form = this.fb.nonNullable.group({
    keyword: '',
    states: [[] as string[]],
    clubTypes: [[] as string[]]
  });

  readonly clubs$ = this.form.valueChanges.pipe(
    startWith(this.form.getRawValue()),
    debounceTime(150),
    switchMap(() => this.api.searchPublicClubs(this.toSearch()))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}

  get hasFilters(): boolean {
    const raw = this.form.getRawValue();
    return Boolean(raw.keyword || raw.states.length > 0 || raw.clubTypes.length > 0);
  }

  clearFilters(): void {
    this.form.reset({
      keyword: '',
      states: [],
      clubTypes: []
    });
  }

  directorName(club: PublicClubSummary): string {
    return `${club.contactFirstName} ${club.contactLastName}`.trim();
  }

  clubTypeLabel(value: string): string {
    const labels = [...new Set(value.toUpperCase().split(/[^A-Z]+/).flatMap((part) => part.split('')))]
      .map((type) => {
        switch (type) {
          case 'G':
            return 'Girls';
          case 'B':
            return 'Boys';
          case 'A':
            return 'Adults';
          case 'O':
            return 'Outdoor';
          default:
            return '';
        }
      })
      .filter(Boolean);

    return labels.join(', ');
  }

  websiteUrl(website: string | undefined): string {
    return `https://${website}`;
  }

  private toSearch(): PublicClubSearch {
    const raw = this.form.getRawValue();
    return {
      keyword: raw.keyword.trim(),
      state: raw.states.join(','),
      clubType: raw.clubTypes.join(',')
    };
  }
}

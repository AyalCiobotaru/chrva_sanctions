import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { map, startWith, switchMap, tap } from 'rxjs';
import {
  AdminCurrentSanctionRequestsResult,
  AdminSanctionRequestSearch,
  AdminSanctionRequestSummary
} from '../../../core/api.models';
import { ChrvaApiService } from '../../../core/chrva-api.service';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../../../util/multi-select-dropdown/multi-select-dropdown.component';

interface AdminSanctionRequestWeekGroup {
  key: string;
  weekNumber: number | null;
  label: string;
  specialDateLabel: string;
  requests: AdminSanctionRequestSummary[];
}

@Component({
  selector: 'app-admin-current-sanction-requests-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, MultiSelectDropdownComponent, ReactiveFormsModule],
  templateUrl: './admin-current-sanction-requests-page.component.html',
  styleUrl: './admin-current-sanction-requests-page.component.scss'
})
export class AdminCurrentSanctionRequestsPageComponent {
  readonly form = this.fb.nonNullable.group({
    season: '2026',
    divisions: [[] as string[]],
    clubCode: '',
    weekNumber: '',
    fromDate: '',
    toDate: '',
    status: 'all',
    tournamentType: '',
    hdpOnly: false,
    sagoOnly: false,
    duplicateSanctionId: ''
  });

  readonly vm$ = this.api.getConfig().pipe(
    tap((config) => this.form.controls.season.setValue(config.currentSeason, { emitEvent: false })),
    switchMap(() => this.form.valueChanges.pipe(
      startWith(this.form.getRawValue()),
      switchMap(() => this.api.getAdminCurrentSanctionRequests(this.toSearch(this.form.getRawValue()))),
      map((result) => ({
        ...result,
        divisionOptions: this.toDivisionOptions(result),
        groups: this.toWeekGroups(result.requests)
      }))
    ))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}

  setStatus(status: string): void {
    this.form.patchValue({
      status,
      hdpOnly: false,
      sagoOnly: false,
      duplicateSanctionId: ''
    });
  }

  showHdpOnly(): void {
    this.form.patchValue({
      status: 'all',
      hdpOnly: true,
      sagoOnly: false,
      duplicateSanctionId: ''
    });
  }

  showSagoOnly(): void {
    this.form.patchValue({
      status: 'all',
      hdpOnly: false,
      sagoOnly: true,
      duplicateSanctionId: ''
    });
  }

  showDuplicate(sanctionId: string): void {
    this.form.patchValue({
      status: 'all',
      hdpOnly: false,
      sagoOnly: false,
      duplicateSanctionId: sanctionId
    });
  }

  clearDuplicateFilter(): void {
    this.form.controls.duplicateSanctionId.setValue('');
  }

  mailto(request: AdminSanctionRequestSummary): string {
    const subject = `Tournament: ${request.clubCode} ${request.date ?? ''} - ${request.division} ${request.type}`.trim();
    const body = `Hi ${request.tournamentDirectorName || 'Tournament Director'},`;
    return `mailto:${encodeURIComponent(request.tournamentDirectorEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  private toSearch(search: typeof this.form.value): AdminSanctionRequestSearch {
    return {
      season: search.season,
      divisions: search.divisions?.join(',') ?? '',
      clubCode: search.clubCode,
      weekNumber: search.weekNumber,
      fromDate: search.fromDate,
      toDate: search.toDate,
      status: search.status,
      tournamentType: search.tournamentType,
      hdpOnly: search.hdpOnly ? 'true' : '',
      sagoOnly: search.sagoOnly ? 'true' : '',
      duplicateSanctionId: search.duplicateSanctionId
    };
  }

  private toDivisionOptions(result: AdminCurrentSanctionRequestsResult): MultiSelectOption[] {
    return result.options.ageGroups.map((ageGroup) => ({
      value: ageGroup,
      label: ageGroup
    }));
  }

  private toWeekGroups(requests: AdminSanctionRequestSummary[]): AdminSanctionRequestWeekGroup[] {
    const groups = new Map<string, AdminSanctionRequestWeekGroup>();

    for (const request of requests) {
      const key = request.weekNumber == null ? 'early' : String(request.weekNumber);
      const group = groups.get(key) ?? {
        key,
        weekNumber: request.weekNumber,
        label: request.weekNumber == null ? 'Early Boys Tournaments' : `Season Week ${request.weekNumber}`,
        specialDateLabel: request.specialDate.label,
        requests: []
      };

      if (!group.specialDateLabel && request.specialDate.label) {
        group.specialDateLabel = request.specialDate.label;
      }

      group.requests.push(request);
      groups.set(key, group);
    }

    return [...groups.values()];
  }
}

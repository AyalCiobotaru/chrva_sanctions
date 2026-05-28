import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, merge, startWith, Subject, switchMap, tap } from 'rxjs';
import {
  AdminCurrentSanctionRequestsResult,
  AdminSanctionRequestSearch,
  AdminSanctionRequestSummary,
  ClubEmailRecipient,
  TournamentDirectorEmailBroadcast
} from '../../../core/api.models';
import { ChrvaApiService } from '../../../core/chrva-api.service';
import { getHttpErrorMessage } from '../../../core/http-error';
import { ModalComponent } from '../../../util/modal/modal.component';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../../../util/multi-select-dropdown/multi-select-dropdown.component';
import { RichTextEditorComponent } from '../../../util/rich-text-editor/rich-text-editor.component';

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
  imports: [AsyncPipe, CurrencyPipe, ModalComponent, MultiSelectDropdownComponent, ReactiveFormsModule, RichTextEditorComponent],
  templateUrl: './admin-current-sanction-requests-page.component.html',
  styleUrl: './admin-current-sanction-requests-page.component.scss'
})
export class AdminCurrentSanctionRequestsPageComponent {
  private readonly firstLegacySeason = 2016;

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

  readonly reviewForm = this.fb.nonNullable.group({
    sanctionStatus: 'Pending',
    sanctionId: '',
    priority: '0',
    sanctionNotes: ''
  });

  readonly emailForm = this.fb.nonNullable.group({
    from: ['', Validators.required],
    subject: ['', Validators.required],
    information: ['', Validators.required]
  });

  readonly statusOptions = ['Approved', 'Denied', 'Pending', 'SO', 'Posted', 'Question', 'Regionals', 'Cancelled', 'Suspended'];
  readonly priorityOptions = ['0', '1', '2', '3', '4', '5', '6', '9'];
  readonly refresh$ = new Subject<void>();
  reviewingRequest: AdminSanctionRequestSummary | null = null;
  emailBroadcast: TournamentDirectorEmailBroadcast | null = null;
  reviewError = '';
  emailError = '';
  emailStatus = '';
  savingReview = false;
  sendingEmail = false;

  readonly vm$ = this.api.getConfig().pipe(
    tap((config) => this.form.controls.season.setValue(config.currentSeason, { emitEvent: false })),
    switchMap((config) => merge(this.form.valueChanges, this.refresh$).pipe(
      startWith(this.form.getRawValue()),
      switchMap(() => this.api.getAdminCurrentSanctionRequests(this.toSearch(this.form.getRawValue()))),
      map((result) => ({
        ...result,
        seasonOptions: this.buildSeasonOptions(Number(config.nextSeason || config.currentSeason)),
        divisionOptions: this.toDivisionOptions(result),
        groups: this.toWeekGroups(result.requests)
      }))
    ))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly changeDetector: ChangeDetectorRef,
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

  openTournamentDirectorEmail(): void {
    this.emailError = '';
    this.emailStatus = '';
    this.api.getTournamentDirectorEmailBroadcast(this.toSearch(this.form.getRawValue())).subscribe({
      next: (broadcast) => {
        this.emailBroadcast = broadcast;
        if (broadcast.fromOptions.length > 0) {
          this.emailForm.controls.from.setValue(broadcast.fromOptions[0].email);
        }
      },
      error: (error) => {
        this.emailError = getHttpErrorMessage(error, 'Unable to load tournament director email list.');
      }
    });
  }

  closeTournamentDirectorEmail(): void {
    if (this.sendingEmail) {
      return;
    }

    this.emailBroadcast = null;
    this.emailError = '';
    this.emailStatus = '';
  }

  removeEmailRecipient(recipient: ClubEmailRecipient): void {
    if (!this.emailBroadcast) {
      return;
    }

    const recipients = this.emailBroadcast.recipients.filter((current) => current.email !== recipient.email);
    this.emailBroadcast = {
      ...this.emailBroadcast,
      recipients,
      recipientCount: recipients.length
    };
  }

  sendTournamentDirectorEmail(): void {
    if (!this.emailBroadcast || this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.sendingEmail = true;
    this.emailError = '';
    this.emailStatus = '';
    this.changeDetector.detectChanges();
    const raw = this.emailForm.getRawValue();

    this.api.sendTournamentDirectorEmailBroadcast(this.toSearch(this.form.getRawValue()), {
      from: raw.from,
      subject: raw.subject,
      information: raw.information,
      recipients: this.emailBroadcast.recipients
    }).pipe(
      finalize(() => {
        this.sendingEmail = false;
        this.changeDetector.detectChanges();
      })
    ).subscribe({
      next: (result) => {
        this.emailStatus = result.message;
        this.emailBroadcast = null;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.emailError = getHttpErrorMessage(error, 'Unable to send tournament director email.');
        this.emailBroadcast = null;
        this.changeDetector.detectChanges();
      }
    });
  }

  openReview(request: AdminSanctionRequestSummary, sanctionStatus = request.sanctionStatus): void {
    this.reviewingRequest = request;
    this.reviewError = '';
    this.reviewForm.setValue({
      sanctionStatus,
      sanctionId: request.sanctionId || 'New',
      priority: request.hdp && sanctionStatus === 'Approved' ? '1' : request.priority ?? '0',
      sanctionNotes: request.sanctionNotes
    });
  }

  closeReview(): void {
    if (this.savingReview) {
      return;
    }

    this.reviewingRequest = null;
    this.reviewError = '';
  }

  submitReview(): void {
    if (!this.reviewingRequest) {
      return;
    }

    this.savingReview = true;
    this.reviewError = '';

    this.api.updateAdminSanctionRequestReview(this.reviewingRequest.id, this.reviewForm.getRawValue()).subscribe({
      next: () => {
        this.savingReview = false;
        this.reviewingRequest = null;
        this.refresh$.next();
      },
      error: (error) => {
        this.savingReview = false;
        this.reviewError = getHttpErrorMessage(error, 'Unable to update sanction request.');
      }
    });
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

  private buildSeasonOptions(latestSeason: number): string[] {
    const latest = Number.isFinite(latestSeason) ? latestSeason : new Date().getFullYear();
    const seasons = [];

    for (let season = latest; season >= this.firstLegacySeason; season -= 1) {
      seasons.push(String(season));
    }

    return seasons;
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

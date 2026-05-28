import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Observable, take } from 'rxjs';
import { CreateSanctionRequestResult, SanctionVenueOption } from '../../../core/api.models';
import { ChrvaApiService } from '../../../core/chrva-api.service';
import { getHttpErrorMessage } from '../../../core/http-error';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../../../util/multi-select-dropdown/multi-select-dropdown.component';
import { SanctionRequestPageHeaderComponent } from '../page-header/sanction-request-page-header.component';

@Component({
  selector: 'app-sanction-request-form-page',
  standalone: true,
  imports: [AsyncPipe, CurrencyPipe, MultiSelectDropdownComponent, ReactiveFormsModule, SanctionRequestPageHeaderComponent],
  templateUrl: './sanction-request-form-page.component.html',
  styleUrl: './sanction-request-form-page.component.scss'
})
export class SanctionRequestFormPageComponent implements OnInit {
  readonly options$ = this.api.getSanctionRequestFormOptions();
  private readonly requiredFields = [
    { controlName: 'tournamentContactName', label: 'Club Contact Name' },
    { controlName: 'tournamentDirectorName', label: 'Tournament Director Name' },
    { controlName: 'tournamentContactAddress', label: 'Address / City / State / Zip' },
    { controlName: 'tournamentDirectorEmail', label: 'Tournament Director Email' },
    { controlName: 'tournamentDirectorHomePhone', label: 'Tournament Director Phone' },
    { controlName: 'tournamentDirectorTournamentPhone', label: 'Cell Phone' },
    { controlName: 'date', label: 'Tournament Date' },
    { controlName: 'startTime', label: 'Start Time' },
    { controlName: 'division', label: 'Age Group' },
    { controlName: 'numberOfTeams', label: 'Number of Teams' },
    { controlName: 'tournamentName', label: 'Tournament Name' },
    { controlName: 'site', label: 'Tournament Site' },
    { controlName: 'siteAddress', label: 'Tournament Address' },
    { controlName: 'type', label: 'Type' },
    { controlName: 'entryFee', label: 'Tournament Fee' },
    { controlName: 'checkPayableTo', label: 'Make Check Payable To' },
    { controlName: 'paymentType', label: 'Accepted Payment Types' },
    { controlName: 'requester', label: 'Person Submitting Request' }
  ];
  submitting = false;
  loadingRenewal = false;
  loadingEdit = false;
  submitError = '';
  renewalSourceText = '';
  editSourceText = '';
  editRequestId = '';
  readonly paymentTypeOptions: MultiSelectOption[] = [
    { value: 'Credit Card', label: 'Credit Card' },
    { value: 'Zelle', label: 'Zelle' },
    { value: 'Venmo', label: 'Venmo' },
    { value: 'Check', label: 'Check' } 
  ];

  readonly form = this.fb.nonNullable.group({
    sanctionId: [''],
    tournamentContactName: ['', Validators.required],
    tournamentDirectorName: ['', Validators.required],
    tournamentContactAddress: ['', Validators.required],
    tournamentDirectorEmail: ['', Validators.required],
    tournamentDirectorHomePhone: ['', Validators.required],
    tournamentDirectorTournamentPhone: ['', Validators.required],
    date: ['', Validators.required],
    startTime: ['8:30 AM', Validators.required],
    division: ['', Validators.required],
    numberOfTeams: ['', Validators.required],
    minimumNumberOfTeams: [''],
    tournamentName: ['', Validators.required],
    site: ['', Validators.required],
    siteAddress: ['', Validators.required],
    type: ['Open', Validators.required],
    entryFee: ['', Validators.required],
    checkPayableTo: ['', Validators.required],
    paymentType: [['Credit Card'] as string[], Validators.required],
    creditCardPayment: ['N'],
    paymentUrl: [''],
    singleAgeGroupOpen: ['N'],
    hdp: ['N'],
    poolPlay: ['2 games of 25 points'],
    playoffFormat: ['All teams into playoffs - Gold/Silver/Consolation'],
    quarterFinals: ['None'],
    semiFinals: ['None'],
    finals: ['Match Play'],
    showers: ['No'],
    awards: ['No'],
    food: ['No'],
    lockerRoom: ['No'],
    information: [''],
    requester: ['', Validators.required],
    expenseFacility: ['0'],
    expenseOfficialsFees: ['0'],
    expenseVolleyballs: ['0'],
    expenseAwards: ['0'],
    expenseSupplies: ['0'],
    expenseOther: ['0'],
    otherIncome: ['0']
  });

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const sourceId = params.get('renewFrom');

      if (!sourceId) {
        return;
      }

      this.loadingRenewal = true;
      this.api.getSanctionRequestRenewal(sourceId).pipe(
        finalize(() => {
          this.loadingRenewal = false;
        })
      ).subscribe({
        next: (renewal) => {
          this.form.patchValue(renewal.request);
          this.renewalSourceText = [
            renewal.source.sanctionId,
            renewal.source.date,
            renewal.source.division,
            renewal.source.site
          ].filter(Boolean).join(' - ');
        },
        error: (error: unknown) => {
          this.submitError = getHttpErrorMessage(error, 'Unable to load sanction renewal.');
        }
      });
    });

    this.route.paramMap.pipe(take(1)).subscribe((params) => {
      const requestId = params.get('id');

      if (!requestId) {
        return;
      }

      this.editRequestId = requestId;
      this.loadingEdit = true;
      this.api.getSanctionRequest(requestId).pipe(
        finalize(() => {
          this.loadingEdit = false;
        })
      ).subscribe({
        next: (request) => {
          this.form.patchValue(request.request);
          this.editSourceText = [
            request.sanctionId,
            request.request.date,
            request.request.division,
            request.request.site
          ].filter(Boolean).join(' - ');
        },
        error: (error: unknown) => {
          this.submitError = getHttpErrorMessage(error, 'Unable to load sanction request.');
        }
      });
    });
  }

  submit(): void {
    this.submitError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError = this.submitDisabledReason;
      return;
    }

    this.submitting = true;
    const saveRequest$: Observable<unknown> = this.editRequestId
      ? this.api.updateSanctionRequest(this.editRequestId, this.form.getRawValue())
      : this.api.createSanctionRequest(this.form.getRawValue());

    saveRequest$.pipe(
      finalize(() => {
        this.submitting = false;
      })
    ).subscribe({
      next: (result: unknown) => {
        this.showEmailResult(result);
        void this.router.navigateByUrl('/sanction-requests/current');
      },
      error: (error: unknown) => {
        this.submitError = getHttpErrorMessage(error, 'Unable to submit sanction request.');
      }
    });
  }

  selectVenue(event: Event, venues: SanctionVenueOption[]): void {
    const select = event.target as HTMLSelectElement;
    const venue = venues[Number(select.value)];

    if (!venue) {
      return;
    }

    this.form.patchValue({
      site: venue.name,
      siteAddress: venue.address
    });
  }

  get expenseTeams(): number {
    return this.toNumber('numberOfTeams');
  }

  get worksheetFee(): number {
    return this.toNumber('entryFee');
  }

  get expenseSanctionFees(): number {
    return this.expenseTeams * 7;
  }

  get entryFeeIncome(): number {
    return this.worksheetFee * this.expenseTeams;
  }

  get expenseTotal(): number {
    return this.toNumber('expenseFacility')
      + this.expenseSanctionFees
      + this.toNumber('expenseOfficialsFees')
      + this.toNumber('expenseVolleyballs')
      + this.toNumber('expenseAwards')
      + this.toNumber('expenseSupplies')
      + this.toNumber('expenseOther');
  }

  get netIncome(): number {
    return this.toNumber('otherIncome') + this.entryFeeIncome - this.expenseTotal;
  }

  get isProfitTooHigh(): boolean {
    return this.netIncome > 250;
  }

  get submitDisabledReason(): string {
    if (this.submitting) {
      return 'Submitting request.';
    }

    if (this.loadingEdit || this.loadingRenewal) {
      return 'Loading request.';
    }

    if (this.form.valid) {
      return 'Submit request';
    }

    const missingFields = this.requiredFields
      .filter((field) => this.form.get(field.controlName)?.hasError('required'))
      .map((field) => field.label);

    if (missingFields.length > 0) {
      return `Complete required fields: ${missingFields.join(', ')}.`;
    }

    if (this.form.controls.tournamentDirectorEmail.hasError('email')) {
      return 'Enter a valid Tournament Director Email.';
    }

    return 'Fix validation errors before submitting.';
  }

  private toNumber(controlName: string): number {
    const value = Number(this.form.get(controlName)?.value);
    return Number.isFinite(value) ? value : 0;
  }

  private showEmailResult(result: unknown): void {
    const email = (result as Partial<CreateSanctionRequestResult>)?.email;

    if (!email) {
      return;
    }

    window.sessionStorage.setItem(
      'chrvaEmailStatus',
      email.message || (email.sent ? 'Confirmation email sent.' : 'Confirmation email was not sent.')
    );
  }
}

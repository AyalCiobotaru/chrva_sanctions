import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { SanctionVenueOption } from '../../../core/api.models';
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
export class SanctionRequestFormPageComponent {
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
  submitError = '';
  readonly paymentTypeOptions: MultiSelectOption[] = [
    { value: 'Credit Card', label: 'Credit Card' },
    { value: 'Zelle', label: 'Zelle' },
    { value: 'Venmo', label: 'Venmo' },
    { value: 'Check', label: 'Check' } 
  ];

  readonly form = this.fb.nonNullable.group({
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
    private readonly router: Router
  ) {}

  submit(): void {
    this.submitError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError = this.submitDisabledReason;
      return;
    }

    this.submitting = true;
    this.api.createSanctionRequest(this.form.getRawValue()).pipe(
      finalize(() => {
        this.submitting = false;
      })
    ).subscribe({
      next: () => {
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
}

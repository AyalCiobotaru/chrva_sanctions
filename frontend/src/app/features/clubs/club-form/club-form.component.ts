import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClubSummary, NewClubRequest } from '../../../core/api.models';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../../../util/multi-select-dropdown/multi-select-dropdown.component';

@Component({
  selector: 'app-club-form',
  standalone: true,
  imports: [MultiSelectDropdownComponent, ReactiveFormsModule],
  templateUrl: './club-form.component.html',
  styleUrl: './club-form.component.scss'
})
export class ClubFormComponent implements OnChanges {
  @Input() club: ClubSummary | null = null;
  @Input() error = '';

  @Output() saved = new EventEmitter<NewClubRequest>();
  @Output() cancelled = new EventEmitter<void>();

  readonly clubTypeOptions: MultiSelectOption[] = [
    { value: 'G', label: 'Girls' },
    { value: 'B', label: 'Boys' },
    { value: 'A', label: 'Adults' },
    { value: 'O', label: 'Outdoor' }
  ];

  validationError = '';
  showPassword = false;

  readonly form = this.fb.nonNullable.group({
    clubCode: ['', [Validators.required, Validators.maxLength(5)]],
    clubName: ['', Validators.required],
    contactFirstName: ['', Validators.required],
    contactLastName: ['', Validators.required],
    address1: '',
    address2: '',
    city: ['', Validators.required],
    state: ['', [Validators.required, Validators.maxLength(2)]],
    zip: ['', Validators.required],
    phone1: ['', Validators.required],
    phone2: '',
    email: ['', [Validators.required, Validators.email]],
    alternateEmail: '',
    username: '',
    password: '',
    website: '',
    clubTypes: [['G'] as string[], Validators.required],
    active: true,
    comments: ''
  });

  constructor(private readonly fb: FormBuilder) {}

  get isEditing(): boolean {
    return this.club !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['club']) {
      this.resetForm();
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.validationError = 'Complete required fields before saving.';
      this.form.markAllAsTouched();
      return;
    }

    this.validationError = '';
    const raw = this.form.getRawValue();
    const { clubTypes, ...club } = raw;
    this.saved.emit({
      ...club,
      clubCode: raw.clubCode.toUpperCase(),
      state: raw.state.toUpperCase(),
      clubType: clubTypes.join('')
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private resetForm(): void {
    this.validationError = '';
    this.showPassword = false;
    this.form.reset({
      clubCode: this.club?.clubCode ?? '',
      clubName: this.club?.clubName ?? '',
      contactFirstName: this.club?.contactFirstName ?? '',
      contactLastName: this.club?.contactLastName ?? '',
      address1: this.club?.address1 ?? '',
      address2: this.club?.address2 ?? '',
      city: this.club?.city ?? '',
      state: this.club?.state ?? '',
      zip: this.club?.zip ?? '',
      phone1: this.club?.phone ?? '',
      phone2: this.club?.phoneSecondary ?? '',
      email: this.club?.email ?? '',
      alternateEmail: this.club?.alternateEmail ?? '',
      username: this.club?.username ?? '',
      password: this.club?.password ?? '',
      website: this.club?.website ?? '',
      clubTypes: this.toClubTypes(this.club?.clubType),
      active: this.club?.active ?? true,
      comments: this.club?.comments ?? ''
    });
  }

  private toClubTypes(value: string | undefined): string[] {
    const types = [...new Set((value || 'G').toUpperCase().split(''))]
      .filter((type) => ['G', 'B', 'A', 'O'].includes(type));
    return types.length > 0 ? types : ['G'];
  }
}

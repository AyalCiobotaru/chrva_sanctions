import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, merge, startWith, switchMap } from 'rxjs';
import { CoordinatorRequest, CoordinatorSearch, CoordinatorSummary } from '@core/api.models';
import { ChrvaApiService } from '@core/chrva-api.service';
import { getHttpErrorMessage } from '@core/http-error';
import { ModalComponent } from '@util/modal/modal.component';

@Component({
  selector: 'app-coordinators-page',
  standalone: true,
  imports: [AsyncPipe, ModalComponent, ReactiveFormsModule],
  templateUrl: './coordinators-page.component.html',
  styleUrl: './coordinators-page.component.scss'
})
export class CoordinatorsPageComponent {
  editingCoordinator: CoordinatorSummary | null = null;
  showCoordinatorForm = false;
  formError = '';
  actionError = '';
  actionStatus = '';
  deletingCategory = '';

  readonly form = this.fb.nonNullable.group({
    category: '',
    firstName: '',
    lastName: ''
  });

  readonly coordinatorForm = this.fb.nonNullable.group({
    grouping: ['Coordinator', Validators.required],
    category: ['', Validators.required],
    level: [''],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    address1: ['', Validators.required],
    address2: [''],
    city: [''],
    state: ['', Validators.required],
    zip: ['', Validators.required],
    phonePrimary: ['', Validators.required],
    phoneSecondary: [''],
    extension: [''],
    fax: [''],
    email: ['']
  });

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly coordinators$ = merge(this.form.valueChanges, this.refresh$).pipe(
    startWith(this.form.getRawValue()),
    switchMap(() => this.api.searchCoordinators(this.form.getRawValue() as CoordinatorSearch))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}

  openNewCoordinator(): void {
    this.editingCoordinator = null;
    this.formError = '';
    this.coordinatorForm.reset({
      grouping: 'Coordinator',
      category: '',
      level: '',
      firstName: '',
      lastName: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      phonePrimary: '',
      phoneSecondary: '',
      extension: '',
      fax: '',
      email: ''
    });
    this.showCoordinatorForm = true;
  }

  openEditCoordinator(coordinator: CoordinatorSummary): void {
    this.editingCoordinator = coordinator;
    this.formError = '';
    this.coordinatorForm.setValue({
      grouping: coordinator.grouping,
      category: coordinator.category,
      level: coordinator.level,
      firstName: coordinator.firstName,
      lastName: coordinator.lastName,
      address1: coordinator.address1,
      address2: coordinator.address2,
      city: coordinator.city,
      state: coordinator.state,
      zip: coordinator.zip,
      phonePrimary: coordinator.phonePrimary,
      phoneSecondary: coordinator.phoneSecondary,
      extension: coordinator.extension,
      fax: coordinator.fax,
      email: coordinator.email
    });
    this.showCoordinatorForm = true;
  }

  closeCoordinatorForm(): void {
    this.showCoordinatorForm = false;
    this.editingCoordinator = null;
    this.formError = '';
  }

  saveCoordinator(): void {
    this.formError = '';

    if (this.coordinatorForm.invalid) {
      this.coordinatorForm.markAllAsTouched();
      this.formError = 'Complete required coordinator fields.';
      return;
    }

    const request = this.coordinatorForm.getRawValue() as CoordinatorRequest;
    const save$ = this.editingCoordinator
      ? this.api.updateCoordinator(this.editingCoordinator.category, request)
      : this.api.createCoordinator(request);

    save$.subscribe({
      next: () => {
        this.actionStatus = this.editingCoordinator ? 'Regional junior contact updated.' : 'Regional junior contact added.';
        this.actionError = '';
        this.closeCoordinatorForm();
        this.refresh$.next();
      },
      error: (error: unknown) => {
        this.formError = getHttpErrorMessage(error, 'Unable to save regional junior contact.');
      }
    });
  }

  deleteCoordinator(coordinator: CoordinatorSummary): void {
    this.actionError = '';
    this.actionStatus = '';

    if (!window.confirm(`Delete ${coordinator.category}?`)) {
      return;
    }

    this.deletingCategory = coordinator.category;
    this.api.deleteCoordinator(coordinator.category).subscribe({
      next: () => {
        this.deletingCategory = '';
        this.actionStatus = 'Regional junior contact deleted.';
        this.refresh$.next();
      },
      error: (error: unknown) => {
        this.deletingCategory = '';
        this.actionError = getHttpErrorMessage(error, 'Unable to delete regional junior contact.');
      }
    });
  }
}

import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { merge, startWith, Subject, switchMap } from 'rxjs';
import { ClubEmailBroadcast, ClubEmailRecipient, ClubSearch, NewClubRequest } from '../../core/api.models';
import { ChrvaApiService } from '../../core/chrva-api.service';
import { RichTextEditorComponent } from '../../util/rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-clubs-page',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RichTextEditorComponent],
  templateUrl: './clubs-page.component.html',
  styleUrl: './clubs-page.component.scss'
})
export class ClubsPageComponent {
  private readonly defaultEmailSender = 'lauren.leventry@chrvajuniors.org';

  showAddClub = false;
  showEmailBroadcast = false;
  addError = '';
  emailBroadcast?: ClubEmailBroadcast;
  emailError = '';
  emailStatus = '';

  readonly form = this.fb.nonNullable.group({
    activeStatus: 'active' as 'active' | 'inactive' | 'all',
    clubName: '',
    state: '',
    meetingNoShows: false
  });

  readonly addForm = this.fb.nonNullable.group({
    clubCode: ['', [Validators.required, Validators.maxLength(5)]],
    clubName: ['', Validators.required],
    contactFirstName: ['', Validators.required],
    contactLastName: ['', Validators.required],
    address1: ['', Validators.required],
    address2: '',
    city: ['', Validators.required],
    state: ['', [Validators.required, Validators.maxLength(2)]],
    zip: ['', Validators.required],
    phone1: ['', Validators.required],
    phone2: '',
    email: ['', [Validators.required, Validators.email]],
    alternateEmail: '',
    website: '',
    clubType: 'G',
    active: true,
    comments: ''
  });

  readonly emailForm = this.fb.nonNullable.group({
    clubType: 'R',
    from: ['', Validators.required],
    subject: ['', Validators.required],
    information: ['', Validators.required]
  });

  private readonly refresh$ = new Subject<void>();

  readonly clubs$ = merge(this.form.valueChanges, this.refresh$).pipe(
    startWith(null),
    switchMap(() => this.api.searchClubs(this.toSearch()))
  );

  constructor(
    private readonly api: ChrvaApiService,
    private readonly fb: FormBuilder
  ) {}

  toggleMeetingNoShows(): void {
    this.form.controls.meetingNoShows.setValue(!this.form.controls.meetingNoShows.value);
  }

  exportClubs(): void {
    window.location.href = '/api/clubs/export';
  }

  openEmailBroadcast(): void {
    this.showEmailBroadcast = !this.showEmailBroadcast;

    if (this.showEmailBroadcast) {
      this.loadEmailBroadcast();
    }
  }

  loadEmailBroadcast(): void {
    this.emailError = '';
    this.emailStatus = '';
    this.api.getClubEmailBroadcast(this.emailForm.controls.clubType.value).subscribe({
      next: (broadcast) => {
        this.emailBroadcast = broadcast;
        if (!this.emailForm.controls.from.value && broadcast.fromOptions.length > 0) {
          const defaultSender = broadcast.fromOptions.find((sender) => sender.email === this.defaultEmailSender);
          this.emailForm.controls.from.setValue((defaultSender ?? broadcast.fromOptions[0]).email);
        }
      },
      error: (error) => {
        this.emailError = error.error?.message ?? 'Unable to load club director email list.';
      }
    });
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

  sendEmailBroadcast(): void {
    if (this.emailForm.invalid || !this.emailBroadcast) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.emailError = '';
    this.emailStatus = '';
    const raw = this.emailForm.getRawValue();

    this.api.sendClubEmailBroadcast({
      from: raw.from,
      subject: raw.subject,
      information: raw.information,
      recipients: this.emailBroadcast.recipients
    }).subscribe({
      next: (result) => {
        this.emailStatus = result.message;
      },
      error: (error) => {
        this.emailError = error.error?.message ?? 'Unable to send club director email.';
      }
    });
  }

  saveClub(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.addError = '';
    const raw = this.addForm.getRawValue();
    const club: NewClubRequest = {
      ...raw,
      clubCode: raw.clubCode.toUpperCase(),
      state: raw.state.toUpperCase()
    };

    this.api.createClub(club).subscribe({
      next: () => {
        this.addForm.reset({
          clubCode: '',
          clubName: '',
          contactFirstName: '',
          contactLastName: '',
          address1: '',
          address2: '',
          city: '',
          state: '',
          zip: '',
          phone1: '',
          phone2: '',
          email: '',
          alternateEmail: '',
          website: '',
          clubType: 'G',
          active: true,
          comments: ''
        });
        this.showAddClub = false;
        this.refresh$.next();
      },
      error: (error) => {
        this.addError = error.error?.message ?? 'Unable to save club.';
      }
    });
  }

  private toSearch(): ClubSearch {
    const raw = this.form.getRawValue();
    return {
      activeStatus: raw.activeStatus,
      clubName: raw.clubName,
      state: raw.state,
      meetingNoShows: raw.meetingNoShows ? 'true' : ''
    };
  }
}

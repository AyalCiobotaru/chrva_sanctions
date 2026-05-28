import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, merge, startWith, Subject, switchMap } from 'rxjs';
import { ClubEmailBroadcast, ClubEmailRecipient, ClubSearch, ClubSummary, NewClubRequest } from '../../core/api.models';
import { ChrvaApiService } from '../../core/chrva-api.service';
import { getHttpErrorMessage } from '../../core/http-error';
import { ClubFormComponent } from './club-form/club-form.component';
import { ModalComponent } from '../../util/modal/modal.component';
import { RichTextEditorComponent } from '../../util/rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-clubs-page',
  standalone: true,
  imports: [AsyncPipe, ClubFormComponent, ModalComponent, ReactiveFormsModule, RichTextEditorComponent],
  templateUrl: './clubs-page.component.html',
  styleUrl: './clubs-page.component.scss'
})
export class ClubsPageComponent {
  showAddClub = false;
  showEmailBroadcast = false;
  editingClub: ClubSummary | null = null;
  addError = '';
  emailBroadcast?: ClubEmailBroadcast;
  emailError = '';
  emailStatus = '';
  sendingEmail = false;

  readonly form = this.fb.nonNullable.group({
    activeStatus: 'active' as 'active' | 'inactive' | 'all',
    clubName: '',
    state: '',
    meetingNoShows: false
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
    private readonly changeDetector: ChangeDetectorRef,
    private readonly fb: FormBuilder
  ) {}

  toggleMeetingNoShows(): void {
    this.form.controls.meetingNoShows.setValue(!this.form.controls.meetingNoShows.value);
  }

  exportClubs(): void {
    window.location.href = '/api/clubs/export';
  }

  openNewClub(): void {
    this.addError = '';
    this.editingClub = null;
    this.showAddClub = true;
  }

  closeClubForm(): void {
    this.addError = '';
    this.editingClub = null;
    this.showAddClub = false;
  }

  editClub(club: ClubSummary): void {
    this.addError = '';
    this.editingClub = club;
    this.showAddClub = true;
  }

  openEmailBroadcast(): void {
    this.showEmailBroadcast = !this.showEmailBroadcast;

    if (this.showEmailBroadcast) {
      this.loadEmailBroadcast();
    } else {
      this.emailBroadcast = undefined;
      this.changeDetector.detectChanges();
    }
  }

  loadEmailBroadcast(): void {
    this.emailError = '';
    this.emailStatus = '';
    this.api.getClubEmailBroadcast(this.emailForm.controls.clubType.value).subscribe({
      next: (broadcast) => {
        this.emailBroadcast = broadcast;
        this.selectEmailSender(broadcast);
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.emailError = getHttpErrorMessage(error, 'Unable to load club director email list.');
      }
    });
  }

  addDirectorToEmail(club: ClubSummary): void {
    const recipient = this.toDirectorRecipient(club);

    if (!recipient) {
      this.emailStatus = '';
      this.emailError = `No valid director email is available for ${club.clubName}.`;
      this.showEmailBroadcast = true;
      this.changeDetector.detectChanges();
      return;
    }

    this.showEmailBroadcast = true;
    this.emailError = '';
    this.emailStatus = '';
    this.changeDetector.detectChanges();

    if (this.showEmailBroadcast && this.emailBroadcast) {
      this.addEmailRecipient(recipient);
      return;
    }

    this.api.getClubEmailBroadcast(this.emailForm.controls.clubType.value).subscribe({
      next: (broadcast) => {
        this.emailBroadcast = {
          ...broadcast,
          recipients: [],
          recipientCount: 0
        };
        this.selectEmailSender(broadcast);
        this.addEmailRecipient(recipient);
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.emailError = getHttpErrorMessage(error, 'Unable to load email composer.');
        this.changeDetector.detectChanges();
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
    this.changeDetector.detectChanges();
  }

  removeAllEmailRecipients(): void {
    if (!this.emailBroadcast) {
      return;
    }

    this.emailBroadcast = {
      ...this.emailBroadcast,
      recipients: [],
      recipientCount: 0
    };
    this.changeDetector.detectChanges();
  }

  addAllEmailRecipients(): void {
    this.emailError = '';
    this.emailStatus = '';
    this.showEmailBroadcast = true;

    this.api.getClubEmailBroadcast(this.emailForm.controls.clubType.value).subscribe({
      next: (broadcast) => {
        this.emailBroadcast = broadcast;
        this.selectEmailSender(broadcast);
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.emailError = getHttpErrorMessage(error, 'Unable to load club director email list.');
        this.changeDetector.detectChanges();
      }
    });
  }

  sendEmailBroadcast(): void {
    if (this.emailForm.invalid || !this.emailBroadcast) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.emailError = '';
    this.emailStatus = '';
    this.sendingEmail = true;
    this.changeDetector.detectChanges();
    const raw = this.emailForm.getRawValue();

    this.api.sendClubEmailBroadcast({
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
        this.showEmailBroadcast = false;
        this.emailBroadcast = undefined;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.emailError = getHttpErrorMessage(error, 'Unable to send club director email.');
        this.showEmailBroadcast = false;
        this.emailBroadcast = undefined;
        this.changeDetector.detectChanges();
      }
    });
  }

  saveClub(club: NewClubRequest): void {
    this.addError = '';
    const request = this.editingClub
      ? this.api.updateClub(this.editingClub.clubCode, club)
      : this.api.createClub(club);

    request.subscribe({
      next: () => {
        this.closeClubForm();
        this.refresh$.next();
      },
      error: (error) => {
        this.addError = getHttpErrorMessage(error, 'Unable to save club.');
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

  private addEmailRecipient(recipient: ClubEmailRecipient): void {
    if (!this.emailBroadcast) {
      return;
    }

    const exists = this.emailBroadcast.recipients.some((current) => {
      return current.email.toLowerCase() === recipient.email.toLowerCase();
    });

    if (exists) {
      this.emailStatus = '';
      this.emailError = `${recipient.email} is already in the email list.`;
      this.changeDetector.detectChanges();
      return;
    }

    const recipients = [...this.emailBroadcast.recipients, recipient];
    this.emailBroadcast = {
      ...this.emailBroadcast,
      recipients,
      recipientCount: recipients.length
    };
    this.changeDetector.detectChanges();
  }

  private selectEmailSender(broadcast: ClubEmailBroadcast): void {
    if (broadcast.fromOptions.length === 0) {
      this.emailForm.controls.from.setValue('');
      return;
    }

    this.emailForm.controls.from.setValue(broadcast.fromOptions[0].email);
  }

  private toDirectorRecipient(club: ClubSummary): ClubEmailRecipient | null {
    const email = club.email.trim();

    if (!email || !email.includes('@') || !email.includes('.')) {
      return null;
    }

    return {
      email,
      name: `${club.contactFirstName} ${club.contactLastName}`.trim(),
      clubName: club.clubName
    };
  }
}

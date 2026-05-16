import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { SanctionClubAuthService } from '../../../core/sanction-club-auth.service';

@Component({
  selector: 'app-sanction-request-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './sanction-request-login-page.component.html',
  styleUrl: './sanction-request-login-page.component.scss'
})
export class SanctionRequestLoginPageComponent implements OnInit {
  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    agree: [false, Validators.requiredTrue],
    agreePenalties: [false, Validators.requiredTrue]
  });
  error = '';
  submitting = false;

  constructor(
    private readonly auth: SanctionClubAuthService,
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.auth.loadSession().subscribe((session) => {
      if (session.authenticated) {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/sanction-requests/history';
        void this.router.navigateByUrl(returnUrl, { replaceUrl: true });
      }
    });
  }

  login(): void {
    this.error = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Enter your club credentials and accept the hosting requirements.';
      return;
    }

    this.submitting = true;
    this.auth.login(this.form.getRawValue()).pipe(
      finalize(() => {
        this.submitting = false;
      })
    ).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/sanction-requests/history';
        void this.router.navigateByUrl(returnUrl);
      },
      error: () => {
        this.error = 'The club username or password is not valid.';
      }
    });
  }
}

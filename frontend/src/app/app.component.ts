import { AsyncPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { AuthSession } from './core/api.models';
import { ErrorBannerComponent } from './util/error-banner/error-banner.component';

interface NavItem {
  path: string;
  label: string;
  role?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, ErrorBannerComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  readonly navItems: NavItem[] = [
    { path: '/', label: 'Overview' },
    { path: '/clubs', label: 'Clubs' },
    { path: '/coordinators', label: 'Coordinators' },
    { path: '/tournaments', label: 'Tournaments' },
    { path: '/migration', label: 'Migration', role: 'master' }
  ];
  readonly session$ = this.auth.session$;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.auth.loadSession().subscribe();
  }

  canShowNavItem(item: NavItem, session: AuthSession): boolean {
    if (item.role) {
      return session.user?.role === item.role;
    }

    return item.path === '/' || session.authenticated;
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      }
    });
  }
}

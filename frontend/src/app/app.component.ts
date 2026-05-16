import { AsyncPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';

import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { AuthSession } from './core/api.models';
import { SanctionClubAuthService } from './core/sanction-club-auth.service';
import { ErrorBannerComponent } from './util/error-banner/error-banner.component';

type NavSection = 'admin' | 'clubs';

interface NavItem {
  path: string;
  label: string;
  role?: string;
  public?: boolean;
}

interface NavSectionOption {
  id: NavSection;
  label: string;
  description: string;
  landingPath: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AsyncPipe, ErrorBannerComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private routeSubscription?: Subscription;

  readonly navSections: NavSectionOption[] = [
    {
      id: 'admin',
      label: 'Admin',
      description: 'Clubs, coordinators, and tournaments',
      landingPath: '/clubs'
    },
    {
      id: 'clubs',
      label: 'Clubs',
      description: 'Sanction requests and history',
      landingPath: '/sanction-requests/history'
    }
  ];
  readonly adminNavItems: NavItem[] = [
    { path: '/clubs', label: 'Clubs' },
    { path: '/coordinators', label: 'Coordinators' },
    { path: '/tournaments', label: 'Tournaments' },
    { path: '/migration', label: 'Migration', role: 'master' }
  ];
  readonly clubNavItems: NavItem[] = [
    { path: '/sanction-requests/history', label: 'Sanction History', public: true },
    { path: '/sanction-requests/current', label: 'Current Sanctions', public: true },
    { path: '/sanction-requests/new', label: 'Sanction Request', public: true }
  ];
  readonly session$ = this.auth.session$;
  readonly clubSession$ = this.clubAuth.session$;
  activeSection: NavSection = 'admin';
  menuOpen = false;

  constructor(
    private readonly auth: AuthService,
    private readonly clubAuth: SanctionClubAuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.activeSection = this.sectionFromUrl(this.router.url);
    this.auth.loadSession().subscribe();
    this.clubAuth.loadSession().subscribe();
    this.routeSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.activeSection = this.sectionFromUrl(event.urlAfterRedirects);
      this.menuOpen = false;
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  get activeNavItems(): NavItem[] {
    return this.activeSection === 'admin' ? this.adminNavItems : this.clubNavItems;
  }

  get activeSectionLabel(): string {
    return this.navSections.find((section) => section.id === this.activeSection)?.label ?? 'Admin';
  }

  canShowNavItem(item: NavItem, session: AuthSession): boolean {
    if (item.role) {
      return session.user?.role === item.role;
    }

    return item.path === '/' || item.public === true || session.authenticated;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  switchSection(section: NavSection): void {
    const option = this.navSections.find((candidate) => candidate.id === section);

    if (!option) {
      return;
    }

    this.activeSection = section;
    this.menuOpen = false;
    void this.router.navigateByUrl(option.landingPath);
  }

  logoutClub(): void {
    this.clubAuth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/sanction-requests/login');
      }
    });
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      }
    });
  }

  private sectionFromUrl(url: string): NavSection {
    return url.startsWith('/sanction-requests') ? 'clubs' : 'admin';
  }
}

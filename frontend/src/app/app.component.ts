import { Component } from '@angular/core';

import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ErrorBannerComponent } from './util/error-banner/error-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ErrorBannerComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  readonly navItems = [
    { path: '/', label: 'Overview' },
    { path: '/clubs', label: 'Clubs' },
    { path: '/coordinators', label: 'Coordinators' },
    { path: '/tournaments', label: 'Tournaments' },
    { path: '/migration', label: 'Migration' }
  ];
}

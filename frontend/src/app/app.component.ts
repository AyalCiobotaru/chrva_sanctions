import { Component } from '@angular/core';

import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
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

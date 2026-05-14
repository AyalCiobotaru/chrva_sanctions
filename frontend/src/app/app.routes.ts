import { Routes } from '@angular/router';
import { ClubsPageComponent } from './features/clubs/clubs-page.component';
import { MigrationPageComponent } from './features/migration/migration-page.component';
import { OverviewPageComponent } from './features/overview/overview-page.component';
import { TournamentsPageComponent } from './features/tournaments/tournaments-page.component';

export const routes: Routes = [
  { path: '', component: OverviewPageComponent, title: 'CHRVA Juniors Migration' },
  { path: 'clubs', component: ClubsPageComponent, title: 'Club Contacts' },
  { path: 'tournaments', component: TournamentsPageComponent, title: 'Tournaments' },
  { path: 'migration', component: MigrationPageComponent, title: 'Migration Inventory' },
  { path: '**', redirectTo: '' }
];

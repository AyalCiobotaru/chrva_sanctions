import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ClubsPageComponent } from './features/clubs/clubs-page.component';
import { CoordinatorsPageComponent } from './features/coordinators/coordinators-page.component';
import { LoginPageComponent } from './features/login/login-page.component';
import { MigrationPageComponent } from './features/migration/migration-page.component';
import { OverviewPageComponent } from './features/overview/overview-page.component';
import { TournamentsPageComponent } from './features/tournaments/tournaments-page.component';

export const routes: Routes = [
  { path: '', component: OverviewPageComponent, title: 'CHRVA Juniors Migration' },
  { path: 'login', component: LoginPageComponent, title: 'Sign in' },
  { path: 'clubs', component: ClubsPageComponent, canActivate: [authGuard], title: 'Club Contacts' },
  { path: 'coordinators', component: CoordinatorsPageComponent, canActivate: [authGuard], title: 'Regional Junior Contacts' },
  { path: 'tournaments', component: TournamentsPageComponent, canActivate: [authGuard], title: 'Tournaments' },
  {
    path: 'migration',
    component: MigrationPageComponent,
    canActivate: [authGuard],
    data: { requiredRole: 'master' },
    title: 'Migration Inventory'
  },
  { path: '**', redirectTo: '' }
];

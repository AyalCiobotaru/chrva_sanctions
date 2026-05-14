export interface LegacyConfig {
  currentSeason: string;
  previousSeason: string;
  nextSeason: string;
  seasonStatus: 'Open' | 'Closed';
  sanctionStatus: 'Open' | 'Closed';
}

export interface ClubSearch {
  clubName?: string;
  contactFirstName?: string;
  contactLastName?: string;
  state?: string;
}

export interface ClubSummary {
  clubCode: string;
  clubName: string;
  contactFirstName: string;
  contactLastName: string;
  address: string;
  state: string;
  zip: string;
  website?: string;
  phone?: string;
}

export interface CoordinatorSearch {
  category?: string;
  firstName?: string;
  lastName?: string;
}

export interface CoordinatorSummary {
  category: string;
  grouping: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phonePrimary: string;
  phoneSecondary: string;
  extension: string;
  fax: string;
  email: string;
}

export interface TournamentSearch {
  season?: string;
  program: 'jr' | 'boys' | 'adt';
  division?: string;
  host?: string;
  name?: string;
  type?: string;
  date?: string;
  clubCode?: string;
  hasNotes?: string;
  notPosted?: string;
}

export interface TournamentSummary {
  id: string;
  uniqueId: string;
  date: string;
  startTime: string | null;
  division: string;
  type: string;
  name: string;
  host: string;
  clubCode: string;
  clubName: string;
  teamCount: number | null;
  minimumTeamCount: number | null;
  site: string;
  siteAddress: string;
  closeDate: string | null;
  priority: string | null;
  status: string;
  addedToAesDate: string | null;
  okToPay: boolean;
  paymentType: string;
  checkPayableTo: string;
  fee: number | null;
  weekNumber: number | null;
}

export interface FeatureInventory {
  featureArea: string;
  files: number;
  hasQuery: number;
  hasWrite: number;
  hasMail: number;
  hasSession: number;
}

export interface MigrationInventory {
  routes: number;
  features: FeatureInventory[];
}

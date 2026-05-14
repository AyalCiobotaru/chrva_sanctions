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

export interface TournamentSearch {
  program: 'jr' | 'boys' | 'adt';
  division?: string;
  host?: string;
  name?: string;
  type?: string;
  date?: string;
}

export interface TournamentSummary {
  id: string;
  uniqueId: string;
  date: string;
  division: string;
  type: string;
  name: string;
  host: string;
  teamCount: number | null;
  site: string;
  closeDate: string | null;
  priority: string | null;
  status: string;
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

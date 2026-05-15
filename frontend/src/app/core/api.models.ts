export interface LegacyConfig {
  currentSeason: string;
  previousSeason: string;
  nextSeason: string;
  seasonStatus: 'Open' | 'Closed';
  sanctionStatus: 'Open' | 'Closed';
}

export interface ClubSearch {
  clubName?: string;
  state?: string;
  activeStatus?: 'active' | 'inactive' | 'all';
  meetingNoShows?: string;
}

export interface ClubSummary {
  clubCode: string;
  clubName: string;
  contactFirstName: string;
  contactLastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website?: string;
  phone?: string;
  phoneSecondary?: string;
  email: string;
  alternateEmail: string;
  active: boolean;
  clubType: string;
  attendedMeeting: boolean;
  previousNoShowFlag: boolean;
  acknowledged: boolean;
}

export interface ClubSearchResult {
  clubs: ClubSummary[];
  total: number;
  activeTotal: number;
  attendingTotal: number;
}

export interface NewClubRequest {
  clubCode: string;
  clubName: string;
  contactFirstName: string;
  contactLastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone1: string;
  phone2?: string;
  extension?: string;
  fax?: string;
  website?: string;
  email: string;
  alternateEmail?: string;
  comments?: string;
  clubType?: string;
  active?: boolean;
}

export interface ClubEmailRecipient {
  email: string;
  name: string;
  clubName: string;
}

export interface ClubEmailFromOption {
  email: string;
  name: string;
}

export interface ClubEmailBroadcast {
  clubType: string;
  recipients: ClubEmailRecipient[];
  recipientCount: number;
  fromOptions: ClubEmailFromOption[];
}

export interface ClubEmailBroadcastRequest {
  from: string;
  subject: string;
  information: string;
  recipients: ClubEmailRecipient[];
}

export interface ClubEmailBroadcastResult {
  sent: boolean;
  dryRun: boolean;
  recipientCount: number;
  message: string;
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

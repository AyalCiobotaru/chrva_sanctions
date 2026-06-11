export interface LegacyConfig {
  currentSeason: string;
  previousSeason: string;
  nextSeason: string;
  seasonStatus: 'Open' | 'Closed';
  sanctionStatus: 'Open' | 'Closed';
}

export type AuthRole = 'master' | 'toolsAdmin' | 'generic';

export interface AuthUser {
  username: string;
  displayName: string;
  role: AuthRole;
}

export interface AuthSession {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SanctionClub {
  clubCode: string;
  clubName: string;
}

export interface SanctionClubSession {
  authenticated: boolean;
  club: SanctionClub | null;
}

export interface SanctionClubLoginRequest {
  username: string;
  password: string;
  agree: boolean;
  agreePenalties: boolean;
}

export interface SanctionHistoryItem {
  id: string;
  sanctionId: string;
  renewalSanctionId: string;
  date: string | null;
  proposedRenewalDate: string | null;
  weekNumber: number | null;
  division: string;
  type: string;
  teamCount: number | null;
  site: string;
  hdp: boolean;
  status: string;
  sanctionStatus: string;
  renewalStatus: string | null;
}

export interface SanctionHistoryResult {
  club: SanctionClub;
  previousSeason: string;
  currentSeason: string;
  tournaments: SanctionHistoryItem[];
}

export interface CurrentSanctionRequest {
  id: string;
  sanctionId: string;
  sanctionStatus: string;
  date: string | null;
  weekNumber: number | null;
  division: string;
  type: string;
  teamCount: number | null;
  entryFee: number | null;
  name: string;
  site: string;
  hdp: boolean;
  sanctionNotes: string;
  tournamentNotes: string;
  canModify: boolean;
}

export interface CurrentSanctionRequestsResult {
  club: SanctionClub;
  currentSeason: string;
  requests: CurrentSanctionRequest[];
}

export interface SanctionVenueOption {
  name: string;
  address: string;
}

export interface SanctionRequestFormOptions {
  club: SanctionClub;
  venues: SanctionVenueOption[];
  ageGroups: string[];
  startTimes: string[];
  sanctionFeePerTeam: number;
  sanctionNetIncomeLimit: number;
}

export interface NewSanctionRequest {
  sanctionId?: string;
  tournamentContactName: string;
  tournamentDirectorName: string;
  tournamentContactAddress: string;
  tournamentDirectorEmail: string;
  tournamentDirectorHomePhone: string;
  tournamentDirectorTournamentPhone: string;
  date: string;
  startTime: string;
  division: string;
  numberOfTeams: string;
  minimumNumberOfTeams: string;
  tournamentName: string;
  site: string;
  siteAddress: string;
  type: string;
  entryFee: string;
  checkPayableTo: string;
  paymentType: string[];
  creditCardPayment: string;
  paymentUrl: string;
  singleAgeGroupOpen: string;
  hdp: string;
  poolPlay: string;
  playoffFormat: string;
  quarterFinals: string;
  semiFinals: string;
  finals: string;
  showers: string;
  awards: string;
  food: string;
  lockerRoom: string;
  information: string;
  requester: string;
  expenseFacility: string;
  expenseOfficialsFees: string;
  expenseVolleyballs: string;
  expenseAwards: string;
  expenseSupplies: string;
  expenseOther: string;
  expenseSanctionFees?: string;
  expenseTotal?: string;
  entryFeeIncome?: string;
  otherIncome: string;
  netIncome?: string;
}

export interface SanctionRequestRenewalSource {
  id: string;
  sanctionId: string;
  date: string | null;
  division: string;
  site: string;
}

export interface SanctionRequestRenewalResult {
  source: SanctionRequestRenewalSource;
  request: NewSanctionRequest;
}

export interface SanctionRequestDetailResult {
  id: string;
  club: SanctionClub;
  sanctionId: string;
  sanctionStatus: string;
  submitDate: string | null;
  weekNumber: number | null;
  canModify: boolean;
  sanctionFeePerTeam: number;
  request: NewSanctionRequest;
}

export interface CreateSanctionRequestResult {
  id: string;
  sanctionId: string;
  status: string;
  submittedDate: string | null;
  email?: ClubEmailBroadcastResult;
}

export interface DeleteSanctionRequestResult {
  id: string;
  deleted: boolean;
}

export interface ClubSearch {
  clubName?: string;
  state?: string;
  clubType?: string;
  activeStatus?: 'active' | 'inactive' | 'all';
  meetingNoShows?: string;
}

export interface ClubSummary {
  clubCode: string;
  clubName: string;
  contactFirstName: string;
  contactLastName: string;
  address1: string;
  address2: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website?: string;
  phone?: string;
  phoneSecondary?: string;
  email: string;
  alternateEmail: string;
  username: string;
  password: string;
  active: boolean;
  clubType: string;
  comments: string;
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
  username?: string;
  password?: string;
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

export interface TournamentDirectorEmailBroadcast {
  season: string;
  recipients: ClubEmailRecipient[];
  recipientCount: number;
  fromOptions: ClubEmailFromOption[];
  deliveryConfigured: boolean;
}

export interface TournamentDirectorEmailBroadcastRequest {
  from: string;
  subject: string;
  information: string;
  recipients: ClubEmailRecipient[];
}

export interface CoordinatorSearch {
  category?: string;
  firstName?: string;
  lastName?: string;
}

export interface CoordinatorSummary {
  category: string;
  level: string;
  grouping: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phonePrimary: string;
  phoneSecondary: string;
  extension: string;
  fax: string;
  email: string;
  displayRecord: string;
  type: string;
}

export interface CoordinatorRequest {
  category: string;
  level: string;
  grouping: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phonePrimary: string;
  phoneSecondary: string;
  extension: string;
  fax: string;
  email: string;
}

export interface DeleteCoordinatorResult {
  deleted: boolean;
}

export interface TournamentSearch {
  season?: string;
  program?: '' | 'jr' | 'boys' | 'adt';
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

export interface AdminSanctionRequestSearch {
  season?: string;
  divisions?: string;
  clubCode?: string;
  weekNumber?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  tournamentType?: string;
  hdpOnly?: string;
  sagoOnly?: string;
  duplicateSanctionId?: string;
}

export interface AdminSanctionRequestCounts {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  cancelled: number;
  hdp: number;
  sago: number;
}

export interface AdminSanctionRequestClubOption {
  clubCode: string;
  clubName: string;
}

export interface AdminSanctionRequestOptions {
  seasons: string[];
  ageGroups: string[];
  clubs: AdminSanctionRequestClubOption[];
}

export interface AdminSanctionRequestSpecialDate {
  id: string | null;
  label: string;
  notes: string;
}

export interface AdminSanctionRequestSummary {
  id: string;
  sanctionId: string;
  suggestedSanctionId: string;
  sanctionStatus: string;
  statusCode: string;
  archiveStatus: string;
  sanctionNotes: string;
  submitDate: string | null;
  date: string | null;
  startTime: string | null;
  closeDate: string | null;
  priority: string | null;
  division: string;
  divisionLabel: string;
  type: string;
  teamCount: number | null;
  entryFee: number | null;
  name: string;
  site: string;
  clubCode: string;
  clubName: string;
  hdp: boolean;
  sago: boolean;
  addedToAes: boolean;
  tournamentDirectorEmail: string;
  tournamentDirectorName: string;
  weekNumber: number | null;
  specialDate: AdminSanctionRequestSpecialDate;
  sanctionDivisionMismatch: boolean;
}

export interface DuplicateSanctionId {
  sanctionId: string;
  count: number;
}

export interface AdminCurrentSanctionRequestsResult {
  season: string;
  options: AdminSanctionRequestOptions;
  counts: AdminSanctionRequestCounts;
  duplicateSanctionIds: DuplicateSanctionId[];
  requests: AdminSanctionRequestSummary[];
}

export interface AdminSanctionRequestReviewRequest {
  sanctionStatus: string;
  sanctionId: string;
  priority: string;
  sanctionNotes: string;
}

export interface UpdateTournamentAddedToAesRequest {
  addedToAesDate: string | null;
}

export interface UpdateTournamentAddedToAesResult {
  id: string;
  addedToAesDate: string | null;
}

export interface UpdateTournamentOkToPayRequest {
  okToPay: boolean;
}

export interface UpdateTournamentOkToPayResult {
  id: string;
  okToPay: boolean;
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

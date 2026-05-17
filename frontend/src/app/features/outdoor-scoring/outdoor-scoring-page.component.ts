import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { OutdoorGameScore, OutdoorMatch, OutdoorPoolState } from './outdoor-scoring.models';
import { OutdoorScoringRealtimeService } from './outdoor-scoring-realtime.service';

const STORAGE_KEY = 'chrva.outdoorScoring.pool.v1';

@Component({
  selector: 'app-outdoor-scoring-page',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgClass],
  templateUrl: './outdoor-scoring-page.component.html',
  styleUrl: './outdoor-scoring-page.component.scss'
})
export class OutdoorScoringPageComponent implements OnInit, OnDestroy {
  private remoteSubscription?: Subscription;
  private snapshotRequestSubscription?: Subscription;
  private applyingRemoteState = false;

  pool: OutdoorPoolState = this.loadState();
  editingSetup = this.pool.matches.length === 0;
  readonly realtimeStatus$ = this.realtime.status$;

  constructor(
    private readonly changeDetector: ChangeDetectorRef,
    private readonly realtime: OutdoorScoringRealtimeService
  ) {}

  ngOnInit(): void {
    this.remoteSubscription = this.realtime.remotePool$.subscribe((pool) => {
      this.applyingRemoteState = true;
      this.pool = this.normalizePool(pool);
      if (this.pool.matches.length > 0) {
        this.pool.activeMatchId = this.pool.matches.some((match) => match.id === this.pool.activeMatchId)
          ? this.pool.activeMatchId
          : this.pool.matches[0].id;
        this.editingSetup = false;
      } else {
        this.editingSetup = true;
      }
      this.persistLocal();
      this.applyingRemoteState = false;
      this.changeDetector.detectChanges();
    });
    this.snapshotRequestSubscription = this.realtime.snapshotRequest$.subscribe(() => {
      if (this.hasPool) {
        this.realtime.publish(this.pool, 'pool-updated');
      }
    });
    void this.realtime.connect();
  }

  ngOnDestroy(): void {
    this.remoteSubscription?.unsubscribe();
    this.snapshotRequestSubscription?.unsubscribe();
  }

  get activeMatch(): OutdoorMatch | null {
    return this.pool.matches.find((match) => match.id === this.pool.activeMatchId) ?? this.pool.matches[0] ?? null;
  }

  get hasPool(): boolean {
    return this.pool.matches.length > 0;
  }

  captureSheet(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.pool.imagePreview = typeof reader.result === 'string' ? reader.result : null;
      this.touch();
    };
    reader.readAsDataURL(file);
  }

  applyTeamCount(): void {
    const count = this.clampWholeNumber(this.pool.teamCount, 2, 16);
    this.pool.teamCount = count;
    this.pool.teams = Array.from({ length: count }, (_, index) => {
      const seed = index + 1;
      return this.pool.teams.find((team) => team.seed === seed) ?? {
        seed,
        name: `Team ${seed}`
      };
    });
    this.pool.matches = this.pool.matches
      .filter((match) => this.seedInRange(match.teamASeed) && this.seedInRange(match.teamBSeed))
      .map((match) => ({
        ...match,
        refSeed: this.seedInRange(match.refSeed) ? match.refSeed : null
      }));
    this.touch();
  }

  applyGameFormat(): void {
    this.pool.gamesPerMatch = this.clampWholeNumber(this.pool.gamesPerMatch, 1, 5);
    this.pool.targetScore = this.clampWholeNumber(this.pool.targetScore, 1, 99);
    this.pool.matches = this.pool.matches.map((match) => ({
      ...match,
      games: this.resizeGames(match.games)
    }));
    this.touch();
  }

  addMatch(): void {
    const firstSeed = this.pool.teams[0]?.seed ?? null;
    const secondSeed = this.pool.teams[1]?.seed ?? null;
    const refSeed = this.pool.teams[2]?.seed ?? null;
    const match: OutdoorMatch = {
      id: this.createId(),
      refSeed,
      teamASeed: firstSeed,
      teamBSeed: secondSeed,
      games: this.createGames(),
      final: false
    };
    this.pool.matches.push(match);
    this.pool.activeMatchId ??= match.id;
    this.touch();
  }

  removeMatch(matchId: string): void {
    this.pool.matches = this.pool.matches.filter((match) => match.id !== matchId);
    if (this.pool.activeMatchId === matchId) {
      this.pool.activeMatchId = this.pool.matches[0]?.id ?? null;
    }
    this.touch();
  }

  startScoring(match: OutdoorMatch): void {
    this.pool.activeMatchId = match.id;
    this.editingSetup = false;
    this.touch();
  }

  updateScore(match: OutdoorMatch, game: OutdoorGameScore, side: 'A' | 'B', change: number): void {
    if (match.final) {
      return;
    }

    if (side === 'A') {
      game.scoreA = Math.max(0, this.wholeNumber(game.scoreA) + change);
    } else {
      game.scoreB = Math.max(0, this.wholeNumber(game.scoreB) + change);
    }

    this.touch('score-updated');
  }

  normalizeScore(game: OutdoorGameScore, side: 'A' | 'B'): void {
    if (side === 'A') {
      game.scoreA = Math.max(0, this.wholeNumber(game.scoreA));
    } else {
      game.scoreB = Math.max(0, this.wholeNumber(game.scoreB));
    }
    this.touch('score-updated');
  }

  markFinal(match: OutdoorMatch): void {
    match.final = true;
    this.touch('score-updated');
  }

  reopen(match: OutdoorMatch): void {
    match.final = false;
    this.pool.activeMatchId = match.id;
    this.touch('score-updated');
  }

  teamName(seed: number | null): string {
    if (seed == null) {
      return 'Team';
    }

    return this.pool.teams.find((team) => team.seed === Number(seed))?.name || `Team ${seed}`;
  }

  resetPool(): void {
    if (!confirm('Reset this outdoor scoring pool? This clears the local sheet, schedule, and scores on this device.')) {
      return;
    }

    this.pool = this.createDefaultState();
    this.editingSetup = true;
    localStorage.removeItem(STORAGE_KEY);
  }

  save(): void {
    this.touch();
  }

  private loadState(): OutdoorPoolState {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return this.createDefaultState();
    }

    try {
      const parsed = JSON.parse(saved) as OutdoorPoolState;
      return this.normalizePool(parsed);
    } catch {
      return this.createDefaultState();
    }
  }

  private normalizePool(pool: OutdoorPoolState): OutdoorPoolState {
    const baseline = this.createDefaultState();
    const gamesPerMatch = this.clampWholeNumber(pool.gamesPerMatch, 1, 5);

    return {
      ...baseline,
      ...pool,
      teamCount: this.clampWholeNumber(pool.teamCount, 2, 16),
      gamesPerMatch,
      targetScore: this.clampWholeNumber(pool.targetScore, 1, 99),
      teams: Array.isArray(pool.teams) ? pool.teams : [],
      matches: Array.isArray(pool.matches) ? pool.matches.map((match) => ({
        ...match,
        games: this.resizeGamesForCount(match.games ?? [], gamesPerMatch),
        final: Boolean(match.final)
      })) : []
    };
  }

  private createDefaultState(): OutdoorPoolState {
    return {
      title: 'Outdoor Pool',
      teamCount: 4,
      gamesPerMatch: 2,
      targetScore: 25,
      teams: [1, 2, 3, 4].map((seed) => ({ seed, name: `Team ${seed}` })),
      matches: [],
      activeMatchId: null,
      imagePreview: null,
      updatedAt: null
    };
  }

  private touch(kind: 'pool-updated' | 'score-updated' = 'pool-updated'): void {
    this.pool.updatedAt = new Date().toISOString();
    this.persistLocal();

    if (!this.applyingRemoteState) {
      this.realtime.publish(this.pool, kind);
    }
  }

  private persistLocal(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pool));
  }

  private createGames(): OutdoorGameScore[] {
    return Array.from({ length: this.pool.gamesPerMatch }, () => ({
      scoreA: 0,
      scoreB: 0
    }));
  }

  private createId(): string {
    const browserCrypto = globalThis.crypto;

    if (typeof browserCrypto?.randomUUID === 'function') {
      return browserCrypto.randomUUID();
    }

    if (typeof browserCrypto?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      browserCrypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  private resizeGames(games: OutdoorGameScore[]): OutdoorGameScore[] {
    return this.resizeGamesForCount(games, this.pool.gamesPerMatch);
  }

  private resizeGamesForCount(games: OutdoorGameScore[], count: number): OutdoorGameScore[] {
    return Array.from({ length: count }, (_, index) => {
      const existing = games[index];
      return {
        scoreA: this.wholeNumber(existing?.scoreA),
        scoreB: this.wholeNumber(existing?.scoreB)
      };
    });
  }

  private seedInRange(seed: number | null): boolean {
    return seed != null && seed >= 1 && seed <= this.pool.teamCount;
  }

  private clampWholeNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, this.wholeNumber(value)));
  }

  private wholeNumber(value: unknown): number {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : 0;
  }
}

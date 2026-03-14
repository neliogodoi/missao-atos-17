import { NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, firstValueFrom, map, of, switchMap, take } from 'rxjs';

import { Season, UserAnswer, UserStats } from '../../../../models/firestore.models';
import { AuthService } from '../../../../services/auth.service';
import { FirestoreService } from '../../../../services/firestore.service';
import { GameRepository } from '../../../../services/game-repository.service';
import { XpTagComponent } from '../../../../shared/components/xp-tag/xp-tag.component';

interface ProfileDoc {
  displayName?: string;
  photoURL?: string;
  role?: string;
}

type ForgeItemName = 'Capacete' | 'Peitoral' | 'Cinto' | 'Sandalias' | 'Escudo' | 'Espada';

interface ArmorProgressVm {
  itemName: ForgeItemName;
  imageSrc: string;
  earned: number;
  target: number;
  progressPercent: number;
}

interface ProfileHistoryDayVm {
  dateKey: string;
  label: string;
}

const FORGE_ITEMS: ForgeItemName[] = ['Capacete', 'Peitoral', 'Cinto', 'Sandalias', 'Escudo', 'Espada'];
const ITEM_TARGET = 5;
const FORGE_ITEM_IMAGE_MAP: Record<ForgeItemName, string> = {
  Capacete: 'assets/imgs/capacete.jpeg',
  Peitoral: 'assets/imgs/peitoral.jpeg',
  Cinto: 'assets/imgs/cinto.jpeg',
  Sandalias: 'assets/imgs/sandalias.jpeg',
  Escudo: 'assets/imgs/escudo.jpeg',
  Espada: 'assets/imgs/espada.jpeg'
};

@Component({
  selector: 'app-profile-page',
  imports: [NgIf, NgFor, XpTagComponent],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css'
})
export class ProfilePage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly gameRepository = inject(GameRepository);

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly totalXp = signal(0);
  readonly streak = signal(0);
  readonly initialDisplayName = signal('');
  readonly armorProgress = signal<ArmorProgressVm[]>([]);
  readonly historyDays = signal<ProfileHistoryDayVm[]>([]);

  readonly profileVm$ = this.authService.user$.pipe(
    switchMap((user) => {
      if (!user) {
        return of(null);
      }

      const uid = user.uid;
      return combineLatest([
        this.firestoreService.doc$<ProfileDoc>(`users/${uid}`),
        this.firestoreService.doc$<UserStats>(`userStats/${uid}`)
      ]).pipe(
        map(([profileDoc, stats]) => ({
          uid,
          displayName: profileDoc?.displayName || user.displayName || '',
          totalXp: stats?.totalXp ?? 0,
          streak: stats?.streak ?? 0
        }))
      );
    })
  );

  constructor() {
    this.profileVm$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vm) => {
          if (!vm) {
            this.loading.set(false);
            return;
          }

          this.totalXp.set(vm.totalXp);
          this.streak.set(vm.streak);
          this.initialDisplayName.set(vm.displayName);
          void this.loadArmorProgress(vm.uid);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Erro ao carregar perfil.';
          this.errorMessage.set(message);
          this.loading.set(false);
        }
      });
  }

  private async loadArmorProgress(uid: string): Promise<void> {
    const [answers, acts] = await firstValueFrom(
      combineLatest([this.gameRepository.listUserAnswers(uid), this.gameRepository.listSeasons$()]).pipe(take(1))
    );
    const participationByItem = this.computeItemParticipations(answers, acts);
    const progress = FORGE_ITEMS.map((itemName) => {
      const earned = Math.min(participationByItem[itemName], ITEM_TARGET);
      return {
        itemName,
        imageSrc: FORGE_ITEM_IMAGE_MAP[itemName],
        earned,
        target: ITEM_TARGET,
        progressPercent: Math.round((earned / ITEM_TARGET) * 100)
      };
    });
    this.armorProgress.set(progress);
    this.historyDays.set(this.buildParticipationHistory(answers));
  }

  private computeItemParticipations(answers: UserAnswer[], acts: Season[]): Record<ForgeItemName, number> {
    const counts: Record<ForgeItemName, number> = {
      Capacete: 0,
      Peitoral: 0,
      Cinto: 0,
      Sandalias: 0,
      Escudo: 0,
      Espada: 0
    };

    for (const answer of answers) {
      const itemName = this.getItemNameForDate(answer.dateKey, acts);
      if (itemName) {
        counts[itemName] += 1;
      }
    }

    return counts;
  }

  private getItemNameForDate(dateKey: string, acts: Season[]): ForgeItemName | null {
    const match = acts.find((act) => {
      const startDateKey = this.toDateKey(act.startsAt);
      const endDateKey = this.toDateKey(act.endsAt);
      return dateKey >= startDateKey && dateKey <= endDateKey;
    });
    if (!match) {
      return null;
    }
    return this.resolveItemName(match.currentItemKey ?? '');
  }

  private resolveItemName(value: string): ForgeItemName | null {
    const normalized = this.normalizeKey(value);
    if (!normalized) {
      return null;
    }

    if (normalized.includes('capacete')) return 'Capacete';
    if (normalized.includes('peitoral')) return 'Peitoral';
    if (normalized.includes('cinto')) return 'Cinto';
    if (normalized.includes('sandalia') || normalized.includes('sandalias')) return 'Sandalias';
    if (normalized.includes('escudo')) return 'Escudo';
    if (normalized.includes('espada')) return 'Espada';
    return null;
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private toDateKey(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildParticipationHistory(answers: UserAnswer[]): ProfileHistoryDayVm[] {
    const uniqueDateKeys = Array.from(new Set(answers.map((answer) => answer.dateKey)))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 5);

    return uniqueDateKeys.map((dateKey) => ({
      dateKey,
      label: this.formatDateKeyForUi(dateKey)
    }));
  }

  private formatDateKeyForUi(dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateKey;
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit'
    }).format(date);
  }
}

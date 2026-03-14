import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { limit, orderBy, query, where } from '@angular/fire/firestore';
import { combineLatest, catchError, map, of, switchMap } from 'rxjs';

import { PrayerMessage, UserStats } from '../../../../models/firestore.models';
import { AuthService } from '../../../../services/auth.service';
import { FirestoreService } from '../../../../services/firestore.service';
import { ToastService } from '../../../../services/toast.service';
import { MissionCardComponent } from '../../../../shared/components/mission-card/mission-card.component';

interface PrayerRecipientVm {
  uid: string;
  displayName: string;
  photoURL: string;
}

@Component({
  selector: 'app-prayers-page',
  imports: [AsyncPipe, NgIf, NgFor, ReactiveFormsModule, MissionCardComponent],
  templateUrl: './prayers-page.html',
  styleUrl: './prayers-page.css'
})
export class PrayersPage {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly uid = signal<string | null>(null);
  readonly recipientSearch = signal('');
  readonly selectedRecipient = signal<PrayerRecipientVm | null>(null);

  readonly form = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]]
  });

  readonly recipients$ = combineLatest([
    this.authService.user$,
    this.firestoreService.col$<UserStats>('userStats', (ref) => query(ref, orderBy('displayName', 'asc'), limit(300))),
    toObservable(this.recipientSearch)
  ]).pipe(
    map(([currentUser, users, search]) => {
      const currentUid = currentUser?.uid ?? '';
      const term = this.normalize(search ?? '');
      return users
        .filter((user) => user.userId && user.userId !== currentUid)
        .map((user) => ({
          uid: user.userId,
          displayName: (user.displayName || user.userId).trim(),
          photoURL: (user.photoURL || '').trim()
        }))
        .filter((user) => {
          if (!term) {
            return true;
          }
          return this.normalize(user.displayName).includes(term) || this.normalize(user.uid).includes(term);
        })
        .slice(0, 24);
    })
  );

  readonly received$ = this.authService.user$.pipe(
    switchMap((user) => {
      if (!user) {
        return of([] as PrayerMessage[]);
      }
      return this.firestoreService.col$<PrayerMessage>('prayers', (ref) =>
        query(ref, where('recipientUid', '==', user.uid), limit(120))
      );
    }),
    map((items) => this.sortByCreatedAtDesc(items).slice(0, 80)),
    catchError(() => {
      this.errorMessage.set('Não foi possível carregar as orações recebidas agora.');
      return of([] as PrayerMessage[]);
    })
  );

  readonly sent$ = this.authService.user$.pipe(
    switchMap((user) => {
      if (!user) {
        return of([] as PrayerMessage[]);
      }
      return this.firestoreService.col$<PrayerMessage>('prayers', (ref) =>
        query(ref, where('senderUid', '==', user.uid), limit(120))
      );
    }),
    map((items) => this.sortByCreatedAtDesc(items).slice(0, 80)),
    catchError(() => {
      this.errorMessage.set('Não foi possível carregar as orações enviadas agora.');
      return of([] as PrayerMessage[]);
    })
  );

  constructor() {
    this.authService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.uid.set(user?.uid ?? null);
          this.loading.set(false);
        }
      });
  }

  async onSendPrayer(): Promise<void> {
    if (this.form.invalid || !this.uid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const recipient = this.selectedRecipient();
    const message = value.message.trim();
    const senderUid = this.uid()!;
    const recipientUid = recipient?.uid ?? '';

    if (!recipientUid) {
      this.errorMessage.set('Selecione um colega para receber a oração.');
      this.sending.set(false);
      return;
    }

    if (recipientUid === senderUid) {
      this.errorMessage.set('Você não pode enviar oração para si mesmo.');
      this.sending.set(false);
      return;
    }

    try {
      await this.firestoreService.addDoc('prayers', {
        senderUid,
        recipientUid,
        anonymous: true,
        message,
        createdAt: new Date().toISOString()
      });
      this.form.reset({ message: '' });
      this.recipientSearch.set('');
      this.selectedRecipient.set(null);
      this.toastService.show('Oração enviada com sucesso.', 'success');
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : 'Não foi possível enviar a oração.';
      this.errorMessage.set(messageText);
    } finally {
      this.sending.set(false);
    }
  }

  formatCreatedAt(value: PrayerMessage['createdAt']): string {
    const date = typeof value === 'string'
      ? new Date(value)
      : value?.toDate?.() ?? null;
    if (!date || Number.isNaN(date.getTime())) {
      return '-';
    }
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  onRecipientSearch(value: string): void {
    this.recipientSearch.set(value);
  }

  onSelectRecipient(recipient: PrayerRecipientVm): void {
    this.selectedRecipient.set(recipient);
  }

  clearSelectedRecipient(): void {
    this.selectedRecipient.set(null);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private sortByCreatedAtDesc(items: PrayerMessage[]): PrayerMessage[] {
    return [...items].sort((a, b) => this.toMillis(b.createdAt) - this.toMillis(a.createdAt));
  }

  private toMillis(value: PrayerMessage['createdAt']): number {
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }

    const date = value?.toDate?.();
    return date ? date.getTime() : 0;
  }

  isAnonymous(prayer: PrayerMessage): boolean {
    return prayer.anonymous !== false;
  }
}

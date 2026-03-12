import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { limit, orderBy, query, where } from '@angular/fire/firestore';
import { of, switchMap } from 'rxjs';

import { PrayerMessage } from '../../../../models/firestore.models';
import { AuthService } from '../../../../services/auth.service';
import { FirestoreService } from '../../../../services/firestore.service';
import { ToastService } from '../../../../services/toast.service';
import { MissionCardComponent } from '../../../../shared/components/mission-card/mission-card.component';

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

  readonly form = this.fb.nonNullable.group({
    recipientUid: ['', [Validators.required, Validators.maxLength(128)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]]
  });

  readonly received$ = this.authService.user$.pipe(
    switchMap((user) => {
      if (!user) {
        return of([] as PrayerMessage[]);
      }
      return this.firestoreService.col$<PrayerMessage>('prayers', (ref) =>
        query(ref, where('recipientUid', '==', user.uid), orderBy('createdAt', 'desc'), limit(80))
      );
    })
  );

  readonly sent$ = this.authService.user$.pipe(
    switchMap((user) => {
      if (!user) {
        return of([] as PrayerMessage[]);
      }
      return this.firestoreService.col$<PrayerMessage>('prayers', (ref) =>
        query(ref, where('senderUid', '==', user.uid), orderBy('createdAt', 'desc'), limit(80))
      );
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
    const recipientUid = value.recipientUid.trim();
    const message = value.message.trim();
    const senderUid = this.uid()!;

    if (recipientUid === senderUid) {
      this.errorMessage.set('Você não pode enviar oração para si mesmo.');
      this.sending.set(false);
      return;
    }

    try {
      await this.firestoreService.addDoc('prayers', {
        senderUid,
        recipientUid,
        message,
        createdAt: new Date().toISOString()
      });
      this.form.reset({ recipientUid: '', message: '' });
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
}

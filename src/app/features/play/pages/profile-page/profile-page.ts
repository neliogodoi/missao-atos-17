import { NgIf } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, map, of, switchMap } from 'rxjs';

import { UserStats } from '../../../../models/firestore.models';
import { AuthService } from '../../../../services/auth.service';
import { FirestoreService } from '../../../../services/firestore.service';
import { XpTagComponent } from '../../../../shared/components/xp-tag/xp-tag.component';

interface ProfileDoc {
  displayName?: string;
  photoURL?: string;
  role?: string;
}

@Component({
  selector: 'app-profile-page',
  imports: [NgIf, ReactiveFormsModule, XpTagComponent],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css'
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly firestoreService = inject(FirestoreService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly uid = signal<string | null>(null);
  readonly email = signal<string>('');
  readonly role = signal<string>('player');
  readonly totalXp = signal(0);
  readonly streak = signal(0);
  readonly initialDisplayName = signal('');
  readonly initialPhotoURL = signal('');

  readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
    photoURL: ['', [Validators.maxLength(500)]]
  });

  readonly isDirty = computed(() => {
    const value = this.form.getRawValue();
    return value.displayName.trim() !== this.initialDisplayName()
      || value.photoURL.trim() !== this.initialPhotoURL();
  });

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
          email: user.email ?? '',
          displayName: profileDoc?.displayName || user.displayName || '',
          photoURL: profileDoc?.photoURL || user.photoURL || '',
          role: profileDoc?.role || 'player',
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
            this.uid.set(null);
            this.loading.set(false);
            return;
          }

          this.uid.set(vm.uid);
          this.email.set(vm.email);
          this.role.set(vm.role);
          this.totalXp.set(vm.totalXp);
          this.streak.set(vm.streak);
          this.initialDisplayName.set(vm.displayName);
          this.initialPhotoURL.set(vm.photoURL);
          this.form.reset({
            displayName: vm.displayName,
            photoURL: vm.photoURL
          });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Erro ao carregar perfil.';
          this.errorMessage.set(message);
          this.loading.set(false);
        }
      });
  }

  async onSave(): Promise<void> {
    if (this.form.invalid || !this.uid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const value = this.form.getRawValue();
    const displayName = value.displayName.trim();
    const photoURL = value.photoURL.trim();

    try {
      await this.firestoreService.updateDoc(`users/${this.uid()}`, { displayName, photoURL });
      this.initialDisplayName.set(displayName);
      this.initialPhotoURL.set(photoURL);
      this.successMessage.set('Perfil atualizado com sucesso.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o perfil.';
      this.errorMessage.set(message);
    } finally {
      this.saving.set(false);
    }
  }
}

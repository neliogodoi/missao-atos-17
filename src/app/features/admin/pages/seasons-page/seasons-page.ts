import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { orderBy, query } from '@angular/fire/firestore';

import { Season } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';

@Component({
  selector: 'app-seasons-page',
  imports: [ReactiveFormsModule, AsyncPipe, NgFor, NgIf],
  templateUrl: './seasons-page.html',
  styleUrl: './seasons-page.css'
})
export class SeasonsPage {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);

  readonly editingId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly seasons$ = this.firestoreService.col$<Season>('seasons', (ref) => query(ref, orderBy('createdAt', 'desc')));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: [''],
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
    isActive: [false],
    currentItemKey: ['']
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const now = new Date().toISOString();
    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description.trim(),
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      isActive: value.isActive,
      currentItemKey: value.currentItemKey.trim(),
      updatedAt: now
    };

    try {
      await this.firestoreService.assertCurrentUserIsAdmin();
      const seasonId = this.editingId();
      if (seasonId) {
        await this.firestoreService.updateDoc(`seasons/${seasonId}`, payload);
      } else {
        const id = await this.firestoreService.addDoc('seasons', {
          ...payload,
          id: '',
          createdAt: now
        });
        await this.firestoreService.updateDoc(`seasons/${id}`, { id });
      }
      this.resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar Ato.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onEdit(season: Season): void {
    this.editingId.set(season.id);
    this.form.setValue({
      name: season.name,
      description: season.description ?? '',
      startsAt: season.startsAt,
      endsAt: season.endsAt,
      isActive: season.isActive,
      currentItemKey: season.currentItemKey ?? ''
    });
  }

  async onToggleActive(season: Season): Promise<void> {
    if (!season.id) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.firestoreService.assertCurrentUserIsAdmin();
      await this.firestoreService.updateDoc(`seasons/${season.id}`, {
        isActive: !season.isActive,
        updatedAt: new Date().toISOString()
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar status do Ato.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onCancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      description: '',
      startsAt: '',
      endsAt: '',
      isActive: false,
      currentItemKey: ''
    });
  }
}

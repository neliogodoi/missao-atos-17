import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { orderBy, query } from '@angular/fire/firestore';

import { RetroAccess } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';

@Component({
  selector: 'app-retro-access-page',
  imports: [ReactiveFormsModule, AsyncPipe, NgFor, NgIf],
  templateUrl: './retro-access-page.html',
  styleUrl: './retro-access-page.css'
})
export class RetroAccessPage {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);

  readonly editingUid = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly accesses$ = this.firestoreService.col$<RetroAccess>('retroAccess', (ref) =>
    query(ref, orderBy('updatedAt', 'desc'))
  );

  readonly form = this.fb.nonNullable.group({
    uid: ['', [Validators.required, Validators.maxLength(128)]],
    bulkUidsText: [''],
    enabled: [true],
    allowAllRetro: [false],
    allowedDateKeysText: [''],
    note: ['', Validators.maxLength(240)]
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const uid = value.uid.trim();
    const bulkUids = this.parseBulkUids(value.bulkUidsText);
    const targetUids = Array.from(new Set([uid, ...bulkUids].filter((item) => item.length > 0)));
    if (targetUids.length === 0) {
      this.errorMessage.set('Informe pelo menos um UID válido.');
      this.loading.set(false);
      return;
    }
    const now = new Date().toISOString();
    const allowedDateKeys = this.parseAllowedDateKeys(value.allowedDateKeysText);

    try {
      await this.firestoreService.assertCurrentUserIsAdmin();
      await Promise.all(
        targetUids.map((targetUid) =>
          this.firestoreService.setDoc(`retroAccess/${targetUid}`, {
            uid: targetUid,
            enabled: value.enabled,
            allowAllRetro: value.allowAllRetro,
            allowedDateKeys,
            note: value.note.trim() || undefined,
            createdAt: now,
            updatedAt: now
          } satisfies RetroAccess)
        )
      );
      this.resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar acesso retroativo.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onEdit(access: RetroAccess): void {
    this.editingUid.set(access.uid);
    this.form.setValue({
      uid: access.uid,
      bulkUidsText: '',
      enabled: !!access.enabled,
      allowAllRetro: !!access.allowAllRetro,
      allowedDateKeysText: (access.allowedDateKeys ?? []).join(', '),
      note: access.note ?? ''
    });
  }

  async onDisable(access: RetroAccess): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      await this.firestoreService.assertCurrentUserIsAdmin();
      await this.firestoreService.updateDoc(`retroAccess/${access.uid}`, {
        enabled: false,
        updatedAt: new Date().toISOString()
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao desativar acesso.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onCancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingUid.set(null);
    this.form.reset({
      uid: '',
      bulkUidsText: '',
      enabled: true,
      allowAllRetro: false,
      allowedDateKeysText: '',
      note: ''
    });
  }

  private parseAllowedDateKeys(input: string): string[] {
    const normalized = input
      .split(/[\s,;]+/g)
      .map((value) => value.trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
    return Array.from(new Set(normalized));
  }

  private parseBulkUids(input: string): string[] {
    return input
      .split(/[\s,;]+/g)
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value.length <= 128);
  }
}

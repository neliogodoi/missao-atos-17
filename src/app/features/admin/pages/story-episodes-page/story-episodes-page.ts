import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { orderBy, query } from '@angular/fire/firestore';

import { StoryEpisode } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';

@Component({
  selector: 'app-story-episodes-page',
  imports: [ReactiveFormsModule, AsyncPipe, NgFor, NgIf],
  templateUrl: './story-episodes-page.html',
  styleUrl: './story-episodes-page.css'
})
export class StoryEpisodesPage {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);

  readonly editingId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly episodes$ = this.firestoreService.col$<StoryEpisode>('storyEpisodes', (ref) =>
    query(ref, orderBy('createdAt', 'desc'))
  );

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    content: ['', [Validators.required, Validators.maxLength(5000)]]
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

    const payload: Omit<StoryEpisode, 'id' | 'createdAt'> = {
      title: value.title.trim(),
      content: value.content.trim(),
      updatedAt: now
    };

    try {
      const episodeId = this.editingId();
      if (episodeId) {
        await this.firestoreService.updateDoc(`storyEpisodes/${episodeId}`, payload);
      } else {
        const id = await this.firestoreService.addDoc('storyEpisodes', {
          ...payload,
          id: '',
          createdAt: now
        });
        await this.firestoreService.updateDoc(`storyEpisodes/${id}`, { id });
      }
      this.resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar episódio.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onEdit(episode: StoryEpisode): void {
    this.editingId.set(episode.id);
    this.form.setValue({
      title: episode.title,
      content: episode.content
    });
  }

  async onDelete(episodeId: string): Promise<void> {
    if (!episodeId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.firestoreService.deleteDoc(`storyEpisodes/${episodeId}`);
      if (this.editingId() === episodeId) {
        this.resetForm();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir episódio.';
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
      title: '',
      content: ''
    });
  }
}

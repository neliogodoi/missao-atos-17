import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { orderBy, query } from '@angular/fire/firestore';

import { DailyMission, Question, StoryEpisode } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'app-daily-missions-page',
  imports: [ReactiveFormsModule, AsyncPipe, NgFor, NgIf],
  templateUrl: './daily-missions-page.html',
  styleUrl: './daily-missions-page.css'
})
export class DailyMissionsPage {
  private readonly participationXp = 1;
  private readonly correctBonusXp = 2;
  private readonly commentBonusXp = 3;

  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);
  private readonly toastService = inject(ToastService);

  readonly editingId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly episodes$ = this.firestoreService.col$<StoryEpisode>('storyEpisodes', (ref) =>
    query(ref, orderBy('createdAt', 'desc'))
  );
  readonly questions$ = this.firestoreService.col$<Question>('questions', (ref) =>
    query(ref, orderBy('createdAt', 'desc'))
  );
  readonly missions$ = this.firestoreService.col$<DailyMission>('dailyMissions', (ref) =>
    query(ref, orderBy('dateKey', 'desc'))
  );
  readonly episodes = toSignal(this.episodes$, { initialValue: [] as StoryEpisode[] });
  readonly questions = toSignal(this.questions$, { initialValue: [] as Question[] });

  readonly form = this.fb.nonNullable.group({
    dateKey: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    questionId: ['', Validators.required],
    storyEpisodeId: ['', Validators.required]
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

    const payload: Omit<DailyMission, 'id' | 'createdAt'> = {
      dateKey: value.dateKey,
      questionId: value.questionId,
      storyEpisodeId: value.storyEpisodeId,
      baseXp: this.participationXp,
      bonusCorrectXp: this.correctBonusXp,
      bonusStreakXp: this.commentBonusXp,
      updatedAt: now
    };

    try {
      await this.firestoreService.assertCurrentUserIsAdmin();
      const missionId = this.editingId();
      if (missionId) {
        await this.firestoreService.updateDoc(`dailyMissions/${missionId}`, payload);
      } else {
        const id = await this.firestoreService.addDoc('dailyMissions', {
          ...payload,
          id: '',
          createdAt: now
        });
        await this.firestoreService.updateDoc(`dailyMissions/${id}`, { id });
      }
      this.resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar missão diária.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onEdit(mission: DailyMission): void {
    this.editingId.set(mission.id);
    this.form.setValue({
      dateKey: mission.dateKey,
      questionId: mission.questionId,
      storyEpisodeId: mission.storyEpisodeId
    });
  }

  async onDelete(missionId: string): Promise<void> {
    if (!missionId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      await this.firestoreService.assertCurrentUserIsAdmin();
      await this.firestoreService.deleteDoc(`dailyMissions/${missionId}`);
      if (this.editingId() === missionId) {
        this.resetForm();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir missão diária.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onCancelEdit(): void {
    this.resetForm();
  }

  async onCopyMissionText(mission: DailyMission): Promise<void> {
    const episode = this.episodes().find((item) => item.id === mission.storyEpisodeId);
    const question = this.questions().find((item) => item.id === mission.questionId);

    if (!episode || !question) {
      this.toastService.show('Não foi possível montar o texto da missão.', 'error');
      return;
    }

    const text = this.buildMissionCopyText(mission, episode, question);

    try {
      await this.copyToClipboard(text);
      this.toastService.show('Texto copiado!', 'success');
    } catch {
      this.toastService.show('Falha ao copiar texto. Tente novamente.', 'error');
    }
  }

  getEpisodeTitle(episodeId: string): string {
    return this.episodes().find((item) => item.id === episodeId)?.title ?? episodeId;
  }

  getQuestionText(questionId: string): string {
    return this.questions().find((item) => item.id === questionId)?.text ?? questionId;
  }

  private buildMissionCopyText(mission: DailyMission, episode: StoryEpisode, question: Question): string {
    const labels = ['A', 'B', 'C', 'D'] as const;
    const formattedDate = this.toDayMonth(mission.dateKey);
    const options = question.options.map((option, index) => `${labels[index]}) ${option}`).join('\n');

    return `📜 Missão do Dia (${formattedDate})\n\n${episode.title}\n\n❓ ${question.text}\n${options}\n\n🛡️ Responda no app e forje sua armadura.`;
  }

  private toDayMonth(dateKey: string): string {
    const [, month = '', day = ''] = dateKey.split('-');
    return `${day}/${month}`;
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error('Clipboard indisponível.');
    }
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      dateKey: '',
      questionId: '',
      storyEpisodeId: ''
    });
  }
}

import { NgFor, NgIf } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';

import { AuthService } from '../../../../services/auth.service';
import { GameRepository } from '../../../../services/game-repository.service';
import { GameScoringService } from '../../../../services/game-scoring.service';
import { ToastService } from '../../../../services/toast.service';
import { DailyMission, Question, StoryEpisode, UserAnswerByDate } from '../../../../models/firestore.models';
import { MissionCardComponent } from '../../../../shared/components/mission-card/mission-card.component';
import { ScrollPanelComponent } from '../../../../shared/components/scroll-panel/scroll-panel.component';
import { XpTagComponent } from '../../../../shared/components/xp-tag/xp-tag.component';

const MIN_COMMENT_LENGTH = 50;

function minLengthIfNotEmpty(minLength: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (value.length === 0 || value.length >= minLength) {
      return null;
    }

    return { minLengthIfNotEmpty: { requiredLength: minLength, actualLength: value.length } };
  };
}

@Component({
  selector: 'app-today-mission-page',
  imports: [ReactiveFormsModule, NgIf, NgFor, RouterLink, MissionCardComponent, ScrollPanelComponent, XpTagComponent],
  templateUrl: './today-mission-page.html',
  styleUrl: './today-mission-page.css'
})
export class TodayMissionPage {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly gameRepository = inject(GameRepository);
  private readonly gameScoringService = inject(GameScoringService);
  private readonly toastService = inject(ToastService);

  readonly dateKey = this.getLocalDateKey();
  readonly formattedToday = this.formatDateKey(this.dateKey);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly savingComment = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly alreadyAnswered = signal(false);
  readonly submittedNow = signal(false);
  readonly dayXp = signal<number | null>(null);
  readonly selectedTodayIndex = signal<number | null>(null);
  readonly submittedComment = signal('');

  readonly mission = signal<DailyMission | null>(null);
  readonly episode = signal<StoryEpisode | null>(null);
  readonly question = signal<Question | null>(null);
  readonly uid = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    selectedIndex: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(3)]),
    comment: this.fb.nonNullable.control('', [Validators.maxLength(500), minLengthIfNotEmpty(MIN_COMMENT_LENGTH)])
  });

  get missionStatus(): 'active' | 'done' {
    return this.alreadyAnswered() ? 'done' : 'active';
  }

  get maxMissionXp(): number {
    return this.gameScoringService.maxMissionXp;
  }

  get minCommentLength(): number {
    return MIN_COMMENT_LENGTH;
  }

  get canSaveComment(): boolean {
    if (!this.alreadyAnswered()) {
      return false;
    }

    if (this.form.controls.comment.invalid) {
      return false;
    }

    const current = this.form.controls.comment.value.trim();
    const persisted = this.submittedComment().trim();
    return current !== persisted;
  }

  constructor() {
    this.loadTodayMission();
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.alreadyAnswered()) {
      this.form.markAllAsTouched();
      return;
    }

    const userId = this.uid();
    const mission = this.mission();
    const question = this.question();
    if (!userId || !mission || !question) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    try {
      const selectedIndex = Number(this.form.getRawValue().selectedIndex);
      const comment = this.form.getRawValue().comment.trim();
      if (!Number.isInteger(selectedIndex)) {
        this.form.markAllAsTouched();
        return;
      }
      await this.gameRepository.createUserAnswerForMission(userId, mission, selectedIndex, comment);

      const xp = this.gameScoringService.computeXpForMission(question, selectedIndex, comment);

      this.selectedTodayIndex.set(selectedIndex);
      this.submittedComment.set(comment);
      this.dayXp.set(xp);
      this.alreadyAnswered.set(true);
      this.submittedNow.set(true);
      this.toastService.show('✅ Resposta enviada!', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar sua resposta.';
      this.errorMessage.set(message);
    } finally {
      this.submitting.set(false);
    }
  }

  async onSaveComment(): Promise<void> {
    if (!this.alreadyAnswered() || this.form.controls.comment.invalid) {
      this.form.controls.comment.markAsTouched();
      return;
    }

    const userId = this.uid();
    const mission = this.mission();
    const question = this.question();
    const selectedIndex = this.selectedTodayIndex();
    if (!userId || !mission || !question || selectedIndex === null) {
      return;
    }

    const comment = this.form.controls.comment.value.trim();
    if (comment === this.submittedComment().trim()) {
      return;
    }

    this.savingComment.set(true);
    this.errorMessage.set(null);

    try {
      await this.gameRepository.updateUserAnswerComment(userId, mission.id, mission.dateKey, comment);
      this.submittedComment.set(comment);
      this.dayXp.set(this.gameScoringService.computeXpForMission(question, selectedIndex, comment));
      this.toastService.show('✅ Comentário atualizado!', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível atualizar comentário.';
      this.errorMessage.set(message);
    } finally {
      this.savingComment.set(false);
    }
  }

  private loadTodayMission(): void {
    this.authService.user$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((user) => {
          if (!user) {
            this.uid.set(null);
            this.mission.set(null);
            this.episode.set(null);
            this.question.set(null);
            this.alreadyAnswered.set(false);
            this.submittedNow.set(false);
            this.dayXp.set(null);
            this.selectedTodayIndex.set(null);
            this.submittedComment.set('');
            this.loading.set(false);
            return of(null);
          }

          this.uid.set(user.uid);

          return this.gameRepository.getMissionByDateKey(this.dateKey).pipe(
            switchMap((mission) => {
              this.mission.set(mission);

              if (!mission) {
                this.episode.set(null);
                this.question.set(null);
                this.alreadyAnswered.set(false);
                this.submittedNow.set(false);
                this.dayXp.set(null);
                this.selectedTodayIndex.set(null);
                this.submittedComment.set('');
                this.loading.set(false);
                return of(null);
              }

              return combineLatest([
                this.gameRepository.getStoryEpisode(mission.storyEpisodeId),
                this.gameRepository.getQuestion(mission.questionId),
                this.gameRepository.getUserAnswerByDate$(user.uid, this.dateKey)
              ]);
            })
          );
        })
      )
      .subscribe({
        next: (data) => {
          if (data) {
            const [episode, question, todayAnswer] = data as [
              StoryEpisode,
              Question,
              UserAnswerByDate | null
            ];

            this.episode.set(episode);
            this.question.set(question);
            this.alreadyAnswered.set(!!todayAnswer);
            this.submittedNow.set(false);

            if (todayAnswer) {
              this.selectedTodayIndex.set(todayAnswer.selectedIndex);
              this.form.controls.selectedIndex.setValue(todayAnswer.selectedIndex);
              const comment = todayAnswer.comment ?? '';
              this.form.controls.comment.setValue(comment);
              this.submittedComment.set(comment);
              const xp = this.gameScoringService.computeXpForMission(question, todayAnswer.selectedIndex, comment);
              this.dayXp.set(xp);
            } else {
              this.form.controls.selectedIndex.setValue(null);
              this.form.controls.comment.setValue('');
              this.selectedTodayIndex.set(null);
              this.submittedComment.set('');
              this.dayXp.set(null);
            }
          }

          this.loading.set(false);
        },
        error: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'Não foi possível carregar sua missão.';
          this.errorMessage.set(message);
          this.loading.set(false);
        }
      });
  }

  private getLocalDateKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatDateKey(dateKey: string): string {
    const [year, month, day] = dateKey.split('-');
    return `${day}/${month}/${year}`;
  }
}

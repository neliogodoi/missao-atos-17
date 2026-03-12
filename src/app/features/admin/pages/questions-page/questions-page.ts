import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { orderBy, query } from '@angular/fire/firestore';

import { Question } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';

@Component({
  selector: 'app-questions-page',
  imports: [ReactiveFormsModule, AsyncPipe, NgFor, NgIf],
  templateUrl: './questions-page.html',
  styleUrl: './questions-page.css'
})
export class QuestionsPage {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);

  readonly editingId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly questions$ = this.firestoreService.col$<Question>('questions', (ref) =>
    query(ref, orderBy('createdAt', 'desc'))
  );

  readonly form = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.maxLength(500)]],
    option0: ['', Validators.required],
    option1: ['', Validators.required],
    option2: ['', Validators.required],
    option3: ['', Validators.required],
    correctIndex: [1, [Validators.min(1), Validators.max(4)]]
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

    const payload: Omit<Question, 'id' | 'createdAt'> = {
      text: value.text.trim(),
      options: [
        value.option0.trim(),
        value.option1.trim(),
        value.option2.trim(),
        value.option3.trim()
      ],
      correctIndex: value.correctIndex - 1,
      updatedAt: now
    };

    try {
      await this.firestoreService.assertCurrentUserIsAdmin();
      const questionId = this.editingId();
      if (questionId) {
        await this.firestoreService.updateDoc(`questions/${questionId}`, payload);
      } else {
        const id = await this.firestoreService.addDoc('questions', {
          ...payload,
          id: '',
          createdAt: now
        });
        await this.firestoreService.updateDoc(`questions/${id}`, { id });
      }
      this.resetForm();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar question.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  onEdit(question: Question): void {
    this.editingId.set(question.id);
    this.form.setValue({
      text: question.text,
      option0: question.options[0],
      option1: question.options[1],
      option2: question.options[2],
      option3: question.options[3],
      correctIndex: (question.correctIndex ?? 0) + 1
    });
  }

  onCancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      text: '',
      option0: '',
      option1: '',
      option2: '',
      option3: '',
      correctIndex: 1
    });
  }
}

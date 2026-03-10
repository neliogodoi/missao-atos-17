import { Injectable } from '@angular/core';

import { Question } from '../models/firestore.models';

@Injectable({
  providedIn: 'root'
})
export class GameScoringService {
  readonly minCommentLength = 50;
  readonly participationXp = 1;
  readonly correctBonusXp = 2;
  readonly commentBonusXp = 3;

  get maxMissionXp(): number {
    return this.participationXp + this.correctBonusXp + this.commentBonusXp;
  }

  computeXpForMission(question: Question, selectedIndex: number, comment: string): number {
    const correctXp = this.isCorrect(question, selectedIndex) ? this.correctBonusXp : 0;
    const commentXp = this.hasMeaningfulComment(comment) ? this.commentBonusXp : 0;

    return this.participationXp + correctXp + commentXp;
  }

  isCorrect(question: Question, selectedIndex: number): boolean {
    return typeof question.correctIndex === 'number' && question.correctIndex === selectedIndex;
  }

  hasMeaningfulComment(comment: string): boolean {
    return comment.trim().length >= this.minCommentLength;
  }

  getYesterdayDateKey(dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid dateKey: ${dateKey}`);
    }

    date.setDate(date.getDate() - 1);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}

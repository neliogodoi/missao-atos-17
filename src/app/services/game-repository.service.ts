import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  deleteField,
  doc,
  docData,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where
} from '@angular/fire/firestore';
import { Observable, map, of, shareReplay, switchMap, take, tap, throwError } from 'rxjs';

import {
  DailyMission,
  Question,
  Season,
  StoryEpisode,
  UserAnswer,
  UserAnswerByDate
} from '../models/firestore.models';

@Injectable({
  providedIn: 'root'
})
export class GameRepository {
  private readonly firestore = inject(Firestore);
  private readonly missionCache = new Map<string, DailyMission>();
  private readonly questionCache = new Map<string, Question>();
  private readonly storyCache = new Map<string, StoryEpisode>();
  private readonly missionDateCache = new Map<string, string>();

  private readonly missionPending = new Map<string, Observable<DailyMission>>();
  private readonly questionPending = new Map<string, Observable<Question>>();
  private readonly storyPending = new Map<string, Observable<StoryEpisode>>();

  getMissionByDateKey(dateKey: string): Observable<DailyMission | null> {
    const cachedMissionId = this.missionDateCache.get(dateKey);
    if (cachedMissionId) {
      const cachedMission = this.missionCache.get(cachedMissionId);
      if (cachedMission) {
        return of(cachedMission);
      }
    }

    const ref = collection(this.firestore, 'dailyMissions');
    const q = query(ref, where('dateKey', '==', dateKey), limit(1));

    return (collectionData(q) as Observable<DailyMission[]>).pipe(
      take(1),
      tap((missions) => {
        const mission = missions[0];
        if (mission) {
          this.missionCache.set(mission.id, mission);
          this.missionDateCache.set(dateKey, mission.id);
        }
      }),
      map((missions) => missions[0] ?? null)
    );
  }

  getMissionById(missionId: string): Observable<DailyMission> {
    const cached = this.missionCache.get(missionId);
    if (cached) {
      return of(cached);
    }

    const pending = this.missionPending.get(missionId);
    if (pending) {
      return pending;
    }

    const ref = doc(this.firestore, `dailyMissions/${missionId}`);

    const request$ = (docData(ref) as Observable<DailyMission | undefined>).pipe(
      take(1),
      tap((mission) => {
        if (mission) {
          this.missionCache.set(missionId, mission);
          this.missionDateCache.set(mission.dateKey, missionId);
        }
      }),
      switchMap((mission) =>
        mission
          ? of(mission)
          : throwError(() => new Error(`DailyMission not found: ${missionId}`))
      ),
      tap({
        next: () => this.missionPending.delete(missionId),
        error: () => this.missionPending.delete(missionId)
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.missionPending.set(missionId, request$);
    return request$;
  }

  getActiveSeason$(): Observable<Season | null> {
    const ref = collection(this.firestore, 'seasons');
    const q = query(ref, orderBy('createdAt', 'desc'));

    return (collectionData(q) as Observable<Array<Season & { active?: boolean }>>).pipe(
      map((seasons) => seasons.find((season) => season.isActive || season.active) ?? null)
    );
  }

  listSeasons$(): Observable<Season[]> {
    const ref = collection(this.firestore, 'seasons');
    return collectionData(ref) as Observable<Season[]>;
  }

  getQuestion(questionId: string): Observable<Question> {
    const cached = this.questionCache.get(questionId);
    if (cached) {
      return of(cached);
    }

    const pending = this.questionPending.get(questionId);
    if (pending) {
      return pending;
    }

    const ref = doc(this.firestore, `questions/${questionId}`);

    const request$ = (docData(ref) as Observable<Question | undefined>).pipe(
      take(1),
      tap((question) => {
        if (question) {
          this.questionCache.set(questionId, question);
        }
      }),
      switchMap((question) =>
        question
          ? of(question)
          : throwError(() => new Error(`Question not found: ${questionId}`))
      ),
      tap({
        next: () => this.questionPending.delete(questionId),
        error: () => this.questionPending.delete(questionId)
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.questionPending.set(questionId, request$);
    return request$;
  }

  getStoryEpisode(storyEpisodeId: string): Observable<StoryEpisode> {
    const cached = this.storyCache.get(storyEpisodeId);
    if (cached) {
      return of(cached);
    }

    const pending = this.storyPending.get(storyEpisodeId);
    if (pending) {
      return pending;
    }

    const ref = doc(this.firestore, `storyEpisodes/${storyEpisodeId}`);

    const request$ = (docData(ref) as Observable<StoryEpisode | undefined>).pipe(
      take(1),
      tap((episode) => {
        if (episode) {
          this.storyCache.set(storyEpisodeId, episode);
        }
      }),
      switchMap((episode) =>
        episode
          ? of(episode)
          : throwError(() => new Error(`StoryEpisode not found: ${storyEpisodeId}`))
      ),
      tap({
        next: () => this.storyPending.delete(storyEpisodeId),
        error: () => this.storyPending.delete(storyEpisodeId)
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.storyPending.set(storyEpisodeId, request$);
    return request$;
  }

  getUserAnswer$(uid: string, missionId: string): Observable<UserAnswer | null> {
    const ref = doc(this.firestore, `users/${uid}/answers/${missionId}`);

    return (docData(ref) as Observable<UserAnswer | undefined>).pipe(
      map((answer) => answer ?? null)
    );
  }

  getUserAnswerByDate$(uid: string, dateKey: string): Observable<UserAnswerByDate | null> {
    const ref = doc(this.firestore, `users/${uid}/answersByDate/${dateKey}`);

    return (docData(ref) as Observable<UserAnswerByDate | undefined>).pipe(
      map((answer) => answer ?? null)
    );
  }

  createUserAnswerForMission(
    uid: string,
    mission: DailyMission,
    selectedIndex: number,
    comment: string
  ): Promise<void> {
    const byMissionRef = doc(this.firestore, `users/${uid}/answers/${mission.id}`);
    const byDateRef = doc(this.firestore, `users/${uid}/answersByDate/${mission.dateKey}`);
    const normalizedComment = comment.trim();

    return runTransaction(this.firestore, async (transaction) => {
      const [byMissionSnap, byDateSnap] = await Promise.all([
        transaction.get(byMissionRef),
        transaction.get(byDateRef)
      ]);

      if (byMissionSnap.exists() || byDateSnap.exists()) {
        throw new Error('Você já respondeu hoje.');
      }

      const byMissionPayload: {
        missionId: string;
        dateKey: string;
        selectedIndex: number;
        comment?: string;
        createdAt: ReturnType<typeof serverTimestamp>;
      } = {
        missionId: mission.id,
        dateKey: mission.dateKey,
        selectedIndex,
        createdAt: serverTimestamp()
      };
      const byDatePayload: {
        dateKey: string;
        missionId: string;
        selectedIndex: number;
        comment?: string;
        createdAt: ReturnType<typeof serverTimestamp>;
      } = {
        dateKey: mission.dateKey,
        missionId: mission.id,
        selectedIndex,
        createdAt: serverTimestamp()
      };

      if (normalizedComment.length > 0) {
        byMissionPayload.comment = normalizedComment;
        byDatePayload.comment = normalizedComment;
      }

      transaction.set(byMissionRef, byMissionPayload);
      transaction.set(byDateRef, byDatePayload);
    });
  }

  updateUserAnswerComment(
    uid: string,
    missionId: string,
    dateKey: string,
    comment: string
  ): Promise<void> {
    const byMissionRef = doc(this.firestore, `users/${uid}/answers/${missionId}`);
    const byDateRef = doc(this.firestore, `users/${uid}/answersByDate/${dateKey}`);
    const normalizedComment = comment.trim();

    return runTransaction(this.firestore, async (transaction) => {
      const [byMissionSnap, byDateSnap] = await Promise.all([
        transaction.get(byMissionRef),
        transaction.get(byDateRef)
      ]);

      if (!byMissionSnap.exists() || !byDateSnap.exists()) {
        throw new Error('Resposta do dia não encontrada para atualizar comentário.');
      }

      if (normalizedComment.length > 0) {
        transaction.update(byMissionRef, { comment: normalizedComment });
        transaction.update(byDateRef, { comment: normalizedComment });
      } else {
        transaction.update(byMissionRef, { comment: deleteField() });
        transaction.update(byDateRef, { comment: deleteField() });
      }
    });
  }

  listUserAnswersInRange(uid: string, startDateKey: string, endDateKey: string): Observable<UserAnswer[]> {
    const ref = collection(this.firestore, `users/${uid}/answersByDate`);
    const q = query(
      ref,
      where('dateKey', '>=', startDateKey),
      where('dateKey', '<=', endDateKey),
      orderBy('dateKey', 'asc')
    );

    return (collectionData(q) as Observable<UserAnswerByDate[]>).pipe(
      map((answers) =>
        answers.map((answer) => ({
          missionId: answer.missionId,
          dateKey: answer.dateKey,
          selectedIndex: answer.selectedIndex,
          comment: answer.comment ?? '',
          createdAt: answer.createdAt?.toDate?.().toISOString?.() ?? ''
        }))
      )
    );
  }

  listUserAnswers(uid: string): Observable<UserAnswer[]> {
    const ref = collection(this.firestore, `users/${uid}/answersByDate`);
    const q = query(ref, orderBy('dateKey', 'asc'));

    return (collectionData(q) as Observable<UserAnswerByDate[]>).pipe(
      map((answers) =>
        answers.map((answer) => ({
          missionId: answer.missionId,
          dateKey: answer.dateKey,
          selectedIndex: answer.selectedIndex,
          comment: answer.comment ?? '',
          createdAt: answer.createdAt?.toDate?.().toISOString?.() ?? ''
        }))
      )
    );
  }

  listMissionsInRange(startDateKey: string, endDateKey: string): Observable<DailyMission[]> {
    const ref = collection(this.firestore, 'dailyMissions');
    const q = query(
      ref,
      where('dateKey', '>=', startDateKey),
      where('dateKey', '<=', endDateKey),
      orderBy('dateKey', 'asc')
    );

    return collectionData(q) as Observable<DailyMission[]>;
  }
}

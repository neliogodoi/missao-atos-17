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
  RetroAccess,
  Season,
  StoryEpisode,
  UserRole,
  UserAnswer,
  UserAnswerByDate
} from '../models/firestore.models';
import { GameScoringService } from './game-scoring.service';

@Injectable({
  providedIn: 'root'
})
export class GameRepository {
  private readonly firestore = inject(Firestore);
  private readonly gameScoringService = inject(GameScoringService);
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

  getRetroAccess$(uid: string): Observable<RetroAccess | null> {
    const ref = doc(this.firestore, `retroAccess/${uid}`);
    return (docData(ref) as Observable<RetroAccess | undefined>).pipe(
      map((access) => access ?? null)
    );
  }

  canAccessMissionDate$(uid: string, requestedDateKey: string, todayDateKey: string): Observable<boolean> {
    if (requestedDateKey >= todayDateKey) {
      return of(true);
    }

    return this.getRetroAccess$(uid).pipe(
      take(1),
      map((access) => {
        if (!access || !access.enabled) {
          return false;
        }

        if (access.allowAllRetro) {
          return true;
        }

        const allowedDateKeys = access.allowedDateKeys ?? [];
        return allowedDateKeys.includes(requestedDateKey);
      })
    );
  }

  createUserAnswerForMission(
    uid: string,
    mission: DailyMission,
    selectedIndex: number,
    comment: string
  ): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    const userStatsRef = doc(this.firestore, `userStats/${uid}`);
    const questionRef = doc(this.firestore, `questions/${mission.questionId}`);
    const byMissionRef = doc(this.firestore, `users/${uid}/answers/${mission.id}`);
    const byDateRef = doc(this.firestore, `users/${uid}/answersByDate/${mission.dateKey}`);
    const normalizedComment = comment.trim();

    return runTransaction(this.firestore, async (transaction) => {
      const [userSnap, userStatsSnap, questionSnap, byMissionSnap, byDateSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(userStatsRef),
        transaction.get(questionRef),
        transaction.get(byMissionRef),
        transaction.get(byDateRef)
      ]);

      if (byMissionSnap.exists() || byDateSnap.exists()) {
        throw new Error('Você já respondeu hoje.');
      }
      if (!userSnap.exists()) {
        throw new Error('Usuário não encontrado.');
      }
      if (!questionSnap.exists()) {
        throw new Error('Pergunta da missão não encontrada.');
      }

      const question = questionSnap.data() as Question;
      const xpEarned = this.gameScoringService.computeXpForMission(question, selectedIndex, normalizedComment);
      const previousStats = userStatsSnap.exists()
        ? this.parseUserStats(userStatsSnap.data() as Record<string, unknown>)
        : null;
      const previousTotalXp = previousStats?.totalXp ?? 0;
      const previousStreak = previousStats?.streak ?? 0;
      const previousLastAnswerDateKey = previousStats?.lastAnswerDateKey ?? '';
      const role = this.parseUserRole((userSnap.data() as Record<string, unknown>)['role']);
      const displayName = this.parseString((userSnap.data() as Record<string, unknown>)['displayName']);
      const photoURL = this.parseString((userSnap.data() as Record<string, unknown>)['photoURL']);

      const { nextStreak, nextLastAnswerDateKey } = this.computeStreakAfterAnswer({
        previousStreak,
        previousLastAnswerDateKey,
        missionDateKey: mission.dateKey
      });

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
      if (userStatsSnap.exists()) {
        transaction.update(userStatsRef, {
          totalXp: previousTotalXp + xpEarned,
          streak: nextStreak,
          lastAnswerDateKey: nextLastAnswerDateKey,
          updatedAt: serverTimestamp()
        });
      } else {
        transaction.set(userStatsRef, {
          userId: uid,
          role,
          displayName,
          photoURL,
          totalXp: xpEarned,
          streak: 1,
          lastAnswerDateKey: mission.dateKey,
          updatedAt: serverTimestamp()
        });
      }
    });
  }

  updateUserAnswerComment(
    uid: string,
    missionId: string,
    dateKey: string,
    comment: string
  ): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    const userStatsRef = doc(this.firestore, `userStats/${uid}`);
    const byMissionRef = doc(this.firestore, `users/${uid}/answers/${missionId}`);
    const byDateRef = doc(this.firestore, `users/${uid}/answersByDate/${dateKey}`);
    const normalizedComment = comment.trim();

    return runTransaction(this.firestore, async (transaction) => {
      const [userSnap, userStatsSnap, byMissionSnap, byDateSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(userStatsRef),
        transaction.get(byMissionRef),
        transaction.get(byDateRef)
      ]);

      if (!byMissionSnap.exists() || !byDateSnap.exists()) {
        throw new Error('Resposta do dia não encontrada para atualizar comentário.');
      }
      if (!userSnap.exists()) {
        throw new Error('Usuário não encontrado.');
      }

      const byMissionData = byMissionSnap.data() as Record<string, unknown>;
      const currentSelectedIndex = Number(byMissionData['selectedIndex']);
      const currentDateKey = this.parseString(byMissionData['dateKey']);
      const currentMissionId = this.parseString(byMissionData['missionId']);
      const previousComment = this.parseString(byMissionData['comment']);
      if (!Number.isInteger(currentSelectedIndex)) {
        throw new Error('Resposta inválida para atualizar comentário.');
      }
      const missionRef = doc(this.firestore, `dailyMissions/${currentMissionId}`);
      const missionSnap = await transaction.get(missionRef);
      if (!missionSnap.exists()) {
        throw new Error('Missão não encontrada para atualizar comentário.');
      }
      const missionData = missionSnap.data() as DailyMission;
      const questionRef = doc(this.firestore, `questions/${missionData.questionId}`);
      const questionSnap = await transaction.get(questionRef);
      if (!questionSnap.exists()) {
        throw new Error('Pergunta não encontrada para atualizar comentário.');
      }
      const question = questionSnap.data() as Question;
      const previousXp = this.gameScoringService.computeXpForMission(question, currentSelectedIndex, previousComment);
      const nextXp = this.gameScoringService.computeXpForMission(question, currentSelectedIndex, normalizedComment);
      const xpDelta = nextXp - previousXp;

      const previousStats = userStatsSnap.exists()
        ? this.parseUserStats(userStatsSnap.data() as Record<string, unknown>)
        : null;
      const currentTotalXp = previousStats?.totalXp ?? 0;
      const role = this.parseUserRole((userSnap.data() as Record<string, unknown>)['role']);
      const displayName = this.parseString((userSnap.data() as Record<string, unknown>)['displayName']);
      const photoURL = this.parseString((userSnap.data() as Record<string, unknown>)['photoURL']);

      if (normalizedComment.length > 0) {
        transaction.update(byMissionRef, { comment: normalizedComment });
        transaction.update(byDateRef, { comment: normalizedComment });
      } else {
        transaction.update(byMissionRef, { comment: deleteField() });
        transaction.update(byDateRef, { comment: deleteField() });
      }

      if (xpDelta !== 0 || !userStatsSnap.exists()) {
        if (userStatsSnap.exists()) {
          transaction.update(userStatsRef, {
            totalXp: Math.max(0, currentTotalXp + xpDelta),
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.set(userStatsRef, {
            userId: uid,
            role,
            displayName,
            photoURL,
            totalXp: Math.max(0, xpDelta),
            streak: 0,
            lastAnswerDateKey: currentDateKey,
            updatedAt: serverTimestamp()
          });
        }
      }
    });
  }

  private parseString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private parseUserRole(value: unknown): UserRole {
    return typeof value === 'string' && value.trim().toLowerCase() === 'admin'
      ? 'admin'
      : 'player';
  }

  private parseUserStats(
    value: Record<string, unknown>
  ): { totalXp: number; streak: number; lastAnswerDateKey: string } {
    const totalXp = typeof value['totalXp'] === 'number' ? Math.max(0, value['totalXp']) : 0;
    const streak = typeof value['streak'] === 'number' ? Math.max(0, value['streak']) : 0;
    const lastAnswerDateKey = this.parseString(value['lastAnswerDateKey']);
    return { totalXp, streak, lastAnswerDateKey };
  }

  private computeStreakAfterAnswer(args: {
    previousStreak: number;
    previousLastAnswerDateKey: string;
    missionDateKey: string;
  }): { nextStreak: number; nextLastAnswerDateKey: string } {
    const { previousStreak, previousLastAnswerDateKey, missionDateKey } = args;

    if (!previousLastAnswerDateKey) {
      return { nextStreak: 1, nextLastAnswerDateKey: missionDateKey };
    }

    if (missionDateKey < previousLastAnswerDateKey) {
      // Retro answer should not reset or increment the current streak chain.
      return {
        nextStreak: previousStreak,
        nextLastAnswerDateKey: previousLastAnswerDateKey
      };
    }

    if (missionDateKey === previousLastAnswerDateKey) {
      return {
        nextStreak: previousStreak,
        nextLastAnswerDateKey: previousLastAnswerDateKey
      };
    }

    const yesterdayOfMission = this.gameScoringService.getYesterdayDateKey(missionDateKey);
    if (yesterdayOfMission === previousLastAnswerDateKey) {
      return {
        nextStreak: previousStreak + 1,
        nextLastAnswerDateKey: missionDateKey
      };
    }

    return {
      nextStreak: 1,
      nextLastAnswerDateKey: missionDateKey
    };
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

import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { limit, orderBy, query } from '@angular/fire/firestore';

import { UserStats } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';

@Component({
  selector: 'app-leaderboard-page',
  imports: [AsyncPipe, NgFor, NgIf],
  templateUrl: './leaderboard-page.html',
  styleUrl: './leaderboard-page.css'
})
export class LeaderboardPage {
  private readonly firestoreService = inject(FirestoreService);

  readonly topUsers$ = this.firestoreService.col$<UserStats>('userStats', (ref) =>
    query(ref, orderBy('totalXp', 'desc'), limit(20))
  );
}

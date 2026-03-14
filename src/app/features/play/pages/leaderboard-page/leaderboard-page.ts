import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { limit, orderBy, query } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

import { UserStats } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';
import { XpTagComponent } from '../../../../shared/components/xp-tag/xp-tag.component';

@Component({
  selector: 'app-leaderboard-page',
  imports: [AsyncPipe, NgFor, NgIf, XpTagComponent],
  templateUrl: './leaderboard-page.html',
  styleUrl: './leaderboard-page.css'
})
export class LeaderboardPage {
  private readonly firestoreService = inject(FirestoreService);

  readonly topUsers$ = this.firestoreService
    .col$<UserStats>('userStats', (ref) => query(ref, orderBy('streak', 'desc'), limit(500)))
    .pipe(
      map((users) =>
        [...users]
          .sort((a, b) =>
            ((b.streak ?? 0) - (a.streak ?? 0))
            || (b.totalXp - a.totalXp)
            || this.getSortName(a).localeCompare(this.getSortName(b), 'pt-BR')
          )
      )
    );

  private getSortName(user: UserStats): string {
    return (user.displayName || user.userId || '').trim().toLowerCase();
  }
}

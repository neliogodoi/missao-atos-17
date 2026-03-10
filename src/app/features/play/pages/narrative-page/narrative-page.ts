import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { orderBy, query } from '@angular/fire/firestore';

import { StoryEpisode } from '../../../../models/firestore.models';
import { FirestoreService } from '../../../../services/firestore.service';
import { MissionCardComponent } from '../../../../shared/components/mission-card/mission-card.component';

@Component({
  selector: 'app-narrative-page',
  imports: [AsyncPipe, NgFor, NgIf, RouterLink, MissionCardComponent, DatePipe],
  templateUrl: './narrative-page.html',
  styleUrl: './narrative-page.css'
})
export class NarrativePage {
  private readonly firestoreService = inject(FirestoreService);

  readonly episodes$ = this.firestoreService.col$<StoryEpisode>('storyEpisodes', (ref) =>
    query(ref, orderBy('createdAt', 'asc'))
  );
}

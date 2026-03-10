import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map, of, switchMap } from 'rxjs';

import { UserArmorItem } from '../../../../models/firestore.models';
import { AuthService } from '../../../../services/auth.service';
import { FirestoreService } from '../../../../services/firestore.service';

@Component({
  selector: 'app-armor-page',
  imports: [AsyncPipe, NgIf, NgFor],
  templateUrl: './armor-page.html',
  styleUrl: './armor-page.css'
})
export class ArmorPage {
  private readonly authService = inject(AuthService);
  private readonly firestoreService = inject(FirestoreService);

  readonly armorItems$ = this.authService.user$.pipe(
    switchMap((user) => {
      if (!user) {
        return of([] as UserArmorItem[]);
      }

      return this.firestoreService.col$<UserArmorItem>(`userArmor/${user.uid}/items`).pipe(
        map((items) => [...items].sort((a, b) => b.level - a.level || b.xp - a.xp))
      );
    })
  );
}

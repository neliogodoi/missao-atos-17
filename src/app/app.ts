import { Component, inject, signal } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { AuthService } from './services/auth.service';
import { FirestoreService } from './services/firestore.service';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';

interface ProfileVm {
  displayName: string;
  photoURL: string;
  role: 'admin' | 'player';
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastHostComponent, AsyncPipe, NgIf, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly firestoreService = inject(FirestoreService);

  readonly user$ = this.authService.user$;
  readonly profileImageFailed = signal(false);
  readonly profile$ = this.user$.pipe(
    switchMap((user) => {
      if (!user) {
        this.profileImageFailed.set(false);
        return of<ProfileVm | null>(null);
      }

      const providerPhoto =
        user.providerData.find((provider) => provider.providerId === 'google.com')?.photoURL ??
        user.providerData[0]?.photoURL ??
        '';

      return this.firestoreService
        .doc$<{ displayName?: string; photoURL?: string; role?: 'admin' | 'player' }>(`users/${user.uid}`)
        .pipe(
        map((userDoc) => ({
          displayName: userDoc?.displayName || user.displayName || 'Usuário',
          photoURL: userDoc?.photoURL || user.photoURL || providerPhoto || '',
          role: userDoc?.role === 'admin' ? 'admin' : 'player'
        })),
        catchError(() =>
          of({
            displayName: user.displayName || 'Usuário',
            photoURL: user.photoURL || providerPhoto || '',
            role: 'player' as const
          })
        ),
        tap(() => this.profileImageFailed.set(false))
      );
    })
  );

  onProfileImageError(): void {
    this.profileImageFailed.set(true);
  }

  async onLogout(): Promise<void> {
    await this.authService.logout();
  }
}

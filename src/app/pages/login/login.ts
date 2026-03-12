import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter } from 'rxjs';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [NgIf],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly firestore = inject(Firestore);

  readonly authService = inject(AuthService);
  readonly errorMessage = signal<string | null>(null);
  readonly loading = signal(false);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const message = params.get('message');
      if (message) {
        this.errorMessage.set(message);
      }
    });

    this.authService.user$
      .pipe(
        filter((user): user is User => user !== null),
        distinctUntilChanged((prev, curr) => prev.uid === curr.uid),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((user) => {
        void this.redirectAuthenticatedUser(user).catch(() => {
          this.errorMessage.set('Não foi possível concluir seu login. Tente novamente.');
          this.loading.set(false);
        });
      });
  }

  async onLoginWithGoogle(): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);

    try {
      await this.authService.loginWithGoogle();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível entrar com Google.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  private async redirectAuthenticatedUser(user: User): Promise<void> {
    await this.authService.ensureUserProfile(user);

    const userRef = doc(this.firestore, `users/${user.uid}`);
    const userSnapshot = await getDoc(userRef);
    const role = userSnapshot.data()?.['role'];

    await this.router.navigateByUrl(role === 'admin' ? '/admin' : '/play');
  }
}

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, filter } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { AuthErrorLoggerService } from '../../services/auth-error-logger.service';

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
  private readonly authErrorLogger = inject(AuthErrorLoggerService);

  readonly authService = inject(AuthService);
  readonly errorMessage = signal<string | null>(null);
  readonly loading = signal(false);
  readonly email = signal('');
  readonly password = signal('');

  constructor() {
    void this.completeRedirectLoginFlow();

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
        void this.redirectAuthenticatedUser(user).catch((error: unknown) => {
          void this.authErrorLogger
            .logAuthError(error, 'post-auth-redirect')
            .catch((logError) => console.error('Falha ao registrar log de auth:', logError));
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
      void this.authErrorLogger
        .logAuthError(error, 'google-login')
        .catch((logError) => console.error('Falha ao registrar log de auth:', logError));
      const message = error instanceof Error ? error.message : 'Não foi possível entrar com Google.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  async onLoginWithEmail(): Promise<void> {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.errorMessage.set('Preencha email e senha.');
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    try {
      await this.authService.loginWithEmail(email, password);
    } catch (error: unknown) {
      void this.authErrorLogger
        .logAuthError(error, 'email-login')
        .catch((logError) => console.error('Falha ao registrar log de auth:', logError));
      const message = error instanceof Error ? error.message : 'Não foi possível entrar com email e senha.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  async onRegisterWithEmail(): Promise<void> {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.errorMessage.set('Preencha email e senha.');
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    try {
      await this.authService.registerWithEmail(email, password);
    } catch (error: unknown) {
      void this.authErrorLogger
        .logAuthError(error, 'email-register')
        .catch((logError) => console.error('Falha ao registrar log de auth:', logError));
      const message = error instanceof Error ? error.message : 'Não foi possível criar conta com email e senha.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  private async completeRedirectLoginFlow(): Promise<void> {
    try {
      await this.authService.completeRedirectLogin();
    } catch (error: unknown) {
      void this.authErrorLogger
        .logAuthError(error, 'google-login-redirect')
        .catch((logError) => console.error('Falha ao registrar log de auth:', logError));
      const message = error instanceof Error ? error.message : 'Não foi possível entrar com Google.';
      this.errorMessage.set(message);
      this.loading.set(false);
    }
  }

  onEmailInput(value: string): void {
    this.email.set(value);
  }

  onPasswordInput(value: string): void {
    this.password.set(value);
  }

  private async redirectAuthenticatedUser(user: User): Promise<void> {
    await this.authService.ensureUserProfile(user);

    const userRef = doc(this.firestore, `users/${user.uid}`);
    const userSnapshot = await getDoc(userRef);
    const role = userSnapshot.data()?.['role'];

    await this.router.navigateByUrl(role === 'admin' ? '/admin' : '/play');
  }
}

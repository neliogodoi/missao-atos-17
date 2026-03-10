import { Component, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';

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
  }

  async onLoginWithGoogle(): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);

    try {
      const credential = await this.authService.loginWithGoogle();
      const userRef = doc(this.firestore, `users/${credential.user.uid}`);
      const userSnapshot = await getDoc(userRef);
      const role = userSnapshot.data()?.['role'];

      await this.router.navigateByUrl(role === 'admin' ? '/admin' : '/play');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Não foi possível entrar com Google.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}

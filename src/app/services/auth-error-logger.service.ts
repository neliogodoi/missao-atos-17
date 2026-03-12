import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, addDoc, collection, serverTimestamp } from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';

@Injectable({
  providedIn: 'root'
})
export class AuthErrorLoggerService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  async logGoogleLoginError(error: unknown): Promise<void> {
    const code = this.extractCode(error);
    const message = this.extractMessage(error);

    await addDoc(collection(this.firestore, 'authClientLogs'), {
      context: 'google-login',
      errorCode: code,
      errorMessage: message.slice(0, 500),
      host: window.location.host.slice(0, 255),
      path: window.location.pathname.slice(0, 255),
      userAgent: navigator.userAgent.slice(0, 500),
      language: (navigator.language ?? '').slice(0, 32),
      authUid: (this.auth.currentUser?.uid ?? '').slice(0, 128),
      createdAt: serverTimestamp()
    });
  }

  private extractCode(error: unknown): string {
    if (error instanceof FirebaseError) {
      return error.code.slice(0, 120);
    }

    if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
      return error.code.slice(0, 120);
    }

    return 'unknown';
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Erro desconhecido no login Google';
  }
}

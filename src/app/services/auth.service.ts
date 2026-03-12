import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly googleProvider = new GoogleAuthProvider();

  readonly user$: Observable<User | null> = authState(this.auth);

  async loginWithGoogle(): Promise<void> {
    try {
      const credential = await signInWithPopup(this.auth, this.googleProvider);
      await this.ensureUserDoc(credential.user);
    } catch (error: unknown) {
      if (this.shouldUseRedirectFallback(error)) {
        await signInWithRedirect(this.auth, this.googleProvider);
        return;
      }

      throw this.mapGoogleLoginError(error);
    }
  }

  async loginWithEmail(email: string, password: string): Promise<void> {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      await this.ensureUserDoc(credential.user);
    } catch (error: unknown) {
      throw this.mapEmailAuthError(error);
    }
  }

  async registerWithEmail(email: string, password: string): Promise<void> {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      await this.ensureUserDoc(credential.user);
    } catch (error: unknown) {
      throw this.mapEmailAuthError(error);
    }
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  async completeRedirectLogin(): Promise<void> {
    try {
      const credential = await getRedirectResult(this.auth);
      if (credential?.user) {
        await this.ensureUserDoc(credential.user);
      }
    } catch (error: unknown) {
      throw this.mapGoogleLoginError(error);
    }
  }

  ensureUserProfile(user: User): Promise<void> {
    return this.ensureUserDoc(user);
  }

  private async ensureUserDoc(user: User): Promise<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    const userSnapshot = await getDoc(userRef);

    const displayName = user.displayName ?? '';
    const photoURL = user.photoURL ?? '';
    const role = 'player' as const;

    if (!userSnapshot.exists()) {
      await setDoc(userRef, {
        displayName,
        photoURL,
        role
      });
    }
  }

  private mapGoogleLoginError(error: unknown): Error {
    if (!(error instanceof FirebaseError)) {
      return new Error('Não foi possível entrar com Google. Tente novamente.');
    }

    const mapped = new Error(this.mapGoogleLoginMessage(error.code)) as Error & { code?: string };
    mapped.code = error.code;
    return mapped;
  }

  private mapEmailAuthError(error: unknown): Error {
    if (!(error instanceof FirebaseError)) {
      return new Error('Não foi possível autenticar com email e senha. Tente novamente.');
    }

    const mapped = new Error(this.mapEmailAuthMessage(error.code)) as Error & { code?: string };
    mapped.code = error.code;
    return mapped;
  }

  private mapGoogleLoginMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/popup-closed-by-user':
        return 'Login cancelado: a janela de autenticação foi fechada.';
      case 'auth/popup-blocked':
        return 'O navegador bloqueou o popup. Permita popups e tente novamente.';
      case 'auth/cancelled-popup-request':
        return 'Solicitação de login cancelada. Tente novamente.';
      case 'auth/network-request-failed':
        return 'Falha de rede ao autenticar. Verifique sua conexão e tente novamente.';
      case 'auth/unauthorized-domain':
        return 'Domínio não autorizado no Firebase Auth para login com Google.';
      default:
        return 'Não foi possível entrar com Google. Tente novamente.';
    }
  }

  private mapEmailAuthMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Email inválido.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email ou senha inválidos.';
      case 'auth/email-already-in-use':
        return 'Este email já está em uso.';
      case 'auth/weak-password':
        return 'A senha deve ter no mínimo 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde e tente novamente.';
      case 'auth/network-request-failed':
        return 'Falha de rede ao autenticar. Verifique sua conexão e tente novamente.';
      default:
        return 'Não foi possível autenticar com email e senha. Tente novamente.';
    }
  }

  private shouldUseRedirectFallback(error: unknown): boolean {
    return error instanceof FirebaseError
      && (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment');
  }
}

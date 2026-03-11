import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  UserCredential,
  authState,
  signInWithPopup,
  signOut
} from '@angular/fire/auth';
import { Firestore, doc, getDoc, serverTimestamp, setDoc } from '@angular/fire/firestore';
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

  async loginWithGoogle(): Promise<UserCredential> {
    try {
      const credential = await signInWithPopup(this.auth, this.googleProvider);
      await this.ensureUserDocAndStats(credential.user);
      return credential;
    } catch (error: unknown) {
      throw this.mapGoogleLoginError(error);
    }
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  private async ensureUserDocAndStats(user: User): Promise<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    const userStatsRef = doc(this.firestore, `userStats/${user.uid}`);
    const userSnapshot = await getDoc(userRef);
    const userStatsSnapshot = await getDoc(userStatsRef);

    const displayName = user.displayName ?? '';
    const photoURL = user.photoURL ?? '';
    const existingRole = userSnapshot.exists() ? userSnapshot.data()?.['role'] : null;
    const role = existingRole === 'admin' ? 'admin' : 'player';

    if (!userSnapshot.exists()) {
      await setDoc(userRef, {
        displayName,
        photoURL,
        role
      });
    }

    if (!userStatsSnapshot.exists()) {
      await setDoc(userStatsRef, {
        userId: user.uid,
        role,
        displayName,
        photoURL,
        totalXp: 0,
        streak: 0,
        updatedAt: serverTimestamp()
      });
    }
  }

  private mapGoogleLoginError(error: unknown): Error {
    if (!(error instanceof FirebaseError)) {
      return new Error('Não foi possível entrar com Google. Tente novamente.');
    }

    switch (error.code) {
      case 'auth/popup-closed-by-user':
        return new Error('Login cancelado: a janela de autenticação foi fechada.');
      case 'auth/popup-blocked':
        return new Error('O navegador bloqueou o popup. Permita popups e tente novamente.');
      case 'auth/cancelled-popup-request':
        return new Error('Solicitação de login cancelada. Tente novamente.');
      case 'auth/network-request-failed':
        return new Error('Falha de rede ao autenticar. Verifique sua conexão e tente novamente.');
      default:
        return new Error('Não foi possível entrar com Google. Tente novamente.');
    }
  }
}

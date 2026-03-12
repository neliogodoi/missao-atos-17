import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  addDoc as addFirestoreDoc,
  collection,
  collectionData,
  deleteDoc as deleteFirestoreDoc,
  doc,
  docData,
  getDoc,
  getDocFromServer,
  setDoc as setFirestoreDoc,
  updateDoc as updateFirestoreDoc
} from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';
import { Observable } from 'rxjs';

export type QueryFn<T extends DocumentData = DocumentData> = (
  ref: CollectionReference<T>
) => Query<T>;

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  doc$<T = DocumentData>(path: string): Observable<T | undefined> {
    const ref = doc(this.firestore, path);
    return docData(ref) as Observable<T | undefined>;
  }

  col$<T extends DocumentData = DocumentData>(path: string, queryFn?: QueryFn<T>): Observable<T[]> {
    const ref = collection(this.firestore, path) as CollectionReference<T>;
    const target = queryFn ? queryFn(ref) : ref;
    return collectionData(target) as Observable<T[]>;
  }

  async setDoc(path: string, data: DocumentData): Promise<void> {
    const ref = doc(this.firestore, path);
    try {
      await setFirestoreDoc(ref, data);
    } catch (error: unknown) {
      throw this.mapFirestoreError(error);
    }
  }

  async addDoc(path: string, data: DocumentData): Promise<string> {
    const ref = collection(this.firestore, path);
    try {
      const result = await addFirestoreDoc(ref, data);
      return result.id;
    } catch (error: unknown) {
      throw this.mapFirestoreError(error);
    }
  }

  async updateDoc(path: string, data: DocumentData): Promise<void> {
    const ref = doc(this.firestore, path);
    try {
      await updateFirestoreDoc(ref, data);
    } catch (error: unknown) {
      throw this.mapFirestoreError(error);
    }
  }

  async deleteDoc(path: string): Promise<void> {
    const ref = doc(this.firestore, path);
    try {
      await deleteFirestoreDoc(ref);
    } catch (error: unknown) {
      throw this.mapFirestoreError(error);
    }
  }

  async assertCurrentUserIsAdmin(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const userRef = doc(this.firestore, `users/${user.uid}`);
    const [serverSnap, fallbackSnap] = await Promise.allSettled([getDocFromServer(userRef), getDoc(userRef)]);

    const snapshot = serverSnap.status === 'fulfilled'
      ? serverSnap.value
      : (fallbackSnap.status === 'fulfilled' ? fallbackSnap.value : null);
    const role = snapshot?.data()?.['role'];

    if (role !== 'admin') {
      throw new Error(`Permissão de admin ausente para UID ${user.uid}. role atual: ${String(role ?? 'undefined')}.`);
    }
  }

  private mapFirestoreError(error: unknown): Error {
    if (error instanceof FirebaseError && error.code === 'permission-denied') {
      const uid = this.auth.currentUser?.uid ?? 'desconhecido';
      return new Error(`Permissão negada no Firestore para UID ${uid}. Verifique role=admin em users/${uid}.`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Erro inesperado no Firestore.');
  }
}

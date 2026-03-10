import { Injectable, inject } from '@angular/core';
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
  setDoc as setFirestoreDoc,
  updateDoc as updateFirestoreDoc
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export type QueryFn<T extends DocumentData = DocumentData> = (
  ref: CollectionReference<T>
) => Query<T>;

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private readonly firestore = inject(Firestore);

  doc$<T = DocumentData>(path: string): Observable<T | undefined> {
    const ref = doc(this.firestore, path);
    return docData(ref) as Observable<T | undefined>;
  }

  col$<T extends DocumentData = DocumentData>(path: string, queryFn?: QueryFn<T>): Observable<T[]> {
    const ref = collection(this.firestore, path) as CollectionReference<T>;
    const target = queryFn ? queryFn(ref) : ref;
    return collectionData(target) as Observable<T[]>;
  }

  setDoc(path: string, data: DocumentData): Promise<void> {
    const ref = doc(this.firestore, path);
    return setFirestoreDoc(ref, data);
  }

  async addDoc(path: string, data: DocumentData): Promise<string> {
    const ref = collection(this.firestore, path);
    const result = await addFirestoreDoc(ref, data);
    return result.id;
  }

  updateDoc(path: string, data: DocumentData): Promise<void> {
    const ref = doc(this.firestore, path);
    return updateFirestoreDoc(ref, data);
  }

  deleteDoc(path: string): Promise<void> {
    const ref = doc(this.firestore, path);
    return deleteFirestoreDoc(ref);
  }
}

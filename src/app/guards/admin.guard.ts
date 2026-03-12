import { inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { CanActivateFn, Router } from '@angular/router';
import { from, map, of, switchMap, take } from 'rxjs';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) {
        return of(router.createUrlTree(['/login']));
      }

      return from(getDoc(doc(firestore, `users/${user.uid}`))).pipe(
        map((snapshot) => {
          const role = snapshot.data()?.['role'];
          const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
          return normalizedRole === 'admin' ? true : router.createUrlTree(['/play']);
        })
      );
    })
  );
};

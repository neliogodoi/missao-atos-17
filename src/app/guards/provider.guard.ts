import { inject } from '@angular/core';
import { Auth, authState, signOut } from '@angular/fire/auth';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, from, map, of, switchMap, take } from 'rxjs';

const PROVIDER_BLOCK_MESSAGE = 'Apenas login com Google é permitido.';

export const providerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) {
        return of(router.createUrlTree(['/login']));
      }

      const isGoogleProvider = user.providerData.some((provider) => provider.providerId === 'google.com');
      if (isGoogleProvider) {
        return of(true);
      }

      return from(signOut(auth)).pipe(
        map(() =>
          router.createUrlTree(['/login'], {
            queryParams: { message: PROVIDER_BLOCK_MESSAGE }
          })
        ),
        catchError(() =>
          of(
            router.createUrlTree(['/login'], {
              queryParams: { message: PROVIDER_BLOCK_MESSAGE }
            })
          )
        )
      );
    })
  );
};

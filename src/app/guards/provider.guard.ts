import { inject } from '@angular/core';
import { Auth, authState, signOut } from '@angular/fire/auth';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, from, map, of, switchMap, take } from 'rxjs';

const ALLOWED_PROVIDERS = ['google.com', 'password', 'phone'];
const PROVIDER_BLOCK_MESSAGE = 'Método de login não permitido.';

export const providerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) {
        return of(router.createUrlTree(['/login']));
      }

      const isAllowedProvider = user.providerData.some((provider) => ALLOWED_PROVIDERS.includes(provider.providerId));
      if (isAllowedProvider) {
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

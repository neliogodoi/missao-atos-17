import { Routes } from '@angular/router';

import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { providerGuard } from './guards/provider.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent)
  },
  {
    path: 'admin',
    canActivate: [providerGuard, adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES)
  },
  {
    path: 'play',
    canActivate: [authGuard, providerGuard],
    loadChildren: () => import('./features/play/play.routes').then((m) => m.PLAY_ROUTES)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

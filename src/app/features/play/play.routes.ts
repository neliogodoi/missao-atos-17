import { Routes } from '@angular/router';

export const PLAY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../../shared/layout/app-shell/app-shell').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/today-mission-page/today-mission-page').then((m) => m.TodayMissionPage)
      },
      {
        path: 'journey',
        loadComponent: () => import('./pages/journey-page/journey-page').then((m) => m.JourneyPage)
      },
      {
        path: 'regras',
        loadComponent: () => import('./pages/rules-page/rules-page').then((m) => m.RulesPage)
      },
      {
        path: 'narrativa',
        loadComponent: () => import('./pages/narrative-page/narrative-page').then((m) => m.NarrativePage)
      }
    ]
  }
];

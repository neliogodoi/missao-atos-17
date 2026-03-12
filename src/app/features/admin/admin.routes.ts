import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/admin-home/admin-home').then((m) => m.AdminHome),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'seasons'
      },
      {
        path: 'seasons',
        loadComponent: () => import('./pages/seasons-page/seasons-page').then((m) => m.SeasonsPage)
      },
      {
        path: 'questions',
        loadComponent: () => import('./pages/questions-page/questions-page').then((m) => m.QuestionsPage)
      },
      {
        path: 'story-episodes',
        loadComponent: () =>
          import('./pages/story-episodes-page/story-episodes-page').then((m) => m.StoryEpisodesPage)
      },
      {
        path: 'daily-missions',
        loadComponent: () =>
          import('./pages/daily-missions-page/daily-missions-page').then((m) => m.DailyMissionsPage)
      },
      {
        path: 'retro-access',
        loadComponent: () => import('./pages/retro-access-page/retro-access-page').then((m) => m.RetroAccessPage)
      }
    ]
  }
];

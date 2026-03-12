import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-admin-home',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  template: `
    <section class="admin-shell app-container">
      <header class="admin-nav">
        <nav>
          <a routerLink="seasons" routerLinkActive="active" title="Atos" aria-label="Atos">
            <mat-icon class="material-icons-outlined">calendar_month</mat-icon>
          </a>
          <a routerLink="questions" routerLinkActive="active" title="Questions" aria-label="Questions">
            <mat-icon class="material-icons-outlined">help</mat-icon>
          </a>
          <a
            routerLink="story-episodes"
            routerLinkActive="active"
            title="Story Episodes"
            aria-label="Story Episodes"
          >
            <mat-icon class="material-icons-outlined">auto_stories</mat-icon>
          </a>
          <a routerLink="daily-missions" routerLinkActive="active" title="Daily Missions" aria-label="Daily Missions">
            <mat-icon class="material-icons-outlined">task_alt</mat-icon>
          </a>
        </nav>
      </header>

      <router-outlet />
    </section>
  `,
  styles: `
    .admin-shell {
      display: grid;
      gap: 1rem;
      padding-top: var(--space-4);
      padding-bottom: var(--space-6);
    }

    .admin-nav {
      border: 1px solid var(--stroke);
      border-radius: 0.9rem;
      background: var(--panel);
      padding: 0.7rem;
    }

    nav {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    a {
      color: var(--muted);
      text-decoration: none;
      padding: 0.45rem 0.6rem;
      border-radius: 0.55rem;
      border: 1px solid var(--stroke);
      background: var(--surface);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.35rem;
      min-height: 2.25rem;
    }

    a mat-icon {
      font-size: 1.15rem;
      width: 1.15rem;
      height: 1.15rem;
    }

    a.active,
    a:hover {
      background: var(--surface-2);
      color: var(--text);
      border-color: var(--stroke);
    }
  `
})
export class AdminHome {}

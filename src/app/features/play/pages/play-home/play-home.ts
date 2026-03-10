import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-play-home',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule],
  template: `
    <section class="play-shell">
      <header>
        <h2>Play</h2>
        <nav>
          <a routerLink="today" routerLinkActive="active" title="Today Mission" aria-label="Today Mission">
            <mat-icon class="material-icons-outlined">today</mat-icon>
          </a>
          <a routerLink="journey" routerLinkActive="active" title="Journey" aria-label="Journey">
            <mat-icon class="material-icons-outlined">explore</mat-icon>
          </a>
          <a routerLink="armor" routerLinkActive="active" title="Armor" aria-label="Armor">
            <mat-icon class="material-icons-outlined">shield</mat-icon>
          </a>
          <a routerLink="leaderboard" routerLinkActive="active" title="Leaderboard" aria-label="Leaderboard">
            <mat-icon class="material-icons-outlined">emoji_events</mat-icon>
          </a>
        </nav>
      </header>

      <router-outlet />
    </section>
  `,
  styles: `
    .play-shell {
      display: grid;
      gap: 1rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--stroke);
      padding-bottom: 0.75rem;
      gap: 0.75rem;
    }

    h2 {
      margin: 0;
      white-space: nowrap;
    }

    nav {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    a {
      color: var(--muted);
      text-decoration: none;
      padding: 0.4rem 0.55rem;
      border-radius: 0.35rem;
      border: 1px solid transparent;
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
      background: #2a3942;
      color: var(--text);
      border-color: color-mix(in srgb, var(--blue) 25%, var(--stroke) 75%);
    }
  `
})
export class PlayHome {}

import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { map, Observable, of, switchMap, catchError } from 'rxjs';
import { environment } from '../../../../../environments/environment';

type AdminDiagnostic = {
  uid: string;
  email: string;
  projectId: string;
  role: string;
  rolePath: string;
};

@Component({
  selector: 'app-admin-home',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatIconModule, AsyncPipe, NgIf],
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

        <section class="debug-auth" *ngIf="debugEnabled">
          <p class="debug-title">Debug Auth</p>
          <ng-container *ngIf="diagnostic$ | async as d">
            <p><strong>uid:</strong> {{ d.uid }}</p>
            <p><strong>email:</strong> {{ d.email }}</p>
            <p><strong>projectId:</strong> {{ d.projectId }}</p>
            <p><strong>role ({{ d.rolePath }}):</strong> {{ d.role }}</p>
            <div class="debug-actions">
              <button type="button" (click)="copyDiagnostic(d)">{{ copied() ? 'Copiado' : 'Copiar diagnóstico' }}</button>
            </div>
          </ng-container>
        </section>
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

    .debug-auth {
      margin-top: 0.7rem;
      border: 1px dashed var(--stroke);
      border-radius: 0.7rem;
      padding: 0.6rem;
      background: var(--surface);
      display: grid;
      gap: 0.25rem;
    }

    .debug-title {
      margin: 0 0 0.25rem 0;
      color: var(--text);
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .debug-auth p {
      margin: 0;
      color: var(--muted);
      font-size: 0.82rem;
      overflow-wrap: anywhere;
    }

    .debug-actions {
      margin-top: 0.35rem;
    }

    .debug-actions button {
      min-height: var(--btn-h-sm);
      padding: 0 0.75rem;
      border-radius: 0.55rem;
      border-color: var(--stroke);
      background: var(--surface-2);
      color: var(--text);
    }
  `
})
export class AdminHome {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  readonly copied = signal(false);
  readonly debugEnabled = this.resolveDebugEnabled();

  readonly diagnostic$: Observable<AdminDiagnostic> = authState(this.auth).pipe(
    switchMap((user) => {
      const projectId = environment.firebase.projectId;
      if (!user) {
        return of({
          uid: '(deslogado)',
          email: '(deslogado)',
          projectId,
          role: '(sem sessão)',
          rolePath: 'users/(sem-uid)'
        });
      }

      const rolePath = `users/${user.uid}`;
      return docData(doc(this.firestore, rolePath)).pipe(
        map((data) => ({
          uid: user.uid,
          email: user.email ?? '(sem email)',
          projectId,
          role: this.normalizeRole(data),
          rolePath
        })),
        catchError((err: unknown) =>
          of({
            uid: user.uid,
            email: user.email ?? '(sem email)',
            projectId,
            role: `erro ao ler role: ${err instanceof Error ? err.message : String(err)}`,
            rolePath
          })
        )
      );
    })
  );

  async copyDiagnostic(diagnostic: AdminDiagnostic): Promise<void> {
    const payload = `uid=${diagnostic.uid}; email=${diagnostic.email}; projectId=${diagnostic.projectId}; role=${diagnostic.role}`;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(payload);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  private normalizeRole(data: unknown): string {
    if (!data || typeof data !== 'object') {
      return '(documento ausente)';
    }
    const roleValue = (data as Record<string, unknown>)['role'];
    return typeof roleValue === 'string' && roleValue.trim() !== '' ? roleValue : '(role ausente)';
  }

  private resolveDebugEnabled(): boolean {
    if (!environment.production) {
      return true;
    }

    if (typeof window === 'undefined') {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('debugAuth') === '1') {
      window.localStorage.setItem('debugAuth', '1');
      return true;
    }

    return window.localStorage.getItem('debugAuth') === '1';
  }
}

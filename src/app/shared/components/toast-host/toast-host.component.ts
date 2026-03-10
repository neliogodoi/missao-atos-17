import { AsyncPipe, NgClass, NgFor } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [NgFor, NgClass, AsyncPipe],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);

  readonly toasts$ = this.toastService.toasts$;

  trackByToastId(index: number, toast: { id: number }): number {
    return toast.id;
  }
}

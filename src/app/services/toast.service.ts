import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  private nextId = 1;

  readonly toasts$ = this.toastsSubject.asObservable();

  show(message: string, type: ToastType): void {
    const toast: ToastMessage = {
      id: this.nextId++,
      message,
      type
    };

    this.toastsSubject.next([...this.toastsSubject.value, toast]);
    setTimeout(() => this.remove(toast.id), 3200);
  }

  remove(id: number): void {
    const next = this.toastsSubject.value.filter((toast) => toast.id !== id);
    this.toastsSubject.next(next);
  }
}

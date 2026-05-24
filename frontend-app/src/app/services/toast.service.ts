import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts$ = new BehaviorSubject<Toast[]>([]);
  toasts = this.toasts$.asObservable();
  private counter = 0;
  show(message: string, type: 'success' | 'error' | 'info' = 'success') {
    const id = ++this.counter;
    const current = this.toasts$.getValue();
    this.toasts$.next([...current, { id, message, type }]);
    setTimeout(() => this.remove(id), 3000);
  }
  remove(id: number) {
    this.toasts$.next(this.toasts$.getValue().filter(t => t.id !== id));
  }
}
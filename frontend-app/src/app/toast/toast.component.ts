import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../services/toast.service';
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div class="toast" *ngFor="let t of toasts" [class]="'toast-' + t.type">
        <svg *ngIf="t.type === 'success'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <svg *ngIf="t.type === 'error'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg *ngIf="t.type === 'info'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>{{ t.message }}</span>
        <button class="toast-close" (click)="toastService.remove(t.id)">✕</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-family: 'Segoe UI', sans-serif;
      min-width: 280px;
      max-width: 360px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      animation: slideIn 0.3s ease;
    }
    .toast-success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .toast-error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .toast-info    { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .toast span { flex: 1; }
    .toast-close { background: none; border: none; cursor: pointer; font-size: 12px; color: inherit; opacity: 0.6; padding: 0 4px; }
    .toast-close:hover { opacity: 1; }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  `]
})
export class ToastComponent {
  toasts: Toast[] = [];
  constructor(public toastService: ToastService) {
    toastService.toasts.subscribe(t => this.toasts = t);
  }
}
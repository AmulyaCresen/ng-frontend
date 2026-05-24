import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrailHelper } from '../services/trail-helper';
import { Leave, LeaveService } from '../services/leave.service';
import { UserService } from '../services/user';
import { CacheService } from '../services/cache.service';

@Component({
  selector: 'app-trail-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="modal-overlay" *ngIf="leave" (click)="close.emit()">
  <div class="modal modal-wide audit-trail-modal" (click)="$event.stopPropagation()">
    <div class="modal-header">
      <div class="trail-modal-title">
        <div class="trail-modal-avatar">{{ (getName(leave.emailId) || leave.emailId || '?')[0].toUpperCase() }}</div>
        <div>
          <h3>Audit Trail</h3>
          <div class="trail-modal-sub">{{ getName(leave.emailId) || leave.emailId }}</div>
        </div>
      </div>
      <button class="close-btn" (click)="close.emit()">&#x2715;</button>
    </div>

    <div class="trail-timeline">
      <!-- Leave Applied -->
      <div class="trail-activity-card">
        <div class="trail-activity-left">
          <div class="trail-activity-dot dot-applied"></div>
          <div class="trail-activity-line" *ngIf="filteredTrail.length"></div>
        </div>
        <div class="trail-activity-body">
          <div class="trail-event-card" [class.expanded]="expanded.has(-1)">
            <div class="trail-accordion-header" (click)="toggle(-1)">
              <div class="trail-header-left">
                <span class="trail-activity-title">Leave Applied</span>
              </div>
              <div class="trail-header-right">
                <span class="trail-accordion-date">{{ formatDate(appliedAt) }}</span>
                <button class="trail-expand-btn" [class.expanded]="expanded.has(-1)" type="button">{{ expanded.has(-1) ? '&minus;' : '+' }}</button>
              </div>
            </div>
          <div class="trail-accordion-detail" *ngIf="expanded.has(-1)">
            <div class="trail-activity-meta">
              <div class="trail-meta-item"><span class="trail-meta-label">Applied By</span><span class="trail-meta-value">{{ employeeName || getName(leave.emailId) || leave.emailId }}</span></div>
              <div class="trail-meta-item"><span class="trail-meta-label">Applied On</span><span class="trail-meta-value">{{ appliedAt }}</span></div>
              <div class="trail-meta-item"><span class="trail-meta-label">Leave Type</span><span class="trail-meta-value">{{ leave.leaveType }}</span></div>
              <div class="trail-meta-item"><span class="trail-meta-label">From</span><span class="trail-meta-value">{{ leave.fromDate }}</span></div>
              <div class="trail-meta-item"><span class="trail-meta-label">To</span><span class="trail-meta-value">{{ leave.toDate }}</span></div>
              <div class="trail-meta-item"><span class="trail-meta-label">Duration</span><span class="trail-meta-value">{{ leaveDuration }}</span></div>
            </div>
            <div class="trail-activity-reason" *ngIf="leaveReason">
              <span class="trail-reason-heading">Reason for Leave</span>
              <span class="trail-reason-text">{{ leaveReason }}</span>
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- Review event cards -->
      <ng-container *ngFor="let t of filteredTrail; let i = index; let last = last">
        <div class="trail-activity-card">
          <div class="trail-activity-left">
            <div class="trail-activity-dot"
              [class.dot-approved]="isApproved(t)"
              [class.dot-rejected]="isRejected(t)"
              [class.dot-partial]="isPartial(t)"></div>
            <div class="trail-activity-line" *ngIf="!last"></div>
          </div>
          <div class="trail-activity-body">
            <div class="trail-event-card" [class.expanded]="expanded.has(i)">
            <div class="trail-accordion-header" (click)="toggle(i)">
              <div class="trail-header-left">
                <span class="trail-activity-title">
                  <span *ngIf="trailHelper.stageFromEntry(t) === 'MANAGER'">Manager Review</span>
                  <span *ngIf="trailHelper.stageFromEntry(t) === 'ADMIN'">HR Review</span>
                </span>
                <span class="trail-status-badge"
                  [class.badge-approved]="isApproved(t)"
                  [class.badge-rejected]="isRejected(t)"
                  [class.badge-partial]="isPartial(t)"
                  [class.badge-pending]="isPending(t)">{{ statusLabel(t) }}</span>
              </div>
              <div class="trail-header-right">
                <span class="trail-accordion-date" *ngIf="t.date">{{ formatDate(t.date) }}</span>
                <button class="trail-expand-btn" [class.expanded]="expanded.has(i)" type="button">{{ expanded.has(i) ? '&minus;' : '+' }}</button>
              </div>
            </div>
            <div class="trail-accordion-detail" *ngIf="expanded.has(i)">
              <div class="trail-activity-meta">
                <div class="trail-meta-item" *ngIf="t.reviewedBy"><span class="trail-meta-label">Reviewed By</span><span class="trail-meta-value">{{ t.reviewedBy }}</span></div>
                <div class="trail-meta-item" *ngIf="t.date"><span class="trail-meta-label">Action Date</span><span class="trail-meta-value">{{ formatDate(t.date) }}</span></div>
                <div class="trail-meta-item"><span class="trail-meta-label">Stage</span><span class="trail-meta-value">{{ trailHelper.stageFromEntry(t) }}</span></div>
                <div class="trail-meta-item"><span class="trail-meta-label">Status</span><span class="trail-meta-value">{{ statusLabel(t) }}</span></div>
              </div>
              <div class="trail-activity-reason" *ngIf="t.rejectionReason">
                <span class="trail-reason-heading">Reason</span>
                <span class="trail-reason-text">{{ t.rejectionReason }}</span>
              </div>
              <div *ngIf="approvedDays(t).length > 0" class="trail-dates-section">
                <span class="trail-meta-label">Approved Dates</span>
                <div class="approved-dates-details">
                  <div *ngFor="let day of approvedDays(t)" class="approved-day-item">
                    <span class="approved-day-date">{{ day.date }}</span>
                  </div>
                </div>
              </div>
              <div *ngIf="rejectedDays(t).length > 0" class="trail-dates-section">
                <span class="trail-meta-label">Rejected Dates</span>
                <div class="rejected-dates-details">
                  <div *ngFor="let day of rejectedDays(t)" class="rejected-day-item">
                    <span class="rejected-day-date">{{ day.date }}</span>
                    <div class="rejected-day-reason-block">
                      <span class="trail-reason-heading">Reason</span>
                      <span class="rejected-day-reason">{{ day.reason || 'No reason provided' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </ng-container>

      <div class="trail-empty" *ngIf="!filteredTrail.length">No review activity yet.</div>
    </div>

    <div class="form-actions">
      <button class="cancel-btn" (click)="close.emit()">Close</button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999}
    .modal{background:white;border-radius:12px;padding:20px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.2);position:relative}
    .modal-wide{width:620px;max-width:96vw;height:520px;max-height:520px;min-height:520px;display:flex;flex-direction:column;overflow:hidden}
    .modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0}
    .modal-header h3{margin:0;font-size:15px;color:#1e293b}
    .trail-modal-title{display:flex;align-items:center;gap:10px}
    .trail-modal-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .trail-modal-sub{font-size:11px;color:#64748b;margin-top:1px}
    .close-btn{background:none;border:none;font-size:15px;cursor:pointer;color:#94a3b8;padding:3px 7px;border-radius:6px;flex-shrink:0}
    .close-btn:hover{background:#f1f5f9;color:#475569}
    .trail-timeline{flex:1;overflow-y:auto;min-height:0;padding:2px 6px 2px 0}
    .trail-timeline::-webkit-scrollbar{width:4px}
    .trail-timeline::-webkit-scrollbar-track{background:#f1f5f9;border-radius:4px}
    .trail-timeline::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
    .trail-timeline::-webkit-scrollbar-thumb:hover{background:#94a3b8}
    .trail-activity-card{display:flex;gap:8px;margin-bottom:14px}
    .trail-activity-left{display:flex;flex-direction:column;align-items:center;width:12px;flex-shrink:0}
    .trail-activity-dot{width:10px;height:10px;border-radius:50%;background:#94a3b8;margin-top:16px;flex-shrink:0;z-index:1}
    .dot-applied{background:#6366f1}
    .dot-approved{background:#16a34a}
    .dot-rejected{background:#dc2626}
    .dot-partial{background:#f59e0b}
    .trail-activity-line{width:2px;flex:1;background:#e2e8f0;margin:1px 0}
    .trail-activity-body{flex:1;padding:0 0 6px 0}
    .trail-event-card{border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;overflow:hidden}
    .trail-accordion-header{display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:0 12px;transition:background 0.15s;height:46px}
    .trail-accordion-header:hover{background:#f1f5f9}
    .trail-header-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
    .trail-activity-title{font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap}
    .trail-status-badge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px;text-transform:uppercase;letter-spacing:0.3px;flex-shrink:0}
    .badge-approved{background:#dcfce7;color:#16a34a}
    .badge-rejected{background:#fee2e2;color:#dc2626}
    .badge-partial{background:#fef9c3;color:#b45309}
    .badge-pending{background:#e0e7ff;color:#4338ca}
    .trail-header-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
    .trail-accordion-date{font-size:11px;color:#b0bec5;white-space:nowrap}
    .trail-expand-btn{background:#6366f1;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:16px;color:white;display:flex;align-items:center;justify-content:center;line-height:1;padding:0;flex-shrink:0;font-weight:400}
    .trail-expand-btn.expanded{background:#4f46e5}
    .trail-accordion-detail{padding:12px 14px;background:white;border-top:1px solid #e2e8f0}
    .trail-activity-meta{display:flex;flex-wrap:wrap;gap:10px 24px}
    .trail-meta-item{display:flex;flex-direction:column;gap:3px;min-width:110px}
    .trail-meta-label{font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.4px}
    .trail-meta-value{font-size:13px;color:#1e293b;font-weight:500}
    .trail-activity-reason{margin-top:8px;padding:8px 12px;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:0 5px 5px 0;font-size:13px;color:#92400e}
    .trail-reason-heading{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#b45309;margin-bottom:3px}
    .trail-reason-text{font-size:13px;color:#92400e}
    .trail-dates-section{margin-top:8px}
    .rejected-day-reason-block{display:flex;flex-direction:column;gap:1px;text-align:right}
    .trail-empty{text-align:center;color:#94a3b8;font-size:13px;padding:16px 0}
    .approved-dates-details{margin-top:6px;padding:6px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px}
    .approved-day-item{display:flex;align-items:center;padding:4px 0;border-bottom:1px solid #dcfce7}
    .approved-day-item:last-child{border-bottom:none}
    .approved-day-date{font-weight:600;color:#16a34a;font-size:13px}
    .rejected-dates-details{margin-top:6px;padding:6px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px}
    .rejected-day-item{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #fee2e2}
    .rejected-day-item:last-child{border-bottom:none}
    .rejected-day-date{font-weight:600;color:#dc2626;font-size:13px}
    .rejected-day-reason{color:#7f1d1d;font-size:12px;font-style:italic}
    .form-actions{display:flex;justify-content:flex-end;margin-top:10px;flex-shrink:0}
    .cancel-btn{padding:5px 14px;border:1px solid #e2e8f0;border-radius:6px;background:white;color:#475569;font-size:12px;cursor:pointer}
    .cancel-btn:hover{background:#f8fafc}
  `]
})
export class TrailModalComponent implements OnChanges {
  @Input() leave: Leave | null = null;
  @Output() close = new EventEmitter<void>();

  expanded = new Set<number>();
  filteredTrail: any[] = [];
  appliedAt = '';
  employeeName = '';
  leaveDuration = '';
  leaveReason = '';
  private nameMap = new Map<string, string>();
  private static leaveCache = new Map<number, Leave>();
  private lastLeaveId: number | null = null;

  constructor(public trailHelper: TrailHelper, private userService: UserService, private leaveService: LeaveService, private cacheService: CacheService) {
    const cachedUsers = this.cacheService.getUsers();
    if (cachedUsers) {
      cachedUsers.forEach((u: any) => this.nameMap.set(u.email, u.fullName));
    } else {
      this.userService.getAllUsers().subscribe({
        next: (users) => {
          users.forEach(u => this.nameMap.set(u.email, u.fullName));
          this.cacheService.setUsers(users);
        },
        error: () => {}
      });
    }
  }

  ngOnChanges() {
    this.expanded.clear();
    
    if (!this.leave?.id) {
      return;
    }

    // Prevent duplicate processing for the same leave
    if (this.lastLeaveId === this.leave.id) {
      return;
    }
    
    this.lastLeaveId = this.leave.id;
    
    // Check cache first
    if (TrailModalComponent.leaveCache.has(this.leave.id)) {
      const cached = TrailModalComponent.leaveCache.get(this.leave.id)!;
      this.applyLeave(cached);
      return;
    }
    
    // Use the leave data directly (trail data should already be embedded)
    TrailModalComponent.leaveCache.set(this.leave.id, this.leave);
    this.applyLeave(this.leave);
  }

  private applyLeave(leave: Leave | null) {
    const trail = leave?.trail || [];
    this.filteredTrail = this.trailHelper.filteredTrail(trail);
    this.appliedAt = this.trailHelper.getLeaveAppliedTimestamp(trail, leave?.createdAt);
    this.employeeName = this.trailHelper.getEmployeeNameFromTrail(trail);
    this.leaveReason = leave?.reason || '';
    const days = leave?.days;
    if (leave?.totalDays != null) {
      this.leaveDuration = leave.totalDays + ' day(s)';
    } else if (days && days.length > 0) {
      const total = days.reduce((s, d) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
      this.leaveDuration = total + ' day(s)';
    } else {
      this.leaveDuration = '1 day(s)';
    }
    if (leave && this.leave && leave.id === this.leave.id) {
      this.leave = { ...this.leave, trail: leave.trail, days: leave.days, reason: leave.reason, totalDays: leave.totalDays };
    }
  }

  toggle(i: number) { this.expanded.has(i) ? this.expanded.delete(i) : this.expanded.add(i); }
  getName(email: string): string { return this.nameMap.get(email || '') || email || ''; }
  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = dateStr.slice(0, 10);
    const time = dateStr.slice(11, 16);
    return time ? `${date} ${time}` : date;
  }
  approvedDays(t: any): any[] { return this.trailHelper.approvedDays(this.leave?.trail || [], t); }
  rejectedDays(t: any): any[] { return this.trailHelper.rejectedDays(this.leave?.trail || [], t); }
  isApproved(t: any): boolean { const s = t.reviewStatus || t.status || ''; return (s === 'APPROVED' || s === 'MANAGER_APPROVED'); }
  isRejected(t: any): boolean { return (t.reviewStatus || t.status || '') === 'REJECTED'; }
  isPartial(t: any): boolean { return (t.reviewStatus || t.status || '') === 'PARTIAL'; }
  isPending(t: any): boolean { return (t.reviewStatus || t.status || '') === 'PENDING'; }
  statusLabel(t: any): string {
    const s = t.reviewStatus || t.status || '';
    if (s === 'MANAGER_APPROVED') return 'Approved';
    if (s === 'PARTIAL') return 'Partial';
    return s;
  }
}

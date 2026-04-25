import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TrailHelper {

  filteredTrail(trail: any[]): any[] {
    if (!trail?.length) return [];
    const stageMap = new Map<string, any>();
    trail
      .filter((t: any) => (t.type === 'MANAGER_REVIEW_EVENT' || t.type === 'ADMIN_REVIEW_EVENT') && t.reviewedBy)
      .forEach((t: any) => {
        const key = t.type;
        if (!stageMap.has(key) || new Date(t.date || 0) > new Date(stageMap.get(key).date || 0)) {
          stageMap.set(key, t);
        }
      });
    return Array.from(stageMap.values()).sort((a, b) =>
      new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );
  }

  stageFromEntry(trailEntry: any): string {
    if (trailEntry?.type === 'MANAGER_REVIEW_EVENT') return 'MANAGER';
    if (trailEntry?.type === 'ADMIN_REVIEW_EVENT') return 'ADMIN';
    return trailEntry?.stage || '';
  }

  
  relevantDaysForStage(trail: any[], stage: string): any[] {
    if (!trail?.length) return [];
    const reviewEventType = stage === 'MANAGER' ? 'MANAGER_REVIEW_EVENT' : 'ADMIN_REVIEW_EVENT';
    const reviewEvent = trail.find((t: any) => t.type === reviewEventType);
    if (!reviewEvent?.reviewedBy) return [];
    const reviewerName = reviewEvent.reviewedBy;
    return trail
      .filter((t: any) => t.type === 'DAY_DECISION' && t.stage === stage && t.reviewedBy === reviewerName)
      .map((entry: any) => ({
        date: entry.dayDate,
        status: entry.status,
        reason: entry.rejectionReason || ''
      }));
  }

  approvedDays(trail: any[], trailEntry: any): any[] {
    return this.relevantDaysForStage(trail, this.stageFromEntry(trailEntry))
      .filter((d: any) => d.status === 'APPROVED');
  }

  rejectedDays(trail: any[], trailEntry: any): any[] {
    return this.relevantDaysForStage(trail, this.stageFromEntry(trailEntry))
      .filter((d: any) => d.status === 'REJECTED');
  }

  getLeaveAppliedTimestamp(trail: any[], createdAt?: string): string {
    if (!trail?.length) return createdAt || '';
    const applied = trail.find((t: any) => t.type === 'LEAVE_APPLIED');
    if (applied?.date) return applied.date;
    const pending = trail.find((t: any) => t.status === 'PENDING');
    if (pending?.date) return pending.date;
    return trail[0]?.date || createdAt || '';
  }

  getEmployeeNameFromTrail(trail: any[]): string {
    return trail?.[0]?.employeeName || '';
  }
}

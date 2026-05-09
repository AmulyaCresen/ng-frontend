import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
export interface LeaveType {
  id: number;
  leaveName: string;
  leaveUniqueName: string;
  description: string;
  maxDays: number;
}
export interface Leave {
  id: number;
  leaveType: string;
  fromDate: string;
  toDate: string;
  emailId: string;
  managerEmail?: string;
  reason: string;
  comments: string;
  createdAt: string;
  status: string;
  dayType: string;
  halfDaySession: string;
  editable: boolean;
  days?: LeaveDay[];
  totalDays?: number;
  reviewedBy?: string;
  trail?: any[];
  documentPath?: string;
}
export interface LeaveFile {
  id: number;
  leaveId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
}
export interface UpdateLeaveRequest {
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
  dayType: string;
  halfDaySession: string;
}
export interface CreateLeaveTypeRequest {
  leaveName: string;
  leaveUniqueName: string;
  description: string;
  maxDays: number;
}
export interface Holiday {
  id: number;
  name: string;
  date: string;
}
export interface HolidayRequest {
  name: string;
  date: string;
}
export let PUBLIC_HOLIDAYS: string[] = [];
function parseLocalDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Invalid date string');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    throw new Error('Invalid date format');
  }
  return new Date(y, m - 1, d);
}
export function isRestrictedDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const day = parseLocalDate(dateStr).getDay();
  return day === 0 || day === 6 || PUBLIC_HOLIDAYS.includes(dateStr);
}
export function calcWorkingDays(from: string, to: string, dayType?: string): number {
  if (!from || !to) return 0;
  if (dayType === 'HALF_DAY') return 0.5;
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    if (day !== 0 && day !== 6 && !PUBLIC_HOLIDAYS.includes(iso)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
export interface LeaveDay {
  date: string;
  dayType: 'FULL_DAY' | 'HALF_DAY';
  halfDaySession: 'MORNING' | 'AFTERNOON' | '';
  status?: string;
  reason?: string;
}
export interface CreateLeaveRequest {
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  comments: string;
  dayType: string;
  halfDaySession: string;
  managerEmail?: string;
  days?: LeaveDay[];
}
@Injectable({ providedIn: 'root' })
export class LeaveService {
  private baseUrl = environment.apiUrl;
  private holidaysCache$: Observable<Holiday[]> | null = null;
  private leaveTypesCache$: Observable<LeaveType[]> | null = null;
  private myLeavesCache$: Observable<Leave[]> | null = null;
  private allLeavesCache$: Observable<Leave[]> | null = null;
  private pendingLeavesCache$: Observable<Leave[]> | null = null;
  private reviewedLeavesCache$: Observable<Leave[]> | null = null;
  
  constructor(private http: HttpClient) {}
  getLeaveById(id: number): Observable<Leave> {
    return this.http.get<Leave>(`${this.baseUrl}/leave/${id}`);
  }
  getHolidays(): Observable<Holiday[]> {
    if (!this.holidaysCache$) {
      this.holidaysCache$ = this.http.get<Holiday[]>(`${this.baseUrl}/leave/holidays`).pipe(
        tap(holidays => {
          PUBLIC_HOLIDAYS = holidays.map(h => h.date);
        }),
        shareReplay(1)
      );
    }
    return this.holidaysCache$;
  }

  clearHolidaysCache(): void {
    this.holidaysCache$ = null;
    PUBLIC_HOLIDAYS = [];
    this.clearLeavesCache();
  }
  createHoliday(request: HolidayRequest): Observable<Holiday> {
    return this.http.post<Holiday>(`${this.baseUrl}/leave/holidays`, request).pipe(
      tap(() => this.clearHolidaysCache())
    );
  }
  updateHoliday(id: number, request: HolidayRequest): Observable<Holiday> {
    return this.http.put<Holiday>(`${this.baseUrl}/leave/holidays/${id}`, request).pipe(
      tap(() => this.clearHolidaysCache())
    );
  }
  deleteHoliday(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/leave/holidays/${id}`).pipe(
      tap(() => this.clearHolidaysCache())
    );
  }
  getLeaveTypes(): Observable<LeaveType[]> {
    if (!this.leaveTypesCache$) {
      this.leaveTypesCache$ = this.http.get<LeaveType[]>(`${this.baseUrl}/leave/types`).pipe(
        shareReplay(1)
      );
    }
    return this.leaveTypesCache$;
  }

  clearLeaveTypesCache(): void {
    this.leaveTypesCache$ = null;
  }

  clearLeavesCache(): void {
    this.myLeavesCache$ = null;
    this.allLeavesCache$ = null;
    this.pendingLeavesCache$ = null;
    this.reviewedLeavesCache$ = null;
  }
  updateLeave(id: number, request: UpdateLeaveRequest): Observable<Leave> {
    return this.http.put<Leave>(`${this.baseUrl}/leave/${id}`, request).pipe(
      tap(() => this.clearLeavesCache())
    );
  }
  deleteLeave(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/leave/${id}`).pipe(
      tap(() => this.clearLeavesCache())
    );
  }
  getMyLeaves(): Observable<Leave[]> {
    if (!this.myLeavesCache$) {
      this.myLeavesCache$ = this.http.get<Leave[]>(`${this.baseUrl}/leave/my`).pipe(
        shareReplay(1)
      );
    }
    return this.myLeavesCache$;
  }
  getAllLeaves(): Observable<Leave[]> {
    if (!this.allLeavesCache$) {
      this.allLeavesCache$ = this.http.get<Leave[]>(`${this.baseUrl}/leave/all`).pipe(
        shareReplay(1)
      );
    }
    return this.allLeavesCache$;
  }
  getPendingLeavesFor(): Observable<Leave[]> {
    if (!this.pendingLeavesCache$) {
      this.pendingLeavesCache$ = this.http.get<Leave[]>(`${this.baseUrl}/leave/pending-for`).pipe(
        shareReplay(1)
      );
    }
    return this.pendingLeavesCache$;
  }

  getReviewedLeaves(): Observable<Leave[]> {
    if (!this.reviewedLeavesCache$) {
      this.reviewedLeavesCache$ = this.http.get<Leave[]>(`${this.baseUrl}/leave/reviewed-by-me`).pipe(
        shareReplay(1)
      );
    }
    return this.reviewedLeavesCache$;
  }

  getManagerLoggedLeaves(): Observable<Leave[]> {
    return this.http.get<Leave[]>(`${this.baseUrl}/leave/manager-logged-leaves`);
  }

  getAdminLoggedLeaves(): Observable<Leave[]> {
    return this.http.get<Leave[]>(`${this.baseUrl}/leave/admin-logged-leaves`);
  }
  partialReview(id: number, dayDecisions: { date: string; status: string; reason?: string }[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/leave/${id}/partial-review`, dayDecisions).pipe(
      tap(() => this.clearLeavesCache())
    );
  }
  checkLeaveName(name: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/leave/types/check-name?name=${encodeURIComponent(name)}`);
  }
  checkLeaveUniqueName(uniqueName: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/leave/types/check-unique-name?uniqueName=${encodeURIComponent(uniqueName)}`);
  }
  updateLeaveType(id: number, request: CreateLeaveTypeRequest): Observable<LeaveType> {
    return this.http.put<LeaveType>(`${this.baseUrl}/leave/types/${id}`, request).pipe(
      tap(() => this.clearLeaveTypesCache())
    );
  }
  deleteLeaveType(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/leave/types/${id}`).pipe(
      tap(() => this.clearLeaveTypesCache())
    );
  }
  createLeaveType(request: CreateLeaveTypeRequest): Observable<LeaveType> {
    return this.http.post<LeaveType>(`${this.baseUrl}/leave/types/create`, request).pipe(
      tap(() => this.clearLeaveTypesCache())
    );
  }
  approveLeave(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/leave/${id}/approve`, {}).pipe(
      tap(() => this.clearLeavesCache())
    );
  }
  rejectLeave(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/leave/${id}/reject?reason=${encodeURIComponent(reason)}`, {}).pipe(
      tap(() => this.clearLeavesCache())
    );
  }
  createLeave(request: CreateLeaveRequest): Observable<Leave> {
    return this.http.post<Leave>(`${this.baseUrl}/leave/create`, request).pipe(
      tap(() => this.clearLeavesCache())
    );
  }

  uploadLeaveDocument(leaveId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/leave/${leaveId}/upload-document`, formData);
  }

  getLeaveFiles(leaveId: number): Observable<LeaveFile[]> {
    return this.http.get<LeaveFile[]>(`${this.baseUrl}/leave/${leaveId}/files`);
  }

  deleteLeaveFile(fileId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/leave/files/${fileId}`);
  }

  downloadLeaveFile(fileId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/leave/files/${fileId}/download`, { responseType: 'blob' });
  }
}

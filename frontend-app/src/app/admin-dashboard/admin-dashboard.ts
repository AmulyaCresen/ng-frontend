import { Component, OnInit, NgZone } from '@angular/core';
import { AuthService } from '../services/auth';
import { UserService, Role, User, Stats, CreateUserRequest, UpdateUserRequest, MenuItem } from '../services/user';
import { LeaveService, LeaveType, Leave, Holiday, HolidayRequest, CreateLeaveRequest, UpdateLeaveRequest, CreateLeaveTypeRequest, LeaveDay, calcWorkingDays, isRestrictedDate, PUBLIC_HOLIDAYS } from '../services/leave.service';
import { CacheService } from '../services/cache.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, GridApi, AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ToastService } from '../services/toast.service';
import { TrailModalComponent } from '../shared/trail-modal.component';
import { AuditTrailComponent } from '../audit-trail/audit-trail.component';
ModuleRegistry.registerModules([AllCommunityModule]);
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, CommonModule, AgGridAngular, TrailModalComponent, AuditTrailComponent],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboard implements OnInit {
  activeMenu = sessionStorage.getItem('adm_activeMenu') || 'home';
  leaveManagementTab = 'types';
  applyLeaveTab = 'apply';
  sidebarExpanded = true;
  sidebarWidth = 230;
  showProfile = false;
  fullName = '';
  role = '';
  gender = '';
  startResize(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.sidebarWidth;
    const onMouseMove = (e: MouseEvent) => {
      this.sidebarWidth = Math.min(Math.max(startWidth + (e.clientX - startX), 68), 350);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  showForm = false;
  showEditForm = false;
  showDeleteConfirm = false;
  editingUser: User | null = null;
  deletingUser: User | null = null;
  editForm: UpdateUserRequest = { userName: '', fullName: '', role: '', active: true, gender: '' };
  form: CreateUserRequest = { userName: '', fullName: '', email: '', password: '', role: '', active: true, gender: '' };
  loading = false;
  userLoading = false;
  deleteLoading = false;
  editLoading = false;
  tabLoading = false;
  menuLoading = false;
  refreshLoading = false;
  searchLoading = false;
  pageLoading = false;
  successMessage = '';
  errorMessage = '';
  roles: Role[] = [];
  nextCompanyId = '';
  menus: MenuItem[] = [];
  users: User[] = [];
  stats: Stats = { totalUsers: 0, activeUsers: 0, inactiveUsers: 0 };
  searchQuery = '';
  gridApi!: GridApi;
  fieldErrors: { [key: string]: string } = {};
  holidays: Holiday[] = [];
  showHolidayForm = false;
  showEditHolidayForm = false;
  showDeleteHolidayConfirm = false;
  holidayLoading = false;
  editingHoliday: Holiday | null = null;
  deletingHoliday: Holiday | null = null;
  holidayForm: HolidayRequest = { name: '', date: '' };
  editHolidayForm: HolidayRequest = { name: '', date: '' };
  holidayColDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, sortable: true },
    { field: 'name', headerName: 'Holiday Name', flex: 1, sortable: true, filter: true },
    { field: 'date', headerName: 'Date', width: 150, sortable: true },
    { headerName: 'Action', width: 120, sortable: false, filter: false,
      cellRenderer: () => `
        <button class="edit-btn" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="delete-btn" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`,
      onCellClicked: (params: any) => {
        const btn = (params.event?.target as HTMLElement)?.closest('button');
        if (btn?.classList.contains('edit-btn')) this.openEditHolidayForm(params.data);
        else if (btn?.classList.contains('delete-btn')) this.openDeleteHolidayConfirm(params.data);
      }
    }
  ];
  showLeaveTypeForm = false;
  showDeleteLeaveTypeConfirm = false;
  leaveTypes: LeaveType[] = [];
  myLeaves: Leave[] = [];
  pendingLeaves: Leave[] = [];
  loggedLeaves: Leave[] = [];
  myTasksTab: 'pending' | 'logged' = 'pending';
  private pendingGridApi: GridApi | null = null;
  private loggedGridApi: GridApi | null = null;
  taskLoading = false;
  showRejectModal = false;
  rejectingLeave: Leave | null = null;
  rejectReason = '';
  showTrailModal = false;
  trailLeave: Leave | null = null;
  showActionWizard = false;
  actionLeave: Leave | null = null;
  dayDecisions: { date: string; dayType: string; status: 'APPROVED' | 'REJECTED'; reason: string }[] = [];
  showApproveAllConfirm = false;
  showRejectAllConfirm = false;
  rejectAllReason = '';
  private userFullNameMap: Map<string, string> = new Map();
  managers: User[] = [];
  getFullName(email: string): string {
    return this.userFullNameMap.get(email) || email;
  }
  leaveTypeForm: CreateLeaveTypeRequest = { leaveName: '', leaveUniqueName: '', description: '', maxDays: 0 };
  leaveTypeLoading = false;
  deletingLeaveType: LeaveType | null = null;
  editingLeaveType: LeaveType | null = null;
  showEditLeaveTypeForm = false;
  editLeaveTypeForm: CreateLeaveTypeRequest = { leaveName: '', leaveUniqueName: '', description: '', maxDays: 0 };
  editLeaveTypeFieldErrors: { [key: string]: string } = {};
  leaveTypeFieldErrors: { [key: string]: string } = {};
  showLeaveForm = false;
  showEditLeaveForm = false;
  showDeleteLeaveConfirm = false;
  leaveLoading = false;
  editingLeave: Leave | null = null;
  deletingLeave: Leave | null = null;
  leaveFormType = '';
  leaveFormFromDate = '';
  leaveFormToDate = '';
  leaveFormReason = '';
  leaveFormManagerEmail = '';
  leaveDays: LeaveDay[] = [];
  leaveDayError = '';
  editLeaveForm: UpdateLeaveRequest = { leaveType: '', fromDate: '', toDate: '', reason: '', comments: '', dayType: 'FULL_DAY', halfDaySession: '' };
  editLeaveDayCount = 0;
  today = new Date().toISOString().split('T')[0];
  get availableLeaveTypes(): LeaveType[] {
    const g = this.gender?.toLowerCase();
    return this.leaveTypes.filter(t => {
      const u = t.leaveUniqueName?.toUpperCase();
      if (u === 'MATERNITY' && g === 'male') return false;
      if (u === 'PATERNITY' && g === 'female') return false;
      return true;
    });
  }
  calcDays(from: string, to: string, dayType?: string): number {
    return calcWorkingDays(from, to, dayType);
  }
  hasDateOverlap(from: string, to: string, dayType: string, session: string, excludeId?: number): boolean {
    if (!from || !to) return false;
    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    return this.myLeaves.some(l => {
      if (excludeId !== undefined && l.id === excludeId) return false;
      const lf = new Date(l.fromDate).getTime();
      const lt = new Date(l.toDate).getTime();
      if (!(f <= lt && t >= lf)) return false;
      if (dayType === 'HALF_DAY' && l.dayType === 'HALF_DAY' && from === to && l.fromDate === l.toDate && l.fromDate === from) {
        return session === l.halfDaySession;
      }
      return true;
    });
  }
  checkLeaveOverlap(from: string, to: string, dayType: string, session: string, excludeId?: number): string {
    if (!from) return '';
    if (dayType === 'HALF_DAY' && !session) return '';
    return this.hasDateOverlap(from, to, dayType, session, excludeId)
      ? dayType === 'HALF_DAY'
        ? `You already have a ${session.toLowerCase()} half-day leave on this date.`
        : 'These dates overlap with an existing leave application.'
      : '';
  }
  private isTakenDate(iso: string): boolean {
    return this.myLeaves.some(l => {
      if (l.status === 'PARTIAL') {
        return l.days?.some(d => d.date === iso && d.status === 'APPROVED') ?? false;
      }
      if (l.status !== 'APPROVED' && l.status !== 'PENDING') return false;
      if (l.days && l.days.length > 0) return l.days.some(d => d.date === iso);
      return iso >= l.fromDate && iso <= l.toDate;
    });
  }
  buildLeaveDays() {
    if (!this.leaveFormFromDate || !this.leaveFormToDate) { this.leaveDays = []; this.leaveDayError = ''; return; }
    const [fy, fm, fd] = this.leaveFormFromDate.split('-').map(Number);
    const [ty, tm, td] = this.leaveFormToDate.split('-').map(Number);
    const from = new Date(fy, fm - 1, fd);
    const to = new Date(ty, tm - 1, td);
    if (to < from) { this.leaveDays = []; this.leaveDayError = ''; return; }
    const existing = new Map(this.leaveDays.map(d => [d.date, d]));
    const days: LeaveDay[] = [];
    const cur = new Date(from);
    while (cur <= to) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      if (!isRestrictedDate(iso) && !this.isTakenDate(iso)) {
        days.push(existing.get(iso) ?? { date: iso, dayType: 'FULL_DAY', halfDaySession: '' });
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (days.length === 0) {
      this.leaveDays = [];
      this.leaveDayError = 'All working days in this range are already applied or on holiday.';
      return;
    }
    if (this.leaveFormType) {
      const lt = this.leaveTypes.find(t => t.leaveName === this.leaveFormType);
      if (lt) {
        const usedOrPending = this.myLeaves
          .filter(l => l.leaveType === lt.leaveName && (l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PARTIAL'))
          .reduce((s, l) => {
            if (l.status === 'PARTIAL' && l.days?.length)
              return s + l.days.filter((d: any) => d.status === 'APPROVED').reduce((a: number, d: any) => a + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
            return s + this.getDays(l);
          }, 0);
        const newTotal = days.reduce((s, d) => s + (d.dayType === 'FULL_DAY' ? 1 : 0.5), 0);
        if (usedOrPending + newTotal > lt.maxDays) {
          this.leaveDays = [];
          this.leaveDayError = `Only ${lt.maxDays - usedOrPending} day(s) remaining for ${lt.leaveName} (includes pending leaves).`;
          return;
        }
      }
    }
    this.leaveDays = days;
    this.leaveDayError = '';
    this.validateLeaveDays(false);
  }
  validateLeaveDays(onSubmit = false): void {
    this.leaveDayError = '';
    if (!this.leaveFormType || this.leaveDays.length === 0) return;
    const lt = this.leaveTypes.find(t => t.leaveName === this.leaveFormType);
    if (lt) {
      const usedOrPending = this.myLeaves
        .filter(l => l.leaveType === lt.leaveName && (l.status === 'APPROVED' || l.status === 'PENDING' || l.status === 'PARTIAL'))
        .reduce((s, l) => {
          if (l.status === 'PARTIAL' && l.days?.length)
            return s + l.days.filter((d: any) => d.status === 'APPROVED').reduce((a: number, d: any) => a + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
          return s + this.getDays(l);
        }, 0);
      const newTotal = this.leaveDays.reduce((s, d) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
      if (usedOrPending + newTotal > lt.maxDays) {
        this.leaveDayError = `Only ${lt.maxDays - usedOrPending} day(s) remaining for ${lt.leaveName} (includes pending leaves).`;
        return;
      }
    }
    if (onSubmit) {
      for (const d of this.leaveDays) {
        if (d.dayType === 'HALF_DAY' && !d.halfDaySession) {
          this.leaveDayError = `Please select Morning or Afternoon for ${d.date}.`;
          return;
        }
      }
    }
  }
  onEditLeaveDatesChange() {
    if (this.editLeaveForm.dayType === 'HALF_DAY') this.editLeaveForm.toDate = this.editLeaveForm.fromDate;
    if (this.editLeaveForm.fromDate && isRestrictedDate(this.editLeaveForm.fromDate)) {
      this.editLeaveDayCount = 0;
      this.leaveDayError = 'From date cannot be a weekend or public holiday.';
      return;
    }
    if (this.editLeaveForm.toDate && isRestrictedDate(this.editLeaveForm.toDate)) {
      this.editLeaveDayCount = 0;
      this.leaveDayError = 'To date cannot be a weekend or public holiday.';
      return;
    }
    this.editLeaveDayCount = this.calcDays(this.editLeaveForm.fromDate, this.editLeaveForm.toDate, this.editLeaveForm.dayType);
    const lt = this.leaveTypes.find(t => t.leaveName === this.editLeaveForm.leaveType);
    if (lt && this.editLeaveDayCount > lt.maxDays) {
      this.leaveDayError = `Exceeds max allowed days (${lt.maxDays}) for ${lt.leaveName}.`;
    } else {
      this.leaveDayError = this.checkLeaveOverlap(this.editLeaveForm.fromDate, this.editLeaveForm.toDate, this.editLeaveForm.dayType, this.editLeaveForm.halfDaySession, this.editingLeave?.id);
    }
  }
  onEditHalfDaySessionChange() {
    this.leaveDayError = this.checkLeaveOverlap(this.editLeaveForm.fromDate, this.editLeaveForm.toDate, this.editLeaveForm.dayType, this.editLeaveForm.halfDaySession, this.editingLeave?.id);
  }
  colDefs: ColDef[] = [
    { field: 'companyId', headerName: 'Company ID', width: 130, sortable: true, filter: true },
    { field: 'fullName', headerName: 'Full Name', flex: 1, sortable: true, filter: true },
    { field: 'userName', headerName: 'Username', flex: 1, sortable: true, filter: true },
    { field: 'email', headerName: 'Email', flex: 1.5, sortable: true, filter: true },
    { field: 'role', headerName: 'Role', width: 120, sortable: true, filter: true,
      cellRenderer: (params: any) => `<span class="role-badge ${params.value?.toLowerCase()}">${params.value}</span>` },
    { field: 'gender', headerName: 'Gender', width: 100, sortable: true, filter: true,
      valueFormatter: (p: any) => p.value || '—' },
    { field: 'active', headerName: 'Status', width: 110, sortable: true, filter: true,
      cellRenderer: (params: any) => params.value
        ? `<span class="active-badge">Active</span>`
        : `<span class="inactive-badge">Inactive</span>` },
    { headerName: 'Action', width: 100, sortable: false, filter: false,
      cellRenderer: () => `
        <button class="edit-btn" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="delete-btn" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`,
      onCellClicked: (params: any) => {
        const btn = (params.event?.target as HTMLElement)?.closest('button');
        if (btn?.classList.contains('delete-btn')) this.openDeleteConfirm(params.data);
        else if (btn?.classList.contains('edit-btn')) this.openEditForm(params.data);
      }
    }
  ];
  leaveTypeColDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, sortable: true },
    { field: 'leaveName', headerName: 'Leave Name', flex: 1, sortable: true, filter: true },
    { field: 'leaveUniqueName', headerName: 'Unique Name', flex: 1, sortable: true, filter: true },
    { field: 'description', headerName: 'Description', flex: 2, sortable: true, filter: true },
    { field: 'maxDays', headerName: 'Max Days', width: 120, sortable: true },
    { headerName: 'Action', width: 120, sortable: false, filter: false,
      cellRenderer: () => `
        <button class="edit-btn" title="Edit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="delete-btn" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`,
      onCellClicked: (params: any) => {
        const btn = (params.event?.target as HTMLElement)?.closest('button');
        if (btn?.classList.contains('delete-btn')) this.openDeleteLeaveTypeConfirm(params.data);
        else if (btn?.classList.contains('edit-btn')) this.openEditLeaveTypeForm(params.data);
      }
    }
  ];
  get flattenedLeaves(): any[] {
    return this.myLeaves.map(l => {
      const lastTrail = l.trail?.length ? l.trail[l.trail.length - 1] : null;
      const managerTrail = l.trail?.find((t: any) => t.stage === 'MANAGER');
      const adminTrail = l.trail?.find((t: any) => t.stage === 'ADMIN');
      let reviewedBy = '';
      let rejectionReason = '';
      if (l.status === 'REJECTED') {
        const rt = adminTrail?.status === 'REJECTED' ? adminTrail : managerTrail;
        reviewedBy = this.getFullName(rt?.reviewedBy || lastTrail?.reviewedBy || '');
        rejectionReason = rt?.rejectionReason || lastTrail?.rejectionReason || '';
      } else {
        reviewedBy = this.getFullName(lastTrail?.reviewedBy || '');
      }
      const totalDays = l.days?.length
        ? l.days.reduce((s: number, d: any) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0)
        : this.getDays(l);
      return { ...l, reviewedBy, rejectionReason, totalDays };
    });
  }
  myLeaveColDefs: ColDef[] = [
    { field: 'leaveType', headerName: 'Leave Type', flex: 1, sortable: true, filter: true },
    { field: 'fromDate', headerName: 'From', width: 115, sortable: true },
    { field: 'toDate', headerName: 'To', width: 115, sortable: true },
    { headerName: 'Duration', width: 100, sortable: false,
      cellRenderer: (p: any) => {
        const total = p.data?.totalDays ??
          (p.data?.days?.length ? p.data.days.reduce((s: number, d: any) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0) : 1);
        return `<span class="full-day-badge">${total} day(s)</span>`;
      }
    },
    { field: 'reason', headerName: 'Reason', flex: 1.5, sortable: true, filter: true },
    { field: 'createdAt', headerName: 'Applied On', width: 120, sortable: true },
    { field: 'status', headerName: 'Status', width: 155, sortable: true,
      cellRenderer: (p: any) => {
        const s = p.value || 'PENDING';
        const cls = s === 'APPROVED' ? 'status-approved'
          : s === 'REJECTED' ? 'status-rejected'
          : s === 'PARTIAL' ? 'status-partial'
          : s === 'MANAGER_APPROVED' ? 'status-manager-approved'
          : 'status-pending';
        const label = s === 'PARTIAL' ? 'Partially Approved'
          : s === 'MANAGER_APPROVED' ? 'Manager Approved'
          : s;
        return `<span class="${cls}">${label}</span>`;
      }
    },
    { field: 'reviewedBy', headerName: 'Reviewed By', flex: 1, sortable: true, filter: true,
      cellRenderer: (p: any) => {
        const v = p.value || '';
        return v ? `<span style="color:#475569;font-size:13px">${v}</span>` : `<span style="color:#cbd5e1;font-size:12px">—</span>`;
      }
    },
    { headerName: 'Action', width: 100, sortable: false, filter: false,
      cellRenderer: (p: any) => {
        const s = p.data?.status || 'PENDING';
        const isPending = s === 'PENDING';
        const disabledAttr = isPending ? '' : 'disabled';
        const disabledClass = isPending ? '' : ' btn-disabled';
        return `<button class="edit-btn${disabledClass}" title="Edit" ${disabledAttr}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
               <button class="delete-btn${disabledClass}" title="Delete" ${disabledAttr}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`;
      },
      onCellClicked: (p: any) => {
        const btn = (p.event?.target as HTMLElement)?.closest('button');
        if (!btn || btn.hasAttribute('disabled')) return;
        if (btn.classList.contains('edit-btn')) this.openEditLeaveForm(p.data);
        else if (btn.classList.contains('delete-btn')) this.openDeleteLeaveConfirm(p.data);
      }
    },
    { headerName: 'Trail', width: 110, sortable: false, filter: false,
      cellStyle: { display: 'flex', alignItems: 'center' },
      cellRenderer: () => `<button class="audit-view-btn">View Trail</button>`,
      onCellClicked: (p: any) => { this.zone.run(() => this.openTrailModal(p.data)); }
    }
  ];
  leaveColDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 80, sortable: true },
    { field: 'leaveType', headerName: 'Leave Type', flex: 1, sortable: true, filter: true },
    { field: 'emailId', headerName: 'Email', flex: 1.5, sortable: true, filter: true },
    { field: 'fromDate', headerName: 'From Date', width: 130, sortable: true },
    { field: 'toDate', headerName: 'To Date', width: 130, sortable: true },
    { field: 'reason', headerName: 'Reason', flex: 1.5, sortable: true, filter: true },
    { field: 'comments', headerName: 'Comments', flex: 1, sortable: true }
  ];
  defaultColDef: ColDef = { resizable: true };
  onGridReady(params: GridReadyEvent) { this.gridApi = params.api; }
  constructor(
    private auth: AuthService,
    private userService: UserService,
    private leaveService: LeaveService,
    private cacheService: CacheService,
    private router: Router,
    private toast: ToastService,
    private zone: NgZone
  ) {
    this.fullName = this.auth.getFullName() || 'Admin';
    this.role = this.auth.getRole() || 'ADMIN';
    this.gender = this.auth.getGender() || '';
  }
  ngOnInit() {
    this.userService.getRoles().subscribe({ next: (r) => this.roles = r, error: () => {} });
    
    const cachedMenus = this.cacheService.getMenus(this.role);
    if (cachedMenus) {
      this.menus = cachedMenus;
    } else {
      this.userService.getMenusByRole(this.role).subscribe({ 
        next: (m) => { 
          this.menus = m; 
          this.cacheService.setMenus(this.role, m);
        }, 
        error: () => {} 
      });
    }

    const cachedUsers = this.cacheService.getUsers();
    if (cachedUsers) {
      this.users = cachedUsers.sort((a, b) => {
        const nA = parseInt(a.companyId?.replace('Cresen', '') || '0');
        const nB = parseInt(b.companyId?.replace('Cresen', '') || '0');
        return nA - nB;
      });
      cachedUsers.forEach((u: any) => this.userFullNameMap.set(u.email, u.fullName));
    } else {
      this.userService.getAllUsers().subscribe({
        next: (users) => {
          this.users = users.sort((a, b) => {
            const nA = parseInt(a.companyId?.replace('Cresen', '') || '0');
            const nB = parseInt(b.companyId?.replace('Cresen', '') || '0');
            return nA - nB;
          });
          users.forEach(u => this.userFullNameMap.set(u.email, u.fullName));
          this.cacheService.setUsers(users);
        },
        error: () => {}
      });
    }

    this.userService.getStats().subscribe({ next: (s) => this.stats = s, error: () => {} });
    
    const cachedManagers = this.cacheService.getManagers();
    if (cachedManagers) {
      this.managers = cachedManagers;
    } else {
      this.userService.getManagers().subscribe({ 
        next: (m) => { 
          this.managers = m; 
          this.cacheService.setManagers(m);
        }, 
        error: () => {} 
      });
    }

    this.refreshMyLeaves();
    
    const cachedLeaveTypes = this.cacheService.getLeaveTypes();
    if (cachedLeaveTypes) {
      this.leaveTypes = cachedLeaveTypes;
    } else {
      this.leaveService.getLeaveTypes().subscribe({ 
        next: (t) => { 
          this.leaveTypes = t; 
          this.cacheService.setLeaveTypes(t);
        }, 
        error: () => {} 
      });
    }

    const cachedHolidays = this.cacheService.getHolidays();
    if (cachedHolidays) {
      PUBLIC_HOLIDAYS.length = 0;
      cachedHolidays.forEach((h: any) => PUBLIC_HOLIDAYS.push(h.date));
    } else {
      this.leaveService.getHolidays().subscribe({
        next: (h) => { 
          PUBLIC_HOLIDAYS.length = 0; 
          h.forEach(hol => PUBLIC_HOLIDAYS.push(hol.date));
          this.cacheService.setHolidays(h);
        },
        error: () => {}
      });
    }

    this.loadPendingLeaves();
    if (this.activeMenu !== 'home') this.onMenuChange(this.activeMenu);
  }
  loadData() {
    this.userService.getAllUsers().subscribe({
      next: (u) => this.users = u.sort((a, b) => {
        const nA = parseInt(a.companyId?.replace('Cresen', '') || '0');
        const nB = parseInt(b.companyId?.replace('Cresen', '') || '0');
        return nA - nB;
      }), error: () => {}
    });
    this.userService.getStats().subscribe({ next: (s) => this.stats = s, error: () => {} });
  }
  get activeMenuLabel(): string {
    return this.menus.find(m => m.menuKey === this.activeMenu)?.menuLabel || this.activeMenu;
  }
  get quickActionMenus(): MenuItem[] {
    return this.menus.filter(m => m.menuKey !== 'home' && m.menuKey !== 'holidaymanagement' && m.menuKey !== 'leavehistory' && m.menuKey !== 'audit');
  }
  get filteredMenus(): MenuItem[] {
    return this.menus.filter(m => m.menuKey !== 'holidaymanagement' && m.menuKey !== 'leavehistory' && m.menuKey !== 'audit');
  }
  get filteredUsers(): User[] {
    const q = this.searchQuery.toLowerCase();
    if (!q) return this.users;
    return this.users.filter(u =>
      u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) || u.companyId?.toLowerCase().includes(q)
    );
  }
  onMenuChange(menuKey: string) {
    this.activeMenu = menuKey;
    sessionStorage.setItem('adm_activeMenu', menuKey);
    if (menuKey === 'home') {
      this.refreshMyLeaves();
    }
    if (menuKey === 'mytasks') {
      this.loadPendingLeaves();
    }
    if (menuKey === 'leavemanagement') {
      this.leaveManagementTab = 'types';
      this.refreshHolidays();
    }
    if (menuKey === 'apply') {
      this.applyLeaveTab = 'apply';
    }
  }

  onTaskTabChange(tab: 'pending' | 'logged') {
    this.tabLoading = true;
    this.myTasksTab = tab;
    window.setTimeout(() => this.tabLoading = false, 200);
  }
  private getDays(l: Leave): number {
    if (l.totalDays != null) return l.totalDays;
    if (l.days && l.days.length > 0) return l.days.reduce((s, d) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
    return l.dayType === 'HALF_DAY' ? 0.5 : calcWorkingDays(l.fromDate, l.toDate);
  }
  get totalLeaveDays(): number {
    return this.leaveDays.reduce((s, d) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
  }
  get leaveBalances(): { leaveName: string; maxDays: number; usedDays: number; remaining: number }[] {
    return this.availableLeaveTypes.map(lt => {
      const usedDays = this.myLeaves
        .filter(l => l.leaveType === lt.leaveName && (l.status === 'APPROVED' || l.status === 'PARTIAL'))
        .reduce((sum, l) => {
          if (l.status === 'PARTIAL' && l.days?.length)
            return sum + l.days.filter((d: any) => d.status === 'APPROVED').reduce((s: number, d: any) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
          return sum + this.getDays(l);
        }, 0);
      return { leaveName: lt.leaveName, maxDays: lt.maxDays, usedDays, remaining: Math.max(0, lt.maxDays - usedDays) };
    });
  }
  get leaveAvailable(): { leaveName: string; maxDays: number; available: number; pendingDays: number }[] {
    return this.availableLeaveTypes.map(lt => {
      const approvedDays = this.myLeaves
        .filter(l => l.leaveType === lt.leaveName && (l.status === 'APPROVED' || l.status === 'PARTIAL'))
        .reduce((s, l) => {
          if (l.status === 'PARTIAL' && l.days?.length)
            return s + l.days.filter((d: any) => d.status === 'APPROVED').reduce((a: number, d: any) => a + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
          return s + this.getDays(l);
        }, 0);
      const pendingDays = this.myLeaves
        .filter(l => l.leaveType === lt.leaveName && (l.status === 'PENDING' || l.status === 'MANAGER_APPROVED'))
        .reduce((s, l) => s + this.getDays(l), 0);
      return { leaveName: lt.leaveName, maxDays: lt.maxDays, available: Math.max(0, lt.maxDays - approvedDays - pendingDays), pendingDays };
    });
  }
  refreshMyLeaves() {
    this.leaveService.getMyLeaves().subscribe({ next: (l) => this.myLeaves = l, error: () => {} });
  }
  onPendingGridReady(e: GridReadyEvent) { this.pendingGridApi = e.api; }
  onLoggedGridReady(e: GridReadyEvent) { this.loggedGridApi = e.api; }
  loadPendingLeaves() {
    this.leaveService.getPendingLeavesFor().subscribe({
      next: (l) => {
        this.pendingLeaves = l;
        this.pendingGridApi?.setGridOption('rowData', this.pendingLeaves);
      },
      error: () => {}
    });
    this.leaveService.getAdminLoggedLeaves().subscribe({
      next: (data: any) => {
        const records: any[] = data?.approved_leaves || [];
        this.loggedLeaves = records.map((r: any) => ({
          id: r.leaveId, emailId: r.employeeEmail, leaveType: r.leaveType,
          fromDate: r.fromDate, toDate: r.toDate, totalDays: r.totalDays,
          status: r.status, createdAt: r.approvedDate,
          reason: '', comments: '', dayType: 'FULL_DAY', halfDaySession: '', editable: false
        } as Leave));
        this.loggedGridApi?.setGridOption('rowData', this.loggedLeaves);
      },
      error: () => {}
    });
  }
  approveLeave(leave: Leave) {
    this.taskLoading = true;
    this.leaveService.approveLeave(leave.id).subscribe({
      next: () => { 
        this.taskLoading = false; 
        this.toast.show('Leave approved!', 'success'); 
        this.loadPendingLeaves();
        this.refreshMyLeaves();
      },
      error: () => { this.taskLoading = false; this.toast.show('Failed to approve leave.', 'error'); }
    });
  }
  openRejectModal(leave: Leave) { this.rejectingLeave = leave; this.rejectReason = ''; this.showRejectModal = true; }
  closeRejectModal() { this.rejectingLeave = null; this.showRejectModal = false; }
  confirmReject() {
    if (!this.rejectingLeave) return;
    if (!this.rejectReason || !this.rejectReason.trim()) {
      this.toast.show('Rejection reason is required.', 'error'); return;
    }
    this.pageLoading = true;
    this.leaveService.rejectLeave(this.rejectingLeave.id, this.rejectReason.trim()).subscribe({
      next: () => { 
        this.pageLoading = false; 
        this.closeRejectModal(); 
        this.toast.show('Leave rejected!', 'success'); 
        this.loadPendingLeaves();
        this.refreshMyLeaves();
      },
      error: () => { this.pageLoading = false; this.toast.show('Failed to reject leave.', 'error'); this.closeRejectModal(); }
    });
  }
  openActionWizard(leave: Leave) {
    const allDays = leave.days && leave.days.length > 0
      ? leave.days
      : [{ date: leave.fromDate, dayType: leave.dayType || 'FULL_DAY', halfDaySession: '' as any }];
    const eligibleDays = allDays.filter((d: any) => d.status !== 'REJECTED');
    this.actionLeave = leave;
    this.dayDecisions = eligibleDays.map((d: any) => ({ date: d.date, dayType: d.dayType, status: 'APPROVED' as const, reason: '' }));
    this.showActionWizard = true;
  }
  closeActionWizard() { this.showActionWizard = false; this.actionLeave = null; this.dayDecisions = []; }
  openApproveAllConfirm() { this.showApproveAllConfirm = true; }
  closeApproveAllConfirm() { this.showApproveAllConfirm = false; }
  confirmApproveAll() {
    this.dayDecisions.forEach(d => { d.status = 'APPROVED'; d.reason = ''; });
    this.showApproveAllConfirm = false;
  }
  openRejectAllConfirm() { this.rejectAllReason = ''; this.showRejectAllConfirm = true; }
  closeRejectAllConfirm() { this.showRejectAllConfirm = false; }
  confirmRejectAll() {
    if (!this.rejectAllReason.trim()) {
      this.toast.show('Rejection reason is required.', 'error'); return;
    }
    this.dayDecisions.forEach(d => { d.status = 'REJECTED'; d.reason = this.rejectAllReason.trim(); });
    this.showRejectAllConfirm = false;
  }
  setAllDecisions(status: 'APPROVED' | 'REJECTED') {
    this.dayDecisions.forEach(d => d.status = status);
  }
  submitActionWizard() {
    if (!this.actionLeave) return;
    const missingReason = this.dayDecisions.find(d => d.status === 'REJECTED' && !d.reason?.trim());
    if (missingReason) {
      this.toast.show(`Rejection reason is required for ${missingReason.date}.`, 'error'); return;
    }
    this.pageLoading = true;
    const reviewedId = this.actionLeave.id;
    const payload = this.dayDecisions.map(d => ({ date: d.date, status: d.status, reason: d.reason?.trim() || undefined }));
    this.leaveService.partialReview(reviewedId, payload).subscribe({
      next: () => {
        this.pageLoading = false;
        this.closeActionWizard();
        this.toast.show('Review submitted!', 'success');
        this.pendingLeaves = this.pendingLeaves.filter(l => l.id !== reviewedId);
        this.pendingGridApi?.setGridOption('rowData', this.pendingLeaves);
        // Refresh both pending and logged leaves to ensure proper updates
        setTimeout(() => {
          this.loadPendingLeaves();
          // Refresh admin's own leaves to update progress bar
          this.refreshMyLeaves();
        }, 500);
      },
      error: () => { this.pageLoading = false; this.toast.show('Failed to submit review.', 'error'); }
    });
  }
  pendingLeaveColDefs: ColDef[] = [
    { field: 'emailId', headerName: 'Employee', flex: 1.5, sortable: true, filter: true },
    { field: 'leaveType', headerName: 'Leave Type', flex: 1, sortable: true, filter: true },
    { field: 'fromDate', headerName: 'From', width: 115, sortable: true },
    { field: 'toDate', headerName: 'To', width: 115, sortable: true },
    { headerName: 'Duration', width: 100, sortable: false,
      cellRenderer: (p: any) => {
        const total = p.data?.totalDays ??
          (p.data?.days?.length ? p.data.days.reduce((s: number, d: any) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0) : 1);
        return `<span class="full-day-badge">${total} day(s)</span>`;
      }
    },
    { field: 'reason', headerName: 'Reason', flex: 1, sortable: true, filter: true },
    { field: 'createdAt', headerName: 'Applied On', width: 115, sortable: true },
    { headerName: 'Action', width: 120, minWidth: 120, maxWidth: 120, sortable: false, filter: false, resizable: false, suppressSizeToFit: true,
      cellStyle: { display: 'flex', alignItems: 'center', padding: '0 4px' },
      cellRenderer: (p: any) => {
        const btn = document.createElement('button');
        btn.className = 'action-btn-text';
        btn.textContent = 'Take Action';
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.zone.run(() => this.openActionWizard(p.data)); });
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;height:100%';
        wrap.appendChild(btn);
        return wrap;
      }
    },
    { headerName: 'Trail', width: 110, sortable: false, filter: false,
      cellStyle: { display: 'flex', alignItems: 'center' },
      cellRenderer: () => `<button class="audit-view-btn">View Trail</button>`,
      onCellClicked: (p: any) => { this.zone.run(() => this.openTrailModal(p.data)); }
    }
  ];
  loggedLeaveColDefs: ColDef[] = [
    { field: 'emailId', headerName: 'Employee', flex: 1.5, sortable: true, filter: true },
    { field: 'leaveType', headerName: 'Leave Type', flex: 1, sortable: true, filter: true },
    { field: 'fromDate', headerName: 'From', width: 115, sortable: true },
    { field: 'toDate', headerName: 'To', width: 115, sortable: true },
    { headerName: 'Duration', width: 100, sortable: false,
      cellRenderer: (p: any) => {
        const total = p.data?.totalDays ??
          (p.data?.days?.length ? p.data.days.reduce((s: number, d: any) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0) : 1);
        return `<span class="full-day-badge">${total} day(s)</span>`;
      }
    },
    { field: 'reason', headerName: 'Reason', flex: 1, sortable: true, filter: true },
    { field: 'createdAt', headerName: 'Applied On', width: 115, sortable: true },
    { field: 'status', headerName: 'Status', width: 140, sortable: true,
      cellRenderer: (p: any) => {
        const s = p.value || '';
        const cls = s === 'APPROVED' ? 'status-approved' : s === 'REJECTED' ? 'status-rejected' : s === 'PARTIAL' ? 'status-partial' : 'status-pending';
        const label = s === 'PARTIAL' ? 'Partially Approved' : s;
        return `<span class="${cls}">${label}</span>`;
      }
    },
    { headerName: 'Trail', width: 110, sortable: false, filter: false,
      cellStyle: { display: 'flex', alignItems: 'center' },
      cellRenderer: () => `<button class="audit-view-btn">View Trail</button>`,
      onCellClicked: (p: any) => { this.zone.run(() => this.openTrailModal(p.data)); }
    }
  ];
  refreshHolidays() {
    this.cacheService.invalidateHolidays();
    this.leaveService.getHolidays().subscribe({
      next: (h) => {
        this.holidays = h;
        PUBLIC_HOLIDAYS.length = 0;
        h.forEach(hol => PUBLIC_HOLIDAYS.push(hol.date));
        this.cacheService.setHolidays(h);
      },
      error: () => {}
    });
  }
  openHolidayForm() {
    this.holidayForm = { name: '', date: '' };
    this.showHolidayForm = true;
  }
  closeHolidayForm() { this.showHolidayForm = false; }
  submitHolidayForm() {
    if (!this.holidayForm.name || !this.holidayForm.date) {
      this.toast.show('Holiday name and date are required.', 'error'); return;
    }
    this.pageLoading = true;
    this.leaveService.createHoliday(this.holidayForm).subscribe({
      next: () => { this.pageLoading = false; this.toast.show('Holiday added!', 'success'); this.closeHolidayForm(); this.refreshHolidays(); },
      error: (err) => { this.pageLoading = false; this.toast.show(err.status === 409 ? 'A holiday already exists on this date.' : 'Failed to add holiday.', 'error'); }
    });
  }
  openEditHolidayForm(h: Holiday) {
    this.editingHoliday = h;
    this.editHolidayForm = { name: h.name, date: h.date };
    this.showEditHolidayForm = true;
  }
  closeEditHolidayForm() { this.showEditHolidayForm = false; this.editingHoliday = null; }
  submitEditHolidayForm() {
    if (!this.editingHoliday) return;
    if (!this.editHolidayForm.name || !this.editHolidayForm.date) {
      this.toast.show('Holiday name and date are required.', 'error'); return;
    }
    this.pageLoading = true;
    this.leaveService.updateHoliday(this.editingHoliday.id, this.editHolidayForm).subscribe({
      next: () => { this.pageLoading = false; this.toast.show('Holiday updated!', 'success'); this.closeEditHolidayForm(); this.refreshHolidays(); },
      error: (err) => { this.pageLoading = false; this.toast.show(err.status === 409 ? 'A holiday already exists on this date.' : 'Failed to update holiday.', 'error'); }
    });
  }
  openDeleteHolidayConfirm(h: Holiday) { this.deletingHoliday = h; this.showDeleteHolidayConfirm = true; }
  closeDeleteHolidayConfirm() { this.deletingHoliday = null; this.showDeleteHolidayConfirm = false; }
  confirmDeleteHoliday() {
    if (!this.deletingHoliday) return;
    this.pageLoading = true;
    this.leaveService.deleteHoliday(this.deletingHoliday.id).subscribe({
      next: () => { this.pageLoading = false; this.toast.show('Holiday deleted!', 'success'); this.closeDeleteHolidayConfirm(); this.refreshHolidays(); },
      error: () => { this.pageLoading = false; this.toast.show('Failed to delete holiday.', 'error'); this.closeDeleteHolidayConfirm(); }
    });
  }
  validateLeaveName() {
    const name = this.leaveTypeForm.leaveName.trim();
    if (!name) { this.leaveTypeFieldErrors['leaveName'] = ''; return; }
    this.leaveTypeFieldErrors['leaveName'] = this.leaveTypes.some(t => t.leaveName?.toLowerCase() === name.toLowerCase())
      ? 'Leave name already exists.' : '';
  }
  validateLeaveUniqueName() {
    const uname = this.leaveTypeForm.leaveUniqueName.trim();
    if (!uname) { this.leaveTypeFieldErrors['leaveUniqueName'] = ''; return; }
    this.leaveTypeFieldErrors['leaveUniqueName'] = this.leaveTypes.some(t => t.leaveUniqueName?.toLowerCase() === uname.toLowerCase())
      ? 'Unique name already exists.' : '';
  }
  openEditLeaveTypeForm(lt: LeaveType) {
    this.editingLeaveType = lt;
    this.editLeaveTypeForm = { leaveName: lt.leaveName, leaveUniqueName: lt.leaveUniqueName, description: lt.description, maxDays: lt.maxDays };
    this.editLeaveTypeFieldErrors = {};
    this.showEditLeaveTypeForm = true;
  }
  closeEditLeaveTypeForm() { this.showEditLeaveTypeForm = false; this.editingLeaveType = null; }
  validateEditLeaveName() {
    const name = this.editLeaveTypeForm.leaveName.trim();
    if (!name) { this.editLeaveTypeFieldErrors['leaveName'] = ''; return; }
    this.editLeaveTypeFieldErrors['leaveName'] = this.leaveTypes.some(t => t.leaveName?.toLowerCase() === name.toLowerCase() && t.id !== this.editingLeaveType?.id)
      ? 'Leave name already exists.' : '';
  }
  validateEditLeaveUniqueName() {
    const uname = this.editLeaveTypeForm.leaveUniqueName.trim();
    if (!uname) { this.editLeaveTypeFieldErrors['leaveUniqueName'] = ''; return; }
    this.editLeaveTypeFieldErrors['leaveUniqueName'] = this.leaveTypes.some(t => t.leaveUniqueName?.toLowerCase() === uname.toLowerCase() && t.id !== this.editingLeaveType?.id)
      ? 'Unique name already exists.' : '';
  }
  submitEditLeaveTypeForm() {
    if (!this.editingLeaveType) return;
    if (!this.editLeaveTypeForm.leaveName || !this.editLeaveTypeForm.leaveUniqueName || !this.editLeaveTypeForm.maxDays) {
      this.toast.show('Leave name, unique name and max days are required.', 'error'); return;
    }
    if (Object.values(this.editLeaveTypeFieldErrors).some(e => e)) {
      this.toast.show('Please fix the errors before submitting.', 'error'); return;
    }
    this.leaveTypeLoading = true;
    this.leaveService.updateLeaveType(this.editingLeaveType.id, this.editLeaveTypeForm).subscribe({
      next: (updated) => {
        this.leaveTypeLoading = false;
        this.toast.show('Leave type updated successfully!', 'success');
        this.leaveTypes = this.leaveTypes.map(t => t.id === updated.id ? updated : t);
        setTimeout(() => this.closeEditLeaveTypeForm(), 1500);
      },
      error: () => { this.leaveTypeLoading = false; this.toast.show('Failed to update leave type.', 'error'); }
    });
  }
  openDeleteLeaveTypeConfirm(lt: LeaveType) {
    this.deletingLeaveType = lt;
    this.showDeleteLeaveTypeConfirm = true;
  }
  closeDeleteLeaveTypeConfirm() {
    this.deletingLeaveType = null;
    this.showDeleteLeaveTypeConfirm = false;
  }
  confirmDeleteLeaveType() {
    if (!this.deletingLeaveType) return;
    this.leaveService.deleteLeaveType(this.deletingLeaveType.id).subscribe({
      next: () => {
        this.toast.show('Leave type deleted!', 'success');
        const deletedId = this.deletingLeaveType!.id;
        this.leaveTypes = this.leaveTypes.filter(t => t.id !== deletedId);
        this.closeDeleteLeaveTypeConfirm();
      },
      error: () => { this.toast.show('Failed to delete leave type.', 'error'); this.closeDeleteLeaveTypeConfirm(); }
    });
  }
  openLeaveTypeForm() {
    this.showLeaveTypeForm = true;
    this.leaveTypeForm = { leaveName: '', leaveUniqueName: '', description: '', maxDays: 0 };
    this.leaveTypeFieldErrors = {};
  }
  closeLeaveTypeForm() { this.showLeaveTypeForm = false; }
  submitLeaveTypeForm() {
    if (!this.leaveTypeForm.leaveName || !this.leaveTypeForm.leaveUniqueName || !this.leaveTypeForm.maxDays) {
      this.toast.show('Leave name, unique name and max days are required.', 'error'); return;
    }
    if (Object.values(this.leaveTypeFieldErrors).some(e => e)) {
      this.toast.show('Please fix the errors before submitting.', 'error'); return;
    }
    this.leaveTypeLoading = true;
    this.leaveService.createLeaveType(this.leaveTypeForm).subscribe({
      next: (created) => {
        this.leaveTypeLoading = false;
        this.toast.show('Leave type created successfully!', 'success');
        this.leaveTypes = [...this.leaveTypes, created];
        setTimeout(() => this.closeLeaveTypeForm(), 1500);
      },
      error: () => { this.leaveTypeLoading = false; this.toast.show('Failed to create leave type.', 'error'); }
    });
  }
  openLeaveForm() {
    this.leaveFormType = '';
    this.leaveFormFromDate = '';
    this.leaveFormToDate = '';
    this.leaveFormReason = '';
    this.leaveFormManagerEmail = '';
    this.leaveDays = [];
    this.leaveDayError = '';
    this.showLeaveForm = true;
  }
  closeLeaveForm() { this.showLeaveForm = false; }
  submitLeaveForm() {
    if (!this.leaveFormType || !this.leaveFormFromDate || !this.leaveFormToDate || !this.leaveFormReason) {
      this.toast.show('Leave type, dates and reason are required.', 'error'); return;
    }
    this.validateLeaveDays(true);
    if (this.leaveDayError) { this.toast.show(this.leaveDayError, 'error'); return; }
    if (this.leaveDays.length === 0) { this.toast.show('No working days in selected range.', 'error'); return; }
    this.pageLoading = true;
    const req: CreateLeaveRequest = {
      leaveType: this.leaveFormType,
      fromDate: this.leaveDays[0].date,
      toDate: this.leaveDays[this.leaveDays.length - 1].date,
      reason: this.leaveFormReason,
      comments: '',
      dayType: this.leaveDays[0].dayType,
      halfDaySession: this.leaveDays[0].halfDaySession,
      days: this.leaveDays,
      managerEmail: this.leaveFormManagerEmail || undefined
    };
    this.leaveService.createLeave(req).subscribe({
      next: () => {
        this.pageLoading = false;
        this.closeLeaveForm();
        this.toast.show('Leave application submitted!', 'success');
        this.refreshMyLeaves();
      },
      error: (err) => {
        this.pageLoading = false;
        this.toast.show(err.status === 409 ? 'You already have a leave overlapping these dates.' : 'Failed to submit leave.', 'error');
      }
    });
  }
  openEditLeaveForm(leave: Leave) {
    this.editingLeave = leave;
    this.editLeaveForm = { leaveType: leave.leaveType, fromDate: leave.fromDate, toDate: leave.toDate, reason: leave.reason, comments: leave.comments || '', dayType: leave.dayType || 'FULL_DAY', halfDaySession: leave.halfDaySession || '' };
    this.editLeaveDayCount = this.calcDays(leave.fromDate, leave.toDate, leave.dayType);
    this.leaveDayError = '';
    this.showEditLeaveForm = true;
  }
  closeEditLeaveForm() { this.showEditLeaveForm = false; this.editingLeave = null; }
  submitEditLeaveForm() {
    if (!this.editingLeave) return;
    if (!this.editLeaveForm.leaveType || !this.editLeaveForm.fromDate || !this.editLeaveForm.toDate || !this.editLeaveForm.reason) {
      this.toast.show('All required fields must be filled.', 'error'); return;
    }
    if (this.editLeaveForm.dayType === 'HALF_DAY' && !this.editLeaveForm.halfDaySession) {
      this.toast.show('Please select Morning or Afternoon for half day.', 'error'); return;
    }
    if (this.leaveDayError) { this.toast.show(this.leaveDayError, 'error'); return; }
    this.pageLoading = true;
    this.leaveService.updateLeave(this.editingLeave.id, this.editLeaveForm).subscribe({
      next: () => {
        this.pageLoading = false;
        this.closeEditLeaveForm();
        this.toast.show('Leave updated successfully!', 'success');
        this.refreshMyLeaves();
      },
      error: (err) => {
        this.pageLoading = false;
        this.toast.show(err.status === 409 ? 'You already have a leave overlapping these dates.' : 'Failed to update leave.', 'error');
      }
    });
  }
  openDeleteLeaveConfirm(leave: Leave) { this.deletingLeave = leave; this.showDeleteLeaveConfirm = true; }
  closeDeleteLeaveConfirm() { this.deletingLeave = null; this.showDeleteLeaveConfirm = false; }
  confirmDeleteLeave() {
    if (!this.deletingLeave) return;
    this.leaveService.deleteLeave(this.deletingLeave.id).subscribe({
      next: () => { this.toast.show('Leave deleted!', 'success'); this.closeDeleteLeaveConfirm(); this.refreshMyLeaves(); },
      error: () => { this.toast.show('Failed to delete leave.', 'error'); this.closeDeleteLeaveConfirm(); }
    });
  }
  validateEmail() {
    const email = this.form.email.trim();
    if (!email) { this.fieldErrors['email'] = ''; return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { this.fieldErrors['email'] = 'Invalid email format.'; return; }
    this.fieldErrors['email'] = this.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
      ? 'Email already exists.' : '';
  }
  validateUsername() {
    const username = this.form.userName.trim();
    if (!username) { this.fieldErrors['userName'] = ''; return; }
    this.fieldErrors['userName'] = this.users.some(u => u.userName?.toLowerCase() === username.toLowerCase())
      ? 'Username already taken.' : '';
  }
  validatePassword() {
    this.fieldErrors['password'] = this.form.password.length > 0 && this.form.password.length < 6
      ? 'Password must be at least 6 characters.' : '';
  }
  openForm() {
    this.showForm = true;
    this.form = { userName: '', fullName: '', email: '', password: '', role: '', active: true, gender: '' };
    this.errorMessage = '';
    this.fieldErrors = {};
    this.userService.getNextCompanyId().subscribe({ next: (id) => this.nextCompanyId = id, error: () => {} });
  }
  closeForm() { this.showForm = false; this.errorMessage = ''; }
  submitForm() {
    this.errorMessage = '';
    if (Object.values(this.fieldErrors).some(e => e)) { this.errorMessage = 'Please fix the errors above.'; return; }
    if (!this.form.userName.trim() || !this.form.fullName.trim() || !this.form.email.trim() ||
        !this.form.password || !this.form.role || !this.form.gender) {
      this.errorMessage = 'All fields are required.'; return;
    }
    this.pageLoading = true;
    this.userService.createUser(this.form).subscribe({
      next: () => {
        this.pageLoading = false;
        this.closeForm();
        this.toast.show('User created successfully!', 'success');
        this.loadData();
        this.userService.getNextCompanyId().subscribe({ next: (id) => this.nextCompanyId = id, error: () => {} });
      },
      error: (err) => {
        this.pageLoading = false;
        const msg = err.status === 409
          ? ((err.error?.detail || err.error?.message || '').toLowerCase().includes('username') ? 'Username already exists.' : 'Email already exists.')
          : 'Failed to create user.';
        this.toast.show(msg, 'error');
      }
    });
  }
  openDeleteConfirm(user: User) { this.deletingUser = user; this.showDeleteConfirm = true; }
  closeDeleteConfirm() { this.deletingUser = null; this.showDeleteConfirm = false; }
  confirmDelete() {
    if (!this.deletingUser) return;
    this.pageLoading = true;
    this.userService.deleteUser(this.deletingUser.id).subscribe({
      next: () => { this.pageLoading = false; this.closeDeleteConfirm(); this.toast.show('User deleted successfully!', 'success'); this.loadData(); },
      error: () => { this.pageLoading = false; this.toast.show('Failed to delete user.', 'error'); this.closeDeleteConfirm(); }
    });
  }
  openEditForm(user: User) {
    this.editingUser = user;
    this.editForm = { userName: user.userName, fullName: user.fullName, role: user.role, active: user.active, gender: user.gender || '' };
    this.showEditForm = true;
    this.errorMessage = '';
  }
  closeEditForm() { this.showEditForm = false; this.editingUser = null; this.errorMessage = ''; }
  submitEditForm() {
    if (!this.editingUser) return;
    this.errorMessage = '';
    if (!this.editForm.userName.trim() || !this.editForm.fullName.trim() || !this.editForm.role || !this.editForm.gender) {
      this.errorMessage = 'All fields are required.'; return;
    }
    this.pageLoading = true;
    this.userService.updateUser(this.editingUser.id, this.editForm).subscribe({
      next: () => { this.pageLoading = false; this.closeEditForm(); this.toast.show('User updated successfully!', 'success'); this.loadData(); },
      error: () => { this.pageLoading = false; this.toast.show('Failed to update user.', 'error'); }
    });
  }
  openTrailModal(leave: Leave) { this.trailLeave = leave; this.showTrailModal = true; }
  closeTrailModal() { this.showTrailModal = false; this.trailLeave = null; }

  logout() { this.auth.logout(); this.router.navigate(['/']); }
}

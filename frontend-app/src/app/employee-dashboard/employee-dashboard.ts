import { Component, OnInit, NgZone } from '@angular/core';
import { AuthService } from '../services/auth';
import { UserService, MenuItem } from '../services/user';
import { LeaveService, LeaveType, Leave, LeaveDay, CreateLeaveRequest, UpdateLeaveRequest, isRestrictedDate, PUBLIC_HOLIDAYS, calcWorkingDays } from '../services/leave.service';
import { CacheService } from '../services/cache.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ToastService } from '../services/toast.service';
import { TrailModalComponent } from '../shared/trail-modal.component';
ModuleRegistry.registerModules([AllCommunityModule]);
@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [FormsModule, CommonModule, AgGridAngular, TrailModalComponent],
  templateUrl: './employee-dashboard.html',
  styleUrls: ['./employee-dashboard.css']
})
export class EmployeeDashboard implements OnInit {
  activeMenu = sessionStorage.getItem('emp_activeMenu') || 'home';
  applyLeaveTab = 'apply';
  sidebarExpanded = true;
  sidebarWidth = 230;
  showProfile = false;
  fullName = '';
  role = '';
  gender = '';
  menus: MenuItem[] = [];
  private userFullNameMap: Map<string, string> = new Map();
  getFullName(email: string): string {
    return this.userFullNameMap.get(email) || email;
  }
  leaveTypes: LeaveType[] = [];
  myLeaves: Leave[] = [];
  leaveLoading = false;
  deleteLoading = false;
  editLoading = false;
  tabLoading = false;
  menuLoading = false;
  refreshLoading = false;
  pageLoading = false;
  showLeaveForm = false;
  showEditLeaveForm = false;
  showDeleteLeaveConfirm = false;
  editingLeave: Leave | null = null;
  deletingLeave: Leave | null = null;
  showTrailModal = false;
  trailLeave: Leave | null = null;

  leaveFormType = '';
  leaveFormFromDate = '';
  leaveFormToDate = '';
  leaveFormReason = '';
  leaveFormManagerEmail = '';
  managers: import('../services/user').User[] = [];
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
  get filteredMenus(): MenuItem[] {
    return this.menus.filter(m => m.menuKey !== 'leavehistory' && m.menuKey !== 'audit');
  }
  get quickActionMenus(): MenuItem[] {
    return this.menus.filter(m => m.menuKey !== 'home' && m.menuKey !== 'leavehistory' && m.menuKey !== 'audit');
  }
  get activeMenuLabel(): string {
    return this.menus.find(m => m.menuKey === this.activeMenu)?.menuLabel || this.activeMenu;
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
        const newTotal = days.reduce((s, d) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
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
          if (l.status === 'PARTIAL' && l.days?.length) {
            return sum + l.days.filter((d: any) => d.status === 'APPROVED').reduce((s: number, d: any) => s + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
          }
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
          if (l.status === 'PARTIAL' && l.days?.length) {
            return s + l.days.filter((d: any) => d.status === 'APPROVED').reduce((a: number, d: any) => a + (d.dayType === 'HALF_DAY' ? 0.5 : 1), 0);
          }
          return s + this.getDays(l);
        }, 0);
      const pendingDays = this.myLeaves
        .filter(l => l.leaveType === lt.leaveName && l.status === 'PENDING')
        .reduce((s, l) => s + this.getDays(l), 0);
      return { leaveName: lt.leaveName, maxDays: lt.maxDays, available: Math.max(0, lt.maxDays - approvedDays - pendingDays), pendingDays };
    });
  }
  onEditLeaveDatesChange() {
    if (this.editLeaveForm.dayType === 'HALF_DAY') this.editLeaveForm.toDate = this.editLeaveForm.fromDate;
    if (this.editLeaveForm.fromDate && isRestrictedDate(this.editLeaveForm.fromDate)) {
      this.editLeaveDayCount = 0; this.leaveDayError = 'From date cannot be a weekend or public holiday.'; return;
    }
    if (this.editLeaveForm.toDate && isRestrictedDate(this.editLeaveForm.toDate)) {
      this.editLeaveDayCount = 0; this.leaveDayError = 'To date cannot be a weekend or public holiday.'; return;
    }
    this.leaveDayError = '';
  }
  onEditHalfDaySessionChange() { this.leaveDayError = ''; }
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
          : s === 'REJECTED' ? 'Rejected'
          : s === 'APPROVED' ? 'Approved'
          : 'Pending';
        return `<span class="${cls}">${label}</span>`;
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
  defaultColDef: ColDef = { resizable: true };
  constructor(
    private auth: AuthService,
    private userService: UserService,
    private leaveService: LeaveService,
    private cacheService: CacheService,
    private router: Router,
    private toast: ToastService,
    private zone: NgZone
  ) {
    this.fullName = this.auth.getFullName() || 'Employee';
    this.role = this.auth.getRole() || 'EMPLOYEE';
    this.gender = this.auth.getGender() || '';
  }
  ngOnInit() {
    // Load menus with cache
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

    // Load holidays - service handles PUBLIC_HOLIDAYS population
    this.leaveService.getHolidays().subscribe({
      next: (h) => { 
        this.cacheService.setHolidays(h);
      },
      error: () => {}
    });

    // Load leave types with cache
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

    // Load users with cache for name mapping
    const cachedUsers = this.cacheService.getUsers();
    if (cachedUsers) {
      cachedUsers.forEach((u: any) => this.userFullNameMap.set(u.email, u.fullName));
    } else {
      this.userService.getAllUsers().subscribe({
        next: (users) => {
          users.forEach(u => this.userFullNameMap.set(u.email, u.fullName));
          this.cacheService.setUsers(users);
        },
        error: () => {}
      });
    }

    // Load managers with cache
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

    // Always fetch fresh leaves (not cached)
    this.refreshMyLeaves();
    
    if (this.activeMenu !== 'home') this.onMenuChange(this.activeMenu);
  }
  onMenuChange(menuKey: string) {
    this.menuLoading = true;
    this.activeMenu = menuKey;
    sessionStorage.setItem('emp_activeMenu', menuKey);
    if (menuKey === 'apply') {
      this.applyLeaveTab = 'apply';
    }
    window.setTimeout(() => this.menuLoading = false, 300);
  }

  onTabChange(tab: string) {
    this.tabLoading = true;
    this.applyLeaveTab = tab;
    window.setTimeout(() => this.tabLoading = false, 200);
  }
  refreshMyLeaves() {
    this.refreshLoading = true;
    this.leaveService.clearLeavesCache();
    this.leaveService.getMyLeaves().subscribe({ 
      next: (l) => { this.myLeaves = l; this.refreshLoading = false; }, 
      error: () => { this.refreshLoading = false; } 
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
    this.leaveLoading = true;
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
        this.leaveLoading = false;
        this.closeLeaveForm();
        this.toast.show('Leave application submitted!', 'success');
        this.refreshMyLeaves();
      },
      error: (err) => {
        this.leaveLoading = false;
        this.toast.show(err.status === 409 ? 'You already have a leave overlapping these dates.' : 'Failed to submit leave.', 'error');
      }
    });
  }
  openEditLeaveForm(leave: Leave) {
    this.editingLeave = leave;
    this.editLeaveForm = { leaveType: leave.leaveType, fromDate: leave.fromDate, toDate: leave.toDate, reason: leave.reason, comments: '', dayType: leave.dayType || 'FULL_DAY', halfDaySession: leave.halfDaySession || '' };
    this.leaveDayError = ''; this.showEditLeaveForm = true;
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
    this.pageLoading = true;
    this.leaveService.updateLeave(this.editingLeave.id, this.editLeaveForm).subscribe({
      next: () => { this.pageLoading = false; this.closeEditLeaveForm(); this.toast.show('Leave updated successfully!', 'success'); this.refreshMyLeaves(); },
      error: (err) => { this.pageLoading = false; this.toast.show(err.status === 409 ? 'You already have a leave overlapping these dates.' : 'Failed to update leave.', 'error'); }
    });
  }
  openDeleteLeaveConfirm(leave: Leave) { this.deletingLeave = leave; this.showDeleteLeaveConfirm = true; }
  closeDeleteLeaveConfirm() { this.deletingLeave = null; this.showDeleteLeaveConfirm = false; }
  confirmDeleteLeave() {
    if (!this.deletingLeave) return;
    this.pageLoading = true;
    this.leaveService.deleteLeave(this.deletingLeave.id).subscribe({
      next: () => { this.pageLoading = false; this.toast.show('Leave deleted!', 'success'); this.closeDeleteLeaveConfirm(); this.refreshMyLeaves(); },
      error: () => { this.pageLoading = false; this.toast.show('Failed to delete leave.', 'error'); this.closeDeleteLeaveConfirm(); }
    });
  }
  startResize(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.sidebarWidth;
    const onMouseMove = (e: MouseEvent) => { this.sidebarWidth = Math.min(Math.max(startWidth + (e.clientX - startX), 68), 350); };
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  openTrailModal(leave: Leave) { this.trailLeave = leave; this.showTrailModal = true; }
  closeTrailModal() { this.showTrailModal = false; this.trailLeave = null; }

  logout() { this.auth.logout(); this.router.navigate(['/']); }
}

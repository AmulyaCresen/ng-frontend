import { Component, OnInit, NgZone, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { LeaveService, Leave, fmtDate } from '../services/leave.service';
import { UserService } from '../services/user';
import { AuthService } from '../services/auth';
import { TrailHelper } from '../services/trail-helper';
import { TrailModalComponent } from '../shared/trail-modal.component';
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular, TrailModalComponent],
  templateUrl: './audit-trail.component.html',
  styleUrls: ['./audit-trail.component.css']
})
export class AuditTrailComponent implements OnInit {
  @Input() userEmail = '';
  private userRole = '';
  private userFullNameMap: Map<string, string> = new Map();

  auditLeaves: Leave[] = [];
  auditSearchQuery = '';
  showTrailModal = false;
  trailLeave: Leave | null = null;

  constructor(
    private leaveService: LeaveService,
    private userService: UserService,
    private auth: AuthService,
    private zone: NgZone,
    public trail: TrailHelper
  ) {}

  ngOnInit() {
    this.userRole = this.auth.getRole() || '';
    this.userService.getAllUsers().subscribe({
      next: (users) => users.forEach(u => this.userFullNameMap.set(u.email, u.fullName)),
      error: () => {}
    });
    this.loadLeaves();
  }

  loadLeaves() {
    const isPrivileged = this.userRole === 'ADMIN' || this.userRole === 'MANAGER';
    const obs = isPrivileged ? this.leaveService.getAllLeaves() : this.leaveService.getMyLeaves();
    obs.subscribe({ next: (l) => this.auditLeaves = l, error: () => {} });
  }

  refresh() {
    this.leaveService.clearLeavesCache();
    this.loadLeaves();
  }

  fmtDate = fmtDate;
  getFullName(email: string): string {
    return this.userFullNameMap.get(email) || email;
  }

  get filteredLeaves(): Leave[] {
    const q = this.auditSearchQuery.toLowerCase();
    if (!q) return this.auditLeaves;
    return this.auditLeaves.filter(l =>
      l.emailId?.toLowerCase().includes(q) ||
      l.leaveType?.toLowerCase().includes(q) ||
      l.status?.toLowerCase().includes(q)
    );
  }

  openTrailModal(leave: Leave) { this.trailLeave = leave; this.showTrailModal = true; }
  closeTrailModal() { this.showTrailModal = false; this.trailLeave = null; }

  defaultColDef: ColDef = { resizable: true };

  auditColDefs: ColDef[] = [
    { field: 'emailId', headerName: 'Employee', flex: 1.5, sortable: true, filter: true,
      cellRenderer: (p: any) => {
        const email = p.value || '';
        const name = this.getFullName(email);
        const initial = (name || email || '?')[0].toUpperCase();
        return `<div style="display:flex;align-items:center;gap:10px;height:100%;padding:4px 0">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1">${initial}</div>
          <div style="display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0">
            <div style="font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
            <div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${email}</div>
          </div>
        </div>`;
      }
    },
    { field: 'leaveType', headerName: 'Leave Type', flex: 1, sortable: true, filter: true,
      cellRenderer: (p: any) => `<span class="audit-leave-type-badge">${p.value || ''}</span>`
    },
    { field: 'fromDate', headerName: 'From', width: 115, sortable: true, valueFormatter: (p: any) => fmtDate(p.value) },
    { field: 'toDate', headerName: 'To', width: 115, sortable: true, valueFormatter: (p: any) => fmtDate(p.value) },
    { field: 'createdAt', headerName: 'Applied On', width: 130, sortable: true, valueFormatter: (p: any) => fmtDate(p.value) },
    { field: 'status', headerName: 'Status', width: 165, sortable: true,
      cellRenderer: (p: any) => {
        const s = p.value || 'PENDING';
        const cls = s === 'APPROVED' ? 'status-approved' : s === 'REJECTED' ? 'status-rejected'
          : s === 'PARTIAL' ? 'status-partial' : s === 'MANAGER_APPROVED' ? 'status-manager-approved' : 'status-pending';
        const label = s === 'PARTIAL' ? 'Partially Approved' : s === 'MANAGER_APPROVED' ? 'Manager Approved' : s;
        return `<span class="${cls}">${label}</span>`;
      }
    },
    { headerName: 'Events', width: 100, sortable: false, filter: false,
      cellRenderer: (p: any) => {
        const trail: any[] = p.data?.trail || [];
        const count = this.trail.filteredTrail(trail).length;
        const cls = count > 0 ? 'audit-trail-count has-trail' : 'audit-trail-count';
        return `<span class="${cls}">${count} event${count !== 1 ? 's' : ''}</span>`;
      }
    },
    { headerName: 'Action', width: 120, sortable: false, filter: false,
      cellStyle: { display: 'flex', alignItems: 'center' },
      cellRenderer: () => `<button class="audit-view-btn">View Trail</button>`,
      onCellClicked: (p: any) => { this.zone.run(() => this.openTrailModal(p.data)); }
    }
  ];
}

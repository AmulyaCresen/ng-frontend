import { Routes } from '@angular/router';
import { Login } from './login/login';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { ManagerDashboard } from './manager-dashboard/manager-dashboard';
import { EmployeeDashboard } from './employee-dashboard/employee-dashboard';
import { ForgotPassword } from './forgot-password/forgot-password';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'forgot-password', component: ForgotPassword },

  {
    path: 'admin',
    component: AdminDashboard,
    canActivate: [authGuard],
    data: { role: 'ADMIN' }
  },
  {
    path: 'manager',
    component: ManagerDashboard,
    canActivate: [authGuard],
    data: { role: 'MANAGER' }
  },
  {
    path: 'employee',
    component: EmployeeDashboard,
    canActivate: [authGuard],
    data: { role: 'EMPLOYEE' }
  },

  { path: '**', redirectTo: '' }
];


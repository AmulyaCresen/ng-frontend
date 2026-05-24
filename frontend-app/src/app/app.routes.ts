import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';
export const routes: Routes = [
  { path: '', loadComponent: () => import('./login/login').then(m => m.Login) },
  { path: 'forgot-password', loadComponent: () => import('./forgot-password/forgot-password').then(m => m.ForgotPassword) },
  {
    path: 'admin',
    loadComponent: () => import('./admin-dashboard/admin-dashboard').then(m => m.AdminDashboard),
    canActivate: [authGuard],
    data: { role: 'ADMIN' }
  },
  {
    path: 'manager',
    loadComponent: () => import('./manager-dashboard/manager-dashboard').then(m => m.ManagerDashboard),
    canActivate: [authGuard],
    data: { role: 'MANAGER' }
  },
  {
    path: 'employee',
    loadComponent: () => import('./employee-dashboard/employee-dashboard').then(m => m.EmployeeDashboard),
    canActivate: [authGuard],
    data: { role: 'EMPLOYEE' }
  },
  { path: '**', redirectTo: '' }
];

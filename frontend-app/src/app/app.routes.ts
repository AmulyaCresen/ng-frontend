import { Routes } from '@angular/router';
import { Login } from './login/login';
import { AdminDashboard } from './admin-dashboard/admin-dashboard';
import { ManagerDashboard } from './manager-dashboard/manager-dashboard';
import { EmployeeDashboard } from './employee-dashboard/employee-dashboard';
import { ForgotPassword } from './forgot-password/forgot-password';

export const routes: Routes = [
  { path: '', component: Login },

  { path: 'admin', component: AdminDashboard },
  { path: 'manager', component: ManagerDashboard },
  { path: 'employee', component: EmployeeDashboard},
  {path: '', component:Login},
  { path: 'forgot-password', component: ForgotPassword }
];

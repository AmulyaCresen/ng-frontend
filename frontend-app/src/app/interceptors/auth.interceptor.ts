import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();
  const email = authService.getEmail();

  // Skip auth header for login/forgot-password/reset-password
  const isPublicUrl = req.url.includes('/auth/login') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/reset-password');

  if (!token && !isPublicUrl) {
    authService.logout();
    router.navigate(['/']);
    return throwError(() => new Error('No token'));
  }

  let clonedReq = req;
  if (token) {
    const headers: any = { Authorization: `Bearer ${token}` };
    if (email) headers['X-User-Email'] = email;
    const role = authService.getRole();
    if (role) headers['X-User-Role'] = role;
    clonedReq = req.clone({ setHeaders: headers });
  }

  return next(clonedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isPublicUrl) {
        authService.logout();
        router.navigate(['/']);
      }
      return throwError(() => err);
    })
  );
};

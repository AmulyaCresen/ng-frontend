import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const email = authService.getEmail();
  
  if (!token) {
    return next(req);
  }
  
  const headers: any = {
    Authorization: `Bearer ${token}`
  };
  
  if (email) {
    headers['X-User-Email'] = email;
  }
  
  return next(
    req.clone({
      setHeaders: headers
    })
  );
};
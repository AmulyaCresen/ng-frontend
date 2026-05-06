import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const email = authService.getEmail();
  
  console.log('Interceptor - URL:', req.url);
  console.log('Interceptor - Token:', token ? 'Present' : 'Missing');
  console.log('Interceptor - Email:', email);
  
  if (!token) {
    return next(req);
  }
  
  const headers: any = {
    Authorization: `Bearer ${token}`
  };
  
  if (email) {
    headers['X-User-Email'] = email;
  }
  
  console.log('Interceptor - Adding headers:', headers);
  
  return next(
    req.clone({
      setHeaders: headers
    })
  );
};
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) {
    router.navigate(['/']);
    return false;
  }
  const requiredRole: string | undefined = route.data['role'];
  if (requiredRole) {
    const userRole = auth.getRole();
    if (userRole !== requiredRole) {
      const roleRouteMap: Record<string, string> = {
        ADMIN: '/admin',
        MANAGER: '/manager',
        EMPLOYEE: '/employee',
      };
      const ownRoute = userRole ? roleRouteMap[userRole] : null;
      router.navigate([ownRoute ?? '/']);
      return false;
    }
  }
  return true;
};
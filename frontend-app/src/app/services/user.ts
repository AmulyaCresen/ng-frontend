import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
export interface MenuItem {
  id: number;
  menuKey: string;
  menuLabel: string;
  menuOrder: number;
  active: boolean;
}
export interface UpdateUserRequest {
  userName: string;
  fullName: string;
  role: string;
  active: boolean;
  gender: string;
}
export interface User {
  id: number;
  companyId: string;
  userName: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
  gender: string;
  createDate: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface Stats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
}
export interface Role {
  id: number;
  roleName: string;
  uniqueName: string;
  roleDesc: string;
}
export interface CreateUserRequest {
  userName: string;
  fullName: string;
  email: string;
  password: string;
  role: string;
  active: boolean;
  gender: string;
}
@Injectable({ providedIn: 'root' })
export class UserService {
  private baseUrl = environment.apiUrl;
  private allUsersCache$: Observable<User[]> | null = null;
  private managersCache$: Observable<User[]> | null = null;
  private rolesCache$: Observable<Role[]> | null = null;
  
  constructor(private http: HttpClient) {}
  getMenusByRole(roleName: string): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.baseUrl}/users/menus/${roleName}`);
  }
  getManagers(): Observable<User[]> {
    if (!this.managersCache$) {
      this.managersCache$ = this.http.get<User[]>(`${this.baseUrl}/users/managers`).pipe(
        shareReplay(1)
      );
    }
    return this.managersCache$;
  }

  clearManagersCache(): void {
    this.managersCache$ = null;
  }
  getAllUsers(): Observable<User[]> {
    if (!this.allUsersCache$) {
      this.allUsersCache$ = this.http.get<User[]>(`${this.baseUrl}/users/all`).pipe(
        shareReplay(1)
      );
    }
    return this.allUsersCache$;
  }

  clearAllUsersCache(): void {
    this.allUsersCache$ = null;
  }
  getUserByEmail(email: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/by-email?email=${encodeURIComponent(email)}`);
  }
  getStats(): Observable<Stats> {
    return this.http.get<Stats>(`${this.baseUrl}/users/stats`);
  }
  getRoles(): Observable<Role[]> {
    if (!this.rolesCache$) {
      this.rolesCache$ = this.http.get<Role[]>(`${this.baseUrl}/users/roles`).pipe(
        shareReplay(1)
      );
    }
    return this.rolesCache$;
  }
  getNextCompanyId(): Observable<string> {
    return this.http.get(`${this.baseUrl}/users/next-company-id`, { responseType: 'text' });
  }
  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${id}`).pipe(
      tap(() => {
        this.clearAllUsersCache();
        this.clearManagersCache();
      })
    );
  }
  updateUser(id: number, request: UpdateUserRequest): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/${id}`, request).pipe(
      tap(() => {
        this.clearAllUsersCache();
        this.clearManagersCache();
      })
    );
  }
  checkEmailExists(email: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/users/check-email?email=${encodeURIComponent(email)}`);
  }
  checkUsernameExists(username: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/users/check-username?username=${encodeURIComponent(username)}`);
  }
  createUser(request: CreateUserRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/create`, {
      ...request,
      password: btoa(request.password)
    }).pipe(
      tap(() => {
        this.clearAllUsersCache();
        this.clearManagersCache();
      })
    );
  }
}
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
export interface LoginResponse {
  message: string;
  token: string;
  role: string;
  fullName: string;
  email: string;
  gender: string;
}
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = environment.apiUrl;
  private readonly TIMEOUT_MS = 30000;
  constructor(private http: HttpClient) {}
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { email, password: btoa(password) })
      .pipe(timeout(this.TIMEOUT_MS));
  }
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/forgot-password`, { email })
      .pipe(timeout(this.TIMEOUT_MS));
  }
  resetPassword(email: string, otp: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/auth/reset-password`, { email, otp, newPassword })
      .pipe(timeout(this.TIMEOUT_MS));
  }
  setToken(token: string): void {
    sessionStorage.setItem('token', token);
  }
  getToken(): string | null {
    return sessionStorage.getItem('token');
  }
  setRole(role: string): void {
    sessionStorage.setItem('role', role);
  }
  getRole(): string | null {
    return sessionStorage.getItem('role');
  }
  setFullName(name: string): void {
    sessionStorage.setItem('fullName', name);
  }
  getFullName(): string | null {
    return sessionStorage.getItem('fullName');
  }
  setGender(gender: string): void {
    sessionStorage.setItem('gender', gender);
  }
  getGender(): string | null {
    return sessionStorage.getItem('gender');
  }
  setEmail(email: string): void {
    sessionStorage.setItem('email', email);
  }
  getEmail(): string | null {
    return sessionStorage.getItem('email');
  }
  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('token');
  }
  logout(): void {
    sessionStorage.clear();
  }
}
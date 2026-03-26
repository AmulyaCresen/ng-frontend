import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl = 'http://localhost:8081';

  constructor(private http: HttpClient) {}

  login(data: any) {
    return this.http.post(`${this.baseUrl}/users/login`, data);
  }

  // ✅ Save role in localStorage
  setRole(role: string) {
    localStorage.setItem('role', role);
  }

  // ✅ Get role
  getRole(): string | null {
    return localStorage.getItem('role');
  }

  // ✅ Check login
  isLoggedIn(): boolean {
    return !!localStorage.getItem('role');
  }

  // ✅ Logout
  logout() {
    localStorage.removeItem('role');
  }
}

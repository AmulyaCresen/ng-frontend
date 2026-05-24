import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth';
import { TimeoutError } from 'rxjs';
import { ToastService } from '../services/toast.service';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;
  emailFocused = false;
  passwordFocused = false;
  showPassword = false;
  constructor(private router: Router, private authService: AuthService, private toast: ToastService) {}
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  private validate(): string | null {
    if (!this.email.trim() || !this.password) return 'Email and password are required.';
    if (!EMAIL_REGEX.test(this.email.trim())) return 'Please enter a valid email address.';
    return null;
  }
  login() {
    this.errorMessage = '';
    const validationError = this.validate();
    if (validationError) { this.errorMessage = validationError; return; }
    this.loading = true;
    this.authService.login(this.email.trim(), this.password).subscribe({
      next: (response) => {
        this.loading = false;
        this.authService.setToken(response.token);
        this.authService.setRole(response.role);
        this.authService.setFullName(response.fullName);
        this.authService.setEmail(response.email);
        this.authService.setGender(response.gender || '');
        const routeMap: Record<string, string> = {
          ADMIN: '/admin',
          MANAGER: '/manager',
          EMPLOYEE: '/employee',
        };
        this.router.navigate([routeMap[response.role] ?? '/']);
        this.toast.show('Login successful! Welcome ' + response.fullName, 'success');
      },
      error: (err) => {
        this.loading = false;
        this.password = '';
        if (err instanceof TimeoutError) {
          this.errorMessage = 'Request timed out. Please try again.';
        } else if (err.status === 401) {
          const reason = err.error?.detail || err.error?.message || '';
          if (reason.toLowerCase().includes('disabled') || reason.toLowerCase().includes('inactive')) {
            this.errorMessage = 'User is inactive. Please contact admin.';
          } else {
            this.errorMessage = 'Wrong email or password. Please try again.';
          }
        } else {
          this.errorMessage = 'Something went wrong. Please try again.';
        }
      }
    });
  }
  clearError() {
    this.errorMessage = '';
  }
}
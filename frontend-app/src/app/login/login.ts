import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth';
import { TimeoutError } from 'rxjs';

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

  constructor(private router: Router, private authService: AuthService) {}

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
        const routeMap: Record<string, string> = {
          ADMIN: '/admin',
          MANAGER: '/manager',
          EMPLOYEE: '/employee',
        };
        this.router.navigate([routeMap[response.role] ?? '/']);
      },
      error: (err) => {
        this.loading = false;
        this.password = '';
        if (err instanceof TimeoutError) {
          this.errorMessage = 'Request timed out. Please try again.';
        } else if (err.status === 401) {
          this.errorMessage = 'Invalid email or password.';
        } else if (err.status === 403) {
          this.errorMessage = 'Account is disabled. Please contact admin.';
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

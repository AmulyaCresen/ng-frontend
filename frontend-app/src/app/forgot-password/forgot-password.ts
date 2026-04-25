import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth';
import { TimeoutError } from 'rxjs';
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css']
})
export class ForgotPassword {
  email = '';
  emailFocused = false;
  loading = false;
  otpSent = false;
  otp = '';
  otpFocused = false;
  resending = false;
  newPassword = '';
  confirmPassword = '';
  newPasswordFocused = false;
  confirmPasswordFocused = false;
  showNewPassword = false;
  showConfirmPassword = false;
  resettingPassword = false;
  passwordReset = false;
  errorMessage = '';
  constructor(private authService: AuthService, private router: Router) {}
  getOtp() {
    this.errorMessage = '';
    const trimmed = this.email.trim();
    if (!trimmed) { this.errorMessage = 'Please enter your email address.'; return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) { this.errorMessage = 'Please enter a valid email address.'; return; }
    this.loading = true;
    this.authService.forgotPassword(trimmed).subscribe({
      next: () => {
        this.loading = false;
        this.otpSent = true;
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 404) {
          this.errorMessage = 'No account found with this email address.';
        } else if (err instanceof TimeoutError || err.status === 0 || err.status === 502 || err.status === 504) {
          this.otpSent = true;
        } else {
          this.errorMessage = err.error?.message || 'Something went wrong. Please try again.';
        }
      }
    });
  }
  changeEmail() {
    this.otpSent = false;
    this.otp = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage = '';
  }
  resend() {
    this.resending = true;
    this.errorMessage = '';
    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: () => { this.resending = false; },
      error: (err) => {
        this.resending = false;
        if (err instanceof TimeoutError || err.status === 0 || err.status === 502 || err.status === 504) {
        } else {
          this.errorMessage = err.error?.message || 'Failed to resend OTP. Please try again.';
        }
      }
    });
  }
  resetPassword() {
    this.errorMessage = '';
    if (!this.otp.trim()) { this.errorMessage = 'Please enter the OTP sent to your email.'; return; }
    if (!this.newPassword) { this.errorMessage = 'Please enter a new password.'; return; }
    if (this.newPassword.length < 6) { this.errorMessage = 'Password must be at least 6 characters.'; return; }
    if (this.newPassword !== this.confirmPassword) { this.errorMessage = 'Passwords do not match.'; return; }
    this.resettingPassword = true;
    this.authService.resetPassword(this.email.trim(), this.otp.trim(), btoa(this.newPassword)).subscribe({
      next: () => {
        this.resettingPassword = false;
        this.passwordReset = true;
      },
      error: (err) => {
        this.resettingPassword = false;
        if (err.status === 400) {
          this.errorMessage = 'Invalid or expired OTP. Please request a new one.';
        } else if (err instanceof TimeoutError || err.status === 0 || err.status === 502 || err.status === 504) {
          this.passwordReset = true;
        } else {
          this.errorMessage = err.error?.message || 'Something went wrong. Please try again.';
        }
      }
    });
  }
}
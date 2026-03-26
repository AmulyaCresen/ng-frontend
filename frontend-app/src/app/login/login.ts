import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {

  email = '';
  password = '';
  role = '';

  errorMessage = '';
  loading = false;

  constructor(private router: Router) {}

  login() {

    this.errorMessage = '';
    this.loading = true;

    // 🔥 Dummy login logic
    setTimeout(() => {

      this.loading = false;

      if (this.email === 'admin@gmail.com' && this.password === 'admin' && this.role === 'ADMIN') {
        localStorage.setItem('role', 'ADMIN');
        this.router.navigate(['/admin']);
      }

      else if (this.email === 'manager@gmail.com' && this.password === 'manager' && this.role === 'MANAGER') {
        localStorage.setItem('role', 'MANAGER');
        this.router.navigate(['/manager']);
      }

      else if (this.email === 'employee@gmail.com' && this.password === 'employee' && this.role === 'EMPLOYEE') {
        localStorage.setItem('role', 'EMPLOYEE');
        this.router.navigate(['/employee']);
      }

      else {
        this.errorMessage = 'Invalid credentials';
      }

    }, 1000); // simulate API delay
  }
}

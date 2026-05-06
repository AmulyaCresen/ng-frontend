import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastComponent } from './toast/toast.component';
import { ChatbotComponent } from './chatbot/chatbot.component';
import { AuthService } from './services/auth';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ChatbotComponent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend-app');
  
  constructor(public authService: AuthService) {}
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Task {
  id?: number;
  emailId?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  managerEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  completionRemarks?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = `${environment.apiUrl}/leave-service/api/tasks`;

  constructor(private http: HttpClient) {}

  createTask(task: Task): Observable<any> {
    return this.http.post(this.apiUrl, task);
  }

  getTasks(status?: string): Observable<Task[]> {
    const url = status ? `${this.apiUrl}?status=${status}` : this.apiUrl;
    return this.http.get<Task[]>(url);
  }

  updateTask(taskId: number, task: Task): Observable<any> {
    return this.http.put(`${this.apiUrl}/${taskId}`, task);
  }

  deleteTask(taskId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${taskId}`);
  }
}

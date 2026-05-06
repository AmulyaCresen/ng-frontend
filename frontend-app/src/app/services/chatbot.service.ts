import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WelcomeResponse {
  message: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private baseUrl = `${environment.apiUrl}/leave-service/api/chatbot`;

  constructor(private http: HttpClient) {}

  /**
   * Streams AI response tokens via SSE using the Fetch API (supports POST + streaming).
   * Yields raw text chunks as they arrive from the backend.
   */
  streamMessage(
    message: string,
    userEmail: string | null,
    userName: string | null,
    userRole: string | null,
    sessionId: number | null,
    onChunk: (text: string) => void,
    onComplete: () => void,
    onError: (err: string) => void
  ): AbortController {
    const controller = new AbortController();
    const token = sessionStorage.getItem('token');

    fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message, userEmail, userName, userRole, sessionId: sessionId?.toString() })
    })
      .then(response => {
        if (!response.ok) {
          onError(`Server error: ${response.status}`);
          return;
        }
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const readChunk = (): void => {
          reader.read().then(({ done, value }) => {
            if (done) {
              onComplete();
              return;
            }

            buffer += decoder.decode(value, { stream: true });

            // Split on double-newline (SSE event boundary)
            const events = buffer.split('\n\n');
            // Keep last incomplete chunk in buffer
            buffer = events.pop() ?? '';

            for (const event of events) {
              for (const line of event.split('\n')) {
                if (line.startsWith('event:')) {
                  const evtName = line.slice(6).trim();
                  if (evtName === 'done' || evtName === 'error') {
                    // handled via data line below
                  }
                } else if (line.startsWith('data:')) {
                  const data = line.slice(5).trim();
                  if (data === '[DONE]') {
                    onComplete();
                    return;
                  }
                  if (data) {
                    onChunk(data);
                  }
                }
              }
            }

            readChunk();
          }).catch(err => {
            if (err.name !== 'AbortError') {
              onError('Stream read error: ' + err.message);
            }
          });
        };

        readChunk();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          onError(err.message || 'Failed to connect to AI service');
        }
      });

    return controller;
  }

  getWelcomeMessage(): Observable<WelcomeResponse> {
    return this.http.get<WelcomeResponse>(`${this.baseUrl}/welcome`);
  }

  checkHealth(): Observable<{ status: string; service: string }> {
    return this.http.get<{ status: string; service: string }>(`${this.baseUrl}/health`);
  }

  getChatSessions(email: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/sessions`, {
      headers: { 'X-User-Email': email }
    });
  }

  getChatHistory(sessionId: number, email: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/sessions/${sessionId}`, {
      headers: { 'X-User-Email': email }
    });
  }

  deleteSession(sessionId: number, email: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/sessions/${sessionId}`, {
      headers: { 'X-User-Email': email }
    });
  }
}

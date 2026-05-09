import {
  Component,
  signal,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from '../services/chatbot.service';
import { AuthService } from '../services/auth';

interface ChatMessage {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
  isStreaming?: boolean;   
  isThinking?: boolean;   
  latency?: number;
  hasTable?: boolean;
  tableData?: any[];
}

interface ChatSession {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css'
})
export class ChatbotComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputField') private inputField!: ElementRef<HTMLInputElement>;
  @ViewChild('chatbotPanel') private chatbotPanel!: ElementRef<HTMLDivElement>;

  isOpen = signal(false);
  messages = signal<ChatMessage[]>([]);
  currentMessage = '';
  isLoading = signal(false);
  showHistory = signal(false);
  sessions = signal<ChatSession[]>([]);
  currentSessionId: number | null = null;
  loadingSessions = signal(false);
  showDeleteConfirm = signal(false);
  sessionToDelete: number | null = null;
  showTableModal = signal(false);
  currentTableData: any[] = [];
  currentTableMessage: ChatMessage | null = null;
  isMaximized = signal(false);

  private msgIdSeq = 0;
  private abortController: AbortController | null = null;
  private shouldScrollToBottom = false;
  
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private initialRight = 20;
  private initialBottom = 20;

  constructor(
    private chatbotService: ChatbotService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.abortController?.abort();
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  onHeaderMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) return;
    
    this.isDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    
    const panel = this.chatbotPanel?.nativeElement;
    if (panel) {
      const rect = panel.getBoundingClientRect();
      this.initialRight = window.innerWidth - rect.right;
      this.initialBottom = window.innerHeight - rect.bottom;
    }
    
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    event.preventDefault();
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging) return;
    
    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;
    
    const newRight = this.initialRight - deltaX;
    const newBottom = this.initialBottom - deltaY;
    
    const panel = this.chatbotPanel?.nativeElement;
    if (!panel) return;
    
    const fabSize = 60;
    const margin = 10;
    
    const maxRight = window.innerWidth - fabSize - margin;
    const maxBottom = window.innerHeight - fabSize - margin;
    const minRight = margin;
    const minBottom = margin;
    
    const constrainedRight = Math.max(minRight, Math.min(maxRight, newRight));
    const constrainedBottom = Math.max(minBottom, Math.min(maxBottom, newBottom));
    
    const fab = document.querySelector('.chatbot-fab') as HTMLElement;
    if (fab) {
      fab.style.right = constrainedRight + 'px';
      fab.style.bottom = constrainedBottom + 'px';
    }
    
    if (this.isOpen()) {
      setTimeout(() => this.adjustModalPosition(), 0);
    }
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  };

  onFabMouseDown(event: MouseEvent): void {
    this.isDragging = false;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    
    const fab = event.currentTarget as HTMLElement;
    const rect = fab.getBoundingClientRect();
    this.initialRight = window.innerWidth - rect.right;
    this.initialBottom = window.innerHeight - rect.bottom;
    
    document.addEventListener('mousemove', this.onFabMouseMove);
    document.addEventListener('mouseup', this.onFabMouseUp);
    event.preventDefault();
    event.stopPropagation();
  }

  private onFabMouseMove = (event: MouseEvent): void => {
    const deltaX = Math.abs(event.clientX - this.dragStartX);
    const deltaY = Math.abs(event.clientY - this.dragStartY);
    
    if (deltaX > 5 || deltaY > 5) {
      this.isDragging = true;
    }
    
    if (!this.isDragging) return;
    
    const moveX = event.clientX - this.dragStartX;
    const moveY = event.clientY - this.dragStartY;
    
    const newRight = this.initialRight - moveX;
    const newBottom = this.initialBottom - moveY;
    
    const fabSize = 60;
    const margin = 10;
    
    const maxRight = window.innerWidth - fabSize - margin;
    const maxBottom = window.innerHeight - fabSize - margin;
    const minRight = margin;
    const minBottom = margin;
    
    const constrainedRight = Math.max(minRight, Math.min(maxRight, newRight));
    const constrainedBottom = Math.max(minBottom, Math.min(maxBottom, newBottom));
    
    const fab = document.querySelector('.chatbot-fab') as HTMLElement;
    const panel = this.chatbotPanel?.nativeElement;
    
    if (fab) {
      fab.style.right = constrainedRight + 'px';
      fab.style.bottom = constrainedBottom + 'px';
    }
    
    if (this.isOpen() && panel) {
      setTimeout(() => this.adjustModalPosition(), 0);
    }
  };

  private onFabMouseUp = (): void => {
    document.removeEventListener('mousemove', this.onFabMouseMove);
    document.removeEventListener('mouseup', this.onFabMouseUp);
    
    if (!this.isDragging) {
      this.toggleChatbot();
    }
    
    this.isDragging = false;
  };


  toggleChatbot(): void {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      if (this.messages().length === 0) {
        this.loadLatestSessionOrWelcome();
      }
      setTimeout(() => {
        this.adjustModalPosition();
        this.inputField?.nativeElement?.focus();
      }, 0);
    }
  }

  toggleMaximize(): void {
    this.isMaximized.update(v => !v);
  }

  private loadLatestSessionOrWelcome(): void {
    const email = this.authService.getEmail();
    if (!email) {
      this.loadWelcomeMessage();
      return;
    }

    this.chatbotService.getChatSessions(email).subscribe({
      next: (sessions) => {
        if (sessions.length > 0) {
          const latest = sessions.reduce((prev: any, curr: any) => 
            new Date(curr.updatedAt) > new Date(prev.updatedAt) ? curr : prev
          );
          this.loadSession(latest.sessionId);
          this.loadSessions();
        } else {
          this.loadWelcomeMessage();
          this.loadSessions();
        }
      },
      error: () => {
        this.loadWelcomeMessage();
        this.loadSessions();
      }
    });
  }

  private adjustModalPosition(): void {
    const fab = document.querySelector('.chatbot-fab') as HTMLElement;
    const panel = this.chatbotPanel?.nativeElement;
    if (!fab || !panel) return;

    const fabRect = fab.getBoundingClientRect();
    const fabSize = 60;
    const panelWidth = 360;
    const panelHeight = 550;
    const margin = 20;
    const gap = 10;
   
    const fabCenterX = fabRect.left + fabRect.width / 2;
    const fabCenterY = fabRect.top + fabRect.height / 2;
    
    let panelRight: number;
    let panelBottom: number;

    
    if (fabCenterX > window.innerWidth / 2) {
      const fabLeft = fabRect.left;
      panelRight = window.innerWidth - fabLeft + gap;
      
      if (fabLeft - gap < panelWidth) {
        panelRight = window.innerWidth - panelWidth - margin;
      }
    } else {
      const fabRight = fabRect.right;
      panelRight = window.innerWidth - fabRight - panelWidth - gap;
      
      if (window.innerWidth - fabRight - gap < panelWidth) {
        panelRight = margin;
      }
    }

    
    if (fabCenterY > window.innerHeight / 2) {
      panelBottom = window.innerHeight - fabRect.bottom;
      
      if (fabRect.top < panelHeight) {
        panelBottom = window.innerHeight - panelHeight - margin;
      }
    } else {
      panelBottom = window.innerHeight - fabRect.bottom;
      
      if (window.innerHeight - fabRect.bottom < panelHeight) {
        panelBottom = margin;
      }
    }

    panelRight = Math.max(margin, Math.min(window.innerWidth - panelWidth - margin, panelRight));
    panelBottom = Math.max(margin, Math.min(window.innerHeight - panelHeight - margin, panelBottom));

    // Apply position to panel only (FAB stays where it is)
    panel.style.right = panelRight + 'px';
    panel.style.bottom = panelBottom + 'px';
  }

  closeChatbot(): void {
    this.isOpen.set(false);
  }


  private loadWelcomeMessage(): void {
    this.chatbotService.getWelcomeMessage().subscribe({
      next: response => {
        if (response.status === 'success') {
          this.typeWriterEffect(this.addBotMessage('', false, true), response.message);
        }
      },
      error: () => {
        this.addBotMessage(
          "Hi! I'm CresenGPT, your AI Leave assistant. How can I help you today?"
        );
      }
    });
  }

  sendMessage(): void {
    const text = this.currentMessage.trim();
    if (!text || this.isLoading()) return;

    this.addUserMessage(text);
    this.currentMessage = '';
    this.isLoading.set(true);

    const botMsg = this.addBotMessage('', false, false, true);
    const startTime = Date.now();
    const isFirstMessage = this.currentSessionId === null;

    const email = this.authService.getEmail();
    const name  = this.authService.getFullName();
    const role  = this.authService.getRole();

    this.abortController = this.chatbotService.streamMessage(
      text, email, name, role, this.currentSessionId,
      (chunk) => {
        if (botMsg.isThinking) {
          botMsg.isThinking = false;
          botMsg.isStreaming = true;
          botMsg.latency = Date.now() - startTime;
        }
        // Replace special newline token with actual newline
        if (chunk === '<NEWLINE>') {
          botMsg.text += '\n';
        } else {
          if (botMsg.text && !botMsg.text.endsWith('\n')) {
            botMsg.text += ' ';
          }
          botMsg.text += chunk;
        }
        this.detectTable(botMsg);
        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      },
      () => {
        botMsg.isStreaming = false;
        botMsg.isThinking = false;
        if (!botMsg.latency) {
          botMsg.latency = Date.now() - startTime;
        }
        this.detectTable(botMsg);
        this.isLoading.set(false);
        this.shouldScrollToBottom = true;
        
        if (isFirstMessage && email) {
          setTimeout(() => {
            this.chatbotService.getChatSessions(email).subscribe({
              next: (sessions) => {
                if (sessions.length > 0) {
                  const latest = sessions.reduce((prev: any, curr: any) => 
                    new Date(curr.updatedAt) > new Date(prev.updatedAt) ? curr : prev
                  );
                  this.currentSessionId = latest.sessionId;
                  console.log('Set current session ID:', this.currentSessionId);
                }
              }
            });
          }, 500);
        }
        
        this.cdr.detectChanges();
      },
      
      (errMsg) => {
        botMsg.isStreaming = false;
        botMsg.isThinking = false;
        if (!botMsg.text) {
          botMsg.text = errMsg.includes('Ollama') || errMsg.includes('Connection')
            ? 'Cannot connect to Ollama. Please ensure Ollama is running on localhost:11434.'
            : 'Sorry, an error occurred. Please try again.';
        }
        this.isLoading.set(false);
        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      }
    );
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  stopStreaming(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.messages.update(msgs =>
      msgs.map(m => ({ ...m, isStreaming: false, isThinking: false }))
    );
    this.isLoading.set(false);
  }

  clearChat(): void {
    this.stopStreaming();
    this.messages.set([]);
    this.currentSessionId = null;
    this.loadWelcomeMessage();
  }

  toggleHistory(): void {
    this.showHistory.update(v => !v);
    if (this.showHistory()) {
      this.loadSessions();
    }
  }

  loadSessions(): void {
    this.loadingSessions.set(true);
    const email = this.authService.getEmail();
    if (!email) {
      this.loadingSessions.set(false);
      return;
    }
    this.chatbotService.getChatSessions(email).subscribe({
      next: (sessions) => {
        const mapped = sessions.map((s: any) => ({
          id: s.sessionId,
          title: s.title,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt
        }));
        this.sessions.set(mapped);
        this.loadingSessions.set(false);
      },
      error: () => {
        this.loadingSessions.set(false);
      }
    });
  }

  loadSession(sessionId: number): void {
    const email = this.authService.getEmail();
    if (!email) return;
    this.chatbotService.getChatHistory(sessionId, email).subscribe({
      next: (data) => {
        this.currentSessionId = sessionId;
        const messages = data.messages || [];
        this.messages.set(
          messages.map((msg: any, idx: number) => {
            const chatMsg: ChatMessage = {
              id: idx + 1,
              text: msg.content || '',
              isBot: msg.sender === 'bot',
              timestamp: new Date(msg.createdAt),
              latency: msg.latency
            };
            
            if (msg.sender === 'bot' && msg.type === 'table' && msg.tableData) {
              chatMsg.hasTable = true;
              chatMsg.tableData = msg.tableData;
              chatMsg.text = msg.content || '';
            }
            
            return chatMsg;
          })
        );
        this.showHistory.set(false);
        this.shouldScrollToBottom = true;
      },
      error: (err) => {
        console.error('Failed to load session:', err);
        alert('Failed to load chat session');
      }
    });
  }

  closeHistory(): void {
    this.showHistory.set(false);
  }

  newChat(): void {
    this.clearChat();
    this.showHistory.set(false);
  }

  deleteSession(sessionId: number, event: Event): void {
    event.stopPropagation();
    this.sessionToDelete = sessionId;
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    if (this.sessionToDelete === null) return;
    
    const email = this.authService.getEmail();
    if (!email) return;
    
    const sessionId = this.sessionToDelete;
    console.log('Deleting session:', sessionId);
    
    this.chatbotService.deleteSession(sessionId, email).subscribe({
      next: () => {
        console.log('Session deleted successfully');
        this.sessions.update(sessions => sessions.filter(s => s.id !== sessionId));
        if (this.currentSessionId === sessionId) {
          this.clearChat();
        }
        this.showDeleteConfirm.set(false);
        this.sessionToDelete = null;
      },
      error: (err) => {
        console.error('Delete error:', err);
        alert('Failed to delete session: ' + (err.error?.message || err.message));
        this.showDeleteConfirm.set(false);
        this.sessionToDelete = null;
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.sessionToDelete = null;
  }

  openTableModal(message: ChatMessage): void {
    this.currentTableMessage = message;
    this.currentTableData = message.tableData || [];
    this.showTableModal.set(true);
  }

  closeTableModal(): void {
    this.showTableModal.set(false);
    this.currentTableData = [];
    this.currentTableMessage = null;
  }

  downloadTable(): void {
    if (this.currentTableData.length === 0) return;

    const headers = Object.keys(this.currentTableData[0]);
    const csvContent = [
      headers.join(','),
      ...this.currentTableData.map(row => 
        headers.map(header => {
          const value = row[header];
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `chatbot-table-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getTableHeaders(): string[] {
    if (this.currentTableData.length === 0) return [];
    return Object.keys(this.currentTableData[0]);
  }

  getTableSummary(message: ChatMessage): string {
    const text = message.text;
    const tableStart = text.indexOf('|');
    if (tableStart > 0) {
      return text.substring(0, tableStart).trim();
    }
    return `Found a table with ${message.tableData?.length || 0} rows. Click "View Table" to see details.`;
  }


  private addUserMessage(text: string): void {
    this.messages.update(msgs => [
      ...msgs,
      { id: ++this.msgIdSeq, text, isBot: false, timestamp: new Date() }
    ]);
    this.shouldScrollToBottom = true;
  }

  private addBotMessage(
    text: string,
    _legacy = false,
    startTypewriter = false,
    thinking = false
  ): ChatMessage {
    const msg: ChatMessage = {
      id: ++this.msgIdSeq,
      text,
      isBot: true,
      timestamp: new Date(),
      isStreaming: startTypewriter,
      isThinking: thinking
    };
    this.messages.update(msgs => [...msgs, msg]);
    this.shouldScrollToBottom = true;
    return msg;
  }

  private typeWriterEffect(msg: ChatMessage, fullText: string): void {
    msg.isStreaming = true;
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        msg.text += fullText[i++];
        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      } else {
        msg.isStreaming = false;
        clearInterval(interval);
        this.cdr.detectChanges();
      }
    }, 18);
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  private detectTable(message: ChatMessage): void {
    const text = message.text;
    
    const markdownTableRegex = /\|(.+?)\|\s*\n\s*\|[-:\s|]+\|\s*\n([\s\S]*)/;
    const match = text.match(markdownTableRegex);
    
    if (match) {
      const headers = match[1].split('|').map(h => h.trim()).filter(h => h);
      
      const rowLines = match[2].split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('|') && line.endsWith('|'));
      
      const rows = rowLines.map(line => {
        const cells = line.slice(1, -1).split('|').map(cell => cell.trim());
        return cells;
      });
      
      const tableData = rows.map(row => {
        const obj: any = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx] || '';
        });
        return obj;
      });
      
      message.hasTable = true;
      message.tableData = tableData;
    }
  }
}

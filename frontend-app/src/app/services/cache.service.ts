import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CacheService {
  private readonly CACHE_KEYS = {
    HOLIDAYS: 'lms_holidays',
    LEAVE_TYPES: 'lms_leaveTypes',
    MENUS: 'lms_menus_',
    USERS: 'lms_users',
    MANAGERS: 'lms_managers'
  };

  private readonly CACHE_DURATION = {
    HOLIDAYS: 24 * 60 * 60 * 1000, // 24 hours
    LEAVE_TYPES: 24 * 60 * 60 * 1000, // 24 hours
    MENUS: 24 * 60 * 60 * 1000, // 24 hours
    USERS: 30 * 60 * 1000, // 30 minutes
    MANAGERS: 60 * 60 * 1000 // 1 hour
  };

  set(key: string, data: any, duration?: number): void {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        duration: duration || this.CACHE_DURATION.USERS
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn('Cache set failed:', e);
    }
  }

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const { data, timestamp, duration } = JSON.parse(item);
      const maxAge = duration || 30 * 60 * 1000;

      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(key);
        return null;
      }
      return data as T;
    } catch (e) {
      console.warn('Cache get failed:', e);
      return null;
    }
  }

  clear(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Cache clear failed:', e);
    }
  }

  clearAll(): void {
    try {
      Object.values(this.CACHE_KEYS).forEach(key => {
        if (key.endsWith('_')) {
          // Clear all keys with this prefix
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith(key)) localStorage.removeItem(k);
          });
        } else {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Cache clearAll failed:', e);
    }
  }

  // Helper methods for specific cache keys
  getHolidays(): any[] | null {
    return this.get(this.CACHE_KEYS.HOLIDAYS);
  }

  setHolidays(holidays: any[]): void {
    this.set(this.CACHE_KEYS.HOLIDAYS, holidays, this.CACHE_DURATION.HOLIDAYS);
  }

  getLeaveTypes(): any[] | null {
    return this.get(this.CACHE_KEYS.LEAVE_TYPES);
  }

  setLeaveTypes(types: any[]): void {
    this.set(this.CACHE_KEYS.LEAVE_TYPES, types, this.CACHE_DURATION.LEAVE_TYPES);
  }

  getMenus(role: string): any[] | null {
    return this.get(this.CACHE_KEYS.MENUS + role);
  }

  setMenus(role: string, menus: any[]): void {
    this.set(this.CACHE_KEYS.MENUS + role, menus, this.CACHE_DURATION.MENUS);
  }

  getUsers(): any[] | null {
    return this.get(this.CACHE_KEYS.USERS);
  }

  setUsers(users: any[]): void {
    this.set(this.CACHE_KEYS.USERS, users, this.CACHE_DURATION.USERS);
  }

  getManagers(): any[] | null {
    return this.get(this.CACHE_KEYS.MANAGERS);
  }

  setManagers(managers: any[]): void {
    this.set(this.CACHE_KEYS.MANAGERS, managers, this.CACHE_DURATION.MANAGERS);
  }

  // Clear cache when data is modified
  invalidateHolidays(): void {
    this.clear(this.CACHE_KEYS.HOLIDAYS);
  }

  invalidateLeaveTypes(): void {
    this.clear(this.CACHE_KEYS.LEAVE_TYPES);
  }

  invalidateUsers(): void {
    this.clear(this.CACHE_KEYS.USERS);
  }

  invalidateManagers(): void {
    this.clear(this.CACHE_KEYS.MANAGERS);
  }
}

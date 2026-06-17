import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeId = 'green' | 'light' | 'dark' | 'blue' | 'purple';

export interface UserPreferences {
  name: string;
  theme: ThemeId;
  geminiToken?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly KEY = 'mcf_user_prefs';

  private prefsSubject = new BehaviorSubject<UserPreferences>(this.load());
  prefs$ = this.prefsSubject.asObservable();

  get prefs(): UserPreferences { return this.prefsSubject.value; }

  private load(): UserPreferences {
    try {
      const data = localStorage.getItem(this.KEY);
      return data ? { name: '', theme: 'green', ...JSON.parse(data) } : { name: '', theme: 'green' };
    } catch {
      return { name: '', theme: 'green' };
    }
  }

  save(partial: Partial<UserPreferences>) {
    const updated = { ...this.prefs, ...partial };
    localStorage.setItem(this.KEY, JSON.stringify(updated));
    this.prefsSubject.next(updated);
    this.applyTheme(updated.theme);
  }

  applyTheme(theme: ThemeId) {
    const all: ThemeId[] = ['green', 'light', 'dark', 'blue', 'purple'];
    all.forEach(t => document.body.classList.remove(`theme-${t}`));
    document.body.classList.add(`theme-${theme}`);
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  initTheme() {
    this.applyTheme(this.prefs.theme);
  }
}

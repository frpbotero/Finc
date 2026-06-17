import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { UserService, ThemeId } from '../../services/user.service';
import { BackupService } from '../../services/backup.service';
import { GeminiService, DAILY_LIMIT } from '../../services/gemini.service';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  color: string;
  textColor: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  name = '';
  selectedTheme: ThemeId = 'green';
  geminiToken = '';
  readonly DAILY_LIMIT = DAILY_LIMIT;

  readonly themes: ThemeOption[] = [
    { id: 'green',  label: 'Verde',  color: '#2d6a4f', textColor: '#fff' },
    { id: 'light',  label: 'Claro',  color: '#3880ff', textColor: '#fff' },
    { id: 'dark',   label: 'Escuro', color: '#2c2c2c', textColor: '#fff' },
    { id: 'blue',   label: 'Azul',   color: '#0077b6', textColor: '#fff' },
    { id: 'purple', label: 'Roxo',   color: '#7b2d8b', textColor: '#fff' },
  ];

  constructor(
    private userSvc: UserService,
    private backup: BackupService,
    private toastCtrl: ToastController,
    public gemini: GeminiService,
  ) {}

  ngOnInit() {
    const prefs = this.userSvc.prefs;
    this.name = prefs.name;
    this.selectedTheme = prefs.theme;
    this.geminiToken = prefs.geminiToken ?? '';
  }

  get usage() { return this.gemini.getUsage(); }

  saveToken() {
    const token = this.geminiToken.trim();
    this.userSvc.save({ geminiToken: token });
    this.showToast(token ? 'Token salvo! Acesse a aba IA para conversar.' : 'Token removido.', 'success');
  }

  saveName() {
    const trimmed = this.name.trim();
    this.userSvc.save({ name: trimmed });
    this.showToast(trimmed ? `Olá, ${trimmed}! 👋` : 'Nome removido.');
  }

  selectTheme(theme: ThemeId) {
    this.selectedTheme = theme;
    this.userSvc.save({ theme });
  }

  async exportBackup() {
    await this.backup.export();
  }

  triggerImport() {
    this.fileInputRef.nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    const text = await file.text();
    try {
      await this.backup.importWithSmartCheck(text);
    } catch (e: any) {
      this.showToast(e?.message ?? 'Erro ao importar', 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastCtrl.create({ message, duration: 2500, position: 'bottom', color });
    await t.present();
  }
}

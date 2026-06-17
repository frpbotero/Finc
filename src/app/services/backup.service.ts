import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AlertController, ToastController } from '@ionic/angular';
import { FinancialService } from './financial.service';

export interface BackupData {
  version: number;
  exportDate: string;
  accounts: any[];
  financial_accounts: any[];
  transactions: any[];
  debts: any[];
  incomes: any[];
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(
    private fin: FinancialService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {}

  async export(): Promise<void> {
    const data: BackupData = {
      version: 1,
      exportDate: new Date().toISOString(),
      accounts: this.fin.getAccounts(),
      financial_accounts: this.fin.getFinancialAccounts(),
      transactions: this.fin.getRawTransactions(),
      debts: this.fin.getRawDebts(),
      incomes: this.fin.getIncomes(),
    };
    const json = JSON.stringify(data, null, 2);
    const filename = `mcf_backup_${new Date().toISOString().slice(0, 10)}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: 'utf8' as any });
        const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({ title: 'Backup financeiro', url: uri, dialogTitle: 'Salvar backup' });
      } catch (e) {
        console.error('[Backup] export error', e);
        this.showToast('Erro ao exportar backup');
      }
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Backup exportado com sucesso');
    }
  }

  async import(jsonText: string): Promise<void> {
    let data: BackupData;
    try {
      data = JSON.parse(jsonText);
    } catch {
      throw new Error('Arquivo JSON inválido');
    }
    if (!data.version || !Array.isArray(data.accounts)) {
      throw new Error('Formato de backup inválido');
    }
    const confirm = await this.alertCtrl.create({
      header: 'Confirmar importação',
      message: `Isso irá sobrescrever TODOS os dados atuais com o backup de ${data.exportDate?.slice(0, 10) ?? 'data desconhecida'}. Continuar?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Importar',
          handler: async () => {
            await this.fin.restoreFromBackup(data);
            this.showToast('Backup importado com sucesso. Reabra o app.');
          },
        },
      ],
    });
    await confirm.present();
  }

  async showMenu(fileInputEl: HTMLInputElement): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Backup de Dados',
      message: 'Exporte para guardar seus dados ou importe um arquivo de backup anterior.',
      buttons: [
        {
          text: 'Exportar',
          handler: () => { this.export(); },
        },
        {
          text: 'Importar arquivo',
          handler: () => { fileInputEl.click(); },
        },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await alert.present();
  }

  private async showToast(message: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 3000, position: 'bottom' });
    await t.present();
  }
}

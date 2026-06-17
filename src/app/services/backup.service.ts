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

  // ---- Export ----

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
        await this.toast('Erro ao exportar backup', 'danger');
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
      await this.toast('Backup exportado com sucesso!');
    }
  }

  // ---- Import com verificação inteligente ----

  async importWithSmartCheck(jsonText: string): Promise<void> {
    let data: BackupData;
    try {
      data = JSON.parse(jsonText);
    } catch {
      throw new Error('Arquivo JSON inválido');
    }
    if (!data.version || !Array.isArray(data.accounts)) {
      throw new Error('Formato de backup inválido');
    }

    if (this.hasExistingData()) {
      const dateStr = data.exportDate?.slice(0, 10) ?? 'data desconhecida';
      const alert = await this.alertCtrl.create({
        header: '⚠️ Atenção',
        message:
          `Você já possui dados cadastrados. Importar o backup de <strong>${dateStr}</strong> irá apagar permanentemente todos os seus dados atuais.<br><br>Esta ação não pode ser desfeita.`,
        cssClass: 'alert-danger',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Apagar e importar',
            role: 'destructive',
            handler: async () => {
              await this.doRestore(data);
            },
          },
        ],
      });
      await alert.present();
    } else {
      await this.doRestore(data);
    }
  }

  private async doRestore(data: BackupData): Promise<void> {
    try {
      await this.fin.restoreFromBackup(data);
      await this.toast('Backup importado com sucesso! Recarregue o app.', 'success');
    } catch {
      await this.toast('Falha ao importar o backup.', 'danger');
    }
  }

  private hasExistingData(): boolean {
    return (
      this.fin.getAccounts().length > 0 ||
      this.fin.getRawTransactions().length > 0 ||
      this.fin.getDebts().length > 0 ||
      this.fin.getIncomes().length > 0
    );
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 3500, position: 'bottom', color });
    await t.present();
  }
}

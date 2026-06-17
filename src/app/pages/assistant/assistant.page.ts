import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';
import { GeminiService, ChatMessage, DAILY_LIMIT } from '../../services/gemini.service';

@Component({
  selector: 'app-assistant',
  templateUrl: './assistant.page.html',
  styleUrls: ['./assistant.page.scss'],
})
export class AssistantPage implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('msgEnd') msgEndRef!: ElementRef;

  messages: ChatMessage[] = [];
  inputText = '';
  isLoading = false;
  private shouldScroll = false;

  readonly DAILY_LIMIT = DAILY_LIMIT;

  readonly quickActions = [
    { label: 'Analisar meu cenário', prompt: 'Analise meu cenário financeiro atual e me dê um diagnóstico completo com pontos de atenção e sugestões.' },
    { label: 'Reduzir gastos', prompt: 'Quais são minhas maiores despesas e como posso reduzi-las?' },
    { label: 'Plano de dívidas', prompt: 'Crie um plano prático para quitar minhas dívidas.' },
    { label: 'Dicas de economia', prompt: 'Com base no meu perfil, dê dicas de economia para o mês.' },
  ];

  constructor(
    public gemini: GeminiService,
    private toastCtrl: ToastController,
  ) {}

  ngOnInit() {}

  ngOnDestroy() {}

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.content?.scrollToBottom(200);
      this.shouldScroll = false;
    }
  }

  get usage() { return this.gemini.getUsage(); }

  get usageColor(): string {
    const pct = this.usage.dailyRemaining / this.DAILY_LIMIT;
    if (pct > 0.5) return 'success';
    if (pct > 0.1) return 'warning';
    return 'danger';
  }

  async quickAction(prompt: string) {
    this.inputText = prompt;
    await this.send();
  }

  async send() {
    const text = this.inputText.trim();
    if (!text || this.isLoading) return;

    this.inputText = '';
    this.messages.push({ role: 'user', text, timestamp: new Date() });
    this.isLoading = true;
    this.shouldScroll = true;

    try {
      const reply = await this.gemini.sendMessage(text);
      this.messages.push({ role: 'model', text: reply, timestamp: new Date() });
    } catch (e: any) {
      await this.showToast(e?.message ?? 'Erro ao contactar o assistente.', 'danger');
    } finally {
      this.isLoading = false;
      this.shouldScroll = true;
    }
  }

  clearChat() {
    this.messages = [];
    this.gemini.clearHistory();
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 3500, position: 'bottom', color });
    await t.present();
  }
}

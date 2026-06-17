import { Component, OnInit } from '@angular/core';
import { FinancialService } from './services/financial.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
  constructor(private fin: FinancialService) {}

  async ngOnInit(): Promise<void> {
    await this.fin.ensureInitialized();
  }
}

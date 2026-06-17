import { Component, OnInit } from '@angular/core';
import { FinancialService } from './services/financial.service';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent implements OnInit {
  constructor(private fin: FinancialService, private user: UserService) {}

  async ngOnInit(): Promise<void> {
    this.user.initTheme();
    await this.fin.ensureInitialized();
  }
}

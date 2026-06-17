import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { MonthlyFlowPage } from './monthly-flow.page';

@NgModule({
  imports: [
    CommonModule, FormsModule, IonicModule,
    RouterModule.forChild([{ path: '', component: MonthlyFlowPage }]),
  ],
  declarations: [MonthlyFlowPage],
})
export class MonthlyFlowPageModule {}

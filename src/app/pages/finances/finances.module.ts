import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FinancesPage } from './finances.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DragDropModule,
    RouterModule.forChild([{ path: '', component: FinancesPage }]),
  ],
  declarations: [FinancesPage],
})
export class FinancesPageModule {}

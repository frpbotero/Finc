import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../pages/dashboard/dashboard.module').then((m) => m.DashboardPageModule),
      },
      {
        path: 'accounts',
        loadChildren: () =>
          import('../pages/accounts/accounts.module').then((m) => m.AccountsPageModule),
      },
      {
        path: 'monthly-flow',
        loadChildren: () =>
          import('../pages/monthly-flow/monthly-flow.module').then((m) => m.MonthlyFlowPageModule),
      },
      {
        path: 'debts',
        loadChildren: () =>
          import('../pages/debts/debts.module').then((m) => m.DebtsPageModule),
      },
      {
        path: 'simulator',
        loadChildren: () =>
          import('../pages/simulator/simulator.module').then((m) => m.SimulatorPageModule),
      },
      { path: '', redirectTo: '/tabs/dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: '/tabs/dashboard', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}

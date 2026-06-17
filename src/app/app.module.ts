import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  albumsOutline,
  alertCircleOutline,
  calculatorOutline,
  cardOutline,
  cashOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  colorPaletteOutline,
  ellipseOutline,
  flashOutline,
  homeOutline,
  keyOutline,
  listOutline,
  personCircleOutline,
  personOutline,
  pricetagOutline,
  sendOutline,
  sparklesOutline,
  trashOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

addIcons({
  'add-outline': addOutline,
  'albums-outline': albumsOutline,
  'alert-circle-outline': alertCircleOutline,
  'calculator-outline': calculatorOutline,
  'card-outline': cardOutline,
  'cash-outline': cashOutline,
  'checkmark-circle': checkmarkCircle,
  'checkmark-circle-outline': checkmarkCircleOutline,
  'checkmark-outline': checkmarkOutline,
  'chevron-back-outline': chevronBackOutline,
  'chevron-forward-outline': chevronForwardOutline,
  'cloud-download-outline': cloudDownloadOutline,
  'cloud-upload-outline': cloudUploadOutline,
  'color-palette-outline': colorPaletteOutline,
  'ellipse-outline': ellipseOutline,
  'flash-outline': flashOutline,
  'key-outline': keyOutline,
  'person-circle-outline': personCircleOutline,
  'person-outline': personOutline,
  'send-outline': sendOutline,
  'sparkles-outline': sparklesOutline,
  'home-outline': homeOutline,
  'list-outline': listOutline,
  'pricetag-outline': pricetagOutline,
  'trash-outline': trashOutline,
  'trending-up-outline': trendingUpOutline,
  'wallet-outline': walletOutline,
});

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot({ mode: 'md' }),
    AppRoutingModule
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule {}

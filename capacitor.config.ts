import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meucenario.financeiro',
  appName: 'Meu Cenário Financeiro',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;

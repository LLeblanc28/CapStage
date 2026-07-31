import fs from 'node:fs';
import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();

// Hebergement au disque ephemere : on remet le jeu de demonstration a chaque demarrage.
if (config.seedOnStart) {
  const { seed } = await import('./db/seed.js');
  await seed();
}

app.listen(config.port, () => {
  console.log(`[capstage] API demarree sur http://localhost:${config.port} (${config.env})`);
  if (!fs.existsSync(config.clientDist)) {
    console.log('[capstage] interface non compilee : lancez "npm run dev" (Vite) ou "npm run build".');
  }
});

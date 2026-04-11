import 'dotenv/config';
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import app from './src/server/app';
import { initializeCronJobs } from "./src/services/cronService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const { default: express } = await import('express');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  initializeCronJobs();
  console.log('[CRON] Daily app->sheet sync initialized');
}

startServer();

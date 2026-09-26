import express from 'express';
import { mkdirSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const moduleFile = fileURLToPath(import.meta.url);
const moduleDirectory = path.dirname(moduleFile);

type ServerOptions = {
  port?: number;
  host?: string;
  useVite?: boolean;
};

export async function startServer(options: ServerOptions = {}) {
  const rootDirectory = process.env.CENTRAL_CORE_ROOT || moduleDirectory;
  const dataDirectory = process.env.CENTRAL_CORE_DATA_DIR || rootDirectory;
  const port = options.port ?? Number(process.env.PORT || 3000);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  const useVite = options.useVite ?? (process.env.NODE_ENV !== 'production');

  mkdirSync(dataDirectory, { recursive: true });
  const db = new Database(path.join(dataDirectory, 'history.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });

  // DEMS API routes
  app.get('/api/history', (req, res) => {
    try {
      const history = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50').all();
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  app.post('/api/history', (req, res) => {
    const { commands } = req.body;
    if (!Array.isArray(commands)) {
      return res.status(400).json({ error: 'Invalid commands format' });
    }

    try {
      const insert = db.prepare('INSERT INTO history (command) VALUES (?)');
      const transaction = db.transaction((cmds) => {
        for (const cmd of cmds) insert.run(cmd);
      });
      transaction(commands);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save history' });
    }
  });

  app.delete('/api/history', (req, res) => {
    try {
      db.prepare('DELETE FROM history').run();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear history' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', system: 'Super App Launcher' });
  });

  // Vite middleware for development
  let viteServer: { close: () => Promise<void> } | undefined;
  if (useVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDirectory, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(port, host);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    db.close();
    throw new Error('Failed to determine the local server address.');
  }

  const url = `http://${host}:${address.port}`;
  console.log(`Central Core server active on ${url}`);

  return {
    url,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      db.close();
      await viteServer?.close();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === moduleFile) {
  startServer().catch(error => {
    console.error('Failed to initiate core:', error);
    process.exitCode = 1;
  });
}

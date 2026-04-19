import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for large JSON payloads if needed
  app.use(express.json({ limit: '50mb' }));

  const dbPath = path.join(process.cwd(), 'database.json');
  
  // Initialize database.json if it doesn't exist
  if (!fsSync.existsSync(dbPath)) {
     await fs.writeFile(dbPath, JSON.stringify({}), 'utf-8');
  }

  // Memory cache to avoid reading from disk on every request
  let storeCache: Record<string, any> = {};
  try {
     const fileData = await fs.readFile(dbPath, 'utf-8');
     storeCache = JSON.parse(fileData);
  } catch (e) {
     console.warn("Could not parse database.json, starting fresh.");
     storeCache = {};
  }

  // API Routes
  app.get('/api/store', (req, res) => {
    res.json(storeCache);
  });

  // Simple lock for atomic file writes
  let isWriting = false;
  let pendingWrite = false;

  const saveStore = async () => {
     if (isWriting) {
        pendingWrite = true;
        return;
     }
     isWriting = true;
     pendingWrite = false;
     try {
        const tempPath = dbPath + '.tmp';
        await fs.writeFile(tempPath, JSON.stringify(storeCache), 'utf-8');
        await fs.rename(tempPath, dbPath);
     } catch (e) {
        console.error("Failed to save database", e);
     } finally {
        isWriting = false;
        // If another write was requested while we were writing, process it now
        if (pendingWrite) {
           saveStore();
        }
     }
  };

  app.post('/api/store/:collection', (req, res) => {
    const collectionName = req.params.collection;
    storeCache[collectionName] = req.body;
    saveStore();
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false // Disable HMR to avoid unhandled WebSocket rejections in customized express
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

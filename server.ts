import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleUniversalApiRequest } from './server/api-router.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd =
  process.env.NODE_ENV === 'production' ||
  process.argv.includes('--prod') ||
  process.argv.includes('--production');

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// -----------------------------------------------------------------------------
// UNIVERSAL API BRIDGE (Express <-> Web Fetch Standard / Cloudflare compatible)
// -----------------------------------------------------------------------------
app.all('/api/*', async (req, res) => {
  try {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
    const fullUrl = `${proto}://${host}${req.originalUrl}`;

    // Bridge Express request headers to Web Standard Headers
    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val) {
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }
    }

    const init: RequestInit = {
      method: req.method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
      if (typeof req.body === 'object' && req.body !== null) {
        init.body = JSON.stringify(req.body);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
    }

    const webReq = new Request(fullUrl, init);
    const webRes = await handleUniversalApiRequest(webReq, { env: process.env });

    res.status(webRes.status);
    webRes.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    const contentType = webRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await webRes.json();
      res.json(data);
    } else {
      const text = await webRes.text();
      res.send(text);
    }
  } catch (err: any) {
    console.error('API bridge error:', err);
    res.status(500).json({ error: 'Internal API routing error' });
  }
});

// -----------------------------------------------------------------------------
// VITE DEV SERVER / STATIC PRODUCTION FALLBACK
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.warn('⚠️  Production mode active but dist/index.html not found!');
      console.warn('   Run "npm run build" to generate client assets before running in production.');
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(503).send('Application build in progress. Please run "npm run build".');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌿 Solaris Reef hub running at http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
  });

  // Graceful shutdown for Docker, PM2, Kubernetes, and SIGINT/SIGTERM
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();

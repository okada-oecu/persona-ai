import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Content } from '@google/genai';
import path from 'path';
import { buildSystemInstruction, GEMINI_MODEL, GENERATION_CONFIG } from './services/prompt';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Gemini Client Utility
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Routes
app.post('/api/chat/stream', async (req, res) => {
  const { world, history, message } = req.body;

  if (!world || !message) {
    res.status(400).json({ error: 'World and message are required' });
    return;
  }

  try {
    const systemInstruction = buildSystemInstruction(world);

    const formattedHistory: Content[] = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chatSession = ai.chats.create({
      model: GEMINI_MODEL,
      config: {
        systemInstruction,
        ...GENERATION_CONFIG,
      },
      history: formattedHistory,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const resultStream = await chatSession.sendMessageStream({ message });

    for await (const chunk of resultStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Error in /api/chat/stream:', error);
    let errMsg = error?.message || 'Internal server error';
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota exceeded') || error?.status === 429) {
      errMsg = 'APIの無料利用枠（クォータ上限）に達しました。Settings > Secrets から課金が有効なAPIキーを選択するか、時間をおいて再度お試しください。';
    }
    if (!res.headersSent) {
      res.status(500).json({ error: errMsg });
    } else {
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.end();
    }
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        const fs = await import('fs');
        let template = '';
        const indexPath = path.resolve('./index.html');
        if (fs.existsSync(indexPath)) {
          template = fs.readFileSync(indexPath, 'utf-8');
        } else {
          template = `<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/index.tsx"></script></body></html>`;
        }
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('/(.*)', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

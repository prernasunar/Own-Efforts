import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Support large image payloads up to 25MB for civil site photos
app.use(express.json({ limit: '25mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Server-side endpoint to analyze site photos and extract GPS Map Camera details
app.post('/api/extract-gps', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 parameter is required' });
    }

    // Strip data URL header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          },
          {
            text: `You are an expert GPS Map Camera & Timestamp Camera OCR analyzer.
Examine this civil site / construction photo closely.
Look for any GPS Map Camera watermark banner or text (typically in a black or dark box at the bottom or top of the image).
Extract:
1. Latitude (as a float, e.g. 19.053155)
2. Longitude (as a float, e.g. 73.016608)
3. formattedCoords: exact string formatted like "Lat 19.053155° Long 73.016608°" (or as written in the photo)
4. location: the full street address or location name found in the stamp (e.g. "Anirudha Bhawan, Sector 23, Juinagar, Navi Mumbai, Maharashtra 400706, India")
5. cityOrArea: city/area line (e.g. "Navi Mumbai, Maharashtra, India")
6. dateOrTimestamp: date and time string (e.g. "Thursday, 15/10/2026 06:49 PM GMT +05:30")
7. hasGps: boolean (true if GPS coordinates or stamp was detected)

Respond ONLY in strict JSON format:
{
  "latitude": number | null,
  "longitude": number | null,
  "formattedCoords": string,
  "location": string,
  "cityOrArea": string,
  "dateOrTimestamp": string,
  "hasGps": boolean
}`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonText = response.text?.trim() || '{}';
    const parsed = JSON.parse(jsonText);
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini GPS extraction server notice:', error.message);
    return res.status(500).json({ error: error.message || 'GPS extraction error' });
  }
});

// Initialize server with Vite middleware in development or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Civil Site Logger full-stack server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

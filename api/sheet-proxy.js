'use strict';

/**
 * Vercel Serverless Function: Google Sheet CSV CORS Proxy
 * Endpoint: /api/sheet-proxy?url=...
 *
 * Allows client-side dashboard to fetch public Google Sheet CSVs without
 * browser CORS restrictions or redirect drops.
 */

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = (req.query.url || '').trim();

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing required query parameter: url' });
  }

  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//i.test(targetUrl)) {
    return res.status(403).json({ error: 'Only Google Spreadsheets URLs are permitted' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/csv, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeout);

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream Google Sheet returned HTTP ${upstream.status} ${upstream.statusText}`
      });
    }

    const csvData = await upstream.text();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(csvData);

  } catch (err) {
    console.error('[SheetProxy Error]', err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Fetching Google Sheet timed out after 12 seconds' });
    }
    return res.status(502).json({ error: `Could not connect to Google Sheet: ${err.message}` });
  }
};

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin';

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.warn('Warning: TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not set in .env — Telegram notifications will fail.');
}

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/'))); // serve index.html, dashboard.html

// store transfers in memory (demo). To persist use a DB or file.
const transfers = [];

/**
 * POST /transfer
 * body: { payerName, amount, note }
 * Action: record transfer, send Telegram message to admin, return success/failure
 */
app.post('/transfer', async (req, res) => {
  try {
    const { payerName, amount, note } = req.body;
    if (!payerName || !amount) {
      return res.status(400).json({ ok: false, message: 'payerName and amount are required' });
    }

    const timestamp = new Date().toISOString();
    const id = transfers.length + 1;
    const item = { id, payerName, amount, note: note || '', timestamp };
    transfers.unshift(item); // latest first

    // prepare telegram message
    if (BOT_TOKEN && ADMIN_CHAT_ID) {
      const text = `🎁 *تحويل جديد*\n\n` +
             `المرسل: ${escapeMarkdown(payerName)}\n` +
             `المبلغ: ${escapeMarkdown(amount)}\n` +
             (note ? `ملاحظة: ${escapeMarkdown(note)}\n` : '') +
             `الوقت: ${timestamp}\n\n` +
             `— Merry Christmas`;
      const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      // send as MarkdownV2 safe-ish (we escape basic chars above)
      try {
        await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text,
            parse_mode: 'Markdown'
          })
        });
      } catch (err) {
        console.error('Telegram send error:', err.message);
      }
    }

    return res.json({ ok: true, transfer: item });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'server error' });
  }
});

/**
 * GET /transfers
 * protected by ADMIN_TOKEN either query param ?admin_token=... or header x-admin-token
 */
app.get('/transfers', (req, res) => {
  const provided = (req.query.admin_token || req.get('x-admin-token') || '');
  if (!ADMIN_TOKEN || provided !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, message: 'unauthorized' });
  }
  return res.json({ ok: true, transfers });
});

// helper to escape markdown (basic)
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([_*[\]()~`>#+-=|{}.!\\])/g, '\\$1');
}

// fallback for single-page serving (if using client side routes)
app.get('*', (req, res) => {
  // serve index.html by default except for explicit files
  if (req.path.endsWith('.html') || req.path.endsWith('.js') || req.path.endsWith('.css')) {
    return res.sendFile(path.join(__dirname, req.path));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

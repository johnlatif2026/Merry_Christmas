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

const transfers = [];

/**
 * POST /transfer
 * body: { payerName, amount, note }
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
    transfers.unshift(item);

    // إرسال رسالة للأدمن على تيليجرام
    if (BOT_TOKEN && ADMIN_CHAT_ID) {
      const text = `🎁 *تحويل جديد*\n\n` +
                   `المرسل: ${payerName}\n` +
                   `المبلغ: ${amount}\n` +
                   (note ? `ملاحظة: ${note}\n` : '') +
                   `الوقت: ${timestamp}\n\n` +
                   `— Merry Christmas`;
      const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

      try {
        await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text,
            parse_mode: 'Markdown' // استخدم Markdown العادية لتجنب \ في الأرقام
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
 * محمي بواسطة ADMIN_TOKEN
 */
app.get('/transfers', (req, res) => {
  const provided = (req.query.admin_token || req.get('x-admin-token') || '');
  if (!ADMIN_TOKEN || provided !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, message: 'unauthorized' });
  }
  return res.json({ ok: true, transfers });
});

// fallback للصفحات
app.get('*', (req, res) => {
  if (req.path.endsWith('.html') || req.path.endsWith('.js') || req.path.endsWith('.css')) {
    return res.sendFile(path.join(__dirname, req.path));
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

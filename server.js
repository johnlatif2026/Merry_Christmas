const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// in-memory store of transfers (لو عايز تحفظ على ملف/قاعدة بيانات لاحقاً سهل نضيف)
const transfers = [];

// Serve front pages (static files will be in project root)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API endpoint لتحويل (من الفرونت)، يرجى ارسال JSON { name, amount, note? }
app.post('/transfer', async (req, res) => {
  try {
    const { name, amount, note } = req.body;
    if (!name || !amount) {
      return res.status(400).json({ ok: false, message: 'name and amount required' });
    }

    const timestamp = new Date().toISOString();
    const transfer = { id: transfers.length + 1, name, amount, note: note || '', timestamp };
    transfers.push(transfer);

    // ارسال رسالة الى تيليجرام
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      const text = `🎁 *Merry Christmas*\n\nتم تحويل مبلغ: *${amount}*\nمن: *${name}*\nالوقت: ${timestamp}\nملاحظة: ${transfer.note || '-'}`;
      // نستخدم تنسيق MarkdownV2 - نرسل كـ POST
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      }).catch(err => {
        console.error('Telegram send failed:', err?.response?.data || err.message);
      });
    } else {
      console.warn('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping telegram send');
    }

    return res.json({ ok: true, transfer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: 'server error' });
  }
});

// API للداشبورد لاسترجاع التحويلات (يتطلب كلمة سر الأدمين)
app.get('/api/transfers', (req, res) => {
  const pw = req.headers['x-admin-password'] || req.query.pw;
  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'unauthorized' });
  }
  return res.json({ ok: true, transfers });
});

// صغير لتجربة أن السيرفر شغال
app.get('/health', (req, res) => res.send('ok'));

// start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
  

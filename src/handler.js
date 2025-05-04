const { Telegraf } = require('telegraf');
const { fetchGoogleSheetData } = require('./src/api');
const { getNamesForNextDay } = require('./src/utils');
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

module.exports.webhookHandler = async (event) => {
  const update = JSON.parse(event.body);
  await bot.handleUpdate(update, { webhookReply: true });
  return { statusCode: 200, body: '' };
};

async function buildScheduleText() {
  const data = await fetchGoogleSheetData();
  const names = getNamesForNextDay(data);
  const text = Array.isArray(names) ? names.join(', ') : names;
  return `🗓️ Розклад на завтра:\n\n${text}`;
}

module.exports.scheduleHandler = async () => {
  const chatIds = JSON.parse(process.env.CHAT_IDS);
  const text = await buildScheduleText();
  await Promise.all(
    chatIds.map(id =>
      axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: id, text
      })
    )
  );
};

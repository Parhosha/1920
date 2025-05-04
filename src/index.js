const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const { TELEGRAM_BOT_TOKEN } = require('./config'); // Assuming config.js exists
const { fetchGoogleSheetData } = require('./api'); // Assuming api.js exists
const { getNamesForNextDay } = require('./utils'); // Assuming utils.js exists



if (!TELEGRAM_BOT_TOKEN) {
  console.error("Error: TELEGRAM_BOT_TOKEN is missing in config.js or environment variables.");
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

const activeUserJobs = new Map();

async function getTomorrowSchedule() {
  try {
    const data = await fetchGoogleSheetData();
    const result = getNamesForNextDay(data);
    return result || 'Не ма нікого на чергуванні';
  } catch (error) {
    console.error("Error fetching Google Sheet data:", error);

    return 'Помилка отримання даних з Google Sheets';
  }
}

async function getScheduleMessageText() {
  const scheduleResult = await getTomorrowSchedule();

  const scheduleString = Array.isArray(scheduleResult)
    ? scheduleResult.join(', ')
    : String(scheduleResult);
  const cleanedString = scheduleString.replaceAll(',', '').trim();

  return `🗓️ Розклад на завтра:\n\n${cleanedString}\n\n🌈 🌈 🌈 🌈 🌈 🌈 🌈 🌈 🌈 🌈 🌈 🌈 🌈`;
}

bot.start(async (ctx) => {
  const chatId = ctx.chat.id;
  console.log(`\nReceived /start from chat ID: ${chatId}`);

  try {
    await ctx.reply(`Шо ти шляпа`);

    if (activeUserJobs.has(chatId)) {
      const existingJob = activeUserJobs.get(chatId);
      existingJob.stop();

      activeUserJobs.delete(chatId);
      console.log(`\nStopped existing schedule for chat ID: ${chatId}`);
      // await ctx.reply('Попередній розклад зупинено. Запускаю новий.');
    }

    // Send the schedule immediately once
    const initialMessageText = await getScheduleMessageText();
    await ctx.reply(initialMessageText);

    const cronExpression = '0 10 * * *';

    console.log(`\nScheduling new job for chat ID: ${chatId} with pattern: ${cronExpression}`);

    const scheduledTask = cron.schedule(cronExpression, async () => {
      console.log(`\nRunning scheduled job for chat ID: ${chatId}`);
      try {
        const messageText = await getScheduleMessageText();
        // Use bot.telegram.sendMessage, DO NOT use ctx here
        await bot.telegram.sendMessage(chatId, messageText);
      } catch (err) {
        console.error(`Error sending scheduled message to chat ${chatId}:`, err);

        try {
          await bot.telegram.sendMessage(chatId, 'Не вдалося надіслати розклад. Спробуйте /start знову пізніше.');
          const jobToStop = activeUserJobs.get(chatId);
          if (jobToStop) {
              jobToStop.stop();
              activeUserJobs.delete(chatId);
              console.log(`\nStopped job for chat ${chatId} due to send error.`);
          }
        } catch (sendError) {
          console.error(`Failed to even send error notification to chat ${chatId}:`, sendError);
        }
      }
    }, {
      scheduled: true,
      timezone: "Europe/Kiev" // IMPORTANT: Set your correct timezone
    });

    // Store the new job reference
    activeUserJobs.set(chatId, scheduledTask);
    console.log(`\nSuccessfully scheduled job for chat ID: ${chatId}`);
    // scheduledTask.start(); // .start() is implicitly called when scheduled: true

  } catch (error) {
    console.error(`Error in /start handler for chat ${chatId}:`, error);
    // Avoid crashing, inform the user if possible
    try {
      await ctx.reply('Виникла помилка під час налаштування розкладу. Спробуйте ще раз.');
    } catch (replyError) {
      console.error(`Failed to send error message to chat ${chatId}:`, replyError);
    }
  }
});

// Command to explicitly stop the schedule
bot.command('stop', async (ctx) => {
  const chatId = ctx.chat.id;
  console.log(`\nReceived /stop from chat ID: ${chatId}`);

  if (activeUserJobs.has(chatId)) {
    const job = activeUserJobs.get(chatId);
    job.stop(); // or job.destroy();
    activeUserJobs.delete(chatId);
    await ctx.reply('Автоматичне надсилання розкладу зупинено.');
    console.log(`\nStopped schedule via /stop for chat ID: ${chatId}`);
  } else {
    await ctx.reply('Немає активного розкладу для зупинки.');
  }
});


// --- Launch Bot ---
bot.launch()
  .then(() => {
    console.log('✅ Бот запущено');
  })
  .catch((err) => {
    console.error('❌ Помилка запуску бота:', err);
    process.exit(1); // Exit if launch fails
  });

// --- Graceful Shutdown ---
const shutdown = (signal) => {
  console.log(`\n\n${signal} отримано. Зупинка бота та розкладів...`);
  // Stop all active cron jobs
  activeUserJobs.forEach((job, chatId) => {
    job.stop(); // or job.destroy();
    console.log(`\nЗупинено розклад для чату ${chatId}`);
  });
  activeUserJobs.clear(); // Clear the map

  // Stop the bot
  bot.stop(signal);
  console.log('Бот зупинено.');
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
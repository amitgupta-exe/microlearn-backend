// daily-scheduler.js - Run as a cron job at 10 AM daily
require('dotenv').config(); // Ensure .env variables are loaded
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsAppMessage, sendInteractiveButtonsMessage } = require('./watiFunctions');

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Corrected to SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_COURSE_DAYS = 3;
const NEXT_DAY_START_HOUR = 10; // 10 AM server time

// --- Core Scheduler Logic ---

async function advanceOrRemindUsersByTimestamp() {
  console.log('[Scheduler] advanceOrRemindUsersByTimestamp: Task started.');
  const now = new Date();
  const todayAtStartHour = new Date(now);
  todayAtStartHour.setHours(NEXT_DAY_START_HOUR, 0, 0, 0);

  // Fetch users who are 'started'
  console.log(`[Scheduler] Fetching users with status='started'.`);
  const { data: usersInProgress, error } = await supabase
    .from('course_progress')
    .select('*')
    .in('status', ['assigned', 'started']);

    console.log(usersInProgress);
    

  if (error) {
    console.error('[Scheduler] Supabase error fetching users:', error);
    return;
  }

  if (!usersInProgress || usersInProgress.length === 0) {
    console.log('[Scheduler] No users found with status=\'started or assigned\'.');
    return;
  }

  console.log(`[Scheduler] Found ${usersInProgress.length} user(s) to process.`);

  for (const user of usersInProgress) {
    const current_day = user.current_day;

    // Restrict current_day to MAX_COURSE_DAYS
    if (current_day > MAX_COURSE_DAYS) {
      continue;
    }

    const m1 = !!user[`day${current_day}_module1`];
    const m2 = !!user[`day${current_day}_module2`];
    const m3 = !!user[`day${current_day}_module3`];
    const completedCount = [m1, m2, m3].filter(Boolean).length;

    // If on last day and all modules complete, mark as completed and stop
    if (current_day === MAX_COURSE_DAYS && completedCount === 3 && user.status !== 'completed') {
      await supabase
        .from('course_progress')
        .update({ status: 'completed' })
        .eq('phone_number', user.phone_number);
      await sendWhatsAppMessage(
        user.phone_number,
        `🎉 Congratulations! You have completed your course. You'll receive your certificate shortly.`
      );
      continue;
    }

    await sendInteractiveButtonsMessage(
      user.phone_number,
      `You're doing great!`,
      `You have completed ${completedCount} module(s) for Day ${current_day} .Press Start Learning to continue.`,
      [{ type: "reply", title: "Start Learning", id: "start_learning" }]
    );
  }
}

// Main scheduler function to be called by cron
async function runScheduledTasks() {
  console.log(`[Scheduler] Running tasks at ${new Date().toISOString()}`);
  try {
    await advanceOrRemindUsersByTimestamp();
  } catch (e) {
    console.error('[Scheduler] Error in runScheduledTasks:', e);
  }
  console.log(`[Scheduler] Tasks completed at ${new Date().toISOString()}`);
}

// Schedule task to run every minute
cron.schedule('* * * * *', () => {
  console.log('[Scheduler] Cron job triggered (every minute).');
  runScheduledTasks();
});

console.log('Daily scheduler started. Will run tasks every minute.');

// For manual testing (optional)
if (require.main === module && process.argv.includes('--manual')) {
  console.log('[Scheduler] Running scheduler manually...');
  runScheduledTasks().then(() => {
    console.log('[Scheduler] Manual execution completed.');
  }).catch(error => {
    console.error('[Scheduler] Error during manual execution:', error);
  });
}
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { sendWhatsAppMessage, sendInteractiveButtonsMessage } = require('./watiFunctions');
const { rebuildSession } = require('./sessionControl');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function sendCourseReminders() {
    try {
        const { data: progresses, error } = await supabase
            .from('course_progress')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.error('Cron fetch error:', error);
            return;
        }

        for (const progress of progresses) {
            const session = await rebuildSession(progress.phone_number, supabase);

            const day = progress.current_day || 1;
            const moduleKeys = [
                `day${day}_module1`,
                `day${day}_module2`,
                `day${day}_module3`
            ];
            const modulesDone = moduleKeys.map(k => progress[k]);
            const someFalse = modulesDone.some(v => !v);

            // Per-day reminder count column
            const reminderKey = `reminder_count_day${day}`;
            const reminderCount = progress[reminderKey] || 0;

            if (someFalse) {
                if (reminderCount < 3) {
                    await sendInteractiveButtonsMessage(
                        progress.phone_number,
                        `Day ${day} Reminder`,
                        `You have not completed Day ${day}. Please continue your course.`,
                        [{ type: "reply", title: `Continue Day ${day}`, id: "continue_day" }]
                    );
                    await supabase.from('course_progress')
                        .update({ [reminderKey]: reminderCount + 1 })
                        .eq('id', progress.id);
                } else {
                    await sendWhatsAppMessage(
                        progress.phone_number,
                        "Your course is suspended due to inactivity."
                    );
                    await supabase.from('course_progress')
                        .update({ is_active: false, status: 'suspended' })
                        .eq('id', progress.id);
                }
            }
        }
    } catch (err) {
        console.error('Cron job error:', err);
    }
}

// Run every minute
// cron.schedule('* * * * *', sendCourseReminders);

console.log('Course reminder cron job scheduled to run every minute.');
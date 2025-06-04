const { buildDeliverySession } = require('./sessionControl'); // Adjust path as needed

const MAX_COURSE_DAYS = 3;

async function handleCourseDelivery(phoneNumber, supabase, sendInteractiveButtonsMessage, sendWhatsAppMessage) {
    console.log(`[handleCourseDelivery] Called for: ${phoneNumber}`);

    const session = await buildDeliverySession(phoneNumber, supabase);

    if (!session) {
        await sendWhatsAppMessage(phoneNumber, "No active course found for you.");
        console.log(`[handleCourseDelivery] No session found for ${phoneNumber}.`);
        return;
    }

    const { current_day, progress, courseRows } = session;
    const dayRow = courseRows.find(row => row.day === current_day);

    if (!dayRow) {
        await sendWhatsAppMessage(phoneNumber, `No modules found for Day ${current_day}. Please contact support.`);
        return;
    }

    // Find the first incomplete module for the current day
    const nextModuleIdx = [1, 2, 3].find(i => !progress[`day${current_day}_module${i}`]);

    // If all modules are complete for the day, do nothing
    if (!nextModuleIdx) {
        console.log(`[handleCourseDelivery] All modules for Day ${current_day} are complete for ${phoneNumber}.`);
        return;
    }

    const moduleTitle = `Day ${current_day} - Module ${nextModuleIdx}`;
    const moduleContent = dayRow[`module_${nextModuleIdx}`];

    if (!moduleContent) {
        console.error(`[handleCourseDelivery] For ${phoneNumber} - Content for Day ${current_day}, Module ${nextModuleIdx} is missing in dayRow:`, dayRow);
        await sendWhatsAppMessage(phoneNumber, `Sorry, there was an issue loading Module ${nextModuleIdx}. Please contact support.`);
        return;
    }

    // Always send interactive button for every module (including the last)
    await sendInteractiveButtonsMessage(
        phoneNumber,
        moduleTitle,
        moduleContent,
        [{ type: "reply", title: "Done", id: `done_day${current_day}_module${nextModuleIdx}` }]
    );

    // Backlog logic: Only send backlog message if user is actually in backlog
    // (i.e., at least one module incomplete AND last_module_completed_at is old)
    // if (progress.last_module_completed_at) {
    //     const now = new Date();
    //     const lastCompleted = new Date(progress.last_module_completed_at);
    //     const diffMinutes = Math.floor((now - lastCompleted) / (1000 * 60));
    //     const completedCount = [1, 2, 3].filter(i => !!progress[`day${current_day}_module${i}`]).length;
    //     if (completedCount < 3 && diffMinutes >= 2) { // 2 minutes = 2 days in test mode
    //         await sendWhatsAppMessage(
    //             phoneNumber,
    //             `You have pending modules for Day ${current_day} of your course: ${dayRow.topic_name || 'your topic'}.`
    //         );
    //         await sendInteractiveButtonsMessage(
    //             phoneNumber,
    //             "Resume Learning",
    //             "Press Start Learning to continue.",
    //             [{ type: "reply", title: "Start Learning", id: "start_learning" }]
    //         );
    //     }
    // }
}

module.exports = { handleCourseDelivery };
const { buildDeliverySession } = require('./sessionControl'); // Ensure this path is correct

const MAX_COURSE_DAYS = 3; // Define the total number of days in your course

async function handleCourseDelivery(phoneNumber, supabase, sendInteractiveButtonsMessage, sendWhatsAppMessage) {
    console.log(`[handleCourseDelivery] Called for: ${phoneNumber}`);

    const session = await buildDeliverySession(phoneNumber, supabase);

    if (!session) {
        await sendWhatsAppMessage(phoneNumber, "No active course found for you.");
        console.log(`[handleCourseDelivery] No session found for ${phoneNumber}.`);
        return;
    }

    const { current_day, progress, courseRows } = session;
    console.log(`[handleCourseDelivery] For ${phoneNumber} - current_day: ${current_day}, progress: ${JSON.stringify(progress)}`);

    const dayRow = courseRows.find(row => row.day === current_day);

    if (!dayRow) {
        // This might happen if current_day was incremented beyond available courseRows
        if (current_day > MAX_COURSE_DAYS) {
            console.log(`[handleCourseDelivery] Course already completed or current_day (${current_day}) exceeds MAX_COURSE_DAYS (${MAX_COURSE_DAYS}) for ${phoneNumber}.`);
            // Optionally send a "You've already completed the course" message if status isn't 'completed' yet.
        } else {
            await sendWhatsAppMessage(phoneNumber, `No modules found for Day ${current_day}. Please contact support.`);
            console.log(`[handleCourseDelivery] No dayRow found for ${phoneNumber}, Day ${current_day}.`);
        }
        return;
    }

    const nextModuleIdx = [1, 2, 3].find(i => !progress[`day${current_day}_module${i}`]);
    console.log(`[handleCourseDelivery] For ${phoneNumber} - Next incomplete module index for Day ${current_day}: ${nextModuleIdx}`);

    if (nextModuleIdx) {
        const moduleTitle = `Day ${current_day} - Module ${nextModuleIdx}`;
        const moduleContent = dayRow[`module_${nextModuleIdx}`];
        
        if (!moduleContent) {
            console.error(`[handleCourseDelivery] For ${phoneNumber} - Content for Day ${current_day}, Module ${nextModuleIdx} is missing in dayRow:`, dayRow);
            await sendWhatsAppMessage(phoneNumber, `Sorry, there was an issue loading Module ${nextModuleIdx}. Please contact support.`);
            return;
        }
        
        console.log(`[handleCourseDelivery] For ${phoneNumber} - Sending Day ${current_day}, Module ${nextModuleIdx}: ${moduleTitle}`);
        await sendInteractiveButtonsMessage(
            phoneNumber,
            moduleTitle,
            moduleContent,
            [{ type: "reply", title: "Done", id: `done_day${current_day}_module${nextModuleIdx}` }] // WATI might simplify this ID on return
        );
        return;
    }

    // All modules for the current_day are complete
    console.log(`[handleCourseDelivery] For ${phoneNumber} - All modules complete for Day ${current_day}.`);
    await sendWhatsAppMessage(
        phoneNumber,
        `Day ${current_day} Complete! Well done.`
    );

    // Check if there are more days in the course
    if (current_day < MAX_COURSE_DAYS) {
        const nextDay = current_day + 1;
        console.log(`[handleCourseDelivery] Advancing ${phoneNumber} to Day ${nextDay}.`);
        
        const { error: updateError } = await supabase
            .from('course_progress')
            .update({ current_day: nextDay, status: 'started' }) // Ensure status remains 'started'
            .eq('phone_number', phoneNumber);

        if (updateError) {
            console.error(`[handleCourseDelivery] Error updating current_day for ${phoneNumber} to ${nextDay}:`, updateError);
            await sendWhatsAppMessage(phoneNumber, "There was an issue advancing to the next day. Please contact support.");
            return;
        }

        console.log(`[handleCourseDelivery] Successfully updated current_day to ${nextDay} for ${phoneNumber}. Triggering next day's delivery.`);
        await sendWhatsAppMessage(phoneNumber, `Let's start Day ${nextDay}!`);
        // Call handleCourseDelivery again to send the first module of the new day
        await handleCourseDelivery(phoneNumber, supabase, sendInteractiveButtonsMessage, sendWhatsAppMessage);
    } else {
        // All course days are completed
        console.log(`[handleCourseDelivery] For ${phoneNumber} - All ${MAX_COURSE_DAYS} days completed. Marking course as complete.`);
        const { error: completionError } = await supabase
            .from('course_progress')
            .update({ status: 'completed', completed_at: new Date() })
            .eq('phone_number', phoneNumber);

        if (completionError) {
            console.error(`[handleCourseDelivery] Error marking course as completed for ${phoneNumber}:`, completionError);
        }
        
        await sendWhatsAppMessage(
            phoneNumber,
            "🎉 Congratulations! You have successfully completed the entire course! 🎉"
        );
    }
}

module.exports = { handleCourseDelivery };
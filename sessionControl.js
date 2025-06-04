const { normalizePhoneNumber } = require('./webhookHelperFunctions')
async function buildDeliverySession(phoneNumber, supabase) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // 1. Fetch course_progress row for this phone number
    const { data: progress, error: progressError } = await supabase
        .from('course_progress')
        .select('*')
        .eq('phone_number', normalizedPhone)
        .in('status', ['assigned', 'started'])
        .maybeSingle();

    if (progressError) {
        console.error(`Error fetching course_progress for phone ${normalizedPhone}:`, progressError);
        return null;
    }
    if (!progress) {
        console.error(`No course_progress found for phone number ${normalizedPhone}. User might not be registered or progress deleted.`);
        return null;
    }

    // 2. Fetch all course day modules using progress.course_id from courses table
    if (!progress.course_id) {
        console.error(`No course_id found in course_progress for ${normalizedPhone}. Cannot fetch course content.`);
        return null;
    }

    console.log(`[sessionControl] Fetching courses for course_id: ${progress.course_id}`);
    const { data: courseRows, error: courseRowsError } = await supabase
        .from('courses')
        .select('*')
        .eq('request_id', progress.course_id)
        .order('day', { ascending: true });

    if (courseRowsError) {
        console.error(`Error fetching courses for course_id ${progress.course_id}:`, courseRowsError);
        return null;
    }
    if (!courseRows || courseRows.length === 0) {
        console.error(`No courses found for course_id ${progress.course_id}. Course content might be missing.`);
        return null;
    }
    console.log(`[sessionControl] Found ${courseRows.length} day(s) of content for course_id ${progress.course_id}.`);

    // 3. Build session object
    return {
        learner_id: progress.learner_id,
        course_id: progress.course_id,
        phone_number: progress.phone_number,
        current_day: progress.current_day || 1,
        progress,
        courseRows
    };
}

module.exports = {
    buildDeliverySession,
    normalizePhoneNumber
};
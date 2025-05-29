function normalizePhoneNumber(number) {
    if (!number) return '';
    number = number.toString().replace(/[\s\-+]/g, '');
    if (number.startsWith('0')) number = '91' + number.slice(1);
    if (number.length === 10) number = '91' + number;
    return number;
}

async function buildDeliverySession(phoneNumber, supabase) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // 1. Fetch course_progress row for this phone number
    const { data: progress, error: progressError } = await supabase
        .from('course_progress')
        .select('*') // Select all fields, including learner_id (which is the request_id)
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

    if (progressError) {
        console.error(`Error fetching course_progress for phone ${normalizedPhone}:`, progressError);
        return null;
    }
    if (!progress) {
        console.error(`No course_progress found for phone number ${normalizedPhone}. User might not be registered or progress deleted.`);
        return null;
    }

    // 2. Fetch all course day modules using progress.learner_id (which is the request_id)
    //    from generated_courses.
    //    progress.learner_id in 'course_progress' table should hold the 'request_id'
    //    that links to 'generated_courses.request_id'.
    if (!progress.learner_id) {
        console.error(`No learner_id (request_id) found in course_progress for ${normalizedPhone}. Cannot fetch course content.`);
        return null;
    }

    console.log(`[sessionControl] Fetching generated_courses for request_id (progress.learner_id): ${progress.learner_id}`);
    const { data: courseRows, error: courseRowsError } = await supabase
        .from('generated_courses')
        .select('*') // Selects all columns: id, request_id, day, module_1, module_2, module_3, etc.
        .eq('request_id', progress.learner_id) // Use learner_id from progress as the request_id
        .order('day', { ascending: true });

    if (courseRowsError) {
        console.error(`Error fetching generated_courses for request_id ${progress.learner_id}:`, courseRowsError);
        return null;
    }
    if (!courseRows || courseRows.length === 0) {
        console.error(`No generated_courses found for request_id ${progress.learner_id}. Course content might be missing.`);
        return null;
    }
    console.log(`[sessionControl] Found ${courseRows.length} day(s) of content for request_id ${progress.learner_id}.`);

    // 3. Build session object
    return {
        learner_id: progress.learner_id, // This is the request_id
        course_id: progress.course_id,   // This is the ID of the specific course_progress entry,
                                         // or could be the ID of the first day's generated_course row if that's how it was set.
                                         // Its primary use now is less for fetching all content, more for identifying the progress record.
        phone_number: progress.phone_number,
        current_day: progress.current_day || 1,
        progress, // The full course_progress object
        courseRows // Array of all day content for this request_id
    };
}

module.exports = {
    buildDeliverySession,
    normalizePhoneNumber
};
async function assignTestCourseToNumber(supabase, sendInteractiveButtonsMessage) {
    try {
        const requestId = '0c807c37-f95d-47f6-859d-cbb9c13c2806'; // Replace with your actual request_id

        // Fetch all course rows (days) for this request_id
        const { data: courseRows, error: courseError } = await supabase
            .from('generated_courses')
            .select('*')
            .eq('request_id', requestId)
            .order('day', { ascending: true });
        if (courseError) {
            console.error("Error fetching course days:", courseError);
            return;
        }
        if (!courseRows || courseRows.length === 0) {
            console.error("No course days found for request_id:", requestId);
            return;
        }

        // Fetch registration for the course
        const { data: registration, error: regError } = await supabase
            .from('registration_requests')
            .select('*')
            .eq('request_id', requestId)
            .maybeSingle();
        if (regError) {
            console.error("Error fetching registration:", regError);
            return;
        }
        if (!registration) {
            console.error("No registration found for request_id:", requestId);
            return;
        }

        const learnerId = registration.request_id;
        const learnerName = registration.name;
        const courseName = courseRows[0].topic_name;
        const courseId = courseRows[0].id; // Use id from generated_courses (day 1)
        const number = registration.number;
        // Check if a course_progress row already exists
        const { data: existingRows, error: selectError } = await supabase
            .from('course_progress')
            .select('id')
            .eq('learner_id', learnerId)
            .eq('course_id', courseId);

        if (selectError) {
            console.error('Error checking for existing course_progress:', selectError);
            return;
        }
        function normalizePhoneNumber(number) {
            if (!number) return '';
            number = number.replace(/[\s\-+]/g, ''); // Remove spaces, dashes, plus
            if (number.startsWith('0')) number = '91' + number.slice(1);
            if (number.length === 10) number = '91' + number;
            return number;
        }
        const normalizedNumber = normalizePhoneNumber(registration.number);

        if (!existingRows || existingRows.length === 0) {
            // Only insert if not already present
            const { error: insertError } = await supabase.from('course_progress').insert([{
                learner_id: learnerId,
                learner_name: learnerName,
                phone_number: normalizedNumber,
                course_id: courseId,
                course_name: courseName,
                status: 'notstarted',
                current_day: 1,
                started_at: null,
                completed_at: null,
                progress_percent: 0,
                reminder_count: 0,
                reminder_count_day1: 0,
                reminder_count_day2: 0,
                reminder_count_day3: 0,
                is_active: true,
                day1_module1: false, day1_module2: false, day1_module3: false,
                day2_module1: false, day2_module2: false, day2_module3: false,
                day3_module1: false, day3_module2: false, day3_module3: false
            }]);
            if (insertError) {
                console.error('Insert error in course_progress:', insertError);
                return;
            }
        } else {
            console.log('course_progress row already exists for this learner and course.');
        }

        // Set up session
        // const phoneNumber = registration.number; // Use the number from registration
        // if (!userSessions.has(phoneNumber)) userSessions.set(phoneNumber, {});
        // const session = userSessions.get(phoneNumber);
        // session.registration = {
        //     learner_id: learnerId,
        //     name: learnerName,
        //     course_id: courseId,
        //     topic: courseName,
        //     request_id: requestId
        // };
        // session.state = 'test_delivery_assigned';
        // session.courseRows = courseRows;

        await sendInteractiveButtonsMessage(
            number,
            "Course Assigned", // Header (must be <= 60 chars)
            `Hi ${learnerName}, you have been assigned "${courseName}". Press Start Learning to begin!`, // Body
            [{ type: "reply", title: "Start Learning", id: "start_learning" }]
        );
        console.log(`Assignment notification sent to ${number} for course "${courseName}"`);
    } catch (err) {
        console.error('Unexpected error in assignTestCourseToNumber:', err);
    }
}

module.exports = { assignTestCourseToNumber };
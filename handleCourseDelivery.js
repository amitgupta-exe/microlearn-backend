async function handleCourseDelivery(phoneNumber, session, userSessions, sendWhatsAppMessage, sendInteractiveButtonsMessage, supabase, text) {
    // Fetch course modules for this request_id
    const reg = session.registration;
    const { data: modules } = await supabase
        .from('generated_courses')
        .select('*')
        .eq('request_id', reg.request_id)
        .order('day, id', { ascending: true });

    if (!modules || modules.length === 0) {
        await sendWhatsAppMessage(phoneNumber, "No course modules found.");
        session.state = null;
        return;
    }

    // Find current module
    let dayIdx = session.courseDay - 1;
    let moduleIdx = session.courseModule - 1;
    const currentDay = modules[dayIdx];
    const moduleKeys = ['module_1', 'module_2', 'module_3'];
    const currentModule = currentDay[moduleKeys[moduleIdx]];

    if (!currentModule) {
        await sendWhatsAppMessage(phoneNumber, "No more modules for today. Type 'next' for the next day.");
        session.courseDay += 1;
        session.courseModule = 1;
        session.state = `course_delivery_day_${session.courseDay}_module_1`;
        return;
    }

    // Send current module with a "Next" button
    await sendInteractiveButtonsMessage(
        phoneNumber,
        `Day ${session.courseDay} - Module ${session.courseModule}`,
        currentModule,
        [
            { type: "reply", title: "Next", id: "next" }
        ]
    );

    // Wait for user to press "Next"
    if (text && text.toLowerCase() === 'next') {
        session.courseModule += 1;
        if (session.courseModule > 3) {
            session.courseDay += 1;
            session.courseModule = 1;
        }
        session.state = `course_delivery_day_${session.courseDay}_module_${session.courseModule}`;
    }
    userSessions.set(phoneNumber, session);
}

module.exports = { handleCourseDelivery };
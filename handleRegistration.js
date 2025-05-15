const { v4: uuidv4 } = require('uuid');

async function handleRegistration(phoneNumber, session, userSessions, sendWhatsAppMessage, sendInteractiveButtonsMessage, supabase, openaiClient, text) {
    if (!session.registration) session.registration = {};
    const reg = session.registration;

    if (!reg.request_id) reg.request_id = uuidv4();

    if (!reg.name) {
        if (!text) {
            await sendWhatsAppMessage(phoneNumber, "Please enter your name:");
            return;
        }
        reg.name = text;
        await sendWhatsAppMessage(phoneNumber, `Hi ${reg.name}, what topic do you want to explore?`);
        return;
    }

    if (!reg.topic) {
        reg.topic = text;
        await sendWhatsAppMessage(phoneNumber, `What goal do you want to achieve? for example "to learn to play cricket", "to learn to make a sadwich" `);
        return;
    }

    if (!reg.goal) {
        reg.goal = text;
        await sendInteractiveButtonsMessage(
            phoneNumber,
            "Choose your learning style",
            "choose a style",
            [
                { type: "reply", title: "Beginner", id: "beginner" },
                { type: "reply", title: "Advanced", id: "advanced" },
                { type: "reply", title: "Professional", id: "professional" }
            ]
        );
        return;
    }

    if (!reg.style) {
        reg.style = text;
        await sendInteractiveButtonsMessage(
            phoneNumber,
            "Choose your preferred language",
            "choose a language",
            [
                { type: "reply", title: "English", id: "english" },
                { type: "reply", title: "Hindi", id: "hindi" },
                { type: "reply", title: "Marathi", id: "marathi" }
            ]
        );
        return;
    }

    if (!reg.language) {
        reg.language = text;
        // Save registration to Supabase
        await supabase.from('registration_requests').insert([{
            request_id: reg.request_id,
            name: reg.name,
            number: phoneNumber,
            topic: reg.topic,
            goal: reg.goal,
            style: reg.style,
            language: reg.language,
            generated: false
        }]);
        await sendWhatsAppMessage(phoneNumber, `Thank you! We'll use this info to personalize your learning journey.`);

        // At the end of registration, instead of generating the course:
        return { completed: true, reg }; // Return registration data to server.js
    }
    return { completed: false };
}

module.exports = { handleRegistration };
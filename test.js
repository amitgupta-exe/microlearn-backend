const { sendInteractiveButtonsMessage, sendWhatsAppMessage } = require('./watiFunctions');
const sessions = new Map(); // In-memory session store

async function testinginteractivechat(phoneNumber) {
    // Start a new session
    let session = {
        state: 'start',
        name: null,
        gender: null
    };

    // Step 1: Send "Can we begin?" interactive button
    await sendInteractiveButtonsMessage(
        phoneNumber,
        "Can we begin?",
        "Please choose an option.",
        [
            { type: "reply", title: "Yes", id: "yes" },
            { type: "reply", title: "No", id: "no" }
        ]
    );
    session.state = 'awaiting_begin';
    sessions.set(phoneNumber, session);

    // Simulate user clicking "Yes"
    let userReply = "yes";
    if (session.state === 'awaiting_begin') {
        if (userReply === 'no') {
            await sendWhatsAppMessage(phoneNumber, "Ok, no worries.");
            session.state = 'completed';
        } else if (userReply === 'yes') {
            await sendWhatsAppMessage(phoneNumber, "What is your name?");
            session.state = 'awaiting_name';
        }
        sessions.set(phoneNumber, session);
    }

    // Simulate user entering their name
    userReply = "Alice";
    if (session.state === 'awaiting_name') {
        session.name = userReply;
        await sendInteractiveButtonsMessage(
            phoneNumber,
            `Hi ${session.name}, select your gender.`,
            "Please choose an option.",
            [
                { type: "reply", title: "Male", id: "male" },
                { type: "reply", title: "Female", id: "female" },
                { type: "reply", title: "Prefer not say", id: "prefer_not_say" }
            ]
        );
        session.state = 'awaiting_gender';
        sessions.set(phoneNumber, session);
    }

    // Simulate user selecting gender
    userReply = "female";
    if (session.state === 'awaiting_gender') {
        session.gender = userReply;
        await sendWhatsAppMessage(phoneNumber, `Thank you! Name: ${session.name}, Gender: ${session.gender}`);
        session.state = 'completed';
        // Log all responses
        console.log("\n--- Session Summary ---");
        console.log("Name:", session.name);
        console.log("Gender:", session.gender);
        sessions.set(phoneNumber, session);
    }
}

// Call the function right away with your test number
testinginteractivechat('919767989231');
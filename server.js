// Enhanced Webhook handler for WATI Chatbot
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { AzureOpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

require('dotenv').config();

const router = express.Router();
// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Azure OpenAI setup
const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const deployment = "o4-mini";
const subscriptionKey = process.env.AZURE_OPENAI_KEY;
const apiVersion = "2024-12-01-preview";

// WATI API setup
const watiApiKey = process.env.WATI_API_TOKEN;
const watiBaseUrl = process.env.WATI_API_URL; // e.g., "https://api.wati.io"
const { generateCourseWithOpenAI } = require('./openai');
const { sendWhatsAppMessage, sendWelcomeMessage, sendInteractiveButtonsMessage } = require('./watiFunctions'); // Import the function from watiFunctions.js
const { extractUserReply, normalizePhoneNumber } = require('./webhookHelperFunctions');

const { handleRegistration } = require('./handleRegistration');
const { handleCourseDelivery } = require('./handleCourseDelivery');

const client = new AzureOpenAI({
    apiVersion: apiVersion,
    azureEndpoint: endpoint,
    apiKey: subscriptionKey,
});

// Map to store user session data
const userSessions = new Map();

app.post('/wati-webhook', async (req, res) => {
    try {
        const payload = req.body;

        // ***** MOST IMPORTANT DEBUG LOG *****
        console.log('[Webhook] RAW PAYLOAD RECEIVED:', JSON.stringify(payload, null, 2));
        // ***** END MOST IMPORTANT DEBUG LOG *****

        const phoneNumber = payload.waId || payload.whatsappNumber || (payload.contact && payload.contact.wa_id);
        const text = extractUserReply(payload); // This might be "Done" or the button's title

        if (!phoneNumber) {
            console.error('[Webhook] Error: Missing WhatsApp number in payload:', payload);
            return res.status(400).json({ error: 'Missing WhatsApp number' });
        }
        // console.log(`[Webhook] Received request for phoneNumber: ${phoneNumber}`); // Optional: for general request logging

        // --- Registration Flow (Lines 73-218 in your provided code) ---
        // This section seems to use userSessions and session.state.
        // We will leave this as is, assuming it works for registration.
        // Initialize session if not present (for registration flow)
        if (!userSessions.has(phoneNumber)) {
            userSessions.set(phoneNumber, {});
        }
        const session = userSessions.get(phoneNumber);

        if (text && text.trim().toLowerCase() === 'microlearn' && (!session.state || session.state !== 'registration')) {
            await sendInteractiveButtonsMessage(
                phoneNumber,
                "Can we begin?",
                "Choose an option",
                [{ type: "reply", title: "Yes", id: "yes" }, { type: "reply", title: "Maybe next time", id: "maybe_next_time" }]
            );
            session.state = 'awaiting_begin';
            return res.status(200).json({ status: 'success' });
        }

        if (session.state === 'awaiting_begin') {
            if (text.toLowerCase() === 'maybe next time') {
                await sendWhatsAppMessage(phoneNumber, "No worries I am always here, awake me with the mantra microlearn!!");
                userSessions.delete(phoneNumber); // Clear session
                return res.status(200).json({ status: 'success' });
            } else if (text.toLowerCase() === 'yes') {
                session.state = 'registration';
                session.registration = {}; // Initialize registration object
                // Call handleRegistration - ensure it's adapted if userSessions is not the primary state mechanism for it
                await handleRegistration(phoneNumber, session, userSessions, sendWhatsAppMessage, sendInteractiveButtonsMessage, supabase, client);
                return res.status(200).json({ status: 'success' });
            }
        }

        if (session.state === 'registration') {
            const result = await handleRegistration(
                phoneNumber,
                session,
                userSessions,
                sendWhatsAppMessage,
                sendInteractiveButtonsMessage,
                supabase,
                client,
                text
            );

            if (result && result.completed && result.reg) {
                // Store registration in Supabase
                await supabase.from('registration_requests').insert([{
                    request_id: result.reg.request_id,
                    name: result.reg.name,
                    number: phoneNumber,
                    topic: result.reg.topic,
                    goal: result.reg.goal,
                    style: result.reg.style,
                    language: result.reg.language,
                    generated: false
                }]);

                // Generate course JSON from OpenAI
                const courseJson = await generateCourseWithOpenAI(result.reg);
                console.log("Raw OpenAI response:", courseJson);

                // Extract JSON between triple backticks (``` or ```json)
                const match = courseJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                let jsonString;
                if (match) {
                    jsonString = match[1];
                } else {
                    // fallback: try to find the first { ... }
                    const braceMatch = courseJson.match(/\{[\s\S]*\}/);
                    jsonString = braceMatch ? braceMatch[0] : null;
                }

                if (!jsonString) {
                    console.error("No JSON object found in OpenAI response:", courseJson);
                    // Inform the user and WATI
                    await sendWhatsAppMessage(phoneNumber, "Sorry, I couldn't generate the course content structure right now. Please try again later.");
                    return res.status(200).json({ status: 'error', message: 'Failed to extract course JSON from AI response.' });
                }

                // Parse the JSON string to an object
                let course;
                try {
                    // Trim whitespace just in case the regex included some
                    jsonString = jsonString.trim();
                    course = JSON.parse(jsonString);
                } catch (e) {
                    console.error("Failed to parse extracted JSON from OpenAI:", e, "Original jsonString snippet:", jsonString.substring(0, 500));
                    // Inform the user and WATI
                    await sendWhatsAppMessage(phoneNumber, "Sorry, there was an issue processing the course content format. Please try again later or contact support.");
                    return res.status(200).json({ status: 'error', message: 'Failed to parse course JSON.' });
                }

                // Insert each day and module into generated_courses
                let firstCourseId = null; // Initialize to ensure it's defined
                let dayNum = 1;
                for (const dayKey of Object.keys(course)) {
                    const modules = course[dayKey];
                    const insertObj = {
                        id: 'xxx',
                        request_id: result.reg.request_id,
                        course_name: result.reg.topic,
                        visibility: "public",
                        origin: "alfred",
                        day: dayNum,
                        module_1: modules[`Day ${dayNum} - Module 1`] ? modules[`Day ${dayNum} - Module 1`]["content"] : null,
                        module_2: modules[`Day ${dayNum} - Module 2`] ? modules[`Day ${dayNum} - Module 2`]["content"] : null,
                        module_3: modules[`Day ${dayNum} - Module 3`] ? modules[`Day ${dayNum} - Module 3`]["content"] : null,
                    };

                    const { data, error } = await supabase.from('courses').insert([insertObj]).select();
                    if (error) {
                        console.error(`Supabase insert error on day ${dayNum}:`, error);
                        return;
                    } else {
                        if (dayNum === 1 && data && data[0] && data[0].id) {
                            firstCourseId = data[0].id;
                        }
                    }
                    dayNum++;
                }

                console.log('Course modules stored successfully in Supabase.');

                // Mark registration as generated
                await supabase.from('registration_requests')
                    .update({ generated: true })
                    .eq('request_id', result.reg.request_id);

                // Insert a row in course_progress
                await supabase.from('course_progress').insert([{ // Changed to upsert
                    learner_id: result.reg.request_id,
                    learner_name: result.reg.name,
                    course_id: firstCourseId, // Ensure firstCourseId is correctly obtained
                    course_name: result.reg.topic,
                    status: 'notstarted',
                    current_day: 1,
                    phone_number: phoneNumber,
                    last_module_completed_at: new Date()
                }], { onConflict: 'phone_number', ignoreDuplicates: false }); // Specify onConflict strategy


                userSessions.delete(phoneNumber); // Good: Clear in-memory session

                await sendInteractiveButtonsMessage(
                    phoneNumber,
                    "Your course is ready!",
                    "Press Start Learning to begin your first module.",
                    [{ type: "reply", title: "Start Learning", id: "start_learning" }]
                );

                // REMOVE or COMMENT OUT the conflicting lines below if you are using the "Start Learning" button
                // session.state = `course_delivery_day_1_module_1`; // This conflicts with stateless button flow
                // session.courseDay = 1;
                // session.courseModule = 1;
                // await sendWhatsAppMessage(phoneNumber, `Your course is ready! Type 'next' to begin your first module.`); // This also conflicts

                return res.status(200).json({ status: 'success', message: 'Registration complete, course generated.' });
            }
            return res.status(200).json({ status: 'success', message: 'Processing registration.' });
        }
        // --- End of Registration Flow ---


        // --- Stateless Course Delivery Flow ---

        // // Handle "Start Learning" text command (keep if needed, but button is primary)
        // if (text && text.trim().toLowerCase() === 'start learning') {
        //     console.log(`[Webhook] 'start learning' text received for ${phoneNumber}`);
        //     // It's better to rely on the button click, but if text is a fallback:
        //     // Ensure a course_progress entry exists before calling handleCourseDelivery
        //     const { data: progressEntry, error: progressError } = await supabase
        //         .from('course_progress')
        //         .select('*')
        //         .eq('phone_number', phoneNumber)
        //         .in('status', ['assigned', 'started'])
        //         .maybeSingle()

        //     console.log(progressEntry);
        //     console.log(progressError);



        //     if (progressEntry) {
        //         if (progressEntry.status === 'assigned') {
        //             await supabase.from('course_progress')
        //                 .update({ status: 'started', started_at: new Date() })
        //                 .eq('phone_number', phoneNumber);
        //         }
        //         await handleCourseDelivery(phoneNumber, supabase, sendInteractiveButtonsMessage, sendWhatsAppMessage);
        //         return res.status(200).json({ status: 'success', message: 'Course delivery triggered by text.' });
        //     } else {
        //         await sendWhatsAppMessage(phoneNumber, "It seems you're not registered for a course yet. Type 'microlearn' to begin.");
        //         return res.status(200).json({ status: 'info', message: 'No course progress found for text command.' });
        //     }
        // }

        // Handle "Start Learning" button click
        if (payload.button_reply && payload.button_reply.id === 'start_learning' || text && text.trim().toLowerCase() === 'start learning') { // This seems to be for a different button type from WATI
            console.log(`[Webhook] 'start_learning' button clicked/text recieved for ${phoneNumber}`);
            // Fetch progress entry
            const { data: progressEntry, error: progressError } = await supabase
                .from('course_progress')
                .select('status')
                .eq('phone_number', phoneNumber)
                .in('status', ['assigned', 'started'])
                .maybeSingle();

            if (progressError || !progressEntry) {
                await sendWhatsAppMessage(phoneNumber, "It seems you're not registered for a course yet. Type 'microlearn' to begin.");
                return res.status(200).json({ status: 'info', message: 'No course progress found.' });
            }

            if (['completed', 'suspended'].includes(progressEntry.status)) {
                await sendWhatsAppMessage(phoneNumber, "Your course is already completed or suspended.");
                return res.status(200).json({ status: 'info', message: 'Course already completed or suspended.' });
            }

            // If status is 'assigned', update to 'started'
            if (progressEntry.status === 'assigned') {
                const { error: updateError } = await supabase.from('course_progress')
                    .update({ status: 'started', started_at: new Date() })
                    .eq('phone_number', phoneNumber);
                if (updateError) {
                    console.error(`[Webhook] Error updating status to 'started' for ${phoneNumber}:`, updateError);
                }
            }

            await handleCourseDelivery(phoneNumber, supabase, sendInteractiveButtonsMessage, sendWhatsAppMessage);
            return res.status(200).json({ status: 'success', message: 'Course started.' });
        }

        // Handle module completion from "Done" button click (using interactiveButtonReply or button_reply)
        const doneButton =
            (text && text.trim().toLowerCase() === 'done') ||
            (payload.interactiveButtonReply && payload.interactiveButtonReply.title && payload.interactiveButtonReply.title.toLowerCase() === 'done' && payload.interactiveButtonReply) ||
            (payload.button_reply && payload.button_reply.title && payload.button_reply.title.toLowerCase() === 'done' && payload.button_reply);

        if (doneButton) {
            // Fetch the user's progress to infer which module is next
            const { data: progressEntry, error: progressError } = await supabase
                .from('course_progress')
                .select('*')
                .eq('phone_number', phoneNumber)
                .in('status', ['assigned', 'started'])
                .maybeSingle();

            if (progressError || !progressEntry) {
                console.error(`[Webhook] Could not fetch progress for ${phoneNumber}:`, progressError);
                return res.status(500).json({ status: 'error', message: 'Could not fetch progress.' });
            }

            const current_day = progressEntry.current_day;
            // Find the first incomplete module for the current day
            const nextModuleIdx = [1, 2, 3].find(i => !progressEntry[`day${current_day}_module${i}`]);

            if (!nextModuleIdx) {
                // All modules are already complete, nothing to do
                await sendWhatsAppMessage(phoneNumber, "All modules for today are already complete.");
                return res.status(200).json({ status: 'success', message: 'All modules already complete.' });
            }

            // Mark this module as done and update last_module_completed_at
            const updateObj = {};
            updateObj[`day${current_day}_module${nextModuleIdx}`] = true;
            updateObj.last_module_completed_at = new Date();

            // If this is the last module (module 3), also increment current_day
            if (nextModuleIdx === 3) {
                // If this is the last module of the last day, mark as completed
                if (current_day === 3) {
                    updateObj.status = 'completed';
                } else {
                    updateObj.current_day = current_day + 1;
                }
            }
            const { error: updateError } = await supabase
                .from('course_progress')
                .update(updateObj)
                .eq('phone_number', phoneNumber);

            if (updateError) {
                console.error(`[Webhook] Error updating progress for ${phoneNumber}:`, updateError);
                return res.status(500).json({ status: 'error', message: 'Failed to update progress.' });
            }

            if (nextModuleIdx === 3) {
                // Send outro and STOP (do not send next module)
                if (current_day === 3) {
                    // Final outro for course completion
                    await sendWhatsAppMessage(
                        phoneNumber,
                        `🎉 Congratulations! You have completed your course. You'll receive your certificate shortly.`
                    );
                    return res.status(200).json({ status: 'success', message: 'Course completed, outro sent.' });
                } else {
                    // Outro for day completion
                    await sendWhatsAppMessage(
                        phoneNumber,
                        `🎉 Congratulations! You have completed all modules for Day ${current_day}. You'll get your next set of modules soon.`
                    );
                    return res.status(200).json({ status: 'success', message: 'Day completed, outro sent.' });
                }
            } else {
                // For modules 1 and 2, fetch fresh progress and send the next module
                await handleCourseDelivery(phoneNumber, supabase, sendInteractiveButtonsMessage, sendWhatsAppMessage);
                return res.status(200).json({ status: 'success', message: 'Module marked as done.' });
            }
        }

        // Fallback for unrecognized button clicks or text messages if session.state is not active
        if (!session.state) { // Only if not in an active registration flow
            console.log(`[Webhook] No specific action for ${phoneNumber}, payload:`, JSON.stringify(payload).substring(0, 200) + "...");
            // Optionally send a generic help message or "I didn't understand"
        }
        res.status(200).json({ status: 'ignored', message: 'No specific action taken for this webhook event.' });

    } catch (error) {
        console.error('[Webhook] General error in /wati-webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Restore GET endpoint for test delivery
app.get('/trigger_test_delivery', async (req, res) => {
    try {
        // You can call your test delivery logic here
        // Example: assignTestCourseToNumber(supabase, sendInteractiveButtonsMessage)
        res.status(200).json({ status: 'success', message: 'Test delivery triggered.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Restore POST endpoint for OpenAI
app.post('/openai', async (req, res) => {
    try {
        // Your OpenAI logic here
        res.status(200).json({ status: 'success', message: 'OpenAI endpoint hit.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
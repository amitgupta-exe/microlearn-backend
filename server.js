// Enhanced Webhook handler for WATI Chatbot
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { AzureOpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

require('dotenv').config();


const cron = require('node-cron');


const { generateCourseWithOpenAI } = require('./openai');
const { sendWhatsAppMessage, sendInteractiveButtonsMessage } = require('./watiFunctions');
const { extractUserReply, normalizePhoneNumber } = require('./webhookHelperFunctions');
const { handleRegistration } = require('./handleRegistration');
const { handleCourseDelivery } = require('./handleCourseDelivery');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
const subscriptionKey = process.env.AZURE_OPENAI_KEY;
const apiVersion = "2024-12-01-preview";
const client = new AzureOpenAI({
    apiVersion: apiVersion,
    azureEndpoint: endpoint,
    apiKey: subscriptionKey,
});

const userSessions = new Map();


app.post('/generate-course', async (req, res) => {
    try {
        // Accept registration data and extracted_pdf_text from request body
        const { extracted_pdf_text, ...reg } = req.body;
        if (!extracted_pdf_text) {
            return res.status(400).json({ error: 'Missing required field: extracted_pdf_text' });
        }
        const courseText = await generateCourseWithOpenAI(reg, extracted_pdf_text);
        res.status(200).json({ text: courseText });
    } catch (error) {
        console.error('[POST /generate-course] Error:', error);
        res.status(500).json({ error: 'Failed to generate course' });
    }
});

app.post('/wati-webhook', async (req, res) => {
    // --- LOG EVERY INCOMING WEBHOOK ---
    console.log('--- Incoming Webhook ---');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('------------------------');

    try {
        const payload = req.body;
        const phoneNumber = normalizePhoneNumber(
            payload.waId || payload.whatsappNumber || (payload.contact && payload.contact.wa_id)
        );
        // Always use lowercase for text comparison
        const text = extractUserReply(payload).toLowerCase();

        if (!phoneNumber) {
            console.error('[Webhook] Error: Missing WhatsApp number in payload:', payload);
            return res.status(400).json({ error: 'Missing WhatsApp number' });
        }

        if (!userSessions.has(phoneNumber)) userSessions.set(phoneNumber, {});
        const session = userSessions.get(phoneNumber);

        // Entry point: "microlearn"
        if (text === 'microlearn' && (!session.state || session.state !== 'registration')) {
            userSessions.delete(phoneNumber); // Destroy any existing session
            userSessions.set(phoneNumber, {}); // Start a fresh session
            const session = userSessions.get(phoneNumber);

            await sendInteractiveButtonsMessage(
                phoneNumber,
                "Can we begin?", // header <= 60 chars
                "Choose an option", // body
                [
                    { type: "reply", title: "Yes", id: "yes" }, // title <= 20 chars
                    { type: "reply", title: "Maybe next time", id: "maybe_next_time" }
                ]
            );
            session.state = 'awaiting_begin';
            return res.status(200).json({ status: 'success' });
        }

        // Awaiting user to start registration
        if (session.state === 'awaiting_begin') {
            if (text === 'maybe next time') {
                await sendWhatsAppMessage(phoneNumber, "No worries I am always here, awake me with the mantra microlearn!!");
                userSessions.delete(phoneNumber);
                return res.status(200).json({ status: 'success' });
            } else if (text === 'yes') {
                session.state = 'registration';
                session.registration = {};
                await handleRegistration(phoneNumber, session, userSessions, sendWhatsAppMessage, sendInteractiveButtonsMessage, supabase, client);
                return res.status(200).json({ status: 'success' });
            }
        }

        // --- Handle suspend/continue button replies ---
        const buttonPayload = payload.button_reply || payload.interactiveButtonReply;
        if (buttonPayload && session.pendingRegistration) {
            // Log for debugging
            console.log(`[Webhook] Button reply received:`, buttonPayload);
            console.log(`[Webhook] Session pendingRegistration:`, session.pendingRegistration);

            // Extract button ID robustly
            const buttonId = (buttonPayload.id || buttonPayload.button_id || '').toLowerCase();
            const buttonTitle = (buttonPayload.title || '').toLowerCase();

            const { userId, learnerName, reg, firstCourseId } = session.pendingRegistration;

            if (buttonId === 'suspend_previous' || buttonTitle === 'yes' || buttonId == 1) {
                console.log(`[Webhook] Suspending previous courses and creating new progress for ${phoneNumber}`);

                // Suspend previous active course(s)
                const { error: suspendError } = await supabase
                    .from('course_progress')
                    .update({ status: 'suspended' })
                    .eq('phone_number', phoneNumber)
                    .in('status', ['assigned', 'started']);
                if (suspendError) {
                    console.error(`[Webhook] Error suspending previous courses:`, suspendError);
                    return res.status(500).json({ status: 'error', message: 'Failed to suspend previous courses.' });
                }

                // Insert the new course_progress row
                const { error: insertError } = await supabase.from('course_progress').insert([{
                    learner_id: userId,
                    learner_name: learnerName,
                    course_id: firstCourseId,
                    course_name: reg.topic,
                    status: 'assigned',
                    current_day: 1,
                    phone_number: phoneNumber,
                    last_module_completed_at: new Date()
                }]);
                if (insertError) {
                    console.error(`[Webhook] Error inserting new course_progress:`, insertError);
                    return res.status(500).json({ status: 'error', message: 'Failed to create new course progress.' });
                }

                // Send interactive button before deleting session
                await sendInteractiveButtonsMessage(
                    phoneNumber,
                    "Course Ready!", // header <= 60 chars
                    "Press Start Learning to begin your first module.", // body
                    [{ type: "reply", title: "Start Learning", id: "start_learning" }] // title <= 20 chars
                );
                userSessions.delete(phoneNumber);
                return res.status(200).json({ status: 'success', message: 'Previous course suspended, new course started.' });
            }

            if (buttonId === 'continue_old' || buttonTitle === 'no' || buttonId == 2) {
                console.log(`[Webhook] Continuing previous course for ${phoneNumber}`);
                await sendInteractiveButtonsMessage(
                    phoneNumber,
                    "Continue Course", // header <= 60 chars
                    "Press Start Learning to continue.", // body
                    [{ type: "reply", title: "Start Learning", id: "start_learning" }] // title <= 20 chars
                );
                userSessions.delete(phoneNumber);
                return res.status(200).json({ status: 'success', message: 'Continuing previous course.' });
            }

            // If we reach here, the button ID was not recognized
            console.warn(`[Webhook] Unrecognized button ID:`, buttonId, buttonTitle);
            return res.status(400).json({ status: 'error', message: 'Unrecognized button reply.' });
        }

        // --- Registration flow ---
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
                // Ensure user exists
                const { data: userRows } = await supabase
                    .from('users')
                    .select('id')
                    .eq('phone', phoneNumber)
                    .maybeSingle();

                let userId;
                if (!userRows) {
                    const { data: newUser, error: userError } = await supabase
                        .from('users')
                        .insert([{ phone: phoneNumber, email: `${phoneNumber}@autogen.com`, name: result.reg.name }])
                        .select()
                        .maybeSingle();
                    if (userError || !newUser) {
                        console.error('Error creating user:', userError);
                        return res.status(500).json({ error: 'Failed to create user' });
                    }
                    userId = newUser.id;
                } else {
                    userId = userRows.id;
                }

                // Check for active course_progress
                const { data: existingActive } = await supabase
                    .from('course_progress')
                    .select('*')
                    .eq('phone_number', phoneNumber)
                    .in('status', ['assigned', 'started']);

                // Generate course JSON from OpenAI
                const courseJson = await generateCourseWithOpenAI(result.reg);
                console.log('[DEBUG] OpenAI courseJson:', courseJson); // <--- LOG RAW RESPONSE

                const match = courseJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                let jsonString;
                if (match) {
                    jsonString = match[1];
                } else {
                    const braceMatch = courseJson.match(/\{[\s\S]*\}/);
                    jsonString = braceMatch ? braceMatch[0] : null;
                }
                if (!jsonString) {
                    console.error('[Webhook] Could not extract JSON from OpenAI response:', courseJson);
                    await sendWhatsAppMessage(phoneNumber, "Sorry, I couldn't generate the course content structure right now. Please try again later.");
                    return res.status(200).json({ status: 'error', message: 'Failed to extract course JSON from AI response.' });
                }
                let course;
                try {
                    jsonString = jsonString.trim();
                    course = JSON.parse(jsonString);
                } catch (e) {
                    console.error('[Webhook] Failed to parse extracted JSON from OpenAI:', e, 'Original jsonString snippet:', jsonString.substring(0, 500));
                    await sendWhatsAppMessage(phoneNumber, "Sorry, there was an issue processing the course content format. Please try again later or contact support.");
                    return res.status(200).json({ status: 'error', message: 'Failed to parse course JSON.' });
                }

                // Insert each day and module into courses
                const courseId = result.reg.request_id; // Use this as the shared course_id
                let dayNum = 1;
                for (const dayKey of Object.keys(course)) {
                    const modules = course[dayKey];
                    const insertObj = {
                        id: uuidv4(), // unique row id for each module/day
                        request_id: courseId,
                        course_name: result.reg.topic,
                        visibility: "public",
                        origin: "alfred",
                        day: dayNum,
                        module_1: modules[`Day ${dayNum} - Module 1`] ? modules[`Day ${dayNum} - Module 1`]["content"] : null,
                        module_2: modules[`Day ${dayNum} - Module 2`] ? modules[`Day ${dayNum} - Module 2`]["content"] : null,
                        module_3: modules[`Day ${dayNum} - Module 3`] ? modules[`Day ${dayNum} - Module 3`]["content"] : null,
                        created_by: userId
                    };
                    const { data, error } = await supabase.from('courses').insert([insertObj]).select();
                    if (error) {
                        console.error(`Supabase insert error on day ${dayNum}:`, error);
                        return;
                    }
                    dayNum++;
                }

                // If active course exists, prompt user
                if (existingActive && existingActive.length > 0) {
                    session.pendingRegistration = {
                        userId,
                        learnerName: result.reg.name,
                        reg: result.reg,
                        firstCourseId: courseId // now always the request_id
                    };
                    await sendInteractiveButtonsMessage(
                        phoneNumber,
                        "Choose an option", // header <= 60 chars
                        "You already have a course in progress. Do you want to suspend your previous course and start a new one?",
                        [
                            { type: "reply", title: "Yes", id: "suspend_previous" },
                            { type: "reply", title: "No", id: "continue_old" }
                        ]
                    );

                    return res.status(200).json({ status: 'pending', message: 'User prompted to suspend previous course.' });
                }

                // No active course, proceed to create course_progress
                await supabase.from('course_progress').insert([{
                    learner_id: userId,
                    learner_name: result.reg.name,
                    course_id: courseId, // use the shared course_id
                    course_name: result.reg.topic,
                    status: 'assigned',
                    current_day: 1,
                    phone_number: phoneNumber,
                    last_module_completed_at: new Date()
                }]);

                // Before creating new course_progress, suspend all previous active courses for this phone number (normalized)
                const normalizedPhone = normalizePhoneNumber(phoneNumber);
                const { error: suspendError } = await supabase
                    .from('course_progress')
                    .update({ status: 'suspended' })
                    .eq('phone_number', normalizedPhone)
                    .in('status', ['assigned', 'started']);
                if (suspendError) {
                    console.error(`[Webhook] Error suspending previous courses for ${normalizedPhone}:`, suspendError);
                    return res.status(500).json({ status: 'error', message: 'Failed to suspend previous courses.' });
                }


                userSessions.delete(phoneNumber);
                await sendInteractiveButtonsMessage(
                    phoneNumber,
                    "Your course is ready!", // header <= 60 chars
                    "Press Start Learning to begin your first module.",
                    [{ type: "reply", title: "Start Learning", id: "start_learning" }]
                );

                // Insert user only if not already present
                const { data: existingUser, error: userLookupError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('phone', normalizePhoneNumber(phoneNumber))
                    .maybeSingle();

                if (!existingUser && !userLookupError) {
                    await supabase.from('users')
                        .insert([
                            { 
                                phone: normalizePhoneNumber(phoneNumber),
                                name: result.reg.name,
                                email: null,
                                role: 'learner'
                            }
                        ]);
                }

                return res.status(200).json({ status: 'success', message: 'Registration complete, course generated.' });
            }
            return res.status(200).json({ status: 'success', message: 'Processing registration.' });
        }

        // --- Handle "Start Learning" button click ---
        if ((payload.button_reply && payload.button_reply.id === 'start_learning') || text === 'start learning') {
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
                    .eq('phone_number', phoneNumber)
                    .in('status', ['assigned']); // Only update assigned
                if (updateError) {
                    console.error(`[Webhook] Error updating status to 'started' for ${phoneNumber}:`, updateError);
                } else {
                    console.log(`[Webhook] Status updated to 'started' for ${phoneNumber}`);
                }
            }

            await handleCourseDelivery(phoneNumber, supabase, sendInteractiveButtonsMessage, sendWhatsAppMessage);
            return res.status(200).json({ status: 'success', message: 'Course started.' });
        }

        // --- Handle module completion from "Done" button click ---
        const doneButton =
            (text === 'done') ||
            (payload.interactiveButtonReply && payload.interactiveButtonReply.title && payload.interactiveButtonReply.title.toLowerCase() === 'done') ||
            (payload.button_reply && payload.button_reply.title && payload.button_reply.title.toLowerCase() === 'done');

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
                        `🎉 Congratulations! You have completed your course.`
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
        if (!session.state) {
            console.log(`[Webhook] No specific action for ${phoneNumber}, payload:`, JSON.stringify(payload).substring(0, 200) + "...");
        }
        res.status(200).json({ status: 'ignored', message: 'No specific action taken for this webhook event.' });

    } catch (error) {
        console.error('[Webhook] General error in /wati-webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint for Azure App Service
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        message: 'Microlearn Backend API is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
    });
});



// // Supabase setup
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Corrected to SERVICE_KEY
// const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_COURSE_DAYS = 3;
const NEXT_DAY_START_HOUR = 10; // 10 AM server time

// --- Core Scheduler Logic ---

async function advanceOrRemindUsersByTimestamp() {
  console.log('[Scheduler] advanceOrRemindUsersByTimestamp: Task started.');
  const now = new Date();
  const todayAtStartHour = new Date(now);
  todayAtStartHour.setHours(NEXT_DAY_START_HOUR, 0, 0, 0);

  // Fetch users who are 'started'
  console.log(`[Scheduler] Fetching users with status='started'.`);
  const { data: usersInProgress, error } = await supabase
    .from('course_progress')
    .select('*')
    .in('status', ['assigned', 'started']);

    console.log(usersInProgress);
    

  if (error) {
    console.error('[Scheduler] Supabase error fetching users:', error);
    return;
  }

  if (!usersInProgress || usersInProgress.length === 0) {
    console.log('[Scheduler] No users found with status=\'started or assigned\'.');
    return;
  }

  console.log(`[Scheduler] Found ${usersInProgress.length} user(s) to process.`);

  for (const user of usersInProgress) {
    const current_day = user.current_day;

    // Restrict current_day to MAX_COURSE_DAYS
    if (current_day > MAX_COURSE_DAYS) {
      continue;
    }

    const m1 = !!user[`day${current_day}_module1`];
    const m2 = !!user[`day${current_day}_module2`];
    const m3 = !!user[`day${current_day}_module3`];
    const completedCount = [m1, m2, m3].filter(Boolean).length;

    // If on last day and all modules complete, mark as completed and stop
    if (current_day === MAX_COURSE_DAYS && completedCount === 3 && user.status !== 'completed') {
      await supabase
        .from('course_progress')
        .update({ status: 'completed' })
        .eq('phone_number', user.phone_number);
      await sendWhatsAppMessage(
        user.phone_number,
        `🎉 Congratulations! You have completed your course. You'll receive your certificate shortly.`
      );
      continue;
    }

    await sendInteractiveButtonsMessage(
      user.phone_number,
      `You're doing great!`,
      `You have completed ${completedCount} module(s) for Day ${current_day} .Press Start Learning to continue.`,
      [{ type: "reply", title: "Start Learning", id: "start_learning" }]
    );
  }
}

// Main scheduler function to be called by cron
async function runScheduledTasks() {
  console.log(`[Scheduler] Running tasks at ${new Date().toISOString()}`);
  try {
    await advanceOrRemindUsersByTimestamp();
  } catch (e) {
    console.error('[Scheduler] Error in runScheduledTasks:', e);
  }
  console.log(`[Scheduler] Tasks completed at ${new Date().toISOString()}`);
}

// // Schedule task to run every minute
// cron.schedule('* * * * *', () => {
//   console.log('[Scheduler] Cron job triggered (every minute).');
//   runScheduledTasks();
// });

// console.log('Daily scheduler started. Will run tasks every minute.');

// // For manual testing (optional)
// if (require.main === module && process.argv.includes('--manual')) {
//   console.log('[Scheduler] Running scheduler manually...');
//   runScheduledTasks().then(() => {
//     console.log('[Scheduler] Manual execution completed.');
//   }).catch(error => {
//     console.error('[Scheduler] Error during manual execution:', error);
//   });
// }
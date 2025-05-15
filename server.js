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
const {
    isModuleCompletionButton,
    extractUserMessage,
    getUserData,
    handleUserMessage,
    recordUserInteraction,
    handleModuleCompletion,
    extractVariableName,
    extractVariableValue,
    generateCourse,
    sendNextModule,

    extractUserReply
} = require('./webhookHelperFunctions');

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
        const phoneNumber = payload.waId || payload.whatsappNumber || (payload.contact && payload.contact.wa_id);
        const text = extractUserReply(payload);

        if (!phoneNumber) return res.status(400).json({ error: 'Missing WhatsApp number' });
        if (!text) return res.status(200).json({ status: 'ignored' });

        // Initialize session if not present
        if (!userSessions.has(phoneNumber)) userSessions.set(phoneNumber, {});
        const session = userSessions.get(phoneNumber);

        // Registration flow trigger
        if (text.toLowerCase() === 'microlearn') {
            await sendInteractiveButtonsMessage(
                phoneNumber,
                "Can we begin?",
                "Choose an option",
                [
                    { type: "reply", title: "Yes", id: "yes" },
                    { type: "reply", title: "Maybe next time", id: "maybe_next_time" }
                ]
            );
            session.state = 'awaiting_begin';
            return res.status(200).json({ status: 'success' });
        }

        // Begin registration if user says yes
        if (session.state === 'awaiting_begin') {
            if (text.toLowerCase() === 'maybe next time') {
                await sendWhatsAppMessage(phoneNumber, "No worries I am always here, awake me with the mantra microlearn!!");
                session.state = null;
                return res.status(200).json({ status: 'success' });
            } else if (text.toLowerCase() === 'yes') {
                session.state = 'registration';
                session.registration = {};
                await handleRegistration(phoneNumber, session, userSessions, sendWhatsAppMessage, sendInteractiveButtonsMessage, supabase, client);
                return res.status(200).json({ status: 'success' });
            }
        }

        // Continue registration flow
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

            // If registration is completed, generate and store the course
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
                    return;
                }

                // Parse the JSON string to an object
                let course;
                try {
                    course = JSON.parse(jsonString);
                } catch (e) {
                    console.error("Failed to parse extracted JSON from OpenAI:", e, jsonString);
                    return;
                }

                // Insert each day and module into generated_courses
                let dayNum = 1;
                for (const dayKey of Object.keys(course)) {
                    const modules = course[dayKey];
                    const insertObj = {
                        request_id: result.reg.request_id,
                        day: dayNum,
                        module_1: modules[`Day ${dayNum} - Module 1`] ? modules[`Day ${dayNum} - Module 1`]["content"] : null,
                        module_2: modules[`Day ${dayNum} - Module 2`] ? modules[`Day ${dayNum} - Module 2`]["content"] : null,
                        module_3: modules[`Day ${dayNum} - Module 3`] ? modules[`Day ${dayNum} - Module 3`]["content"] : null,
                        topic_name: result.reg.topic
                    };

                    console.log(`Inserting for day ${dayNum}:`, insertObj);

                    const { data, error } = await supabase.from('generated_courses').insert([insertObj]).select();

                    if (error) {
                        console.error(`Supabase insert error on day ${dayNum}:`, error);
                        return;
                    } else {
                        console.log(`Inserted row for day ${dayNum}:`, data);
                    }
                    dayNum++;
                }

                console.log('Course modules stored successfully in Supabase.');

                // Mark registration as generated
                await supabase.from('registration_requests')
                    .update({ generated: true })
                    .eq('request_id', result.reg.request_id);

                // Start course delivery
                session.state = `course_delivery_day_1_module_1`;
                session.courseDay = 1;
                session.courseModule = 1;
                await sendWhatsAppMessage(phoneNumber, `Your course is ready! Type 'next' to begin your first module.`);
            }

            return res.status(200).json({ status: 'success' });
        }

        // Course delivery flow
        if (session.state && session.state.startsWith('course_delivery')) {
            await handleCourseDelivery(phoneNumber, session, userSessions, sendWhatsAppMessage, sendInteractiveButtonsMessage, supabase, text);
            return res.status(200).json({ status: 'success' });
        }

        res.status(200).json({ status: 'ignored' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
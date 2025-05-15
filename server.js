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

const client = new AzureOpenAI({
    apiVersion: apiVersion,
    azureEndpoint: endpoint,
    apiKey: subscriptionKey,
});

// Map to store user session data
const userSessions = new Map();

// Route for handling chatbot messages from WATI
// router.post('/chat', async (req, res) => {
//     try {
//         const payload = req.body;
//         const whatsappNumber = payload.waId || payload.whatsappNumber || (payload.contact && payload.contact.wa_id);

//         if (!whatsappNumber) {
//             return res.status(400).json({ error: 'Missing WhatsApp number' });
//         }

//         // Check if this is a button press for module completion
//         if (isModuleCompletionButton(payload)) {
//             // This will be handled by the main webhook handler
//             return res.status(200).json({ status: 'success' });
//         }

//         // Extract user message
//         const userMessage = extractUserMessage(payload);

//         if (!userMessage) {
//             return res.status(400).json({ error: 'No message content found' });
//         }

//         // Get user data and course context
//         const userData = await getUserData(whatsappNumber);

//         if (!userData) {
//             // If user not found in database, could be a new user or error
//             await sendWhatsAppMessage(whatsappNumber, "I don't seem to have your course information. If you're interested in taking a course, please start by telling me your name.");
//             return res.status(200).json({ status: 'success' });
//         }

//         // Handle the message based on context
//         await handleUserMessage(whatsappNumber, userMessage, userData);

//         // Record the question/response in database
//         await recordUserInteraction(whatsappNumber, userMessage, 'question');

//         // Respond to WATI webhook
//         res.status(200).json({ status: 'success' });

//     } catch (error) {
//         console.error('Chatbot error:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

app.post('/wati-webhook', async (req, res) => {
    try {
        const payload = req.body;
        const phoneNumber = payload.waId || payload.whatsappNumber || (payload.contact && payload.contact.wa_id);
        const text = extractUserReply(payload);

        if (!phoneNumber) return res.status(400).json({ error: 'Missing WhatsApp number' });

        if (!text) {
            // Ignore empty or unrecognized input
            return res.status(200).json({ status: 'ignored' });
        }

        // Initialize session if not present
        if (!userSessions.has(phoneNumber)) {
            userSessions.set(phoneNumber, {});
        }
        const session = userSessions.get(phoneNumber);

        // FLOW LOGIC
        if (text === 'microlearn') {
            // await sendWhatsAppMessage(phoneNumber, "Welcome to microlearn, microlearn is a platform to consume knowledge in bite sized modules");
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

        else if (session.state === 'awaiting_begin') {
            if (text === 'maybe next time') {
                await sendWhatsAppMessage(phoneNumber, "No worries I am always here, awake me with the mantra microlearn!!");
                session.state = null;
            } else if (text === 'yes') {
                await sendWhatsAppMessage(phoneNumber, "Please enter your name");
                session.state = 'awaiting_name';
            }
            return res.status(200).json({ status: 'success' });
        }

        else if (session.state === 'awaiting_name') {
            session.name = text;
            await sendWhatsAppMessage(phoneNumber, `Hi ${session.name}, what topic do you want to explore?`);
            session.state = 'awaiting_topic';
            return res.status(200).json({ status: 'success' });
        }

        else if (session.state === 'awaiting_topic') {
            session.topic = text;
            await sendWhatsAppMessage(phoneNumber, `What goal do you want to achieve?`);
            session.state = 'awaiting_goal';
            return res.status(200).json({ status: 'success' });
        }

        else if (session.state === 'awaiting_goal') {
            session.goal = text;
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
            session.state = 'awaiting_style';
            return res.status(200).json({ status: 'success' });
        }

        else if (session.state === 'awaiting_style') {
            session.style = text;
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
            session.state = 'awaiting_language';
            return res.status(200).json({ status: 'success' });
        }

        else if (session.state === 'awaiting_language') {
            session.language = text;
            await sendWhatsAppMessage(phoneNumber, `Thank you! We'll use this info to personalize your learning journey.`);
            session.state = null; // End of flow

            // Log all responses at the end of the flow
            console.log("\n--- Session Summary ---");
            console.log("Name:", session.name);
            console.log("Topic:", session.topic);
            console.log("Goal:", session.goal);
            console.log("Learning Style:", session.style);
            console.log("Language:", session.language);

            // Here you can later add code to store session in Supabase
            return res.status(200).json({ status: 'success' });
        }

        // Default fallback
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
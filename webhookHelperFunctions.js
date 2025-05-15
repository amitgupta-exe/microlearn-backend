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

const { sendWhatsAppMessage } = require('./watiFunctions'); // Import the function from watiFunctions.js

const client = new AzureOpenAI({
    apiVersion: apiVersion,
    azureEndpoint: endpoint,
    apiKey: subscriptionKey,
});

// Map to store user session data
const userSessions = new Map();


//made to handle session problem of sending rapid sequent messagees without waiting. the issue is because the payload for interactive message is in different format
function extractUserReply(payload) {
    // WATI interactive button reply (common)
    if (payload.button && payload.button.text) return payload.button.text.trim().toLowerCase();

    // WATI interactive message (sometimes nested)
    if (
        payload.message &&
        payload.message.type === 'interactive' &&
        payload.message.interactiveResponseMessage &&
        payload.message.interactiveResponseMessage.button_text
    ) {
        return payload.message.interactiveResponseMessage.button_text.trim().toLowerCase();
    }

    // WATI interactive button reply (newer format)
    if (
        payload.type === 'button' &&
        payload.buttonText
    ) {
        return payload.buttonText.trim().toLowerCase();
    }

    // Plain text
    if (payload.text) return payload.text.trim().toLowerCase();

    // Fallback
    return '';
}



module.exports = {

    extractUserReply
};
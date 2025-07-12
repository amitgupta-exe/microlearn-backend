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


function normalizePhoneNumber(input) {
  if (!input) {
    throw new Error("Phone number is empty or undefined");
  }

  // Convert to string and remove all non-digit characters
  const cleaned = String(input).replace(/\D/g, '');

  let tenDigitNumber;

  if (cleaned.length === 10) {
    // Already a 10-digit number
    tenDigitNumber = cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    // Starts with 0 and followed by 10 digits
    tenDigitNumber = cleaned.slice(1);
  } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // Starts with country code 91
    tenDigitNumber = cleaned.slice(2);
  } else if (cleaned.length === 13 && cleaned.startsWith('091')) {
    // Starts with 091
    tenDigitNumber = cleaned.slice(3);
  } else if (cleaned.length >= 10) {
    // Fallback: pick the last 10 digits
    tenDigitNumber = cleaned.slice(-10);
  } else {
    throw new Error(`Invalid phone number format: ${input}`);
  }

  if (tenDigitNumber.length !== 10) {
    throw new Error(`Unable to normalize phone number: ${input}`);
  }

  return `+91${tenDigitNumber}`;
}


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

    extractUserReply, normalizePhoneNumber
};
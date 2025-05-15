const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const apiKey = process.env.WATI_API_TOKEN;

async function sendWhatsAppMessage(phoneNumber, message) {
    const url = `${process.env.WATI_API_URL}/api/v1/sendSessionMessage/${phoneNumber}`;
    const formData = new FormData();
    formData.append('messageText', message);
    try {
        await axios.post(url, formData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...formData.getHeaders(),
            },
        });
    } catch (error) {
        console.error('Error sending message:', error.response ? error.response.data : error.message);
    }
}

async function sendInteractiveButtonsMessage(phoneNumber, headerText, bodyText, buttons) {
    const url = `https://live-mt-server.wati.io/8076/api/v1/sendInteractiveButtonsMessage?whatsappNumber=${phoneNumber}`;
    const payload = {
        header: {
            type: "Text",
            text: headerText
        },
        body: bodyText,
        // footer: "Optional footer text", // Uncomment if you want a footer
        buttons: buttons.map(btn => ({ text: btn.title }))
    };

    console.log('Payload:', payload);

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });
        console.log('Interactive button sent successfully:', response.data);
    } catch (error) {
        console.error('Error sending interactive button:', error.response ? error.response.data : error.message);
        if (error.response) {
            console.error('Status Code:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
    }
}

async function sendWelcomeMessage(phoneNumber) {
    const message = `Welcome to MicroLearn! We're excited to have you on board.`;
    await sendWhatsAppMessage(phoneNumber, message);
}

module.exports = { sendWhatsAppMessage, sendWelcomeMessage, sendInteractiveButtonsMessage };


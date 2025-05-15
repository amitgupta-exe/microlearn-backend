const cron = require('node-cron'); // Install using `npm install node-cron`
const axios = require('axios'); // Install using `npm install axios`
const { createClient } = require('@supabase/supabase-js'); // Install using `npm install @supabase/supabase-js`
var request = require('request');
require('dotenv').config("./env")

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL; // Replace with your Supabase URL
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Replace with your Supabase Key
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// WATI configuration
const WATI_ENDPOINT = process.env.URL; // Replace with your WATI endpoint
const WATI_API_KEY = process.env.API; // Replace with your WATI API Key

// Cron job to run every 10 seconds
// Adjust the frequency here if needed
cron.schedule('*/10 * * * * *', async () => {
    console.log('Cron job started...');

    try {
        // Fetch data from Supabase table
        const { data, error } = await supabase
            .from('your_table_name') // Replace with your table name
            .select('*')
            .eq('some_column', 'some_value'); // Adjust the query condition as needed

        if (error) {
            console.error('Error fetching data from Supabase:', error);
            return;
        }

        if (data && data.length > 0) {
            for (const record of data) {
                // Prepare the message to send
                const message = record.message; // Adjust based on your table structure
                const recipient = record.recipient; // Adjust based on your table structure

                // Send message using WATI
                const response = await axios.post(
                    WATI_ENDPOINT,
                    {
                        phone: recipient, // Replace with the recipient's phone number
                        message: message, // Replace with the message content
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${WATI_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                console.log('Message sent:', response.data);
            }
        } else {
            console.log('No matching records found.');
        }
    } catch (err) {
        console.error('Error in cron job:', err);
    }
});
// Azure OpenAI API Test - Node.js
const axios = require('axios');

// Configuration
const endpoint = "https://make002.openai.azure.com/openai/deployments/o4-mini/v1/chat/completions/";
const apiKey = process.env.AZURE_OPENAI_API_KEY // Replace with your actual API key

// Sample prompt
const data = {
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Tell me a short joke about programming." }
  ],
  max_tokens: 150,
  temperature: 0.7
};

// Request headers
const headers = {
  'Content-Type': 'application/json',
  'api-key': apiKey
};

// Make the API call
async function testAzureOpenAI() {
  try {
    console.log("Sending request to Azure OpenAI...");
    const response = await axios.post(endpoint, data, { headers });
    
    // Extract and display the response
    const assistantResponse = response.data.choices[0].message.content;
    console.log("\nResponse from AI:");
    console.log(assistantResponse);
    
    // Log additional information
    console.log("\nComplete API Response:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Error calling Azure OpenAI API:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Execute the test
testAzureOpenAI();
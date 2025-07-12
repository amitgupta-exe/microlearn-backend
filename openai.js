const { AzureOpenAI } = require("openai");
const dotenv = require("dotenv");

dotenv.config();

async function generateCourseWithOpenAI(reg, extracted_pdf_text = null) {
  const { style, goal, topic, language } = reg;
  const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://cop-test.openai.azure.com/";
  const apiKey = process.env["AZURE_OPENAI_API_KEY"] || "<REPLACE_WITH_YOUR_KEY_VALUE_HERE>";
  const apiVersion = "2025-01-01-preview";
  const deployment = "o1-mini"; // This must match your deployment name

  // Create the base prompt
  let prompt = `
Create a personalized 3-day micro-course on "${topic}" in "${language}", using the teaching style of "${style}", designed to be delivered via WhatsApp. The course should help the learner achieve their goal: "${goal}".`;

  // Add PDF content if provided
  if (extracted_pdf_text) {
    prompt += `

Additional Context:
Use the following extracted PDF content as reference material to enhance the course content and ensure accuracy:

${extracted_pdf_text}

Please incorporate relevant information from this content into the course modules where appropriate.`;
  }

  prompt += `

Guidelines:

1. Structure:
- Duration: 3 days.
- Modules per Day: 3 modules (total of 9 modules).
- Daily Module Breakdown:
    - Modules 1 and 2: Focus on teaching key concepts and skills related to "${topic}". Content should align with the learner's goal ("${goal}").
    - Module 3: Should include Reflection (encourage the learner to reflect on the previous modules and how it applies to the goal) and an Actionable Task (provide a practical exercise or task that allows the learner to apply the day's learning).

2. Content Requirements:
- Length: Each module must be 10 to 12 sentences.
- Opening: Start with a compelling hook or key point to engage the learner.
- Focus: Concentrate on one core concept or skill per module.
- Language: Use clear, simple language suitable for mobile reading formatted for WhatsApp.

3. Engagement:
- Incorporate 1-2 relevant emojis to enhance engagement.
- Maintain an encouraging tone that fosters learning.

4. Style Guidelines:
- Format content for easy reading on WhatsApp.
- Break text into short paragraphs for readability.
- Utilize bullet points or numbered lists where appropriate.
- Use line breaks to enhance readability.

5. Content Flow:
- Ensure modules progress logically, building upon previous content.
- Align all content with the unique learner's overall goal ("${goal}").

6. Output Format:
- Respond ONLY with valid JSON (no markdown, no triple backticks, no explanations).
- Each module must be an object with a single property "content" containing the text.
- Example:
{
  "Day 1": {
    "Day 1 - Module 1": { "content": "Your module 1 content here." },
    "Day 1 - Module 2": { "content": "Your module 2 content here." },
    "Day 1 - Module 3": { "content": "Your module 3 content here." }
  },
  "Day 2": {
    "Day 2 - Module 1": { "content": "..." },
    "Day 2 - Module 2": { "content": "..." },
    "Day 2 - Module 3": { "content": "..." }
  },
  "Day 3": {
    "Day 3 - Module 1": { "content": "..." },
    "Day 3 - Module 2": { "content": "..." },
    "Day 3 - Module 3": { "content": "..." }
  }
}

Important Output Instructions:
- Do NOT use markdown formatting, triple backticks, or code blocks anywhere in your response.
- Do NOT use indentation or extra line breaks except for separating paragraphs.
- Each module's "content" property must contain only plain text, not objects or arrays.
- Do NOT include any explanations, comments, or extra text—respond ONLY with valid JSON as shown in the example.`;

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

  const result = await client.chat.completions.create({
    messages: [
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 3991
  });

  console.log(result.choices[0].message.content);
  console.log("course generated sucessfully");



  // Extract and return only the JSON content from the response
  return result.choices[0].message.content;
}

module.exports = {
  generateCourseWithOpenAI
};


import { AzureOpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const Style = 'beginer'
const Goal = 'TO learn music theory on guitar'
const Topic = 'Music'

const prompt = `Create a personalized 3-day micro-course on music in english, using the teaching style of ${Style}, designed to be delivered via WhatsApp. The course should help the learner achieve their goal: ${Goal}.
 
Guidelines:

1. Structure:
- Duration: 3 days.
- ⁠Modules per Day: 3 modules (total of 9 modules).
- ⁠Daily Module Breakdown:
		- Modules 1 and 2:
		 	Focus on teaching key concepts and skills related to ${Topic}.
			Content should align with the learner's goal (${Goal}
		- Module 3 Should include:
			Reflection: Encourage the learner to reflect on the previous modules and how it applies to the goal.
			Actionable Task: Provide a practical exercise or task that allows the learner to apply the day's learning.

- Content Requirements:
	- Length: Each module must be 10 to 12 sentences.
	- Opening: Start with a compelling hook or key point to engage the learner.
	- Focus: Concentrate on one core concept or skill per module.
	- Language: Use clear, simple language suitable for mobile reading formatted for WhatsApp

- Engagement:
	- Incorporate 1-2 relevant emojis to enhance engagement.
	- Maintain an encouraging tone that fosters learning.
	
- Style Guidelines:
	- Format content for easy reading on WhatsApp.
	- Break text into short paragraphs for readability.
	- Utilize bullet points or numbered lists where appropriate.
	- Use line breaks to enhance readability.

- Content Flow:
	- Ensure modules progress logically, building upon previous content.
	- Align all content with the unique learner's overall goal (${Goal}).
 
- Output Format: 
	- Provide the micro-course in JSON format as follows:
{
  "Day 1": {
    "Day 1 - Module 1": {
      "[module-content]"
    },
    "Day 1 - Module 2": {
      "[module-content]"
    },
    "Day 1 - Module 3": {
      "[module-content]"
    }
  },
  "Day 2": {
    "Day 2 - Module 1": {
      "[module-content]"
    },
    "Day 2 - Module 2": {
      "[module-content]"
    },
    "Day 2 - Module 3": {
      "[module-content]"
    }
  },
  "Day 3": {
    "Day 3 - Module 1": {
      "[module-content]"
    },
    "Day 3 - Module 2": {
      "[module-content]"
    },
    "Day 3 - Module 3": {
      "[module-content]"
    }
  }
}
dont give any other words other than json`

export async function main() {
    // You will need to set these environment variables or edit the following values
    const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://cop-test.openai.azure.com/";
    const apiKey = process.env["AZURE_OPENAI_API_KEY"] || "<REPLACE_WITH_YOUR_KEY_VALUE_HERE>";
    const apiVersion = "2025-01-01-preview";
    const deployment = "o1-mini"; // This must match your deployment name

    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

    const result = await client.chat.completions.create({
        messages: [
            { role: "user", content: prompt },
        ],
        max_completion_tokens: 3991
    });

    console.log(JSON.stringify(result, null, 2));
    console.log(result.choices[0].message.content);
    
}

main().catch((err) => {
    console.error("The sample encountered an error:", err);
});


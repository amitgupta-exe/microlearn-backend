import { createClient } from '@supabase/supabase-js';
import { generateCourseWithOpenAI } from './openai.js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

// Hardcoded registration variables
const reg = {
    request_id: '8e9b41ca-5124-4b52-bea7-557ca1d219ae',
    name: 'John Doe',
    number: '919999999999',
    topic: 'Classical Literature',
    goal: 'To know about best works in classical literature and analyse them ',
    style: 'Beginner',
    language: 'English'
};

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Generate course JSON from OpenAI
    const courseJson = await generateCourseWithOpenAI(reg);
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
            request_id: reg.request_id,
            day: dayNum,
            module_1: modules[`Day ${dayNum} - Module 1`] ? modules[`Day ${dayNum} - Module 1`]["content"] : null,
            module_2: modules[`Day ${dayNum} - Module 2`] ? modules[`Day ${dayNum} - Module 2`]["content"] : null,
            module_3: modules[`Day ${dayNum} - Module 3`] ? modules[`Day ${dayNum} - Module 3`]["content"] : null,
            topic_name: reg.topic
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
}

main();


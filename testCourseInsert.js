const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function insertTestCourse() {
    const phoneNumber = '919999999999';
    const learnerName = 'Test User';
    const topic = 'Test Topic';
    const email = `${phoneNumber}@autogen.com`;

    try {
        // 1. Read the sample course file (should be valid JSON)
        const coursePath = path.join(__dirname, 'sampleCourse.txt');
        const courseJson = await fs.readFile(coursePath, 'utf-8');
        const course = JSON.parse(courseJson);

        // 2. Ensure user exists (with all NOT NULL fields and valid role)
        let { data: userRow, error: userFetchError } = await supabase
            .from('users')
            .select('id')
            .eq('phone', phoneNumber)
            .maybeSingle();

        let userId;
        if (!userRow) {
            const { data: newUser, error: userError } = await supabase
                .from('users')
                .insert([{
                    phone: phoneNumber,
                    email,
                    name: learnerName,
                    role: 'learner' // must be one of the allowed roles
                }])
                .select()
                .maybeSingle();
            if (userError || !newUser) {
                console.error('Error creating user:', userError);
                return;
            }
            userId = newUser.id;
        } else {
            userId = userRow.id;
        }

        // 3. Insert course days/modules (with all required fields and valid enums)
        let firstCourseId = null;
        let dayNum = 1;
        const requestId = uuidv4();
        for (const dayKey of Object.keys(course)) {
            const modules = course[dayKey];
            const insertObj = {
                id: uuidv4(),
                request_id: requestId,
                course_name: topic,
                created_by: userId,
                visibility: "public", // must be 'public' or 'private'
                day: dayNum,
                origin: "alfred", // must be one of the allowed origins
                status: "approved", // must be one of the allowed statuses
                module_1: modules[`Day ${dayNum} - Module 1`] ? modules[`Day ${dayNum} - Module 1`]["content"] : null,
                module_2: modules[`Day ${dayNum} - Module 2`] ? modules[`Day ${dayNum} - Module 2`]["content"] : null,
                module_3: modules[`Day ${dayNum} - Module 3`] ? modules[`Day ${dayNum} - Module 3`]["content"] : null
            };
            const { data, error } = await supabase.from('courses').insert([insertObj]).select();
            if (error) {
                console.error('Course insert failed:', error);
                return;
            }
            if (dayNum === 1 && data && data[0] && data[0].id) {
                firstCourseId = data[0].id;
            }
            dayNum++;
        }

        // 4. Insert course_progress (with valid status)
        const { error: progressError } = await supabase.from('course_progress').insert([{
            learner_id: userId,
            learner_name: learnerName,
            course_id: firstCourseId,
            course_name: topic,
            status: 'assigned', // must be one of the allowed statuses
            current_day: 1,
            phone_number: phoneNumber,
            last_module_completed_at: new Date()
        }]);
        if (progressError) {
            console.error('Course progress insert failed:', progressError);
            return;
        }

        console.log('Test course and progress inserted successfully!');
    } catch (error) {
        console.error('Test insert error:', error);
    }
}

insertTestCourse();
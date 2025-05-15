require('dotenv').config();
const Airtable = require('airtable');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configure Airtable
const airtableBase = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY || process.env.apiKey
}).base(process.env.AIRTABLE_BASE_ID || process.env.base);

const studentTableId = process.env.AIRTABLE_STUDENT_TABLE || process.env.tableId;

// Configure Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Utility to generate a UUID based on input string
function generateUUID(input) {
    const md5 = crypto.createHash('md5').update(input).digest('hex');
    return md5.substring(0, 8) + '-' +
        md5.substring(8, 12) + '-' +
        md5.substring(12, 16) + '-' +
        md5.substring(16, 20) + '-' +
        md5.substring(20, 32);
}

// Create a mapping table for IDs
const idMappings = {
    courses: {},       // Airtable ID -> Supabase ID
    courseDays: {},    // Airtable day record ID -> Supabase day ID
    users: {}          // Airtable user ID -> Supabase user ID
};

async function migrateData() {
    console.log("Starting migration from Airtable to Supabase...");

    try {
        // 1. First migrate users/students
        await migrateUsers();

        // 2. Then migrate courses (main course info)
        await migrateCourses();

        // 3. Then migrate course days and their content
        await migrateCourseContent();

        // 4. Migrate user progress data
        await migrateUserProgress();

        console.log("Migration completed successfully!");
    } catch (error) {
        console.error("Migration failed:", error);
    }
}

async function migrateUsers() {
    console.log("Migrating users...");

    try {
        const students = await fetchFromAirtable(studentTableId);
        console.log(`Found ${students.length} students in Airtable`);

        for (const student of students) {
            const fields = student.fields;

            // Generate a stable UUID for each user
            const supabaseId = generateUUID(student.id);
            idMappings.users[student.id] = supabaseId;

            // Insert into Supabase profiles table
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: supabaseId,
                    first_name: fields.Name ? fields.Name.split(' ')[0] : '',
                    last_name: fields.Name ? fields.Name.split(' ').slice(1).join(' ') : '',
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error(`Error creating profile for ${fields.Name || fields.Phone}:`, error);
                continue;
            }

            // Create user metadata for WhatsApp connection
            if (fields.Phone) {
                const { error: metadataError } = await supabase
                    .from('whatsapp_metadata')
                    .upsert({
                        user_id: supabaseId,
                        phone_number: fields.Phone,
                        last_interaction_at: new Date().toISOString(),
                        created_at: new Date().toISOString()
                    });

                if (metadataError) {
                    console.error(`Error creating WhatsApp metadata for ${fields.Phone}:`, metadataError);
                }
            }

            console.log(`Migrated user: ${fields.Name || fields.Phone}`);
        }

        console.log(`Migrated ${students.length} users to Supabase`);
    } catch (error) {
        console.error("Error migrating users:", error);
        throw error;
    }
}

async function migrateCourses() {
    console.log("Migrating courses...");

    try {
        const students = await fetchFromAirtable(studentTableId);

        // Get unique courses
        const courseSet = new Set();
        students.forEach(student => {
            if (student.fields.Course) {
                courseSet.add(student.fields.Course);
            }
        });

        const courses = Array.from(courseSet);
        console.log(`Found ${courses.length} unique courses`);

        for (const courseTableName of courses) {
            // Generate a stable UUID for the course
            const courseId = generateUUID(courseTableName);
            idMappings.courses[courseTableName] = courseId;

            // Insert course into Supabase
            const { error } = await supabase
                .from('courses')
                .upsert({
                    id: courseId,
                    title: courseTableName,
                    description: `WhatsApp course imported from TBS: ${courseTableName}`,
                    is_published: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    // Map additional fields like category, language if available
                });

            if (error) {
                console.error(`Error creating course ${courseTableName}:`, error);
                continue;
            }

            console.log(`Migrated course: ${courseTableName}`);
        }

        console.log(`Migrated ${courses.length} courses to Supabase`);
    } catch (error) {
        console.error("Error migrating courses:", error);
        throw error;
    }
}

async function migrateCourseContent() {
    console.log("Migrating course content...");

    for (const [courseTableName, supabaseCourseId] of Object.entries(idMappings.courses)) {
        console.log(`Migrating content for course: ${courseTableName}`);

        try {
            // Fetch days for this course
            const days = await fetchFromAirtable(courseTableName);
            console.log(`Found ${days.length} days for course ${courseTableName}`);

            // Sort days by day number
            days.sort((a, b) => (a.fields.Day || 0) - (b.fields.Day || 0));

            for (const day of days) {
                const dayNumber = day.fields.Day || 0;

                // Create day in Supabase
                const { data: dayData, error: dayError } = await supabase
                    .from('course_days')
                    .upsert({
                        course_id: supabaseCourseId,
                        day_number: dayNumber,
                        title: `Day ${dayNumber}`,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (dayError) {
                    console.error(`Error creating day ${dayNumber} for course ${courseTableName}:`, dayError);
                    continue;
                }

                // Store the day ID mapping
                idMappings.courseDays[day.id] = dayData.id;

                // Process modules for this day
                for (let module = 1; module <= 5; module++) {
                    const moduleText = day.fields[`Module ${module} Text`];
                    const moduleMedia = day.fields[`Module ${module} File`];

                    // Update day with media if available
                    if (moduleMedia && moduleMedia.length > 0) {
                        const { error: mediaError } = await supabase
                            .from('course_days')
                            .update({ media: moduleMedia[0].url })
                            .eq('id', dayData.id);

                        if (mediaError) {
                            console.error(`Error adding media to day ${dayNumber}:`, mediaError);
                        }
                    }

                    // Add paragraph if text content exists
                    if (moduleText) {
                        const { error: paraError } = await supabase
                            .from('course_paragraphs')
                            .insert({
                                day_id: dayData.id,
                                paragraph_number: module,
                                content: moduleText,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            });

                        if (paraError) {
                            console.error(`Error creating paragraph for module ${module}, day ${dayNumber}:`, paraError);
                        }
                    }
                }

                console.log(`Migrated day ${dayNumber} with modules for course ${courseTableName}`);
            }
        } catch (error) {
            console.error(`Error migrating content for course ${courseTableName}:`, error);
        }
    }

    console.log("Course content migration complete");
}

async function migrateUserProgress() {
    console.log("Migrating user progress...");

    try {
        const students = await fetchFromAirtable(studentTableId);

        for (const student of students) {
            const fields = student.fields;
            const supabaseUserId = idMappings.users[student.id];

            if (!supabaseUserId) {
                console.warn(`No Supabase user ID found for student ${student.id}`);
                continue;
            }

            if (!fields.Course) {
                console.warn(`No course assigned to student ${fields.Name || fields.Phone}`);
                continue;
            }

            const supabaseCourseId = idMappings.courses[fields.Course];
            if (!supabaseCourseId) {
                console.warn(`No Supabase course ID found for ${fields.Course}`);
                continue;
            }

            // Get all content items for this course
            const { data: contentItems, error: contentError } = await supabase
                .from('content_items')
                .select('id')
                .eq('module_id', supabaseCourseId);

            if (contentError) {
                console.error(`Error fetching content items for course ${fields.Course}:`, contentError);
                continue;
            }

            // Skip if no content items
            if (!contentItems || contentItems.length === 0) {
                continue;
            }

            // Create user progress entries
            for (const item of contentItems) {
                const { error: progressError } = await supabase
                    .from('user_progress')
                    .insert({
                        user_id: supabaseUserId,
                        content_item_id: item.id,
                        status: fields["Day Completed"] ? 'completed' : 'in_progress',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (progressError) {
                    console.error(`Error creating progress for user ${fields.Name || fields.Phone}:`, progressError);
                }
            }

            console.log(`Migrated progress for user: ${fields.Name || fields.Phone}`);
        }

        console.log("User progress migration complete");
    } catch (error) {
        console.error("Error migrating user progress:", error);
        throw error;
    }
}

// Utility function to fetch all records from an Airtable table
async function fetchFromAirtable(tableName) {
    return new Promise((resolve, reject) => {
        const records = [];

        airtableBase(tableName).select({
            view: 'Grid view'
        }).eachPage(
            function page(pageRecords, fetchNextPage) {
                records.push(...pageRecords);
                fetchNextPage();
            },
            function done(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(records);
            }
        );
    });
}

// Save ID mappings to a file for reference
function saveIdMappings() {
    const fs = require('fs');
    fs.writeFileSync(
        './id-mappings.json',
        JSON.stringify(idMappings, null, 2),
        'utf8'
    );
    console.log("ID mappings saved to id-mappings.json");
}

// Run the migration
migrateData()
    .then(saveIdMappings)
    .catch(console.error);
// tbs-adapter.js
const express = require('express');
const cors = require('cors');
const airtable = require('./update'); // Your existing TBS airtable module
const tbsTest = require('./test'); // Your existing TBS test module

const app = express();
app.use(cors());
app.use(express.json());

// API endpoint to fetch courses from TBS
app.get('/api/courses', async (req, res) => {
    try {
        // Query Airtable for all available courses
        const courses = await fetchAllCourses();
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to fetch a specific course
app.get('/api/courses/:courseId', async (req, res) => {
    try {
        const course = await fetchCourseById(req.params.courseId);
        res.json(course);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to map TBS Airtable courses to Microlearn format
async function fetchAllCourses() {
    // Implement this to query your Airtable tables and format data
    // to match the Microlearn Course interface
}

// In your adapter layer
function mapTBSCourseToMicrolearn(tbsCourse, tbsCourseDays) {
    return {
        id: tbsCourse.id,
        title: tbsCourse.fields.Course || "Untitled Course",
        description: tbsCourse.fields.Description || "",
        instructor: tbsCourse.fields.Instructor || "",
        enrolled: tbsCourse.fields.Enrolled || 0,
        completion: 0, // Calculate based on your TBS data
        status: "active",
        created: new Date(tbsCourse.createdTime).toISOString().split('T')[0],
        days: tbsCourseDays.map(day => ({
            id: day.fields.Day,
            title: `Day ${day.fields.Day}`,
            paragraphs: extractParagraphsFromTBSDay(day),
            media: extractMediaFromTBSDay(day)
        }))
    };
}

function extractParagraphsFromTBSDay(tbsDay) {
    // Extract the paragraphs from TBS day format
    const paragraphs = [];

    // Handle the different module text fields from your TBS system
    for (let i = 1; i <= 5; i++) {
        const moduleText = tbsDay.fields[`Module ${i} Text`];
        if (moduleText) {
            paragraphs.push({
                id: i,
                content: moduleText
            });
        }
    }

    return paragraphs;
}


app.listen(3001, () => {
    console.log('TBS Adapter API running on port 3001');
});

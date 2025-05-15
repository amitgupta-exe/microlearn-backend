
require('dotenv').config("./env")
const fetch = require('node-fetch');


const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_ALFRED_COP_BASE_ID;


async function getStudentsTableSchema() {
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();

        // The schema info is inside data.tables -> each table has fields, columns etc.
        // console.log('Tables schema:', JSON.stringify(data.tables, null, 2));
        schema = []
        data.tables.forEach(table => {
            table.fields.forEach(field => {
                if (table.name == "Student") {

                    schema.push(field.name)
                }
            })
        });
        console.log(schema)
        return schema

    } catch (error) {
        console.error('Error fetching Airtable schema:', error.message);
    }
}

getStudentsTableSchema();
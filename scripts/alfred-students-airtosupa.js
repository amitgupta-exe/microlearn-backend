/**
 * Example JavaScript script to fetch Airtable table schema using the Airtable Metadata API
 * 
 * Requirements:
 * - Replace YOUR_API_KEY with your Airtable API key.
 * - Replace YOUR_BASE_ID with your Airtable base ID.
 * 
 * Run with Node.js: `node fetch_airtable_schema.js`
 */
require('dotenv').config("./env")
const fetch = require('node-fetch');
const Airtable = require('airtable');
const { createClient } = require('@supabase/supabase-js');




const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_ALFRED_COP_BASE_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;


if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Please set AIRTABLE_API_KEY, AIRTABLE_BASE_ID, SUPABASE_URL, and SUPABASE_SERVICE_KEY environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);



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





const AIRTABLE_TABLE_NAME = 'Student'

const SUPABASE_TABLE_NAME = 'cop_students';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Please set AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME, SUPABASE_URL, SUPABASE_SERVICE_KEY in environment variables.");
  process.exit(1);
}

const AIRTABLE_ENDPOINT = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`
};

function parseBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    return ['yes', 'true', '1'].includes(val.trim().toLowerCase());
  }
  return false;
}

function parseDate(val) {
  if (!val) return null;
  try {
    const dt = new Date(val);
    if (isNaN(dt)) return null;
    return dt.toISOString();
  } catch (e) {
    return null;
  }
}

// Since Airtable may have attachments as array objects, extract first URL if exists
function parseAttachmentUrl(field) {
  if (Array.isArray(field) && field.length > 0) {
    return field[0].url || null;
  }
  return null;
}

function tryParseInt(val) {
  if (val === undefined || val === null) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function tryParseFloat(val) {
  if (val === undefined || val === null) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseRecord(record) {
  const fields = record.fields || {};

  return {
    airtable_id: record.id,
    Phone: fields['Phone'] || null,
    Created: parseDate(fields['Created']),
    Name: fields['Name'] || null,
    Topic: fields['Topic'] || null,
    Goal: fields['Goal'] || null,
    Style: fields['Style'] || null,
    Language: fields['Language'] || null,
    'Course Status': fields['Course Status'] || null,
    'Join Waitlist': parseBool(fields['Join Waitlist']),
    Progress: tryParseFloat(fields['Progress']),
    'Module Completed': tryParseInt(fields['Module Completed']),
    'Next Module': fields['Next Module'] || null,
    'Day Completed': tryParseInt(fields['Day Completed']),
    'Next Day': parseDate(fields['Next Day']),
    Feedback: fields['Feedback'] || null,
    Interactive_Responses: fields['Interactive_Responses'] || null,
    Responses: fields['Responses'] || null,
    'Certificate File': parseAttachmentUrl(fields['Certificate File']),
    'Course Completed': parseBool(fields['Course Completed']),
    'Completion_Certificate': parseAttachmentUrl(fields['Completion_Certificate']),
    Last_Msg: fields['Last_Msg'] || null,
    'Question Responses': fields['Question Responses'] || null,
    'completed courses': tryParseInt(fields['completed courses']),
    Date: parseDate(fields['Date']),
    Doubt: fields['Doubt'] || null,
  };
}

async function fetchAirtableRecords() {
  let records = [];
  let offset = undefined;

  try {
    do {
      const url = new URL(AIRTABLE_ENDPOINT);
      if (offset) {
        url.searchParams.append('offset', offset);
      }
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        throw new Error(`Error fetching Airtable records: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.records) {
        throw new Error("No records field in Airtable response");
      }
      records = records.concat(data.records);
      offset = data.offset;
    } while (offset);
  } catch (error) {
    throw error;
  }

  return records;
}

async function upsertToSupabase(rows) {
  if (!rows.length) {
    console.log("No records to upsert.");
    return;
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLE_NAME)
    .upsert(rows, { onConflict: 'airtable_id' });

  if (error) {
    throw error;
  }

  console.log(`Upserted  record(s) into Supabase.`);
}

async function main() {
  console.log("Fetching Airtable records...");
  const airtableRecords = await fetchAirtableRecords();
  console.log(`Fetched ${airtableRecords.length} records.`);

  const supabaseRows = airtableRecords.map(parseRecord);

  console.log("Upserting records into Supabase...");
  await upsertToSupabase(supabaseRows);

  console.log("Finished.");
}

main()
  .catch(err => {
    console.error("Error occurred:", err);
    process.exit(1);
  });
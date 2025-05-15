/**
 * Script to:
 * 1. Dynamically fetch Airtable table names from Metadata API.
 * 2. Fetch data from those tables.
 * 3. Insert data to Supabase table 'alfred_course_data'.
 * 
 * Usage:
 * - Set environment variables:
 *   AIRTABLE_API_KEY, AIRTABLE_BASE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY
 * - Run: node migrate_airtable_to_supabase.js
 * 
 * Note: Supabase table 'alfred_course_data' should already be created.
 */
require('dotenv').config("./env")

const fetch = require('node-fetch');
const Airtable = require('airtable');
const { createClient } = require('@supabase/supabase-js');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_ALFRED_COURSE_DATA_BASE_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Please set AIRTABLE_API_KEY, AIRTABLE_BASE_ID, SUPABASE_URL, and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

/**
 * Fetch Airtable table names dynamically using Airtable Metadata API.
 * Docs: https://airtable.com/developers/metadata/api
 */
async function fetchAirtableTableNames() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const headers = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Metadata API request failed with status ${response.status}: ${response.statusText}`);
    }
    const json = await response.json();
    if (!json.tables) {
      throw new Error('No tables field found in Metadata API response.');
    }
    // Extract and return table names as an array
    return json.tables.map(table => table.name);
  } catch (error) {
    console.error('Error fetching table names from Airtable Metadata API:', error.message);
    process.exit(1);
  }
}

async function fetchAndInsertTable(airtableTableName) {
  console.log(`Fetching data from Airtable table: ${airtableTableName}`);

  var records = [];

  try {
    records = await base(airtableTableName).select({ pageSize: 100 }).all();
  } catch (error) {
    console.error(`Error fetching from Airtable table "${airtableTableName}":`, error);
    return;
  }

//   if (!Array.isArray(records) || records.length === 0) {
//     console.log(`No records found in table "${airtableTableName}".`);
//   }

  const dataToInsert = [];

  records.forEach(record => {
    const fields = record.fields;

    const day = Number(fields['Day']);
    if (isNaN(day)) {
      console.warn(`Skipping record with invalid Day: ${fields['Day']}`);
      return;
    }

    const module1 = fields['Module 1 Text'] || null;
    const module2 = fields['Module 2 Text'] || null;
    const module3 = fields['Module 3 Text'] || null;

    dataToInsert.push({
      course_name: airtableTableName,
      day,
      module_1_text: module1,
      module_2_text: module2,
      module_3_text: module3,
    });
  });

  if (dataToInsert.length === 0) {
    console.log(`No valid data to insert for table "${airtableTableName}".`);
    return;
  }

 // Prepare to query existing entries from Supabase
  // We will check for existing rows with same course_name and day

  // Create array of {course_name, day} keys from dataToInsert
  // Because all have the same course_name (airtableTableName), we only need the days list
  const days = dataToInsert.map(d => d.day);

  // Query Supabase for existing entries with these days and this course_name
  // We do an 'in' query for day matching any day, plus course_name eq airtableTableName

  const { data: existingData, error: fetchError } = await supabase
    .from('alfred_course_data')
    .select('day')
    .in('day', days)
    .eq('course_name', airtableTableName);

  if (fetchError) {
    console.error(`Error fetching existing records from Supabase for table "${airtableTableName}":`, fetchError);
    // we can choose to abort or continue and insert all (risk duplicates)
    return;
  }

  // Build set of days already in Supabase for this course_name
  const existingDaysSet = new Set(existingData.map(d => d.day));

  // Filter out records that already exist
  const newDataToInsert = dataToInsert.filter(d => !existingDaysSet.has(d.day));

  if (newDataToInsert.length === 0) {
    console.log(`All records for table "${airtableTableName}" already exist in Supabase. Skipping insert.`);
    return;
  }

  // Insert only new records
  const { data, error } = await supabase.from('alfred_course_data').insert(newDataToInsert);

  if (error) {
    console.error(`Error inserting data into Supabase from table "${airtableTableName}":`, error);
  } else {
    console.log(`Successfully inserted ${dataToInsert.length} new records from table "${airtableTableName}".`);
  }
}

async function main() {
  // Fetch table names dynamically
  const airtableTables = await fetchAirtableTableNames();
  console.log('Fetched Airtable tables:', airtableTables);

  for (const tableName of airtableTables) {
    await fetchAndInsertTable(tableName);
  }

  console.log('Migration completed.');
}

main().catch(err => {
  console.error('Unexpected error:', err);
});

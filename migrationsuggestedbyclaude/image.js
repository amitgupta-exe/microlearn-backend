// image.js
const request = require('request-promise');
const WA = require('./wati');
const us = require('./update');
const supabase = require('./supabase-client');
require('dotenv').config();

async function sendMediaFile(cDay, cModule, number) {
  try {
    const course_id = await us.findTable(number);
    
    // Get the day record
    const { data, error } = await supabase
      .from('course_days')
      .select('*')
      .eq('course_id', course_id)
      .eq('day_number', cDay)
      .single();
    
    if (error) throw error;
    if (!data) {
      console.log("No day record found");
      return;
    }
    
    // Get media files for this module
    const img = data[`module_${cModule}_file`];
    
    if (img && img.length > 0) {
      console.log(`Found ${img.length} media files`);
      
      for (let i = 0; i < img.length; i++) {
        const filename = img[i].filename;
        const imgurl = img[i].url;
        
        console.log("Delay of sending images");
        await load(imgurl, filename, number);
      }
    } else {
      console.log("No media in this module");
    }
  } catch (error) {
    console.error(`Error in sendMediaFile:`, error);
  }
}


async function sendMediaFile_v2(index, cDay, cModule, number) {
    try {
      const course_id = await us.findTable(number);
      
      // Get the day record
      const { data, error } = await supabase
        .from('course_days')
        .select('*')
        .eq('course_id', course_id)
        .eq('day_number', cDay)
        .single();
      
      if (error) throw error;
      if (!data) {
        console.log("No day record found");
        return;
      }
      
      // Get media files for this module
      const img = data[`module_${cModule}_file`];
      
      if (img && img.length > 0) {
        console.log(`Found ${img.length} media files`);
        
        for (let i = 0; i < img.length; i++) {
          const filename = img[i].filename;
          const imgurl = img[i].url;
          
          console.log("Delay of sending images");
          await load(imgurl, filename, number);
        }
      } else {
        console.log("No media in this module");
      }
    } catch (error) {
      console.error(`Error in sendMediaFile:`, error);
    }
  }

// The rest of the functions follow the same pattern
// ...

module.exports = { sendMediaFile, sendMediaFile_v2 };

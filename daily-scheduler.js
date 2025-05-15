// daily-scheduler.js - Run as a cron job at 10 AM daily
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// WATI API setup
const watiApiKey = process.env.WATI_API_KEY;
const watiBaseUrl = process.env.WATI_BASE_URL; // e.g., "https://api.wati.io"

// Schedule task to run at 10 AM every day
cron.schedule('0 10 * * *', async () => {
  console.log('Running daily course scheduler at 10 AM');
  await sendDailyModules();
});

// Main function to send modules for the day
async function sendDailyModules() {
  try {
    // Get all active users who completed a day but haven't completed the course
    const { data: activeUsers, error } = await supabase
      .from('user_inputs')
      .select('Phone, Name, Topic, Day_Completed, Next_Module, Course_Completed')
      .eq('Course_Completed', false)
      .not('Next_Module', 'is', null)
      .not('Day_Completed', 'is', null);
      
    if (error) {
      console.error('Error fetching active users:', error);
      return;
    }
    
    console.log(`Found ${activeUsers?.length || 0} active users to process`);
    
    // Process each user
    for (const user of (activeUsers || [])) {
      // Skip users who haven't completed any days yet (they're handled by the webhook)
      if (user.Day_Completed === 0) continue;
      
      // Check if we should send next day's modules
      const [nextDay, nextModule] = (user.Next_Module || '').split('_').map(Number);
      
      // Only process if it's the first module of a new day
      if (nextModule === 1) {
        await sendNewDayMessage(user.Phone, user.Name, user.Topic, nextDay);
        await sendNextModuleForUser(user.Phone);
      }
    }
    
  } catch (error) {
    console.error('Error in daily module scheduler:', error);
  }
}

// Send new day welcome message
async function sendNewDayMessage(phone, name, topic, day) {
  try {
    const userName = name || 'there';
    const courseTopic = topic || 'your course';
    
    let message = '';
    if (day === 2) {
      message = `Good morning, ${userName}! 🌞\n\nWelcome to Day 2 of your course on *${courseTopic}*!\n\nReady to continue your learning journey? Today we'll dive deeper into new concepts and skills. Let's get started with your first module for today!`;
    } else if (day === 3) {
      message = `Good morning, ${userName}! 🌞\n\nWelcome to the final day of your course on *${courseTopic}*!\n\nToday, we'll consolidate what you've learned and explore advanced concepts. Let's make the most of your final day!`;
    }
    
    if (message) {
      await sendWhatsAppMessage(phone, message);
    }
    
  } catch (error) {
    console.error(`Error sending new day message to ${phone}:`, error);
  }
}

// Send next module for a specific user
async function sendNextModuleForUser(phone) {
  try {
    // Fetch user progress data
    const { data: userData, error } = await supabase
      .from('user_inputs')
      .select('Next_Module, Course_Completed')
      .eq('Phone', phone)
      .single();
      
    if (error || !userData) {
      console.error(`Error fetching user progress data for ${phone}:`, error);
      return;
    }
    
    if (userData.Course_Completed) {
      console.log(`Course already completed for ${phone}`);
      return;
    }
    
    if (!userData.Next_Module) {
      console.error(`No next module found for ${phone}`);
      return;
    }
    
    // Parse day and module
    const [day, module] = userData.Next_Module.split('_').map(Number);
    
    // Fetch module content
    const { data: moduleData, error: moduleError } = await supabase
      .from('course_modules')
      .select('module_content, module_id')
      .eq('whatsapp_number', phone)
      .eq('day', day)
      .eq('module_number', module)
      .single();
      
    if (moduleError || !moduleData) {
      console.error(`Error fetching module content for ${phone}:`, moduleError);
      return;
    }
    
    // Construct module message
    const moduleMessage = `*Day ${day} - Module ${module}*\n\n${moduleData.module_content}`;
    
    // Send module content
    await sendWhatsAppMessage(phone, moduleMessage);
    
    // Send completion button
    await sendCompletionButton(phone, `Click the button when you've completed Day ${day} - Module ${module}`);
    
    // Update last message timestamp
    await supabase
      .from('user_inputs')
      .update({ "Last_Msg": new Date().toISOString() })
      .eq('Phone', phone);
    
  } catch (error) {
    console.error(`Error sending next module for ${phone}:`, error);
  }
}

// Helper function to send WhatsApp message via WATI API
async function sendWhatsAppMessage(phone, message) {
  try {
    const response = await fetch(`${watiBaseUrl}/api/v1/sendSessionMessage/${phone}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${watiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageText: message
      })
    });
    
    if (!response.ok) {
      throw new Error(`WATI API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

// Send module completion button
async function sendCompletionButton(phone, message) {
  try {
    const response = await fetch(`${watiBaseUrl}/api/v1/sendInteractiveButtonsMessage/${phone}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${watiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messageText: message,
        buttons: [
          {
            text: "Module Completed!",
            id: "module_complete"
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`WATI API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending completion button:', error);
    throw error;
  }
}

// Execute the scheduler if running directly
if (require.main === module) {
  console.log('Running scheduler manually...');
  sendDailyModules().then(() => {
    console.log('Manual execution completed');
  }).catch(error => {
    console.error('Error during manual execution:', error);
  });
}

module.exports = { sendDailyModules };
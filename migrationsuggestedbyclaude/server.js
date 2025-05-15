// server.js
const express = require('express');
const supabase = require('./supabase-client');
require('dotenv').config();
const test = require('./test');
const WA = require('./wati');

const webApp = express();
webApp.use(express.json());

// Route for WhatsApp
webApp.post('/web', async (req, res) => {
  let senderID = req.body.waId;
  let keyword = req.body.text || '';

  console.log(req.body);

  try {
    // Get user data from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, next_day, next_module')
      .eq('phone', senderID)
      .single();
      
    if (error) {
      console.error("Error fetching user:", error);
      return res.end();
    }
    
    if (!user) {
      console.log("User not found:", senderID);
      return res.end();
    }
    
    const id = user.id;
    const currentDay = user.next_day;
    const current_module = user.next_module;
    
    console.log(currentDay, current_module);
    
    // Get the last message sent to user
    const last_msg = await supabase
      .from('users')
      .select('last_msg')
      .eq('id', id)
      .single()
      .then(({ data }) => data?.last_msg)
      .catch(e => console.log("Last msg error:", e));

    // Handle different message types
    if (req.body.listReply != null) {
      reply = JSON.parse(JSON.stringify(req.body.listReply));
      console.log("List msg");

      await test.store_responses(senderID, reply.title)
        .catch(e => console.log("Finish List error:", e));
    } else if (keyword == `Let's Begin`) {
      test.findModule(currentDay, current_module, senderID)
        .catch(e => console.log("Let's begin keyword error:", e));
    } else if (keyword == "Start Day") {
      console.log("Finish start template error:", keyword);
      test.sendModuleContent(senderID)
        .catch(e => console.log("Finish start template error:", e));
    } else if (keyword == "Next." || keyword == "नेक्स्ट") {
      test.markModuleComplete(senderID)
        .catch(e => console.info("Finish module template error:", e));
    } else {
      console.log("Storing for almost 24 h limit");
      await test.store_quesResponse(senderID, keyword);
    }

    res.end();
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).end();
  }
});

webApp.get('/ping', (req, res) => {
  res.status(200).send('Pong');
});

webApp.listen(process.env.PORT, () => {
  console.log(`Server is up and running at ${process.env.PORT}`);
});

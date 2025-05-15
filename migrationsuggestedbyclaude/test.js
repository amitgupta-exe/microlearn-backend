// Import required modules
require('dotenv').config();
const WA = require('./wati');
const us = require('./update');
const sendContent = require('./image');
// const outro = require('./outroflow');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Updates the user's completed day and sets up the next day
 * @param {string} number - User's phone number
 */
async function markDayComplete(number) {
  try {
    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, course_id, next_day')
      .eq('phone', number)
      .single();
    
    if (error) throw error;
    if (!user) {
      console.log("No user found for the given number");
      return;
    }
    
    const comp_day = Number(user.next_day);
    const nextDay = comp_day + 1;
    
    // Get total days in course
    const total_days = await us.totalDays(number);
    
    if (comp_day <= total_days) {
      console.log("Entered markDayComplete");

      // Update user fields
      const { error: updateError } = await supabase
        .from('users')
        .update({
          next_day: nextDay,
          day_completed: comp_day,
          next_module: 1,
          module_completed: 0
        })
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      console.log("Complete Day " + comp_day);
      
      if (nextDay == total_days + 1) {
        console.log("Executing Outro for ", user.name, nextDay);
        // Outro logic could be called here if needed
      }
    }
  } catch (error) {
    console.error('Error in markDayComplete:', error);
  }
}

/**
 * Find current day content and send to user
 * @param {number} currentDay - Current day number
 * @param {string} number - User's phone number
 */
async function findDay(currentDay, number) {
  try {
    const course_tn = await us.findTable(number);
    console.log(`Table name of ${number} is ${course_tn}`);

    // Get course content for the current day
    const { data: content, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('day', currentDay)
      .single();
    
    if (error) throw error;
    if (!content) {
      console.log("No records found for the given day");
      return;
    }

    const day = content.day;
    const id = await us.getID(number);
    const total_days = await us.totalDays(number);

    console.log("Entered findDay module");

    if (currentDay == 4) {
      const hTxt = `Congratulations on completing Day ${day}!`;
      const bTxt = `_powered by ekatra.one_`;
      
      console.log("5. Updating last message");
      await us.updateField(id, "last_msg", hTxt);

      WA.sendText(`${hTxt} \n${bTxt}`, number);
      await markDayComplete(number);

      setTimeout(() => {
        WA.sendText(`Would you like another learner to join you? Invite your friends to take the course! 
        
https://bit.ly/TBS-Referral`, number);
      }, 5000);
    } else {
      let next_day = day + 1;
      const hTxt = `Congratulations on completing Day ${day}!`;
      const bTxt = `You will receive Day ${next_day} modules tomorrow. \n\n_powered by ekatra.one_`;
      
      console.log("6. Updating last message");
      await us.updateField(id, "last_msg", hTxt);

      console.log("2. Delay of Finish Day");
      WA.sendText(`${hTxt} \n${bTxt}`, number);
      await markDayComplete(number);

      setTimeout(() => {
        WA.sendText(`Would you like another learner to join you? Invite your friends to take the course! 

https://bit.ly/TBS-Referral`, number);
      }, 5000);
    }
  } catch (error) {
    console.error('Error in findDay:', error);
  }
}

/**
 * Send a list of options to the user
 * @param {number} currentDay - Current day number
 * @param {number} module_No - Module number
 * @param {string} number - User's phone number
 */
async function sendList(currentDay, module_No, number) {
  try {
    const course_tn = await us.findTable(number);
    const id = await us.getID(number);

    // Get course content for the current day
    const { data: content, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('day', currentDay)
      .single();
    
    if (error) throw error;
    if (!content) {
      console.log("No records found for the given day");
      return;
    }

    const module_title = content[`module_${module_No}_ltitle`];
    const module_list = content[`module_${module_No}_list`];

    console.log("Executing List");
    const options = module_list.split("\n").filter(n => n);

    const d = options.map(row => ({ title: row }));

    console.log("8. Updating");
    await us.updateField(id, "last_msg", module_title);

    WA.sendListInteractive(d, module_title, "Options", number);
  } catch (error) {
    console.error('Error in sendList:', error);
  }
}

/**
 * Sends interactive messages to the user
 * @param {number} currentDay - Current day number
 * @param {number} module_No - Module number
 * @param {string} number - User's phone number
 */
async function sendIMsg(currentDay, module_No, number) {
  try {
    const course_tn = await us.findTable(number);

    // Get content for the current day
    const { data: content, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('day', currentDay)
      .single();
    
    if (error) throw error;
    if (!content) {
      console.log("No records found for the given day");
      return;
    }

    let module_body = content[`module_${module_No}_ibody`];
    let module_buttons = content[`module_${module_No}_ibuttons`];

    console.log("Executing Interactive");
    let options = module_buttons.split("\n").filter(n => n);

    let data = options.map(option => ({ text: option }));

    setTimeout(() => {
      WA.sendDynamicInteractiveMsg(data, module_body, number);
    }, 35000);
  } catch (error) {
    console.error('Error in sendIMsg:', error);
  }
}

/**
 * Sends questions to the user
 * @param {number} currentDay - Current day number
 * @param {number} module_No - Module number
 * @param {string} number - User's phone number
 */
async function sendQues(currentDay, module_No, number) {
  try {
    const course_tn = await us.findTable(number);
    let id = await us.getID(number);

    // Get content for the current day
    const { data: content, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('day', currentDay)
      .single();
    
    if (error) throw error;
    if (!content) {
      console.log("No records found for the given day");
      return;
    }

    let module_ques = content[`module_${module_No}_question`];

    console.log("Executing Question");
    console.log("4. Update as last message");

    await us.updateField(id, "last_msg", `Q: ${module_ques}`);

    setTimeout(() => {
      WA.sendText(module_ques, number);
    }, 2000);

    setTimeout(() => {
      WA.sendText("⬇⁣", number);
    }, 3000);
  } catch (error) {
    console.error('Error in sendQues:', error);
  }
}

/**
 * Store user responses to questions
 * @param {string} number - User's phone number
 * @param {string} value - User's response
 */
async function store_responses(number, value) {
  try {
    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, next_module, next_day, last_msg')
      .eq('phone', number)
      .single();
    
    if (error) throw error;
    if (!user) {
      console.log("No user found");
      return;
    }

    const id = user.id;
    const currentModule = user.next_module;
    const currentDay = user.next_day;
    const last_msg = user.last_msg;

    let list = await us.findTitle(currentDay, currentModule, number);
    let title = list[0];
    let correct_ans = await us.findAns(currentDay, currentModule, number);

    if (correct_ans == null) {
      console.log("currentDay ", currentDay);
      let existingValues = await us.findField("question_responses", number);
      console.log("existingValues 1 ", existingValues, title);
      
      let newValues;
      if (existingValues == 0) {
        console.log("existingValues 2 ");
        existingValues = "";
        newValues = `Q: ${title} \nA: ${value}`;
      } else {
        console.log("existingValues 3 ");
        newValues = `${existingValues} \n\nQ: ${title} \nA: ${value}`;
      }

      if (existingValues.toString().includes(title)) {
        console.log("2.1 List Feedback already recorded");
        await findContent(currentDay, currentModule, number);
      } else {
        await us.updateField(id, "question_responses", newValues);
        console.log("2.2 List New Feedback recorded");
        await findContent(currentDay, currentModule, number);

        console.log("1. Updating");
        await us.updateField(id, "last_msg", title);
      }
    } else {
      let correct_ans = await us.findAns(currentDay, currentModule, number);
      console.log("Correct ans ", correct_ans);

      let existingValues = await us.findField("question_responses", number);
      let list = await us.findTitle(currentDay, currentModule, number);

      let title = list[0];
      let options = list.filter((v, i) => i !== 0);

      const isCorrect = correct_ans === value;
      const isSecondAttempt = last_msg == "Incorrect";

      if (isCorrect || isSecondAttempt) {
        let congratsMessages = [
          "Congratulations! You got it right. 🥳",
          "That's the correct answer.Yay! 🎉",
          "Awesome! Your answer is correct. 🎊",
          "Hey, good job! That's the right answer Woohoo! 🤩",
          "Well done! The answer you have chosen is correct. 🎖️"
        ];

        if (isCorrect && !isSecondAttempt) {
          console.log("1st attempt correct!");
          
          WA.sendText(congratsMessages[Math.floor(Math.random() * congratsMessages.length)], number);
          console.log(`${title} 1st attempt correct`);
        } else if (isSecondAttempt) {
          console.log("correct_ans == value ", isCorrect, correct_ans, value);
          if (isCorrect) {
            WA.sendText(congratsMessages[Math.floor(Math.random() * congratsMessages.length)], number);
          } else {
            WA.sendText(`The correct answer is *${correct_ans}*`, number);
          }
        }

        const selectedOption = options[0].find(option => option === value);
        if (selectedOption) {
          const newValues = existingValues ?
            `${existingValues}\n\nQ: ${title}\nA: ${value}` :
            `Q: ${title}\nA: ${value}`;

          if (existingValues.includes(title)) {
            console.log("2.1 List Feedback already recorded");
            await findContent(currentDay, currentModule, number);
          } else {
            await us.updateField(id, "question_responses", newValues);
            console.log("2.2 List New Feedback recorded");
            await findContent(currentDay, currentModule, number);
            console.log("1. Updating");
            await us.updateField(id, "last_msg", title);
          }
        }
      } else {
        WA.sendText("You've entered the wrong answer. Let's try one more time. \n\nSelect the correct option from the list again.", number);
        await us.updateField(id, "last_msg", "Incorrect");
      }
    }
  } catch (error) {
    console.error('Error in store_responses:', error);
  }
}

/**
 * Store interactive responses from the user
 * @param {string} number - User's phone number
 * @param {string} value - User's response
 */
async function store_intResponse(number, value) {
  try {
    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, module_completed, next_module, next_day, last_msg')
      .eq('phone', number)
      .single();
    
    if (error) throw error;
    if (!user) {
      console.log("No user found");
      return;
    }

    const id = user.id;
    const module_complete = user.module_completed;
    const currentModule = user.next_module;
    const currentDay = user.next_day;
    const last_msg = user.last_msg;

    let existingValues = await us.findField("interactive_responses", number);
    let list = await us.findInteractive(currentDay, currentModule, number);

    if (list != undefined) {
      let title = list[0];
      console.log(title);

      let options = list.filter((v, i) => i !== 0);

      console.log("Value ", value);
      console.log("Last Msg = ", existingValues);

      for (let i = 0; i < options[0].length; i++) {
        if (options[0][i] == value) {
          let newValues;
          if (existingValues == 0) {
            existingValues = "";
            newValues = title + "\n" + value;
          } else {
            newValues = existingValues + "\n\n" + title + value;
          }

          if (existingValues.includes(title)) {
            console.log("Interactive Feedback already recorded");
            await find_IntContent(currentDay, currentModule, number);
          } else {
            await us.updateField(id, "interactive_responses", newValues);
            console.log("New Interactive Feedback recorded");
            await find_IntContent(currentDay, currentModule, number);
          }
          break;
        }
      }
    } else {
      console.log("List empty");
    }
  } catch (error) {
    console.error('Error in store_intResponse:', error);
  }
}

/**
 * Store question responses from user
 * @param {string} number - User's phone number
 * @param {string} value - User's response
 */
async function store_quesResponse(number, value) {
  try {
    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, next_module, next_day, last_msg')
      .eq('phone', number)
      .single();
    
    if (error) throw error;
    if (!user) {
      console.log("No user found");
      return;
    }

    const id = user.id;
    const currentModule = user.next_module;
    const currentDay = user.next_day;
    const last_msg = user.last_msg;

    if (currentModule !== undefined) {
      let ques = await us.findQuestion(currentDay, currentModule, number);

      if (typeof last_msg === 'string') {
        let cleanLastMsg = last_msg.replace("Q: ", "");
        console.log("Last msg and question in store_quesResponse ", cleanLastMsg, ques);
      }            

      if (last_msg && last_msg.replace("Q: ", "") === ques) {
        ques = ques.replace("\n\nShare your thoughts!", " ");

        let existingValues = await us.findQuesRecord(id);

        console.log("ques -  ", ques);

        let newValues;
        if (ques !== undefined) {
          if (existingValues === undefined) {
            console.log("existingValues", existingValues);
            existingValues = "";
            newValues = `Q: ${ques} \nA: ${value}`;
          } else {
            console.log("existingValues");
            newValues = `${existingValues} \n\nQ: ${ques} \nA: ${value}`;
          }

          if (existingValues.includes(ques)) {
            console.log("third_last", last_msg);
            let cleanLastMsg = last_msg.replace("\n\nShare your thoughts!", " ");

            if (cleanLastMsg === ques) {
              try {
                console.log("1.1.2 Feedback already recorded");
                await find_QContent(currentDay, currentModule, number);
              } catch (e) {
                console.log("Caught Error 1.1.2 Feedback ", e);
              }
            } else {
              console.log("1.2 Feedback already recorded");
              await find_QContent(currentDay, currentModule, number);
            }
          } else {
            await us.updateField(id, "responses", newValues);
            console.log("3. New Feedback recorded");
            await find_QContent(currentDay, currentModule, number);
          }
        }
      } else {
        console.log("No ques");
      }
    }
  } catch (error) {
    console.error('Error in store_quesResponse:', error);
  }
}

/**
 * Find content for the next module
 * @param {number} currentDay - Current day number
 * @param {number} module_No - Module number
 * @param {string} number - User's phone number
 */
async function findContent(currentDay, module_No, number) {
  try {
    const course_tn = await us.findTable(number);
    let id = await us.getID(number);

    // Get content for the current day
    const { data: content, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('day', currentDay)
      .single();
    
    if (error) throw error;
    if (!content) {
      console.log("No records found for the given day");
      return;
    }

    setTimeout(async () => {
      for (let i = module_No + 1; i <= 5; i++) {
        let module_text = content[`module_${i}_text`];
        let module_list = content[`module_${i}_ltitle`];
        console.log("After ", i);
        
        if (module_text === undefined && !module_list) {
          console.log(module_text, module_list);
          if (i >= 5) {
            await markModuleComplete_v2(i, number);
          }
        } else {
          const hTxt = `Let's move forward!`;
          const bTxt = `Click Next.`;
          const btnTxt = "Next.";
          
          setTimeout(() => {
            console.log("2. Delay of Finish Interactive Button - find_QContent");
            us.updateField(id, "last_msg", btnTxt);
            WA.sendInteractiveButtonsMessage(hTxt, bTxt, btnTxt, number);
          }, 5000);
          break;
        }
      }
    }, 500);
  } catch (error) {
    console.error('Error in findContent:', error);
  }
}

/**
 * Find content for interactive messages
 * @param {number} currentDay - Current day number
 * @param {number} module_No - Module number
 * @param {string} number - User's phone number
 */
async function find_IntContent(currentDay, module_No, number) {
  try {
    const course_tn = await us.findTable(number);

    // Get content for the current day
    const { data: content, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('day', currentDay)
      .single();
    
    if (error) throw error;
    if (!content) {
      console.log("No records found for the given day");
      return;
    }

    let module_title = content[`module_${module_No}_ltitle`];
    let id = await us.getID(number);

    console.log(module_title);

    if (module_title !== undefined) {
      console.log("List not empty in findContent");
      await sendList(currentDay, module_No, number);
    } else {
      setTimeout(async () => {
        for (let i = module_No + 1; i <= 6; i++) {
          let module_text = content[`module_${i}_text`];
          let module_list = content[`module_${i}_ltitle`];
          console.log("After ", i);
          
          if (module_text === undefined && !module_list) {
            console.log(module_text, module_list);
            if (i >= 5) {
              await markModuleComplete_v2(i, number);
            }
          } else {
            const hTxt = `Let's move forward!`;
            const bTxt = `Click Next.`;
            const btnTxt = "Next.";
            
            console.log("2. Delay of Finish Interactive Button - find_QContent");
            us.updateField(id, "last_msg", btnTxt);
            WA.sendInteractiveButtonsMessage(hTxt, bTxt, btnTxt, number);
            break;
          }
        }
      }, 500);
    }
  } catch (error) {
    console.error('Error in find_IntContent:', error);
  }
}

/**
 * Find content for questions
 * @param {number} currentDay - Current day number
 * @param {number} module_No - Module number
 * @param {string} number - User's phone number
 */
async function find_QContent(currentDay, module_No, number) {
  try {
    const course_tn = await us.findTable(number);
    console.log("findModule ", course_tn);

    // Get content for the current day
    const { data: content, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('day', currentDay)
      .single();
    
    if (error) throw error;
    if (!content) {
      console.log("No records found for the given day");
      return;
    }

    let id = await us.getID(number);
    console.log(module_No, currentDay);

    setTimeout(async () => {
      for (let i = module_No + 1; i <= 5; i++) {
        console.log("After ", i);
        
        let module_text = content[`module_${i}_text`];
        let module_list = content[`module_${i}_ltitle`];
        
        if (module_text === undefined && !module_list) {
          console.log(`Module ${i} Text is undefined and Module ${i} LTitle is falsy.`);

          if (i >= 5) {
            await markModuleComplete_v2(i, number);
          }
        } else {
          // Send interactive message when module_text or module_list is available
          const hTxt = `Let's move forward!`;
          const bTxt = `Click Next.`;
          const btnTxt = "Next.";

          setTimeout(() => {
            console.log("1. Delay of Finish Interactive Button - find_QContent");
            us.updateField(id, "last_msg", btnTxt);
            WA.sendInteractiveButtonsMessage(hTxt, bTxt, btnTxt, number);
          }, 5000);

          break; // Exit the loop after sending the interactive message
        }
      }
    }, 3000);
  } catch (error) {
    console.error('Error in find_QContent:', error);
  }
}



// Table names
const student_table = 'students';

/**
 * Find Module No in students table and send it
 * @param {string} number - The phone number of the student
 */
async function sendModuleContent(number) {
  console.log("Entered sendModuleContent");

  try {
    // Query student record from Supabase
    const { data: records, error } = await supabase
      .from(student_table)
      .select('*')
      .eq('Phone', number);

    if (error) {
      console.error('Error fetching student record:', error);
      return;
    }

    if (!records || records.length === 0) {
      console.log("No records found for the given number");
      return;
    }

    // Process each record (should be just one)
    for (const record of records) {
      console.log("Processing student record");

      const id = await us.getID(number).catch(e => console.log(e));
      const cDay = record.Next_Day;
      const next_module = record.Next_Module;
      const completed_module = record.Module_Completed;

      if (next_module !== undefined) {
        if (cDay === 5) {
          console.log("Executing outro for day 5");
          // await outro.outro_flow(cDay, number); // Uncomment to execute outro flow
        } else if (next_module === 0) {
          console.log("Next module is 0, finding day content");
          findDay(cDay, number);
        } else {
          if (completed_module === 0 && next_module === 1) {
            console.log(`Starting Day ${cDay} of ${number}`);
            await sendStartDayTopic(next_module, cDay, number);
          } else {
            console.log(`Finding module ${next_module} for day ${cDay}`);
            findModule(cDay, next_module, number);
          }
        }
      } else {
        console.log("Next module is undefined");
      }
    }
  } catch (error) {
    console.error('Error in sendModuleContent:', error);
  }
}

/**
 * Mark the current module as complete and proceed to the next
 * @param {string} number - The phone number of the student
 */
async function markModuleComplete(number) {
  try {
    // Query student record from Supabase
    const { data: records, error } = await supabase
      .from(student_table)
      .select('*')
      .eq('Phone', number);

    if (error) {
      console.error('Error fetching student record:', error);
      return;
    }

    if (!records || records.length === 0) {
      console.log("No records found for the given number");
      return;
    }

    // Process each record (should be just one)
    for (const record of records) {
      const id = record.id;
      const current_module = Number(record.Next_Module);
      const cDay = Number(record.Next_Day);
      const next_module = current_module + 1;

      console.log("Entered markModuleComplete: Next Module - ", next_module, " Current Module - ", current_module);

      if (next_module >= 6) {
        console.log("Module series completed. Updating fields.");

        // Update fields for module completion in Supabase
        const { error: updateError } = await supabase
          .from(student_table)
          .update({
            Module_Completed: current_module,
            Next_Module: 0
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating module completion:', updateError);
          return;
        }

        // Proceed to find the next day's content
        findDay(cDay, number);
      } else {
        console.log("Module in progress. Updating fields and finding next module.");

        // Update fields for current module completion and next module in Supabase
        const { error: updateError } = await supabase
          .from(student_table)
          .update({
            Module_Completed: current_module,
            Next_Module: next_module
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating module progress:', updateError);
          return;
        }

        // Proceed to find the next module's content
        findModule(cDay, next_module, number);
      }
    }
  } catch (error) {
    console.error('Error in markModuleComplete:', error);
  }
}

/**
 * Find module content for the given day and module number
 * @param {number} currentDay - The current day
 * @param {number} module_No - The module number
 * @param {string} number - The phone number of the student
 */
async function findModule(currentDay, module_No, number) {
  try {
    // Get the course table name
    const course_tn = await us.findTable(number);
    console.log("findModule ", module_No, currentDay);

    // Query the course content from Supabase
    const { data: records, error } = await supabase
      .from(course_tn)
      .select('*')
      .eq('Day', currentDay);

    if (error) {
      console.error('Error fetching course content:', error);
      return;
    }

    if (!records || records.length === 0) {
      console.log("No records found for the given day");
      return;
    }

    // Process each record (should be just one for the day)
    for (const record of records) {
      const id = await us.getID(number).catch(e => console.log(e));

      const day = record.Day;
      const module_text = record[`Module_${module_No}_Text`];
      const module_title = record[`Module_${module_No}_LTitle`];
      const module_link = record[`Module_${module_No}_Link`];
      const module_next_msg = record[`Module_${module_No}_next`];
      const interactive_body = record[`Module_${module_No}_iBody`];
      const module_ques = record[`Module_${module_No}_Question`];
      
      // Split the module text if it exists
      const module_split = module_text ? module_text.split("#") : [];
      
      console.log("Executing FindModule");

      if (!module_text && !!module_ques) {
        console.log("Ques not empty - Module Text Empty");

        setTimeout(() => {
          console.log("4. Delay of media in Ques not empty - Module Text Empty");
          sendContent.sendMediaFile(day, module_No, number).then().catch(e => console.log("Error" + e));
        }, 100);

        await sendQues(currentDay, module_No, number);
      }
      else if (!!interactive_body && !!module_text) {
        const data = module_text;
        let index = 0;
        console.log("1. Module Split");

        await sendSplitMessages(module_split, index, day, module_No, number);

        if (!!module_link) {
          console.log("1. Module link not null");

          setTimeout(() => {
            WA.sendText(module_link, number);
          }, 2000);

          console.log("7. Update as last message");
          
          // Update last message in Supabase
          const { error: updateError } = await supabase
            .from(student_table)
            .update({ Last_Msg: data })
            .eq('id', id);

          if (updateError) {
            console.error('Error updating last message:', updateError);
          }
        }

        console.log("8. Update as last message");
        
        // Update last message in Supabase
        const { error: updateError } = await supabase
          .from(student_table)
          .update({ Last_Msg: data })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating last message:', updateError);
        }

        await sendIMsg(currentDay, module_No, number);
      }
      else if (!!module_title && !module_text) {
        console.log("!!module_title && !module_text");
        await sendList(currentDay, module_No, number);
      }
      else if (!!interactive_body && !module_text) {
        console.log("Delay of media in not empty link - interactive not empty");
        sendContent.sendMediaFile(day, module_No, number).then().catch(e => console.log("Error" + e));
        await sendIMsg(currentDay, module_No, number);
      }
      else if (!!module_text && !module_title) {
        console.log("!!module_text && !module_title");

        if (!!interactive_body) {
          setTimeout(() => {
            console.log("2. Delay of media in not empty link");
            sendContent.sendMediaFile(day, module_No, number).then().catch(e => console.log("Error" + e));
          }, 10000);

          await sendIMsg(currentDay, module_No, number);
        }
        else if (!!module_link) {
          const data = module_text;
          let index = 0;

          console.log("2. Split");
          await sendSplitMessages(module_split, index, day, module_No, number);

          console.log("1. Update as last message");
          
          // Update last message in Supabase
          const { error: updateError } = await supabase
            .from(student_table)
            .update({ Last_Msg: data })
            .eq('id', id);

          if (updateError) {
            console.error('Error updating last message:', updateError);
          }

          if (!!module_ques) {
            console.log("1. Ques not empty");

            setTimeout(async () => {
              await sendQues(currentDay, module_No, number);
            }, 5000);
          }
          else {
            console.log("Module link not empty");
            setTimeout(() => {
              console.log("3. Delay of link");
              WA.sendText(module_link, number);
            }, 2500);

            for (let i = module_No + 1; i <= 5; i++) {
              const next_module_text = record[`Module_${i}_Text`];
              console.log("1. After", i);
              console.log("module_text", next_module_text);
              const next_module_list = record[`Module_${i}_LTitle`];

              if (next_module_text === undefined && !next_module_list) {
                console.log(next_module_text);

                if (i >= 5) {
                  await markModuleComplete_v2(i, number).then().catch(error => console.log("v2.1", error));
                }
              }
              else {
                const hTxt = module_next_msg;
                const bTxt = "Click Next.";
                const btnTxt = "Next.";

                setTimeout(() => {
                  console.log("2. Delay of Finish Interactive Button - Module");
                  WA.sendInteractiveButtonsMessage(hTxt, bTxt, btnTxt, number);
                }, 0);
                break;
              }
            }
          }
        }
        else {
          const data = module_text;
          let index = 0;
          console.log("1. module_split");
          await sendSplitMessages(module_split, index, day, module_No, number);

          console.log("2. Update as last message");
          
          // Update last message in Supabase
          const { error: updateError } = await supabase
            .from(student_table)
            .update({ Last_Msg: data })
            .eq('id', id);

          if (updateError) {
            console.error('Error updating last message:', updateError);
          }

          if (!!module_ques) {
            console.log("2. Ques not empty");
            setTimeout(async () => {
              await sendQues(currentDay, module_No, number);
            }, 5000);
          }
          else {
            console.log("Module link null", module_No);
            const next_m = module_No + 1;
            console.log("Module link null nm", next_m);
            const next_module_ques = record[`Module_${next_m}_Question`];
            const next_module_text = record[`Module_${next_m}_Text`];

            if (!!next_module_ques && next_module_text === undefined) {
              console.log("3. Ques not empty", next_module_text);
              
              // Update next module in Supabase
              const { error: updateError } = await supabase
                .from(student_table)
                .update({
                  Next_Module: module_No + 1,
                  Module_Completed: module_No
                })
                .eq('id', id);

              if (updateError) {
                console.error('Error updating next module:', updateError);
              }

              setTimeout(async () => {
                await sendQues(currentDay, module_No + 1, number);
              }, 4000);
            }
            else {
              setTimeout(async () => {
                for (let i = module_No + 1; i <= 5; i++) {
                  const next_module_text = record[`Module_${i}_Text`];
                  console.log("1. After", i);
                  const next_module_list = record[`Module_${i}_LTitle`];

                  if (next_module_text === undefined && !next_module_list) {
                    console.log(next_module_text, module_ques);

                    if (i >= 5) {
                      await markModuleComplete_v2(i, number).then().catch(error => console.log("v2.1", error));
                    }
                  }
                  else {
                    let hTxt = "";
                    console.log("Module Next 1", module_next_msg);
                    if (module_next_msg != null) {
                      hTxt = module_next_msg;
                    }
                    else {
                      hTxt = "To Learn More!";
                    }
                    const bTxt = "Click Next.";
                    const btnTxt = "Next.";

                    setTimeout(() => {
                      console.log("2. Delay of Finish Interactive Button - FindModule");
                      WA.sendInteractiveButtonsMessage(hTxt, bTxt, btnTxt, number);
                    }, 6000);
                    break;
                  }
                }
              }, 15000);
            }
          }
        }
      }
      else if (!!module_text && !!module_title) {
        const data = module_text;

        console.log("3. Update as last message");
        
        // Update last message in Supabase
        const { error: updateError } = await supabase
          .from(student_table)
          .update({ Last_Msg: data })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating last message:', updateError);
        }

        let index = 0;
        await sendSplitMessages(module_split, index, day, module_No, number);

        setTimeout(async () => {
          await sendList(currentDay, module_No, number);
        }, 2000);
      }
      else {
        markModuleComplete(number);
      }
    }
  } catch (error) {
    console.error('Error in findModule:', error);
  }
}


module.exports = { 
  markDayComplete, 
  sendModuleContent, 
  markModuleComplete, 
  store_responses, 
  store_intResponse, 
  store_quesResponse, 
  sendList, 
  findModule 
};

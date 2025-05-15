// update.js
const supabase = require('./supabase-client');

// Update a field for a record
async function updateField(id, field_name, updatedValue) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ [field_name]: updatedValue })
      .eq('id', id);

    if (error) throw error;
    console.log('Record updated successfully');
    return data;
  } catch (error) {
    console.error('Error updating record:', error);
    throw error;
  }
}

// Get user ID by phone number
async function getID(number) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('phone', number)
      .single();

    if (error) throw error;
    if (!data) throw new Error('No matching record found');
    
    console.log("id", data.id);
    return data.id;
  } catch (error) {
    console.error('Error in getID:', error);
    throw error;
  }
}

// Get total days in a course
async function totalDays(number) {
  try {
    // Get the course table name first
    const course_tn = await findTable(number);
    
    // Count days in that course
    const { count, error } = await supabase
      .from('course_days')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', course_tn);

    if (error) throw error;
    console.log(count);
    return count;
  } catch (error) {
    console.error('Error in totalDays:', error);
    throw error;
  }
}

// Find the course table for a user
async function findTable(number) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('course_id')
      .eq('phone', number)
      .single();

    if (error) throw error;
    if (!data) throw new Error('No matching record found');
    
    // Return the course ID
    return data.course_id;
  } catch (error) {
    console.error('Error in findTable:', error);
    throw error;
  }
}

// Get user's record
async function findRecord(id) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('question_responses')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data.question_responses;
  } catch (error) {
    console.error('Error in findRecord:', error);
    throw error;
  }
}

// Get question responses
async function findQuesRecord(id) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('responses')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data.responses;
  } catch (error) {
    console.error('Error in findQuesRecord:', error);
    throw error;
  }
}

// Find title for a module
async function findTitle(currentDay, module_no, number) {
  try {
    // First get the course ID
    const course_id = await findTable(number);
    
    // Get the day
    const { data, error } = await supabase
      .from('course_days')
      .select(`
        id,
        module_1_ltitle,
        module_1_list,
        module_2_ltitle,
        module_2_list,
        module_3_ltitle,
        module_3_list,
        module_4_ltitle,
        module_4_list,
        module_5_ltitle,
        module_5_list
      `)
      .eq('course_id', course_id)
      .eq('day_number', currentDay)
      .single();

    if (error) throw error;
    if (!data) return [0, 0];
    
    const title = data[`module_${module_no}_ltitle`];
    const options = data[`module_${module_no}_list`];
    
    if (title === undefined) return [0, 0];
    
    return [title, options.split('\n')];
  } catch (error) {
    console.error('Error in findTitle:', error);
    return [0, 0];
  }
}

// Find interactive content
async function findInteractive(currentDay, module_no, number) {
  try {
    // Get the course ID
    const course_id = await findTable(number);
    
    // Get the day
    const { data, error } = await supabase
      .from('course_days')
      .select(`
        id,
        module_${module_no}_ibody,
        module_${module_no}_ibuttons
      `)
      .eq('course_id', course_id)
      .eq('day_number', currentDay)
      .single();

    if (error) throw error;
    if (!data) return "No records found for the given day";
    
    const body = data[`module_${module_no}_ibody`];
    const buttons = data[`module_${module_no}_ibuttons`];
    
    if (body === undefined) return "No matching interactive content found";
    
    return [body, buttons.split('\n')];
  } catch (error) {
    console.error('Error in findInteractive:', error);
    throw error;
  }
}

// Find a question
async function findQuestion(currentDay, module_no, number) {
  try {
    // Get the course ID
    const course_id = await findTable(number);
    
    // Get the day
    const { data, error } = await supabase
      .from('course_days')
      .select(`module_${module_no}_question`)
      .eq('course_id', course_id)
      .eq('day_number', currentDay)
      .single();

    if (error) throw error;
    if (!data) return "No records found for the given day";
    
    const questionField = `module_${module_no}_question`;
    const body = data[questionField];
    
    if (body === undefined) return "No matching question found";
    
    return body;
  } catch (error) {
    console.error('Error in findQuestion:', error);
    throw error;
  }
}

// Find the last message sent to a user
async function findLastMsg(number) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('last_msg')
      .eq('phone', number)
      .single();

    if (error) throw error;
    if (!data) return undefined;
    
    return data.last_msg;
  } catch (error) {
    console.error('Error in findLastMsg:', error);
    return undefined;
  }
}

// Find a field value for a user
async function findField(field, number) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(field)
      .eq('phone', number)
      .single();

    if (error) throw error;
    if (!data) return 0;
    
    return data[field] !== undefined ? data[field] : 0;
  } catch (error) {
    console.error('Error in findField:', error);
    return 0;
  }
}

// Find content for a specific field, day and module
async function find_ContentField(field, currentDay, current_module, number) {
  try {
    // Get the course ID
    const course_id = await findTable(number);
    
    // Get the day
    const { data, error } = await supabase
      .from('course_days')
      .select(`module_${current_module}_${field}`)
      .eq('course_id', course_id)
      .eq('day_number', currentDay)
      .single();

    if (error) throw error;
    if (!data) return 0;
    
    const fieldName = `module_${current_module}_${field}`;
    const body = data[fieldName];
    
    if (body === undefined) return 0;
    
    return body.split('\n');
  } catch (error) {
    console.error('Error in find_ContentField:', error);
    return 0;
  }
}

// Find answer for a question
async function findAns(currentDay, module_no, number) {
  try {
    // Get the course ID
    const course_id = await findTable(number);
    
    // Get the day
    const { data, error } = await supabase
      .from('course_days')
      .select(`module_${module_no}_ans`)
      .eq('course_id', course_id)
      .eq('day_number', currentDay)
      .single();

    if (error) throw error;
    if (!data) return null;
    
    const ansField = `module_${module_no}_ans`;
    return data[ansField] !== undefined ? data[ansField] : null;
  } catch (error) {
    console.error('Error in findAns:', error);
    return null;
  }
}

module.exports = {
  findTable,
  totalDays,
  updateField,
  findRecord,
  findTitle,
  findInteractive,
  findQuestion,
  findQuesRecord,
  getID,
  findLastMsg,
  findField,
  findAns,
  find_ContentField
};

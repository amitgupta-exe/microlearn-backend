// setup-supabase-schema.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function setupSchema() {
  console.log("Setting up Supabase schema...");
  
  try {
    // Enable PostgreSQL extensions (needs to be done via SQL)
    const { error: extensionsError } = await supabase.rpc('extensions', {
      extensions: ['uuid-ossp', 'pgcrypto']
    });
    
    if (extensionsError) {
      console.warn("Warning: Couldn't enable extensions (may need admin privileges):", extensionsError);
    }
    
    // Create users table
    const { error: usersError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'users',
      columns: `
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone TEXT UNIQUE NOT NULL,
        name TEXT,
        course_id UUID REFERENCES courses(id),
        next_day INTEGER DEFAULT 1,
        day_completed INTEGER DEFAULT 0,
        next_module INTEGER DEFAULT 1,
        module_completed INTEGER DEFAULT 0,
        last_msg TEXT,
        question_responses TEXT,
        interactive_responses TEXT,
        responses TEXT,
        feedback TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    });
    
    if (usersError) {
      console.error("Error creating users table:", usersError);
    } else {
      console.log("Users table created successfully");
    }
    
    // Create courses table
    const { error: coursesError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'courses',
      columns: `
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title TEXT NOT NULL,
        description TEXT,
        instructor TEXT,
        language TEXT DEFAULT 'English',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    });
    
    if (coursesError) {
      console.error("Error creating courses table:", coursesError);
    } else {
      console.log("Courses table created successfully");
    }
    
    // Create course_days table
    const { error: daysError } = await supabase.rpc('create_table_if_not_exists', {
      table_name: 'course_days',
      columns: `
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        title TEXT,
        
        module_1_text TEXT,
        module_1_link TEXT,
        module_1_file JSONB,
        module_1_ltitle TEXT,
        module_1_list TEXT,
        module_1_ibody TEXT,
        module_1_ibuttons TEXT,
        module_1_question TEXT,
        module_1_ans TEXT,
        module_1_next TEXT,
        
        module_2_text TEXT,
        module_2_link TEXT,
        module_2_file JSONB,
        module_2_ltitle TEXT,
        module_2_list TEXT,
        module_2_ibody TEXT,
        module_2_ibuttons TEXT,
        module_2_question TEXT,
        module_2_ans TEXT,
        module_2_next TEXT,
        
        module_3_text TEXT,
        module_3_link TEXT,
        module_3_file JSONB,
        module_3_ltitle TEXT,
        module_3_list TEXT,
        module_3_ibody TEXT,
        module_3_ibuttons TEXT,
        module_3_question TEXT,
        module_3_ans TEXT,
        module_3_next TEXT,
        
        module_4_text TEXT,
        module_4_link TEXT,
        module_4_file JSONB,
        module_4_ltitle TEXT,
        module_4_list TEXT,
        module_4_ibody TEXT,
        module_4_ibuttons TEXT,
        module_4_question TEXT,
        module_4_ans TEXT,
        module_4_next TEXT,
        
        module_5_text TEXT,
        module_5_link TEXT,
        module_5_file JSONB,
        module_5_ltitle TEXT,
        module_5_list TEXT,
        module_5_ibody TEXT,
        module_5_ibuttons TEXT,
        module_5_question TEXT,
        module_5_ans TEXT,
        module_5_next TEXT,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(course_id, day_number)
      `
    });
    
    if (daysError) {
      console.error("Error creating course_days table:", daysError);
    } else {
      console.log("Course days table created successfully");
    }
    
    console.log("Schema setup complete");
  } catch (error) {
    console.error("Schema setup failed:", error);
  }
}

setupSchema().catch(console.error);

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

create table public.course_generation_requests (
  request_id uuid not null default gen_random_uuid (),
  course_title text not null,
  topic text not null,
  goal text not null,
  style text not null,
  language text not null,
  created_at timestamp with time zone null default now(),
  created_by uuid null,
  constraint course_generation_requests_pkey primary key (request_id)
) TABLESPACE pg_default;


create table public.course_progress (
  id uuid not null default gen_random_uuid (),
  learner_id uuid null,
  learner_name text null,
  course_id uuid null,
  course_name text null,
  status text null,
  current_day integer null default 1,
  last_reminder_sent_at timestamp without time zone null,
  started_at timestamp without time zone null,
  completed_at timestamp without time zone null,
  progress_percent integer null default 0,
  last_module_completed_at timestamp without time zone null,
  reminder_count integer null default 0,
  feedback text null,
  notes text null,
  is_active boolean null default true,
  day1_module1 boolean null default false,
  day1_module2 boolean null default false,
  day1_module3 boolean null default false,
  day2_module1 boolean null default false,
  day2_module2 boolean null default false,
  day2_module3 boolean null default false,
  day3_module1 boolean null default false,
  day3_module2 boolean null default false,
  day3_module3 boolean null default false,
  phone_number text null,
  reminder_count_day1 integer null default 0,
  reminder_count_day2 integer null default 0,
  reminder_count_day3 integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint course_progress_pkey primary key (id),
  constraint course_progress_status_check check (
    (
      status = any (
        array[
          'assigned'::text,
          'started'::text,
          'completed'::text,
          'suspended'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists unique_active_progress_per_learner on public.course_progress using btree (learner_id, status) TABLESPACE pg_default
where
  (
    status = any (array['assigned'::text, 'started'::text])
  );

create unique INDEX IF not exists unique_active_progress_per_phone on public.course_progress using btree (phone_number) TABLESPACE pg_default
where
  (
    status = any (array['assigned'::text, 'started'::text])
  );





create table public.courses (
  id uuid not null default extensions.uuid_generate_v4 (),
  course_name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid not null,
  visibility text not null default 'private'::text,
  day integer not null default 1,
  module_1 text null,
  module_2 text null,
  module_3 text null,
  origin text not null default 'microlearn_manual'::text,
  request_id uuid null,
  status text not null default 'approved'::text,
  constraint courses_pkey primary key (id),
  constraint courses_created_by_fkey foreign KEY (created_by) references users (id),
  constraint courses_origin_check check (
    (
      origin = any (
        array[
          'migrated_from_airtable'::text,
          'alfred'::text,
          'microlearn_manual'::text,
          'microlearn_cop'::text
        ]
      )
    )
  ),
  constraint courses_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'approved'::text,
          'rejected'::text
        ]
      )
    )
  ),
  constraint courses_visibility_check check (
    (
      visibility = any (array['public'::text, 'private'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_courses_created_by on public.courses using btree (created_by) TABLESPACE pg_default;




create table public.learners (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  email text not null,
  phone text not null,
  status text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid not null,
  assigned_course_id uuid null,
  constraint learners_pkey primary key (id),
  constraint learners_assigned_course_id_fkey foreign KEY (assigned_course_id) references courses (id) on delete set null,
  constraint learners_created_by_fkey foreign KEY (created_by) references users (id),
  constraint learners_status_check check (
    (
      status = any (array['active'::text, 'inactive'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_learners_created_by on public.learners using btree (created_by) TABLESPACE pg_default;

create trigger on_learner_created
after INSERT on learners for EACH row
execute FUNCTION send_learner_welcome_message ();

create table public.messages_sent (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  learner_id uuid null,
  message_type text null,
  created_at timestamp with time zone null default now(),
  constraint messages_sent_pkey primary key (id),
  constraint messages_sent_learner_id_fkey foreign KEY (learner_id) references learners (id),
  constraint messages_sent_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;



create table public.registration_requests (
  request_id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  number text not null,
  topic text not null,
  goal text not null,
  style text not null,
  language text not null,
  generated boolean not null default false,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  approval_status text null default 'pending'::text,
  constraint registration_requests_pkey primary key (request_id),
  constraint approval_status_check check (
    (
      approval_status = any (
        array[
          'approved'::text,
          'rejected'::text,
          'pending'::text
        ]
      )
    )
  ),
  constraint registration_requests_approval_status_check check (
    (
      approval_status = any (
        array[
          'pending'::text,
          'approved'::text,
          'rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;


create table public.users (
  id uuid not null default extensions.uuid_generate_v4 (),
  email text not null,
  name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  phone text null,
  role text not null default 'learner'::text,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_phone_key unique (phone),
  constraint users_role_check check (
    (
      role = any (
        array[
          'superadmin'::text,
          'admin'::text,
          'learner'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;
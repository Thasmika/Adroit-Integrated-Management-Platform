-- Adroit Integrated Management Platform · Phase 1 schema (§13 Logical Data Model)
-- Internal immutable UUID identifiers alongside business identifiers (Employee ID, Fleet No.) (§13.1).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- reference masters (§5) ----------
CREATE TABLE companies (
  id          text PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  short       text NOT NULL,
  kind        text NOT NULL DEFAULT 'Group company',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE departments (
  id          text PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE locations (
  id          text PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE asset_categories (
  name        text PRIMARY KEY,
  active      boolean NOT NULL DEFAULT true,
  sort        int NOT NULL DEFAULT 0
);

-- ---------- users, sessions (§4) ----------
CREATE TABLE users (
  id                    text PRIMARY KEY,
  name                  text NOT NULL,
  email                 text NOT NULL,
  password_hash         text,
  role                  text NOT NULL CHECK (role IN ('sysadmin','management','hr','pro','insurance','depthead','fleet','auditor')),
  scope_department      text REFERENCES departments(name) ON UPDATE CASCADE,
  active                boolean NOT NULL DEFAULT true,
  must_change_password  boolean NOT NULL DEFAULT false,
  failed_logins         int NOT NULL DEFAULT 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  password_changed_at   timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT depthead_scope CHECK (role <> 'depthead' OR scope_department IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  ip          text,
  user_agent  text,
  revoked_at  timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- ---------- document types & responsible officers (§5, §10) ----------
CREATE TABLE document_types (
  key             text PRIMARY KEY,
  module          text NOT NULL CHECK (module IN ('hr','fleet')),
  short           text NOT NULL,
  expires         boolean NOT NULL DEFAULT true,
  required        boolean NOT NULL DEFAULT false,          -- HR: required for every employee
  required_for    text[] NOT NULL DEFAULT '{}',            -- Fleet: categories that require it
  urgent_days     int NOT NULL DEFAULT 30,
  due_days        int NOT NULL DEFAULT 60,
  monitor_days    int NOT NULL DEFAULT 90,
  officer_user_id text REFERENCES users(id),
  sort            int NOT NULL DEFAULT 0,
  CHECK (urgent_days <= due_days AND (monitor_days = 0 OR due_days <= monitor_days))
);

-- ---------- files (§9) ----------
CREATE TABLE files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key    text NOT NULL UNIQUE,         -- system generated; original name kept as metadata
  original_name  text NOT NULL,
  mime           text NOT NULL,
  size_bytes     bigint NOT NULL,
  sha256         text NOT NULL,
  owner_module   text NOT NULL CHECK (owner_module IN ('hr','fleet')),
  owner_id       uuid NOT NULL,
  purpose        text NOT NULL DEFAULT 'document' CHECK (purpose IN ('document','photo')),
  uploaded_by    text REFERENCES users(id),
  uploaded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX files_owner_idx ON files (owner_module, owner_id);

-- ---------- employees (§6) ----------
CREATE TABLE employees (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_no             text NOT NULL UNIQUE,
  name               text NOT NULL,
  photo_file_id      uuid REFERENCES files(id),
  gender             text,
  nationality        text,
  dob                date,
  department         text NOT NULL REFERENCES departments(name) ON UPDATE CASCADE,
  location           text REFERENCES locations(name) ON UPDATE CASCADE,
  designation        text NOT NULL,
  mobile             text,
  email              text,
  status             text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','On Notice','Inactive','Resigned','Terminated')),
  joined             date,
  company            text NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,   -- operational company
  sponsor            text NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,   -- visa sponsoring company
  dept_head          text,
  insurance_plan     text,
  insurance_provider text,
  emergency_contact  text,
  home_address       text,
  notes              text,
  created_by         text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by         text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employees_name_idx ON employees (lower(name));
CREATE INDEX employees_dept_idx ON employees (department);

-- ---------- assets (§8) ----------
CREATE TABLE assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_no       text NOT NULL UNIQUE,
  category       text NOT NULL REFERENCES asset_categories(name) ON UPDATE CASCADE,
  make           text NOT NULL,
  model          text NOT NULL,
  body           text,
  year           int,
  colour         text,
  emirate        text,
  plate          text,
  vin            text NOT NULL,
  engine         text,
  capacity       text,
  company        text NOT NULL REFERENCES companies(name) ON UPDATE CASCADE,
  department     text NOT NULL REFERENCES departments(name) ON UPDATE CASCADE,
  location       text REFERENCES locations(name) ON UPDATE CASCADE,
  status         text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Under Repair','Standby','Off-road','Inactive','Disposed')),
  usage          text,
  officer        text,
  acquired       date,
  odometer       text,
  remarks        text,
  photo_file_id  uuid REFERENCES files(id),
  created_by     text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by     text, updated_at timestamptz NOT NULL DEFAULT now()
);
-- Indexed for search; uniqueness of plate / VIN is a business-rule confirmation item (§13.1, §19)
CREATE INDEX assets_plate_idx ON assets (lower(plate));
CREATE INDEX assets_vin_idx ON assets (lower(vin));

-- ---------- documents: one logical record per owner + type, with a version chain (§9) ----------
CREATE TABLE documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_module        text NOT NULL CHECK (owner_module IN ('hr','fleet')),
  owner_id            uuid NOT NULL,
  type                text NOT NULL REFERENCES document_types(key) ON UPDATE CASCADE,
  name                text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_module, owner_id, type)
);
CREATE TABLE document_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ref             text,
  issuer          text,
  issued          date,
  expiry          date,
  file_id         uuid REFERENCES files(id),
  is_current      boolean NOT NULL DEFAULT true,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  superseded_at   timestamptz,
  superseded_by   text
);
CREATE UNIQUE INDEX document_versions_current_uq ON document_versions (document_id) WHERE is_current;
CREATE INDEX document_versions_expiry_idx ON document_versions (expiry) WHERE is_current;
CREATE INDEX document_versions_ref_idx ON document_versions (lower(ref));

-- ---------- expiry actions / tasks (§10) ----------
CREATE TABLE expiry_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind          text NOT NULL DEFAULT 'renewal' CHECK (kind IN ('renewal','missing')),
  status        text NOT NULL DEFAULT 'Open',
  assigned_to   text REFERENCES users(id),
  note          text,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text,
  completed_at  timestamptz,
  completed_by  text
);
CREATE UNIQUE INDEX expiry_actions_open_uq ON expiry_actions (document_id) WHERE completed_at IS NULL;
CREATE TABLE action_events (
  id          bigserial PRIMARY KEY,
  action_id   uuid NOT NULL REFERENCES expiry_actions(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL DEFAULT now(),
  by_user     text,
  status      text NOT NULL,
  note        text
);

-- ---------- leave (§7) ----------
CREATE SEQUENCE leave_seq;
CREATE TABLE leave_requests (
  id              text PRIMARY KEY,
  employee_id     uuid NOT NULL REFERENCES employees(id),
  type            text NOT NULL CHECK (type IN ('Annual Leave','Emergency Leave','Sick Leave')),
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  days            int NOT NULL,
  reason          text NOT NULL,
  contact_abroad  text,
  status          text NOT NULL CHECK (status IN ('Pending HR Review','Pending Approval','Approved','On Leave','Awaiting Rejoining','Completed','Rejected','Cancelled')),
  requested_by    text,
  requested_on    date NOT NULL DEFAULT current_date,
  hr_note         text,
  decided_by      text,
  decided_at      timestamptz,
  reject_reason   text,
  rejoined        date,
  rejoin_note     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX leave_emp_idx ON leave_requests (employee_id);
CREATE INDEX leave_status_idx ON leave_requests (status);
CREATE TABLE leave_events (
  id          bigserial PRIMARY KEY,
  leave_id    text NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL DEFAULT now(),
  by_user     text,
  from_status text,
  to_status   text NOT NULL,
  note        text
);

-- ---------- notifications (§5, §10) ----------
CREATE TABLE notification_templates (
  id        text PRIMARY KEY,
  event     text NOT NULL,
  audience  text NOT NULL,
  subject   text NOT NULL,
  channel   text NOT NULL DEFAULT 'In-app + email'
);
CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id   text,
  title         text NOT NULL,
  body          text,
  link          text,
  dedupe_key    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,
  email_status  text NOT NULL DEFAULT 'not_required' CHECK (email_status IN ('not_required','pending','sent','failed')),
  email_error   text,
  email_sent_at timestamptz
);
CREATE UNIQUE INDEX notifications_dedupe_uq ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX notifications_user_idx ON notifications (user_id, read_at);

-- ---------- configuration (§5 System Configuration) ----------
CREATE TABLE system_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- audit (§4.1): append-only ----------
CREATE TABLE audit_events (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  user_id    text,
  user_name  text,
  role       text,
  action     text NOT NULL,
  entity     text NOT NULL,
  record     text,
  detail     text,
  before     jsonb,
  after      jsonb,
  ip         text
);
CREATE INDEX audit_at_idx ON audit_events (at DESC);
CREATE INDEX audit_record_idx ON audit_events (record);
CREATE OR REPLACE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();

-- ---------- AI interactions (§12 logging) ----------
CREATE TABLE ai_interactions (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  user_id       text,
  question      text NOT NULL,
  module        text,
  result_count  int,
  result_refs   jsonb
);

-- ---------- operations: background jobs, imports (§15 observability, §16 migration) ----------
CREATE TABLE job_runs (
  id           bigserial PRIMARY KEY,
  job          text NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','failed')),
  detail       jsonb,
  error        text
);
CREATE INDEX job_runs_job_idx ON job_runs (job, started_at DESC);
CREATE TABLE import_batches (
  id           bigserial PRIMARY KEY,
  kind         text NOT NULL CHECK (kind IN ('employees','assets')),
  file_name    text,
  uploaded_by  text,
  at           timestamptz NOT NULL DEFAULT now(),
  mode         text NOT NULL CHECK (mode IN ('validate','commit')),
  total        int NOT NULL DEFAULT 0,
  accepted     int NOT NULL DEFAULT 0,
  rejected     int NOT NULL DEFAULT 0,
  log          jsonb NOT NULL DEFAULT '[]'
);

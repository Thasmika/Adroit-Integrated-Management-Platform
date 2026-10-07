// AI provider adapter (§12).
//
// The language model is used only to understand the question. It is given the question and a fixed list of
// approved read-only operations, and must pick exactly one and fill in its parameters. The server then runs
// that operation itself through the same permission-filtered engine used everywhere else. The model never
// receives employee or fleet records and has no database access, and nothing it returns can write data.
//
// If no provider is configured, the provider is slow or failing, or it returns something unusable, the
// built-in rules engine answers the original question instead (§12 failure mode). The response says which
// path produced it.
import { env } from './env.js';

export type Plan = { tool: string; input: Record<string, any> };

const DOC_ENUM = ['Passport', 'Employment Visa', 'Emirates ID', 'Labour Card', 'Health Insurance', 'Vehicle Registration', 'Motor Insurance', 'Safety Certificate', 'Inspection / Test Certificate', 'Other Permit'];
const CAT_ENUM = ['Heavy Vehicle', 'Light Vehicle', 'Trailer', 'Heavy Machine / Equipment', 'Other Company Vehicle'];

export const TOOLS = [
  {
    name: 'expiring_documents',
    description: 'List employee or fleet documents that are expired or expire within a number of days.',
    input_schema: {
      type: 'object',
      properties: {
        doc_types: { type: 'array', items: { type: 'string', enum: DOC_ENUM }, description: 'Document types. Empty means all.' },
        within_days: { type: 'integer', minimum: 0, maximum: 730, description: 'Look-ahead window in days. 0 means already expired only.' },
        vehicle_category: { type: 'string', enum: CAT_ENUM },
        department_or_branch: { type: 'string', description: 'e.g. Satwa, Aweer Branch, Transport, Trading' },
        registered_company: { type: 'string', description: 'e.g. Gateway Gulf Transport' },
      },
      required: ['within_days'],
    },
  },
  {
    name: 'missing_documents',
    description: 'List employees or vehicles whose required documents are not recorded or have no scanned copy.',
    input_schema: {
      type: 'object',
      properties: {
        module: { type: 'string', enum: ['employees', 'fleet'] },
        doc_types: { type: 'array', items: { type: 'string', enum: DOC_ENUM } },
        vehicle_category: { type: 'string', enum: CAT_ENUM },
      },
      required: ['module'],
    },
  },
  {
    name: 'record_documents',
    description: 'Show one employee or vehicle and its documents, e.g. "insurance card for employee 0115" or "insurance copy for VH-0108".',
    input_schema: {
      type: 'object',
      properties: {
        record: { type: 'string', description: 'Employee number (e.g. 0115, EMP 0115), fleet number (e.g. VH-0108), plate, or employee name' },
        doc_types: { type: 'array', items: { type: 'string', enum: DOC_ENUM } },
      },
      required: ['record'],
    },
  },
  {
    name: 'leave_status',
    description: 'Who is on leave, pending leave requests, or employees who have not rejoined after leave.',
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['on_leave', 'pending_requests', 'not_rejoined'] },
        leave_type: { type: 'string', enum: ['Annual Leave', 'Emergency Leave', 'Sick Leave'] },
        department_or_branch: { type: 'string' },
      },
      required: ['view'],
    },
  },
  {
    name: 'open_renewal_actions',
    description: 'Open renewal actions assigned to a responsible officer. Use officer "me" for the person asking.',
    input_schema: { type: 'object', properties: { officer: { type: 'string', description: 'Officer name or "me"' } }, required: ['officer'] },
  },
  {
    name: 'attention_summary',
    description: 'Summarise document and leave actions needing attention this week.',
    input_schema: { type: 'object', properties: { scope: { type: 'string', enum: ['hr', 'fleet', 'both'] } }, required: ['scope'] },
  },
  {
    name: 'list_fleet',
    description: 'List or count vehicles and machines by category, machine type, location, registered company or status.',
    input_schema: {
      type: 'object',
      properties: {
        vehicle_category: { type: 'string', enum: CAT_ENUM },
        machine_or_body_type: { type: 'string', description: 'e.g. forklift, tipper, pickup, mobile crane' },
        location: { type: 'string' },
        registered_company: { type: 'string' },
        status: { type: 'string', enum: ['Active', 'Under Repair', 'Standby', 'Off-road', 'Inactive', 'Disposed'] },
      },
    },
  },
  {
    name: 'employee_headcount',
    description: 'Count or list employees by department, nationality or visa sponsorship.',
    input_schema: { type: 'object', properties: { department_or_branch: { type: 'string' }, nationality: { type: 'string' }, group_company_visa: { type: 'boolean' } } },
  },
  {
    name: 'not_supported',
    description: 'Use when the question is not about employee or fleet records, documents, expiries or leave, or asks to change data.',
    input_schema: { type: 'object', properties: { reason: { type: 'string' } } },
  },
];

const SHORT: Record<string, string> = { 'Employment Visa': 'visas', 'Emirates ID': 'Emirates IDs', 'Labour Card': 'labour cards', Passport: 'passports', 'Health Insurance': 'health insurance', 'Vehicle Registration': 'registration', 'Motor Insurance': 'motor insurance', 'Safety Certificate': 'safety certificates', 'Inspection / Test Certificate': 'inspection certificates', 'Other Permit': 'permits' };
const clean = (s: any) => String(s ?? '').replace(/[^\p{L}\p{N} &/.'-]/gu, ' ').trim().slice(0, 60);
const types = (a: any) => (Array.isArray(a) ? a.filter((t) => DOC_ENUM.includes(t)).map((t) => SHORT[t]).join(' or ') : '');

// Turns an approved operation into the canonical phrasing that the grounded engine answers.
// Every parameter is validated against the schema values above; free text is stripped to plain words.
export function planToQuestion(p: Plan): string | null {
  const i = p.input || {};
  const dept = i.department_or_branch ? ` in ${clean(i.department_or_branch)}` : '';
  const cat = CAT_ENUM.includes(i.vehicle_category) ? (i.vehicle_category === 'Heavy Machine / Equipment' ? 'heavy machines' : `${i.vehicle_category.toLowerCase()}s`) : '';
  switch (p.tool) {
    case 'expiring_documents': {
      const d = Math.max(0, Math.min(730, parseInt(i.within_days, 10) || 0));
      const t = types(i.doc_types) || 'documents';
      const co = i.registered_company ? ` registered under ${clean(i.registered_company)}` : '';
      return d === 0 ? `Show ${cat ? cat + ' ' : ''}${t} already expired${dept}${co}` : `Show ${cat ? cat + ' with ' : ''}${t} expiring within ${d} days${dept}${co}`;
    }
    case 'missing_documents':
      return i.module === 'fleet' ? `List ${cat || 'vehicles'} with missing ${types(i.doc_types) || 'documents'}` : `List employees with missing ${types(i.doc_types) || 'documents'} copies`;
    case 'record_documents': {
      const r = clean(i.record);
      if (!r) return null;
      const ref = /^\d{1,4}$/.test(r) ? `employee ${r}` : /^vh[\s-]?\d/i.test(r) ? `vehicle ${r.toUpperCase().replace(/\s/, '-')}` : /^emp/i.test(r) ? `employee ${r.replace(/\D/g, '')}` : r;
      return `Find the ${types(i.doc_types) || 'documents'} copy for ${ref}`;
    }
    case 'leave_status':
      if (i.view === 'pending_requests') return 'Which leave requests are pending approval?';
      if (i.view === 'not_rejoined') return 'Who has not rejoined after leave?';
      return `Who is currently on ${i.leave_type ? i.leave_type.toLowerCase() : 'leave'}${dept}?`;
    case 'open_renewal_actions': {
      const o = clean(i.officer);
      return /^(me|my|mine|myself)?$/i.test(o) ? 'Show open renewal actions assigned to me' : `Show open renewal actions assigned to ${o}`;
    }
    case 'attention_summary':
      return i.scope === 'hr' ? 'Summarize HR actions requiring attention this week' : i.scope === 'fleet' ? 'Summarize fleet document actions requiring attention' : 'Summarize HR and fleet document actions requiring attention this week';
    case 'list_fleet': {
      const what = i.machine_or_body_type ? `${clean(i.machine_or_body_type)}s` : cat || 'vehicles';
      const parts = [
        i.location ? ` at ${clean(i.location)}` : '',
        i.registered_company ? ` registered under ${clean(i.registered_company)}` : '',
      ].join('');
      if (i.status) return `Which ${what} are ${String(i.status).toLowerCase()}${parts}?`;
      return `How many ${what}${parts}?`;
    }
    case 'employee_headcount': {
      if (i.group_company_visa) return 'How many employees are on group company visas?';
      return `How many ${i.nationality ? clean(i.nationality) + ' ' : ''}employees${dept}?`;
    }
    default:
      return null;
  }
}

export const aiConfigured = () => env.aiProvider === 'anthropic' && !!env.anthropicApiKey;

// Asks the provider to choose one approved operation. Returns null on any problem so the caller falls back.
export async function planWithProvider(question: string, ctx: { role: string; modules: string[] }, fetchImpl: typeof fetch = fetch): Promise<Plan | null> {
  if (!aiConfigured()) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), env.aiTimeoutMs);
  try {
    const res = await fetchImpl(`${env.anthropicBaseUrl}/v1/messages`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: env.aiModel,
        max_tokens: 300,
        system: `You route questions for the Adroit HR and fleet management system (UAE). Choose exactly one tool that answers the question and fill its parameters from the question. You never answer from your own knowledge and never modify data. The user's role is ${ctx.role}; they can access: ${ctx.modules.join(', ') || 'no modules'}. Today is ${new Date().toISOString().slice(0, 10)}. "This month" means within 30 days; "this week" means within 7 days; if no window is given use 60 days.`,
        tools: TOOLS,
        tool_choice: { type: 'any' },
        messages: [{ role: 'user', content: question }],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const call = (data.content || []).find((c: any) => c.type === 'tool_use');
    if (!call || !TOOLS.some((t) => t.name === call.name)) return null;
    return { tool: call.name, input: call.input || {} };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

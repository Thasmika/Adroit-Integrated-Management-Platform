# AI assistance: integration and safeguards

The assistant answers plain-English questions about employees, vehicles, documents, expiries and leave (technical proposal §12). It is an assistance layer over the system's own records, never a separate source of truth.

## How a question is answered

```
question ─► (optional) AI provider picks ONE approved read-only operation and its parameters
          ─► server runs that operation with the signed-in user's permissions
          ─► answer built from the records, listing the records it used
          ─► logged in ai_interactions and the audit trail
```

1. **Approved operations only.** The provider is given the question and a fixed list of nine operations: expiring documents, missing documents, one record's documents, leave status, open renewal actions, attention summary, fleet list, employee headcount, and "not supported". It must choose exactly one. Any other tool name, or invalid parameters, is ignored.
2. **The model sees no records.** Only the question, the user's role name and module list, and today's date are sent. Employee names, document numbers, plates and scans never leave the server. A test (`server/test/ai.test.ts`) checks the outgoing request for names, Emirates IDs and plates.
3. **Permissions first.** The operation runs through the same filters as the rest of the system. A Fleet Officer who asks about visas is told their role doesn't include those records; an Insurance Officer only ever gets insurance documents.
4. **Read-only.** No operation can create, change, approve or complete anything.
5. **Grounded answers.** Every answer lists the employees, vehicles or documents it came from, with links, so users can check it.
6. **Logged.** Every question is written to `ai_interactions` (user, question, module, which path answered, how it was routed, the record references returned) and to the audit trail.

## Without a provider

With `AI_PROVIDER=none` (the default), or with no API key, a built-in rules engine answers the question directly. It understands the example questions in the proposal and common variations. Nothing is sent outside the server.

## Failure mode

If the provider is slow (more than `AI_TIMEOUT_MS`, default 8 seconds), returns an error, or returns something unusable, the rules engine answers instead, so users still get a result. If an administrator switches the assistant off (**Administration → System configuration → AI assistant enabled**), the assistant page says so; search, dashboards, alerts and workflows keep working (§15 business continuity).

## Turning on a provider

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<key from the Anthropic Console>
AI_MODEL=claude-haiku-4-5-20251001
AI_TIMEOUT_MS=8000
```

Restart the application. **Administration → System health → AI assistant** shows the provider, the model and how many questions it routed in the last 24 hours.

Before enabling, management should confirm the AI provider, hosting and privacy terms (technical proposal §19). The provider only receives the question text; users should be told not to type personal data into questions.

## Tests

`server/test/ai.test.ts` runs against a local mock provider:

- the provider's choice is executed and answered from records;
- the request carries no record data;
- provider errors and timeouts fall back to the rules engine;
- unknown tools and malformed parameters are ignored;
- permissions still apply after routing;
- every operation type produces a grounded answer;
- each question is logged with the path that answered it.

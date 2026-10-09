/**
 * Six threat-modeling scenarios grounded in the AIGoat architecture.
 *
 * Rules enforced by tests:
 *   - exactly six scenarios, each with every mandatory item;
 *   - every claim carries an evidence class (verified | hypothesis | needs-validation);
 *   - nothing derived from architecture alone is called a confirmed vulnerability;
 *   - every scenario has all five lenses: discovery, context, SAIF, AI Exchange, risk.
 *
 * SAIF risk and control names come from SAIF_RISKS in ./frameworks.js (copied
 * from the SAIF risks page). AI Exchange control and threat names are only
 * those found on the checked owaspai.org pages. Anything else is an
 * "analytical" statement and is shown with that label.
 */
import { SAIF_RISKS } from './frameworks';

const AIX = {
  overview: { label: 'AI security overview and risk analysis', url: 'https://owaspai.org/docs/ai_security_overview/' },
  general: { label: 'General controls', url: 'https://owaspai.org/docs/1_general_controls/' },
  devtime: { label: 'Development-time threats', url: 'https://owaspai.org/docs/3_development_time_threats/' },
  runtime: { label: 'Runtime application security threats', url: 'https://owaspai.org/docs/4_runtime_application_security_threats/' },
  testing: { label: 'AI security testing', url: 'https://owaspai.org/docs/5_testing/' },
  privacy: { label: 'AI privacy', url: 'https://owaspai.org/docs/6_privacy/' },
};

const saifFor = (risk) => ({ risk, who: SAIF_RISKS[risk].who, controls: SAIF_RISKS[risk].controls });

export const SCENARIOS = [
  /* ---------------------------------------------------------------- 1 */
  {
    id: 'rag-injection',
    number: 1,
    title: 'Indirect prompt injection through RAG',
    family: 'Untrusted content steers the model',
    context: 'A shop assistant answers policy questions using a shared knowledge base that any signed-in user can add to. The question is what happens when one entry carries instructions instead of facts.',
    components: ['browser', 'api', 'rag', 'chroma', 'sqlite', 'chat', 'ollama'],
    assets: [
      'Integrity of answers and of stated policy',
      'Confidentiality of data placed in the prompt (at Level 0 chat this includes other customers\' records)',
      'User trust in the assistant',
    ],
    attacker: {
      assumptions: [
        'A signed-in low-privilege user (demo tokens are public by design, and signup is open).',
        'Cannot read the database or call Ollama directly.',
      ],
      prerequisites: [
        'The entry is indexed and a later query retrieves it.',
        'The model follows or repeats the embedded text.',
        'For data theft: sensitive data is in the same prompt AND an output channel to the attacker exists.',
      ],
    },
    boundaries: ['tb-client', 'tb-model'],
    attackPath: [
      { text: 'The attacker adds a knowledge-base entry whose text reads like an instruction. The API accepts it from any authenticated user and tags it user-injected.', evidence: 'verified', refs: ['app/api/rag.py'], nodes: ['api', 'rag'] },
      { text: 'The entry is chunked, embedded and stored in ChromaDB after sync.', evidence: 'verified', refs: ['app/rag/service.py', 'app/rag/retrieval.py'], nodes: ['rag', 'chroma'] },
      { text: 'A different user asks a question that is semantically close, so the chunk can rank into the top results. Ranking manipulation (keyword stuffing) is the subject of lab llm09-2.', evidence: 'hypothesis', nodes: ['chroma', 'rag'] },
      { text: 'chat.cracky queries the vector store directly, so the retrieval-control chain used by retrieve_trace is not on this path.', evidence: 'verified', refs: ['app/surfaces/chat_cracky.py'], nodes: ['chat', 'chroma'] },
      { text: 'The model may treat the retrieved text as an instruction. Model behaviour is probabilistic; the labs measure it rather than assume it.', evidence: 'hypothesis', nodes: ['ollama'] },
      { text: 'Result: a manipulated answer. Data exfiltration is a separate outcome that needs sensitive data in context and an outbound channel, such as output the browser renders as HTML or a markdown image (the Level 0 chat renders raw HTML).', evidence: 'needs-validation', nodes: ['chat', 'browser'] },
    ],
    conditions: 'Prompt injection does not automatically mean exfiltration. It needs (1) sensitive data in the same context, (2) a way for the output to reach the attacker, and (3) a model that complies. Without all three, the realistic impact is a manipulated answer.',
    lenses: {
      discovery: {
        framework: 'Attack Trees and STRIDE',
        finds: [
          { text: 'Attack tree, root "make the assistant return attacker-chosen content": branches are a direct KB entry, a keyword-stuffed entry, instructions split across two entries, or a review used as the channel (lab llm02-3).', evidence: 'hypothesis' },
          { text: 'Attack tree, root "disclose another user\'s data": AND-node requiring sensitive data in context plus an outbound channel. This is a different tree from the first.', evidence: 'hypothesis' },
          { text: 'STRIDE Spoofing on the ingestion flow: the create schema accepts caller-supplied trust_tier and owner_id, so provenance fields are not set only by the server.', evidence: 'verified', refs: ['app/api/rag.py'], flags: ['byDesign'] },
          { text: 'STRIDE Elevation of privilege at the model boundary: untrusted text gains instruction authority once concatenated into the prompt.', evidence: 'hypothesis' },
        ],
        unique: 'The tree shows that "inject" and "steal" are different goals with different prerequisites. STRIDE shows the writable provenance fields.',
      },
      context: {
        atlas: [
          { id: 'AML.T0051.001', name: 'LLM Prompt Injection: Indirect' },
          { id: 'AML.T0070', name: 'RAG Poisoning' },
          { id: 'AML.T0071', name: 'False RAG Entry Injection' },
          { id: 'AML.T0066', name: 'Retrieval Content Crafting' },
        ],
        owasp: [
          { code: 'LLM01', name: 'Prompt Injection', list: 'OWASP LLM Top 10 2026' },
          { code: 'LLM09', name: 'Vector and Embedding Weaknesses', list: 'OWASP LLM Top 10 2026' },
          { code: 'ASI06', name: 'Memory & Context Poisoning', list: 'OWASP Agentic 2026 (applies if an agent reads this content; hypothetical extension here)' },
        ],
        finds: [
          { text: 'ATLAS names the technique chain: craft retrieval content, inject a false RAG entry, then indirect prompt injection.', evidence: 'verified', flags: [] },
          { text: 'OWASP LLM09 adds ranking and embedding weaknesses (stuffing, outranking) that a pure injection view misses.', evidence: 'verified', flags: [] },
        ],
        unique: 'ATLAS gives the ordered technique chain and IDs for tests. OWASP gives the weakness class names for reporting.',
      },
      saif: {
        areas: ['Model', 'Application'],
        components: ['Input Handling', 'The Model', 'Application', 'Agent (agent extension: Orchestration, Content for RAG)'],
        risks: [saifFor('Prompt Injection')],
        agentNote: 'In the SAIF agent extension, RAG content is an orchestration component and its main security risk is described as data poisoning of the knowledge source.',
        analytical: [
          'AIGoat is a model consumer in SAIF terms: it uses a local model inside an application, so consumer-side controls apply.',
          'AIGoat\'s retrieval.injection_scan (Level 2) is a retrieval-time form of input validation; SAIF does not name a retrieval-specific control, so this mapping is analytical.',
        ],
        uncertain: 'SAIF does not rate likelihood for your system and does not define a retrieval access control by name.',
        unique: 'SAIF places the risk in the Model and Application areas, says who can mitigate it, and lists candidate controls from one official catalog. It does not say which AIGoat retrieval path is weaker.',
      },
      aix: {
        threats: ['Indirect prompt injection', 'Augmentation data manipulation (runtime, section 4.7)'],
        controls: ['PROMPT INJECTION I/O HANDLING', 'INPUT SEGREGATION', 'AUGMENTATION DATA INTEGRITY', 'LEAST MODEL PRIVILEGE', 'OVERSIGHT'],
        sections: [AIX.overview, AIX.runtime, AIX.testing],
        analytical: [
          'The Exchange says the limits of these controls increase the importance of blast radius control, so pair input controls with least privilege on whatever the model can reach.',
          'Its testing section includes RAG system and prompt injection testing, which maps directly to AIGoat labs llm01-4 and llm01-5.',
        ],
        limitation: 'Controls reduce the chance and impact; none of them makes the model follow only trusted instructions.',
        unique: "The AI Exchange adds named runtime threats and controls for augmentation data, and a testing section that maps to existing labs. It does not rank AIGoat's retrieval paths.",
      },
      risk: {
        framework: 'PASTA stage 7 and NIST AI RMF',
        finds: [
          { text: 'PASTA: the business objective is trustworthy policy answers. Impact is wrong or manipulated policy, reputational harm and, only under the extra conditions above, data disclosure.', evidence: 'hypothesis' },
          { text: 'NIST AI RMF Measure: lab llm01-4 and llm09 evaluators act as measurements of whether injected retrieval changes behaviour.', evidence: 'verified', refs: ['config/labs/'] },
        ],
        unique: 'Separates "wrong answer" impact from "data theft" impact, so the fix order follows impact rather than technique.',
      },
    },
    overlap: 'Every lens agrees that untrusted text reaches the model. The differences are what each adds: goals and prerequisites (trees), writable provenance (STRIDE), technique chain (ATLAS), weakness class (OWASP), component placement and controls (SAIF), control detail and tests (AI Exchange), impact ordering (PASTA).',
    risk: {
      likelihood: 'High in the Level 0 training setup, because any signed-in user can write to the corpus. In a real product it depends on who may write to the knowledge base.',
      impact: 'Manipulated answers are likely. Data disclosure and downstream actions need extra conditions that this page does not confirm end to end.',
      rationale: 'Low attacker cost, probabilistic model compliance, bounded impact unless a tool or sensitive context is reachable.',
      assumptions: ['AIGoat Level 0 settings', 'Qualitative rating by AIGoat, not a measured value'],
    },
    mitigations: [
      { text: 'Retrieval provenance shown to the learner (Level 1 and 2 rag.kb profile).', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Does not stop injected text from being used.' },
      { text: 'Retrieval ACL and injection scan on retrieved chunks (Level 2 rag.kb profile).', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Pattern-based scans miss paraphrase; chat.cracky\'s direct vector query does not run these retrieval controls.' },
      { text: 'Output moderation and NeMo rails on chat (Level 1 and 2).', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Reduces leakage channels such as HTML and URLs, not the manipulation itself.' },
      { text: 'Restrict who can write to the knowledge base and require review for new entries.', state: 'candidate', limit: 'Not implemented in AIGoat. Adds workflow cost.' },
      { text: 'Mark untrusted retrieved text clearly in the prompt (input segregation) and route chat retrieval through the same control chain.', state: 'candidate', limit: 'Not implemented in AIGoat. Helps but is not a guarantee.' },
    ],
    residual: [
      'A model can still follow paraphrased instructions that no pattern catches.',
      'Controls on the direct vector-query path are weaker than on the retrieve_trace path.',
    ],
    uncertain: [
      'No end-to-end exfiltration test is claimed here; only the preconditions are listed.',
      'Whether an agent in AIGoat reads knowledge-base content is not established; that would be a hypothetical extension.',
    ],
    labs: ['llm01-4', 'llm01-5', 'llm09-1', 'llm09-2', 'llm02-3', 'llm02-4'],
  },

  /* ---------------------------------------------------------------- 2 */
  {
    id: 'mcp-tool-abuse',
    number: 2,
    title: 'MCP tool abuse and excessive agency',
    family: 'Untrusted tool metadata steers a privileged planner',
    context: 'An admin assistant lists tools from MCP servers and calls them. One server is a lookalike community package. The question is what an untrusted description or result can make the assistant do.',
    components: ['browser', 'api', 'mcpclient', 'mcphost', 'mcpservers', 'ollama', 'sqlite'],
    assets: [
      'Integrity of tool selection and arguments',
      'Admin-level capabilities (refunds, customer export)',
      'Customer records and order state',
    ],
    attacker: {
      assumptions: [
        'Controls text the planner reads: a tool description or result from an untrusted or lookalike server.',
        'Has no admin credential of their own.',
      ],
      prerequisites: [
        'The lookalike server is reachable by the client or host (in AIGoat, a lab enables it).',
        'The planner acts on the injected text.',
        'An overpowered tool is available to the session.',
      ],
    },
    boundaries: ['tb-tools', 'tb-model'],
    attackPath: [
      { text: 'The client or host lists tools. The registry holds four servers with trust tiers, including one untrusted lookalike.', evidence: 'verified', refs: ['config/mcp_servers.yml'], nodes: ['mcpclient', 'mcpservers'] },
      { text: 'A description or result from that server carries instructions addressed to the planner.', evidence: 'hypothesis', nodes: ['mcpservers'] },
      { text: 'At Level 0 descriptions return verbatim and no MCP control runs. mcp.client labs use a deterministic scripted planner; mcp.host uses the live model client.', evidence: 'verified', refs: ['config/defense_profiles.yml', 'app/mcp/victim_planner.py', 'app/mcp/host.py'], nodes: ['mcpclient', 'mcphost'] },
      { text: 'The planner may choose a tool or arguments the user did not request.', evidence: 'hypothesis', nodes: ['mcphost', 'ollama'] },
      { text: 'For staff sessions in admin labs, tools such as lookup_any_order, issue_refund_any and export_customer_data_any are registered and do not check object ownership.', evidence: 'verified', refs: ['app/agent/admin_tools.py', 'app/agent/service.py'], nodes: ['mcphost', 'sqlite'] },
    ],
    conditions: 'Steering the planner (a description or prompt manipulation problem) is different from an authorization weakness. The first changes which call is made. The second means the call should have been refused no matter who or what asked. Fixing only one leaves the other.',
    lenses: {
      discovery: {
        framework: 'STRIDE and Attack Trees',
        finds: [
          { text: 'STRIDE Spoofing: a lookalike server impersonates the official catalogue server (lab mcp09-1).', evidence: 'verified', refs: ['config/mcp_servers.yml'] },
          { text: 'STRIDE Tampering: a description changes between listing and calling (rug-pull). Level 1 restores pinned descriptions.', evidence: 'verified', refs: ['config/defense_profiles.yml'] },
          { text: 'STRIDE Elevation of privilege: admin tools lack per-object checks, so an obedient planner can act on any customer.', evidence: 'verified', refs: ['app/agent/admin_tools.py'], flags: ['byDesign'] },
          { text: 'Attack tree, root "unauthorised refund or export": poisoned description, poisoned tool result, lookalike server, or misuse of a decoy credential in a result (lab mcp01-1). One approval-and-authorization control cuts several branches.', evidence: 'hypothesis' },
        ],
        unique: 'STRIDE enumerates failure types per boundary. The tree shows several routes to the same outcome and which control cuts most of them.',
      },
      context: {
        atlas: [
          { id: 'AML.T0053', name: 'AI Agent Tool Invocation' },
          { id: 'AML.T0110', name: 'AI Agent Tool Poisoning' },
          { id: 'AML.T0099', name: 'AI Agent Tool Data Poisoning' },
          { id: 'AML.T0086', name: 'Exfiltration via AI Agent Tool Invocation' },
        ],
        owasp: [
          { code: 'LLM03', name: 'Excessive Agency', list: 'OWASP LLM Top 10 2026' },
          { code: 'ASI02', name: 'Tool Misuse and Exploitation', list: 'OWASP Agentic 2026' },
          { code: 'ASI01', name: 'Agent Goal Hijack', list: 'OWASP Agentic 2026' },
          { code: 'MCP03', name: 'Tool Poisoning', list: 'OWASP MCP Top 10 (beta, identifiers may change)' },
          { code: 'MCP09', name: 'Shadow MCP Servers', list: 'OWASP MCP Top 10 (beta, identifiers may change)' },
        ],
        finds: [
          { text: 'ATLAS names tool poisoning, tool data poisoning and tool invocation as separate techniques, which separates description attacks from result attacks.', evidence: 'verified' },
          { text: 'The OWASP MCP list is labelled beta in the repo manifest; treat its identifiers as unstable.', evidence: 'verified', refs: ['config/frameworks/owasp-mcp-2025.yml'] },
        ],
        unique: 'ATLAS separates description, data and invocation attacks. OWASP names the excessive-agency and shadow-server classes.',
      },
      saif: {
        areas: ['Application'],
        components: ['Agent (tools)', 'Agent extension: Orchestration, Tools'],
        risks: [saifFor('Insecure Integrated Component'), saifFor('Rogue Actions')],
        agentNote: 'The SAIF agent extension describes tools as external APIs that must run with least-privilege permissions and warns about deceptive descriptions on third-party tools.',
        analytical: [
          'AIGoat\'s tool.allowlist, tool.approval and telemetry loosely correspond to SAIF Agent Permissions, Agent User Control and Agent Observability. This correspondence is analytical, not an official mapping.',
        ],
        uncertain: 'SAIF does not say which tool in your system is overprivileged; that needs your own inventory.',
        unique: 'SAIF treats tools as integrated components in the agent extension and maps Insecure Integrated Component and Rogue Actions to named controls, so the fix list comes from an official catalog rather than from the attack tree.',
      },
      aix: {
        threats: ['Indirect prompt injection', 'Agent escape', 'Agent sandboxing and isolation (runtime, sections 4.8 and 4.9)'],
        controls: ['LEAST MODEL PRIVILEGE', 'OVERSIGHT', 'INPUT SEGREGATION', 'PROMPT INJECTION I/O HANDLING', 'MONITOR USE'],
        sections: [AIX.overview, AIX.general, AIX.runtime],
        analytical: [
          'The Exchange agentic overview states that prompt injections can invoke unwanted actions or escalate privileges and that blast radius control is key.',
          'It also notes that human oversight has downsides such as approval fatigue, so approval should not be the only control.',
        ],
        limitation: 'Controls limit blast radius; they do not make tool descriptions trustworthy.',
        unique: 'The AI Exchange adds agent escape and sandboxing threats with controls such as LEAST MODEL PRIVILEGE and OVERSIGHT, and notes that these limit blast radius rather than prevent manipulation.',
      },
      risk: {
        framework: 'PASTA stages 5 to 7 and NIST AI RMF',
        finds: [
          { text: 'PASTA: unauthorised refunds or customer exports are the business-impact events; they are cheap to attempt and expensive to reverse.', evidence: 'hypothesis' },
          { text: 'NIST AI RMF Manage: raising a lab from Level 0 to Level 2 is the documented treatment path in AIGoat.', evidence: 'verified', refs: ['config/defense_profiles.yml'] },
        ],
        unique: 'Ranks the abuse paths by business impact and names the owner of the treatment decision.',
      },
    },
    overlap: 'Trees, ATLAS and OWASP all describe tool steering. The distinct contributions are: STRIDE flags the missing per-object authorization separately from steering; ATLAS separates description from result attacks; SAIF and the AI Exchange point to permission and oversight controls.',
    risk: {
      likelihood: 'Moderate to high in lab settings where an untrusted server is enabled and the admin assistant runs at Level 0. Low in a real deployment that only connects vetted servers.',
      impact: 'High for the admin tools: cross-customer data and money movement.',
      rationale: 'Impact is driven by tool privilege, not by the model. The likelihood depends on whether untrusted servers can be connected.',
      assumptions: ['mcp.host enabled (not enabled in Docker config)', 'Qualitative rating by AIGoat'],
    },
    mitigations: [
      { text: 'Tool allowlist and description pinning (Level 1 mcp.client).', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Pinning needs a known-good baseline.' },
      { text: 'Description scan, schema pin and result scan (Level 2 mcp.client).', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Pattern and contract based; novel phrasing can pass.' },
      { text: 'Origin pin, tool approval and object authorization for the host assistant (Level 2 mcp.host profile).', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Approval can be rubber-stamped; only as strong as the authorization check.' },
      { text: 'MCP child processes receive an allow-listed environment, so repo secrets are not inherited.', state: 'implemented', refs: ['app/mcp/env.py'], limit: 'Contains the subprocess environment only; it does not constrain what the tool does.' },
      { text: 'Enforce per-object authorization inside every privileged tool, independent of the model.', state: 'candidate', limit: 'The admin tools do not do this; it is a design change, not a prompt change.' },
    ],
    residual: [
      'A vetted server can still return hostile data in a result.',
      'Approval dialogs can be approved by habit.',
    ],
    uncertain: [
      'mcp.client labs use a scripted planner, so they show the control logic, not live model behaviour.',
      'No remote MCP servers exist in the repo, so network-level server risks are out of scope.',
    ],
    labs: ['mcp03-1', 'mcp09-1', 'mcp01-1', 'mcp04-1', 'asi01-1', 'asi04-1'],
  },

  /* ---------------------------------------------------------------- 3 */
  {
    id: 'data-leakage',
    number: 3,
    title: 'Sensitive data leakage across RAG, context and persistence',
    family: 'Data reaches a principal who should not see it',
    context: 'The shop assistant builds prompts from orders, customer data and knowledge-base text, returns replies to the browser, and records telemetry. The question is where that data can travel beyond its owner.',
    components: ['browser', 'chat', 'rag', 'sqlite', 'chroma', 'ollama'],
    assets: [
      'Customer profile and order data, including (fake) card numbers',
      'System prompt content',
      'Other users\' knowledge-base documents',
      'Chat history and telemetry previews',
    ],
    attacker: {
      assumptions: [
        'Another signed-in customer, or the same customer on a shared computer.',
        'No database access.',
      ],
      prerequisites: [
        'Level 0 or Level 1 settings for the context scope.',
        'For KB documents: retrieval is not authorization-aware (before Level 2).',
      ],
    },
    boundaries: ['tb-model', 'tb-client'],
    attackPath: [
      { text: 'A user sends a message. At Level 0 the prompt context includes every order and unmasked customer data, regardless of who is asking.', evidence: 'verified', refs: ['app/surfaces/chat_cracky.py'], nodes: ['chat', 'sqlite'], flags: ['byDesign'] },
      { text: 'The model may repeat that context in its reply.', evidence: 'hypothesis', nodes: ['ollama'] },
      { text: 'The reply is rendered in the browser and shop chat history is stored in localStorage.', evidence: 'verified', refs: ['frontend/src/components/ChatBot.js'], nodes: ['browser'] },
      { text: 'Retrieval before Level 2 is not authorization-aware, so another user\'s knowledge-base document can be retrieved (lab llm02-4).', evidence: 'verified', refs: ['config/defense_profiles.yml'], nodes: ['rag', 'chroma'], flags: ['byDesign'] },
      { text: 'Telemetry logs a 200-character message preview and writes a database row. No retention or purge code was found in app/.', evidence: 'verified', refs: ['app/defense/telemetry.py'], nodes: ['sqlite'], flags: ['absence'] },
    ],
    conditions: 'Access-control enforcement is a code decision, not a prompt decision. Tenant isolation does not apply because AIGoat has one shared database and one shared vector store. A multi-tenant version would be a hypothetical extension and needs isolation designed in.',
    lenses: {
      discovery: {
        framework: 'LINDDUN and STRIDE',
        finds: [
          { text: 'LINDDUN Data disclosure: more personal data is placed in context than the question needs (Level 0).', evidence: 'verified', refs: ['app/surfaces/chat_cracky.py'], flags: ['byDesign'] },
          { text: 'LINDDUN Linking and Identifying: orders, profile and knowledge-base text with owner ids sit in stores that can be combined in one prompt.', evidence: 'hypothesis' },
          { text: 'LINDDUN Unawareness and Non-compliance: nothing in the repo tells users that a message preview is logged or defines how long it is kept.', evidence: 'needs-validation' },
          { text: 'STRIDE Information disclosure on the chat-to-database and rag-to-vector-store flows; Tampering of owner_id, which is caller-supplied on create.', evidence: 'verified', refs: ['app/api/rag.py'] },
        ],
        unique: 'LINDDUN raises privacy harms STRIDE does not name (linking, awareness, retention). STRIDE ties disclosure to specific flows and to the writable owner field.',
      },
      context: {
        atlas: [
          { id: 'AML.T0057', name: 'LLM Data Leakage' },
          { id: 'AML.T0056', name: 'Extract LLM System Prompt' },
          { id: 'AML.T0085', name: 'Data from AI Services' },
        ],
        owasp: [
          { code: 'LLM02', name: 'Sensitive Information Disclosure', list: 'OWASP LLM Top 10 2026' },
          { code: 'LLM08', name: 'Hidden Context Exposure', list: 'OWASP LLM Top 10 2026' },
          { code: 'LLM09', name: 'Vector and Embedding Weaknesses', list: 'OWASP LLM Top 10 2026' },
        ],
        finds: [
          { text: 'OWASP separates sensitive information in context (LLM02) from hidden prompt content (LLM08) and from retrieval access weaknesses (LLM09). Three different fixes.', evidence: 'verified' },
        ],
        unique: 'ATLAS names the leakage and system-prompt extraction techniques; OWASP splits the problem into three weakness classes.',
      },
      saif: {
        areas: ['Application', 'Model', 'Infrastructure'],
        components: ['Application', 'Output Handling', 'Data and Model Storage', 'Data Filtering and Processing'],
        risks: [saifFor('Sensitive Data Disclosure')],
        agentNote: 'SAIF also names Excessive Data Handling, which it ties to collection, retention and sharing beyond policy; its listed control is User Data Management. That risk is relevant to the telemetry retention question.',
        analytical: [
          'Mapping Excessive Data Handling to the telemetry rows is an analytical reading of the SAIF risk, because SAIF describes it mainly for model creators.',
        ],
        uncertain: 'SAIF lists controls but does not define how much context is "too much" for your product.',
        unique: "SAIF frames leakage as Sensitive Data Disclosure and names the controls and the party that owns them. It does not say which fields in AIGoat's prompt are sensitive.",
      },
      aix: {
        threats: ['Input data leak (runtime, section 4.5)', 'Direct augmentation data leak (runtime, section 4.6)'],
        controls: ['MODEL INPUT CONFIDENTIALITY', 'AUGMENTATION DATA CONFIDENTIALITY', 'SENSITIVE OUTPUT HANDLING', 'DATA MINIMIZE', 'ALLOWED DATA'],
        sections: [AIX.runtime, AIX.general, AIX.privacy],
        analytical: [
          'The Exchange groups data limitation controls (such as DATA MINIMIZE) separately and has an AI privacy section; that is the natural source for retention and consent questions.',
        ],
        limitation: 'Data limitation reduces exposure but does not substitute for an authorization check before the data is selected.',
        unique: 'The AI Exchange covers both the input leak and the augmentation data leak, and links them to data limitation controls (DATA MINIMIZE, ALLOWED DATA, SHORT RETAIN) plus a privacy section.',
      },
      risk: {
        framework: 'PASTA and NIST AI RMF',
        finds: [
          { text: 'PASTA attacker objective: obtain other customers\' card or contact data. Business impact: privacy harm and loss of trust. The Level 0 context scope is the highest-impact item and is by design in the lab.', evidence: 'hypothesis' },
          { text: 'NIST AI RMF Map: documenting which data classes enter the prompt is the first step; Measure is the lab evaluators.', evidence: 'verified', refs: ['config/labs/'] },
        ],
        unique: 'Prioritises by data class and impact instead of by technique.',
      },
    },
    overlap: 'All lenses agree that too much data reaches a place it should not. The distinct contributions are privacy harms and retention (LINDDUN), flow-level disclosure (STRIDE), three weakness classes (OWASP), SAIF risk and User Data Management, and AI Exchange data-limitation and privacy guidance.',
    risk: {
      likelihood: 'High at Level 0 by design. Lower at Level 1 (orders limited to the caller) and Level 2 (no user, order or coupon context).',
      impact: 'High for personal and payment-like data in a real shop. Here the data is fake.',
      rationale: 'The exposure is built into the Level 0 context scope; levels 1 and 2 reduce it by removing data from the prompt.',
      assumptions: ['Seed data is fake', 'Qualitative rating by AIGoat'],
    },
    mitigations: [
      { text: 'Orders limited to the caller (Level 1 chat context).', state: 'implemented', refs: ['app/surfaces/chat_cracky.py'], limit: 'Customer profile data is still in context.' },
      { text: 'No user, order or coupon context at Level 2.', state: 'implemented', refs: ['app/surfaces/chat_cracky.py'], limit: 'The assistant can no longer answer order questions from context.' },
      { text: 'Output moderation masks card numbers and emails (Level 1) and applies a stricter pass at Level 2.', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Pattern masking misses reformatted values.' },
      { text: 'Authorization-aware retrieval (Level 2 rag.kb).', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Not on the chat.cracky direct vector-query path.' },
      { text: 'Define and enforce retention for telemetry previews and chat history; add a user-facing notice.', state: 'candidate', limit: 'Not implemented in AIGoat.' },
    ],
    residual: [
      'Masking and moderation are best-effort.',
      'localStorage history remains readable on a shared computer.',
    ],
    uncertain: [
      'Whether the model reproduces context depends on the model and prompt; the labs measure it.',
      'Retention of telemetry rows beyond the code searched was not audited on a running instance.',
    ],
    labs: ['llm02-1', 'llm02-2', 'llm02-4', 'llm08-1'],
  },

  /* ---------------------------------------------------------------- 4 */
  {
    id: 'agent-escalation',
    number: 4,
    title: 'Agent privilege escalation and unauthorized downstream actions',
    family: 'The model asks, the application decides',
    context: 'The shop agent can look up orders and issue refunds; an admin agent has cross-customer tools. The question is which layer actually decides whether a refund or export is allowed.',
    components: ['browser', 'api', 'agent', 'sqlite', 'ollama'],
    assets: [
      'Order state and refund integrity',
      'Other customers\' data',
      'Integrity of agent memory',
      'Approval workflow',
    ],
    attacker: {
      assumptions: [
        'A signed-in customer steering their own agent, or an author of content (a review or a support ticket) that an admin assistant later reads.',
      ],
      prerequisites: [
        'Level 0 or Level 1: no tool approval is enforced.',
        'For cross-customer impact: an admin session with admin tools registered.',
      ],
    },
    boundaries: ['tb-client', 'tb-model'],
    attackPath: [
      { text: 'The user gives the agent a goal that implies a refund.', evidence: 'verified', refs: ['config/labs/'], nodes: ['browser', 'agent'] },
      { text: 'The model proposes issue_refund. The Intent Gate is the only path to a tool; at Level 0 it invokes the tool without an allowlist or approval.', evidence: 'verified', refs: ['app/agent/broker.py'], nodes: ['agent'], flags: ['byDesign'] },
      { text: 'The shop agent\'s tools filter orders by the calling user id, so this path refunds the caller\'s own orders. That is excessive agency, but not cross-customer access.', evidence: 'verified', refs: ['app/agent/tools.py'], nodes: ['agent', 'sqlite'] },
      { text: 'A stored memory note such as "refunds are pre-approved" can influence a later plan (lab asi06-1).', evidence: 'hypothesis', nodes: ['agent'] },
      { text: 'For staff in admin labs, issue_refund_any and export_customer_data_any act on any customer, and the admin tools read user-written content (list_support_tickets, read_review). That is a confused-deputy channel.', evidence: 'verified', refs: ['app/agent/admin_tools.py', 'app/agent/service.py'], nodes: ['agent', 'sqlite'], flags: ['byDesign'] },
      { text: 'Whether a non-admin can actually make an admin agent follow instructions planted in a ticket or review has to be tested; this page does not claim it.', evidence: 'needs-validation', nodes: ['agent'] },
    ],
    conditions: 'Keep four layers apart. Model intent is probabilistic and steerable. Tool availability decides what can be called. Application authorization decides whose objects a call may touch. Downstream authorization decides whether the write is allowed at all. The LLM is not an access-control layer.',
    lenses: {
      discovery: {
        framework: 'Attack Trees and STRIDE',
        finds: [
          { text: 'Attack tree, root "refund an order without authorization": steer the model, poison memory, poison a tool result, abuse an admin tool, or act as an admin.', evidence: 'hypothesis' },
          { text: 'STRIDE Elevation of privilege: the shop tools check ownership in code (verified), the admin tools do not (verified, by design).', evidence: 'verified', refs: ['app/agent/tools.py', 'app/agent/admin_tools.py'] },
          { text: 'STRIDE Repudiation: at Level 0 no approval record exists for a refund; whether other audit records exist was not audited.', evidence: 'needs-validation' },
        ],
        unique: 'The tree lists routes. STRIDE shows where the authorization decision lives (shop tools: in code; admin tools: not).',
      },
      context: {
        atlas: [
          { id: 'AML.T0053', name: 'AI Agent Tool Invocation' },
          { id: 'AML.T0080', name: 'AI Agent Context Poisoning' },
          { id: 'AML.T0086', name: 'Exfiltration via AI Agent Tool Invocation' },
        ],
        owasp: [
          { code: 'LLM03', name: 'Excessive Agency', list: 'OWASP LLM Top 10 2026' },
          { code: 'ASI03', name: 'Identity and Privilege Abuse', list: 'OWASP Agentic 2026' },
          { code: 'ASI06', name: 'Memory & Context Poisoning', list: 'OWASP Agentic 2026' },
          { code: 'ASI09', name: 'Human-Agent Trust Exploitation', list: 'OWASP Agentic 2026' },
        ],
        finds: [
          { text: 'OWASP Agentic separates identity and privilege abuse (ASI03) from human-agent trust exploitation (ASI09, the approval dialog).', evidence: 'verified' },
        ],
        unique: 'ATLAS names context poisoning and tool invocation. OWASP Agentic names the identity and approval-trust classes.',
      },
      saif: {
        areas: ['Application'],
        components: ['Agent', 'Agent extension: Reasoning core, Orchestration (agent memory, tools)'],
        risks: [saifFor('Rogue Actions'), saifFor('Insecure Integrated Component')],
        agentNote: 'The SAIF agent extension names agent memory (which becomes a risk if malicious data is stored or memory is not isolated between users) and tools (least-privilege permissions) as orchestration components.',
        analytical: [
          'AIGoat\'s tool.approval corresponds loosely to Agent User Control, and the per-user filter in the shop tools to Agent Permissions. This is an analytical correspondence.',
        ],
        uncertain: 'SAIF does not tell you whether your admin tools should exist; that is a product decision.',
        unique: "SAIF names Rogue Actions and the agent's tool and orchestration components, so the privilege question is placed on the layer that must enforce it instead of on the model.",
      },
      aix: {
        threats: ['Agent escape (runtime, section 4.8)', 'Augmentation data manipulation (agent memory, runtime section 4.7)'],
        controls: ['LEAST MODEL PRIVILEGE', 'OVERSIGHT', 'MONITOR USE', 'INPUT SEGREGATION', 'PROMPT INJECTION I/O HANDLING'],
        sections: [AIX.overview, AIX.general, AIX.runtime, AIX.testing],
        analytical: [
          'The runtime section says to treat vector store and shared agent memory content as an untrusted input surface, which applies to the memory-note path.',
          'The testing section includes agentic AI security testing, which fits the asi labs.',
        ],
        limitation: 'Least privilege helps only if the privilege check is enforced outside the model, as the shop tools do.',
        unique: 'The AI Exchange ties agent privilege to LEAST MODEL PRIVILEGE and OVERSIGHT and to augmentation data manipulation when memory is involved, which the other lenses do not name.',
      },
      risk: {
        framework: 'PASTA and NIST AI RMF',
        finds: [
          { text: 'PASTA: attacker goals are free refunds and another customer\'s data; consequences are financial loss and privacy harm. The shop agent path is limited to the caller\'s own orders; the admin path is where impact concentrates.', evidence: 'verified', refs: ['app/agent/tools.py', 'app/agent/admin_tools.py'] },
          { text: 'NIST AI RMF Govern: someone must own the decision to give an agent write tools and the approval policy.', evidence: 'hypothesis' },
        ],
        unique: 'Focuses attention on the admin tools rather than on the shop agent.',
      },
    },
    overlap: 'All lenses agree the model should not be the access-control layer. The distinct contributions are: route enumeration (trees), the location of the authorization check (STRIDE), memory and identity classes (OWASP Agentic), agent permission and user-control controls (SAIF), and untrusted-memory and testing guidance (AI Exchange).',
    risk: {
      likelihood: 'High for self-refund at Level 0 and Level 1 (no approval). Admin-path abuse depends on whether a non-admin can influence what the admin agent reads, which needs testing.',
      impact: 'Low for the shop agent in this repo (own orders only). High for admin tools.',
      rationale: 'Impact is set by the tool, not by the model; the repo shows the shop tools check ownership and the admin tools do not.',
      assumptions: ['Admin labs enabled for a staff user', 'Qualitative rating by AIGoat'],
    },
    mitigations: [
      { text: 'Tool allowlist at Level 1.', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'A listed refund tool still runs with whatever arguments the model chose.' },
      { text: 'Tool approval, coupon policy, memory scan and tool-result scan at Level 2.', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Approval can be rubber-stamped; scans are pattern-based.' },
      { text: 'Ownership filter inside shop tools (lookup_order, issue_refund).', state: 'implemented', refs: ['app/agent/tools.py'], limit: 'The same filter is absent in the admin tool variants.' },
      { text: 'Per-object authorization and re-authentication inside every admin tool; separate read-only and write tools.', state: 'candidate', limit: 'Not implemented in AIGoat. This is the control that removes the confused-deputy risk.' },
    ],
    residual: [
      'Approval fatigue and rubber-stamping.',
      'Pattern scans on memory and results miss paraphrase.',
    ],
    uncertain: [
      'Cross-principal injection into the admin assistant was not tested for this page.',
      'Audit records beyond telemetry were not audited.',
    ],
    labs: ['llm03-1', 'llm03-2', 'asi03-1', 'asi06-1', 'asi09-1', 'asi02-1'],
  },

  /* ---------------------------------------------------------------- 5 */
  {
    id: 'supply-chain',
    number: 5,
    title: 'AI supply-chain compromise and integrity risks',
    family: 'An upstream artifact is not what you think it is',
    context: 'AIGoat pulls a model, an embedding model, Python and npm packages, container base images and MCP servers from outside the repo. The question is what a compromised upstream could change and how far it would spread.',
    components: ['pkgs', 'registry', 'hfhub', 'ollama', 'chroma', 'rag', 'mcpservers', 'mcphost', 'api'],
    assets: [
      'Integrity of model behaviour',
      'Integrity of the retrieval index and embeddings',
      'Integrity of tool servers and their descriptions',
      'Integrity of the build and the backend process',
    ],
    attacker: {
      assumptions: [
        'Can influence an upstream artifact: a package release, a model tag, a base image tag, a community Modelfile, or an MCP server a user adds.',
        'Has no direct access to the AIGoat host.',
      ],
      prerequisites: [
        'The operator installs or pulls without pinning to a digest or verifying provenance.',
        'For MCP: an untrusted server is added to the registry (in AIGoat, a lab fixture does this).',
      ],
    },
    boundaries: ['tb-external', 'tb-tools'],
    attackPath: [
      { text: 'Model artifact: setup pulls the model by name with ollama pull. No digest pinning was found in scripts/start.sh.', evidence: 'verified', refs: ['scripts/start.sh'], nodes: ['registry', 'ollama'], flags: ['absence'] },
      { text: 'Community model: lab llm04-1 simulates a community-published Modelfile with a hidden trigger through a lab prompt; it is not a real pulled artifact.', evidence: 'verified', refs: ['prompts/labs/supply_chain.md'], nodes: ['ollama'], flags: ['byDesign'] },
      { text: 'Dependencies: requirements.txt uses open lower bounds, and images are built FROM unpinned tags. A new upstream release could change behaviour between installs.', evidence: 'verified', refs: ['requirements.txt', 'docker/Dockerfile', 'frontend/Dockerfile'], nodes: ['pkgs', 'api'] },
      { text: 'Ingestion source: the embedding model is downloaded on first use by sentence-transformers; no revision pin was found.', evidence: 'verified', refs: ['app/rag/embeddings.py'], nodes: ['hfhub', 'chroma'], flags: ['absence'] },
      { text: 'MCP components: servers are allow-listed with trust tiers, and a lookalike untrusted server exists as a lab fixture (mcp04-1, asi04-1). Child processes get an allow-listed environment.', evidence: 'verified', refs: ['config/mcp_servers.yml', 'app/mcp/env.py'], nodes: ['mcpservers', 'mcphost'] },
      { text: 'Propagation: a compromised package runs inside the backend process with database access; a changed model affects every surface because all share one Ollama instance.', evidence: 'hypothesis', nodes: ['api', 'ollama'] },
      { text: 'Whether any installed dependency currently has a known vulnerability was not scanned for this page.', evidence: 'needs-validation', nodes: ['pkgs'] },
    ],
    conditions: 'A supply-chain compromise needs a path from the attacker to an artifact you consume. The prerequisites differ per artifact: models need a pull of a changed tag, packages need an install of a new release, MCP servers need to be added to the registry. The repo shows missing pins; that is a gap in integrity assurance, not by itself a compromise.',
    lenses: {
      discovery: {
        framework: 'STRIDE and Attack Trees',
        finds: [
          { text: 'STRIDE Spoofing and Tampering on every external download arrow (model, embedding model, packages, images).', evidence: 'hypothesis' },
          { text: 'Attack tree, root "change model or tool behaviour in a deployment": poisoned model tag, poisoned package, lookalike MCP server, tampered base image. Pinning by digest cuts several branches at once.', evidence: 'hypothesis' },
        ],
        unique: 'STRIDE keeps every download arrow in view. The tree shows that digest and version pinning is a shared control.',
      },
      context: {
        atlas: [{ id: 'AML.T0010', name: 'AI Supply Chain Compromise' }],
        owasp: [
          { code: 'LLM04', name: 'Supply Chain', list: 'OWASP LLM Top 10 2026' },
          { code: 'LLM05', name: 'Data and Model Poisoning', list: 'OWASP LLM Top 10 2026' },
          { code: 'ASI04', name: 'Agentic Supply Chain Vulnerabilities', list: 'OWASP Agentic 2026' },
          { code: 'MCP04', name: 'Software Supply Chain Attacks & Dependency Tampering', list: 'OWASP MCP Top 10 (beta, identifiers may change)' },
          { code: 'MCP09', name: 'Shadow MCP Servers', list: 'OWASP MCP Top 10 (beta, identifiers may change)' },
        ],
        finds: [
          { text: 'ATLAS has a single umbrella technique for AI supply-chain compromise; the OWASP lists split it into model, agent and MCP variants.', evidence: 'verified' },
        ],
        unique: 'ATLAS gives one technique ID to test against; OWASP names model, agent and MCP variants.',
      },
      saif: {
        areas: ['Infrastructure', 'Data', 'Application'],
        components: ['Model Frameworks and Code', 'Data and Model Storage', 'Model Serving', 'Data Sources'],
        risks: [saifFor('Model Source Tampering'), saifFor('Model Deployment Tampering'), saifFor('Data Poisoning')],
        agentNote: 'SAIF defines these risks mainly for model creators. AIGoat is a model consumer, so the relevant lesson is verifying what you consume. The controls are still the ones SAIF lists.',
        analytical: [
          'For a model consumer, Model and Data Inventory Management and Model and Data Integrity Management translate to keeping an inventory of pulled models and packages and verifying them before use. This translation is analytical.',
        ],
        uncertain: 'SAIF does not prescribe pinning mechanisms for Ollama, pip or npm.',
        unique: 'SAIF is the only lens here that separates tampering with a model source from tampering with a deployment, and it says these are mainly model-creator risks, which clarifies what AIGoat can and cannot control.',
      },
      aix: {
        threats: ['Supply-chain model poisoning (development time, section 3.1.3)', 'Data poisoning (development time, section 3.1.1)'],
        controls: ['SUPPLY CHAIN MANAGE', 'DEV SECURITY', 'SEGREGATE DATA', 'CONTINUOUS VALIDATION'],
        sections: [AIX.devtime, AIX.general, AIX.overview],
        analytical: [
          'The Exchange describes the data and model supply chain as untrusted data, third-party models, external hosting and inherited vulnerabilities, with SUPPLY CHAIN MANAGE as the central control.',
        ],
        limitation: 'Supply-chain controls verify provenance; they cannot prove a model is free of hidden behaviour.',
        unique: 'The AI Exchange links supply-chain model poisoning to SUPPLY CHAIN MANAGE and DEV SECURITY and treats development time as a separate phase from runtime.',
      },
      risk: {
        framework: 'PASTA and NIST AI RMF',
        finds: [
          { text: 'PASTA: the impact depends on what the compromised artifact can reach. A package reaches the backend process; a model reaches every surface; an MCP server reaches its tools.', evidence: 'hypothesis' },
          { text: 'NIST AI RMF Govern and Map: third-party components are a named risk area, and an inventory of them is the first step.', evidence: 'hypothesis' },
        ],
        unique: 'Orders the artifacts by blast radius rather than by how likely each is to be attacked.',
      },
    },
    overlap: 'All lenses agree on the artifacts and on integrity assurance. The distinct contributions are the per-arrow review (STRIDE), shared pinning control (tree), the ATLAS technique and OWASP variants, SAIF component placement, and AI Exchange supply-chain controls and testing.',
    risk: {
      likelihood: 'Unknown from the repo. Missing pins raise exposure; actual likelihood depends on the upstream sources and on how often the operator reinstalls.',
      impact: 'Potentially high because one Ollama model and one backend process serve every surface.',
      rationale: 'Wide blast radius, but a real compromise requires a successful attack on an upstream source that this page did not assess.',
      assumptions: ['No dependency scan was run', 'Qualitative rating by AIGoat'],
    },
    mitigations: [
      { text: 'MCP servers are allow-listed and argv never comes from a request.', state: 'implemented', refs: ['config/mcp_servers.yml', 'app/mcp/registry.py'], limit: 'Does not make an allow-listed community server trustworthy.' },
      { text: 'MCP child processes receive an allow-listed environment (PYTHONPATH deliberately absent).', state: 'implemented', refs: ['app/mcp/env.py'], limit: 'Contains inherited secrets only.' },
      { text: 'Level 1 and 2 MCP profiles pin descriptions, schemas and origin.', state: 'implemented', refs: ['config/defense_profiles.yml'], limit: 'Needs a trusted baseline.' },
      { text: 'Frontend installs use package-lock.json with npm ci in CI.', state: 'implemented', refs: ['frontend/package-lock.json', '.github/workflows/ci.yml'], limit: 'Applies to npm only.' },
      { text: 'Pin Python dependencies, container images and the model by digest or hash; verify and inventory them.', state: 'candidate', limit: 'Not implemented in AIGoat. Adds update effort.' },
      { text: 'Run a dependency vulnerability scan in CI.', state: 'candidate', limit: 'Not implemented in AIGoat. Finds known issues only.' },
    ],
    residual: [
      'A pinned artifact can still be malicious from the start.',
      'Hidden model behaviour is hard to detect by inspection.',
    ],
    uncertain: [
      'No dependency vulnerability scan was run for this page.',
      'llm04-1 is a simulation; it does not show that a real Ollama registry artifact was compromised.',
    ],
    labs: ['llm04-1', 'mcp04-1', 'asi04-1', 'mcp09-1'],
  },

  /* ---------------------------------------------------------------- 6 */
  {
    id: 'unbounded-consumption',
    number: 6,
    title: 'Unbounded consumption and AI service availability',
    family: 'A shared model runs out of capacity',
    context: 'Every surface shares one local Ollama instance and one backend. The question is how one learner can degrade the service for others, and what limits exist.',
    components: ['browser', 'edge', 'api', 'chat', 'rag', 'agent', 'mcpclient', 'chroma', 'ollama', 'mcpservers'],
    assets: [
      'Availability of the shared Ollama instance and backend',
      'Host CPU, GPU and memory',
      'Operator time to recover',
    ],
    attacker: {
      assumptions: [
        'Any signed-in user. Demo tokens are public and signup is open.',
      ],
      prerequisites: [
        'Ability to send many requests, large requests or requests that cause long generations.',
      ],
    },
    boundaries: ['tb-client', 'tb-model'],
    attackPath: [
      { text: 'Large inputs: ChatRequest.message has no length limit in the schema. Level 1 and Level 2 input validation refuse messages over 2000 and 1000 characters.', evidence: 'verified', refs: ['app/schemas/chat.py', 'app/defense/input_validator.py'], nodes: ['chat'], flags: ['absence'] },
      { text: 'Excessive output: generation is capped by num_predict (chat.max_tokens 2048). Level 1 truncates chat output past 1000 characters.', evidence: 'verified', refs: ['config/config.yml', 'app/surfaces/chat_cracky.py', 'config/defense_profiles.yml'], nodes: ['chat', 'ollama'] },
      { text: 'Retrieval amplification: the trace endpoint passes a caller-supplied top_k to retrieval with no upper bound in that path. The prompt context is capped at 1500 tokens, which bounds the prompt but not the retrieval work.', evidence: 'verified', refs: ['app/rag/service.py', 'app/schemas/rag.py'], nodes: ['rag', 'chroma'], flags: ['absence'] },
      { text: 'Agent loops: a run stops at max_steps 8. No cap on simultaneous runs per user was found in the agent service or routes.', evidence: 'verified', refs: ['app/agent/loop.py', 'config/config.yml'], nodes: ['agent', 'ollama'], flags: ['absence'] },
      { text: 'Concurrency: MCP sessions are capped by a semaphore of 2. Ollama calls have a 90-second timeout. No API rate limiting was found in app/.', evidence: 'verified', refs: ['app/mcp/client.py', 'config/config.yml', 'app/'], nodes: ['mcpclient', 'ollama', 'api'], flags: ['absence'] },
      { text: 'Effect: many parallel or long requests could queue behind one local model and delay other users. The size of that effect depends on hardware and was not measured.', evidence: 'needs-validation', nodes: ['ollama'] },
    ],
    conditions: 'Cost exposure applies to local compute only: AIGoat has no per-token billing and no cloud provider. A cloud-hosted variant would be a hypothetical extension where the same paths become direct spend. A missing rate limit is a missing control, not by itself a confirmed denial-of-service finding.',
    lenses: {
      discovery: {
        framework: 'STRIDE and Attack Trees',
        finds: [
          { text: 'STRIDE Denial of service on the edge proxy, API, Ollama, ChromaDB and SQLite.', evidence: 'hypothesis' },
          { text: 'Attack tree, root "degrade service for other learners": flood requests, send very large inputs, force maximum-length output, trigger agent or MCP loops, or inflate retrieval with a large top_k. Rate and concurrency limits cut the most branches.', evidence: 'hypothesis' },
        ],
        unique: 'STRIDE lists the components that can saturate. The tree shows that one rate and concurrency control covers several branches.',
      },
      context: {
        atlas: [
          { id: 'AML.T0029', name: 'Denial of AI Service' },
          { id: 'AML.T0034', name: 'Cost Harvesting' },
        ],
        owasp: [
          { code: 'LLM06', name: 'Unbounded Consumption', list: 'OWASP LLM Top 10 2026' },
        ],
        finds: [
          { text: 'ATLAS separates denial of service from cost harvesting. In AIGoat only the first has a local analogue; the second would need a metered provider.', evidence: 'verified' },
        ],
        unique: 'ATLAS splits availability from cost; OWASP names the class and ties it to rate limiting and resource controls.',
      },
      saif: {
        areas: ['Application', 'Model'],
        components: ['Application', 'Input Handling', 'Model Serving'],
        risks: [saifFor('Denial of ML Service')],
        agentNote: 'SAIF describes this risk as arising in the application component when a model is exposed to excessive access, including energy-latency attacks with "sponge examples". The listed control is Application Access Management.',
        analytical: [
          'Application Access Management is an access control, so rate and concurrency limits are an analytical reading of it for this repo.',
        ],
        uncertain: 'SAIF gives no numeric limits and does not describe local-only deployments.',
        unique: "SAIF names Denial of ML Service as an application-level risk and lists its controls. It gives no limits, so the numbers come from AIGoat's own configuration.",
      },
      aix: {
        threats: ['Runtime resilience and abuse (overview)', 'Agent sandboxing and isolation resource quotas (runtime, section 4.9)'],
        controls: ['RATE LIMIT', 'DOS INPUT VALIDATION', 'LIMIT RESOURCES', 'MONITOR USE', 'MODEL ACCESS CONTROL'],
        sections: [AIX.overview, AIX.general, AIX.runtime],
        analytical: [
          'The runtime section says per-agent quotas for CPU, memory, API volume, tool invocations and wall-clock time should be enforced by the platform, not by agent self-management.',
        ],
        limitation: 'Quotas help against volume but not against one expensive, well-formed request.',
        unique: 'The AI Exchange adds RATE LIMIT, LIMIT RESOURCES and DOS INPUT VALIDATION as named controls and a testing section, which complements the per-component view of STRIDE.',
      },
      risk: {
        framework: 'PASTA and NIST AI RMF',
        finds: [
          { text: 'PASTA: the business impact is training-environment unavailability for other learners. No direct financial loss exists locally.', evidence: 'hypothesis' },
          { text: 'NIST AI RMF Measure: the lab llm06-1 measures output size; there is no load or latency measurement in the repo.', evidence: 'verified', refs: ['config/labs/'], flags: ['absence'] },
        ],
        unique: 'Keeps the impact honest: availability for learners, not money, unless a metered provider is added.',
      },
    },
    overlap: 'All lenses agree on the controls family: limits on rate, size, loops and concurrency. The distinct contributions are the component list (STRIDE), shared control (tree), the DoS versus cost split (ATLAS), the SAIF risk and its access-management control, and the AI Exchange named runtime controls and platform-enforced quotas.',
    risk: {
      likelihood: 'Plausible given no rate limiting and open signup, but not measured.',
      impact: 'Local availability loss for a training environment; no per-token cost.',
      rationale: 'Easy to attempt, bounded impact in a lab, and the real effect depends on hardware.',
      assumptions: ['Single local Ollama instance', 'Qualitative rating by AIGoat'],
    },
    mitigations: [
      { text: 'Input length limits at Level 1 (2000 characters) and Level 2 (1000 characters).', state: 'implemented', refs: ['app/defense/input_validator.py'], limit: 'Not applied to rag.kb queries, whose profile has no input validation.' },
      { text: 'Output cap (num_predict 2048) and Level 1 and 2 output truncation or moderation.', state: 'implemented', refs: ['config/config.yml', 'config/defense_profiles.yml'], limit: 'Caps tokens, not request count.' },
      { text: 'Agent step cap (8) and MCP concurrency cap (2); 90-second Ollama timeout.', state: 'implemented', refs: ['config/config.yml'], limit: 'No per-user cap on simultaneous agent runs was found.' },
      { text: 'Per-user and per-IP rate limits and concurrency caps at the proxy or API.', state: 'candidate', limit: 'Not implemented in AIGoat. Needs tuning to avoid blocking legitimate users.' },
      { text: 'Clamp top_k and request size; add request queueing with load shedding; alert on sustained load.', state: 'candidate', limit: 'Not implemented in AIGoat.' },
    ],
    residual: [
      'A single expensive request can still tie up the one local model.',
      'Sponge-style inputs target worst-case latency and are hard to filter.',
    ],
    uncertain: [
      'No load test was run; the real effect on a given host is unknown.',
      'Whether the published Ollama port is reachable by other hosts depends on the host network.',
    ],
    labs: ['llm06-1'],
  },
];

export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

export const SCENARIO_LENS_ORDER = ['discovery', 'context', 'saif', 'aix', 'risk'];

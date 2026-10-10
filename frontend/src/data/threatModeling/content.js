/**
 * Prose and reference data for the intro, "why it matters" and references
 * sections. No hardcoded secrets, no telemetry. Links were checked for an HTTP
 * 200 response when this file was written (2026-10-09).
 */

export const LINKS_CHECKED_ON = '2026-10-09';

export const INTRO = {
  lead: 'Threat modeling is a structured way to ask what can go wrong in a system you have drawn, before an attacker answers it for you. This workbench applies it to AIGoat itself.',
  steps: [
    { title: 'See the architecture', body: 'Start with the diagram. Every box and arrow is in the repo, and each cites its source files.' },
    { title: 'Pick a framework for the question', body: 'Frameworks answer different questions. The explorer and the selection guide show which one fits.' },
    { title: 'Work a scenario', body: 'Six scenarios show how methods, attack knowledge, SAIF and the AI Exchange look at the same system.' },
  ],
  legendIntro: 'Read every claim by its label. Nothing here calls a missing control or a hypothetical path a confirmed vulnerability.',
};

export const WHY_IT_MATTERS = [
  {
    id: 'probabilistic',
    title: 'Model behaviour is probabilistic',
    body: 'A model follows instructions most of the time, not every time. A rule written in a prompt is a request, not an enforced policy, so the design cannot depend on the model obeying it.',
    aigoat: 'Level 0 prompts hold guidance only; Levels 1 and 2 add code-level controls around the model.',
  },
  {
    id: 'injection',
    title: 'Direct and indirect prompt injection',
    body: 'Direct injection arrives in the user message. Indirect injection arrives through content the system fetches: documents, web pages, tool results. Both exploit that instructions and data share one text channel.',
    aigoat: 'Labs llm01-1 (direct) and llm01-4 (indirect through a retrieved document).',
  },
  {
    id: 'retrieval',
    title: 'Retrieved content is untrusted',
    body: 'Anything that can be indexed can be retrieved and placed in a prompt. Who may write to the index, and how ranking can be manipulated, are security questions.',
    aigoat: 'Any signed-in user can add a knowledge-base entry; labs llm09-1 and llm09-2.',
  },
  {
    id: 'tools',
    title: 'Tools, MCP and agent autonomy',
    body: 'When a model can call tools, a wrong decision becomes an action. Tool descriptions and results are inputs too, and a connected server is part of your trust boundary.',
    aigoat: 'agent.runner tools and MCP stdio servers with trust tiers.',
  },
  {
    id: 'confused-deputy',
    title: 'Excessive permissions and confused deputies',
    body: 'An agent that holds more privilege than the person asking can be steered into using it for them. Authorization has to be checked in code on the object, outside the model.',
    aigoat: 'Shop tools filter by caller id; admin tools do not (by design in the admin labs).',
  },
  {
    id: 'privacy',
    title: 'Sensitive data and privacy',
    body: 'Data placed in a prompt can come back out. Logs, history and embeddings are further copies. Threat modeling asks where each copy lives and who can read it.',
    aigoat: 'The Level 0 chat context scope, localStorage chat history and telemetry previews.',
  },
  {
    id: 'multi-step',
    title: 'Multi-step paths across components',
    body: 'Each component can look reasonable alone while a path across three of them is unsafe: untrusted content, then retrieval, then a tool, then a database write.',
    aigoat: 'Scenarios 2 and 4 chain retrieval or tool content into a write.',
  },
  {
    id: 'third-party',
    title: 'Third-party models and dependencies',
    body: 'Models, embeddings, packages, images and tool servers come from outside. You inherit their integrity, which makes pinning and provenance part of the model.',
    aigoat: 'Scenario 5, including lab llm04-1 (a simulated community Modelfile).',
  },
  {
    id: 'consumption',
    title: 'Resource exhaustion and uncontrolled consumption',
    body: 'Inference is expensive and shared. Limits on rate, input size, output size, loops and concurrency are availability controls and, with a metered provider, cost controls.',
    aigoat: 'Scenario 6 and lab llm06-1.',
  },
  {
    id: 'tradeoffs',
    title: 'Security trade-offs',
    body: 'Every control costs something. Tight output filters reduce helpfulness, approvals add friction and invite rubber-stamping, and strict retrieval hides useful documents. Threat modeling makes the trade-off explicit and owned.',
    aigoat: 'Level 2 removes order context entirely, so the assistant can no longer answer order questions from it.',
  },
];

export const PRACTICES = [
  {
    id: 'threat-modeling',
    name: 'Threat modeling',
    asks: 'What could go wrong in this design, and what should we build in?',
    when: 'Design and every significant change.',
    output: 'A list of threats, assumptions and chosen mitigations tied to a diagram.',
    note: 'Finds design flaws before there is anything to scan.',
  },
  {
    id: 'red-teaming',
    name: 'AI red teaming',
    asks: 'Can an adversary make this system misbehave in practice?',
    when: 'After there is a running system or prototype.',
    output: 'Demonstrated attacks, transcripts and impact.',
    note: 'Validates threat model hypotheses and finds ones nobody imagined. It does not replace a design review.',
  },
  {
    id: 'scanning',
    name: 'Vulnerability scanning',
    asks: 'Do known weaknesses exist in components and dependencies?',
    when: 'Continuously, in CI and on deployed assets.',
    output: 'A list of known issues with versions.',
    note: 'Good at known issues. Blind to design flaws and to model behaviour.',
  },
  {
    id: 'pentest',
    name: 'Penetration testing',
    asks: 'Can a tester break into the deployed system?',
    when: 'Before release and periodically.',
    output: 'Exploited findings in a defined scope.',
    note: 'Covers conventional paths well. AI-specific paths need AI-aware testers and scope.',
  },
  {
    id: 'risk-mgmt',
    name: 'AI risk management',
    asks: 'Who owns each AI risk, how is it measured, and what do we accept?',
    when: 'Continuously, at organisation level.',
    output: 'Risk register, owners, metrics and accepted residual risk.',
    note: 'Gives threat modeling its priorities and gives findings an owner.',
  },
];

export const PRACTICE_COMPLEMENT = 'They complement each other: threat modeling produces hypotheses and priorities; red teaming and penetration testing validate them; scanning keeps known issues down; risk management decides what to accept and who owns it.';

export const LIFECYCLE = [
  { id: 'assets', title: 'Identify assets and trust boundaries', body: 'List what you must protect and draw where trust changes: browser to server, app to model, app to tools, local to external.' },
  { id: 'enumerate', title: 'Enumerate threats', body: 'Walk each element and flow with a method such as STRIDE, LINDDUN or attack trees, and enrich with ATLAS, SAIF and the AI Exchange.' },
  { id: 'evaluate', title: 'Evaluate risk', body: 'Rate likelihood and impact with stated assumptions. Separate verified facts from hypotheses.' },
  { id: 'mitigate', title: 'Select mitigations', body: 'Prefer controls enforced in code outside the model. Record the cost, the residual risk and the owner.' },
  { id: 'validate', title: 'Validate assumptions', body: 'Test the hypotheses: run the lab, red team the path, scan the dependency. Move claims from hypothesis to verified or discard them.' },
  { id: 'revisit', title: 'Revisit when the architecture changes', body: 'A new tool, a new data source or a new model changes the diagram. Update it and repeat.' },
];

export const REFERENCE_GROUPS = [
  {
    id: 'saif',
    title: 'Google SAIF',
    items: [
      { label: 'SAIF home', url: 'https://saif.google', note: 'Overview and SAIF Map tour.' },
      { label: 'SAIF Map (Secure AI Framework)', url: 'https://saif.google/secure-ai-framework', note: 'Four component areas: Data, Infrastructure, Model, Application.' },
      { label: 'SAIF components', url: 'https://saif.google/secure-ai-framework/components', note: 'Component descriptions.' },
      { label: 'SAIF risks', url: 'https://saif.google/secure-ai-framework/risks', note: 'Risks mapped to controls and to model creators or consumers.' },
      { label: 'SAIF controls', url: 'https://saif.google/secure-ai-framework/controls', note: 'Control descriptions mapped to risks.' },
      { label: 'SAIF AI development primer', url: 'https://saif.google/ai-development-primer', note: 'The AI development lifecycle and its risks.' },
      { label: 'SAIF: focus on agents', url: 'https://saif.google/focus-on-agents', note: 'Agent components, risks and controls.' },
      { label: 'Google SAIF overview (six core elements)', url: 'https://safety.google/intl/en_us/safety/saif/', note: 'The original six core elements.' },
    ],
  },
  {
    id: 'aix',
    title: 'OWASP AI Exchange',
    items: [
      { label: 'OWASP AI Exchange project page', url: 'https://owasp.org/projects/ai-exchange', note: 'Flagship OWASP project.' },
      { label: 'OWASP AI Exchange website', url: 'https://owaspai.org', note: 'The full guidance.' },
      { label: 'AI security overview and risk analysis', url: 'https://owaspai.org/docs/ai_security_overview/', note: 'Threat map, agentic and RAG overviews, risk analysis.' },
      { label: 'General controls', url: 'https://owaspai.org/docs/1_general_controls/', note: 'Governance, data limitation, limiting unwanted behaviour.' },
      { label: 'Development-time threats', url: 'https://owaspai.org/docs/3_development_time_threats/', note: 'Poisoning and supply chain.' },
      { label: 'Runtime application security threats', url: 'https://owaspai.org/docs/4_runtime_application_security_threats/', note: 'Output injection, data leaks, agents.' },
      { label: 'AI security testing', url: 'https://owaspai.org/docs/5_testing/', note: 'Testing approaches including agentic and RAG.' },
      { label: 'AI privacy', url: 'https://owaspai.org/docs/6_privacy/', note: 'Privacy guidance for AI.' },
    ],
  },
  {
    id: 'owasp',
    title: 'OWASP vulnerability taxonomies',
    items: [
      { label: 'OWASP Top 10 for LLM Applications 2026', url: 'https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/', note: 'Published 2026-08-04.' },
      { label: 'OWASP GenAI Security Project: LLM Top 10', url: 'https://genai.owasp.org/llm-top-10/', note: 'Landing page for the list.' },
      { label: 'OWASP Top 10 for Agentic Applications 2026', url: 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/', note: 'Published 2025-12-09.' },
      { label: 'OWASP MCP Top 10', url: 'https://owasp.org/www-project-mcp-top-10/', note: 'Beta in the AIGoat manifest; identifiers may change.' },
    ],
  },
  {
    id: 'atlas',
    title: 'Attack knowledge base',
    items: [
      { label: 'MITRE ATLAS', url: 'https://atlas.mitre.org', note: 'Tactics, techniques, mitigations and case studies.' },
    ],
  },
  {
    id: 'nist',
    title: 'Risk management',
    items: [
      { label: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework', note: 'Program page.' },
      { label: 'NIST AI 100-1: AI RMF 1.0 (PDF)', url: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf', note: 'Govern, Map, Measure, Manage.' },
      { label: 'NIST AI 600-1: Generative AI Profile (PDF)', url: 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf', note: 'GenAI-specific risks and actions.' },
      { label: 'NIST AI 100-2 E2025: Adversarial Machine Learning', url: 'https://csrc.nist.gov/pubs/ai/100/2/e2025/final', note: 'Taxonomy and terminology of attacks and mitigations.' },
    ],
  },
  {
    id: 'methods',
    title: 'Threat modeling methods',
    items: [
      { label: 'STRIDE threats (Microsoft Threat Modeling Tool)', url: 'https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats', note: 'Six threat categories.' },
      { label: 'LINDDUN privacy threat types', url: 'https://linddun.org/threat-types/', note: 'Seven privacy threat types.' },
      { label: 'Attack Trees (Schneier, 1999)', url: 'https://www.schneier.com/academic/archives/1999/12/attack_trees.html', note: 'The original article.' },
      { label: 'Risk Centric Threat Modeling (PASTA, Wiley)', url: 'https://www.wiley.com/en-us/Risk+Centric+Threat+Modeling%3A+Process+for+Attack+Simulation+and+Threat+Analysis-p-9780470500965', note: 'Seven-stage process.' },
      { label: 'MAESTRO (Cloud Security Alliance)', url: 'https://labs.cloudsecurityalliance.org/maestro/', note: 'Layered threat modeling for agentic AI; mentioned for further reading.' },
    ],
  },
];

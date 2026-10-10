/**
 * Framework catalogue for the threat-modeling workbench.
 *
 * Titles, versions and URLs were checked against the official sources while
 * writing this file. Notes marked "AIGoat example" are teaching commentary,
 * not part of the upstream framework.
 *
 * The category is deliberate. Do not collapse them:
 *   methodology   - a repeatable way to find threats in a system you describe.
 *   ai-framework  - an AI security framework and risk-to-control resource.
 *   attack-kb     - a knowledge base of observed attacker behaviour.
 *   taxonomy      - a vulnerability or risk taxonomy with guidance.
 *   risk-mgmt     - an organisation-level risk management framework.
 */

export const FRAMEWORK_CATEGORIES = {
  methodology: {
    label: 'Threat modeling methodology',
    description: 'A repeatable process for finding threats in a system you have drawn.',
  },
  'ai-framework': {
    label: 'AI security framework and risk-to-control resource',
    description: 'Maps AI-specific risks to controls across the AI lifecycle. Not a step-by-step threat modeling method.',
  },
  'attack-kb': {
    label: 'Attack knowledge base',
    description: 'Observed adversary tactics and techniques against AI systems.',
  },
  taxonomy: {
    label: 'Vulnerability taxonomy and guidance',
    description: 'A ranked list of weakness classes with guidance. A vocabulary, not a method.',
  },
  'risk-mgmt': {
    label: 'Risk management framework',
    description: 'Organisation-level governance and risk management for AI.',
  },
};

export const FRAMEWORKS = [
  {
    id: 'stride',
    name: 'STRIDE',
    category: 'methodology',
    publisher: 'Microsoft',
    version: 'Established mnemonic (no version number)',
    purpose: 'Ask six questions of every element and data flow in a diagram: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.',
    bestTime: 'Design and review time, once you have a data-flow diagram.',
    scope: 'Components, data flows and trust boundaries of a system.',
    threatsFound: 'Per-element security threats, including those on AI-specific flows (prompt in, retrieved chunk in, tool result in, model output out).',
    strengths: ['Easy to teach and to apply to a diagram', 'Forces a question on every arrow, not only the ones people worry about'],
    limits: ['Says nothing AI-specific by itself', 'Does not rank or prioritise threats'],
    aigoatExample: 'Use the diagram above: for the arrow from the agent to the database, ask what Tampering and Elevation of privilege look like for issue_refund.',
    url: 'https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats',
    urlLabel: 'Microsoft Threat Modeling Tool: STRIDE threats',
  },
  {
    id: 'pasta',
    name: 'PASTA',
    category: 'methodology',
    publisher: 'Process for Attack Simulation and Threat Analysis (Wiley, 2015: Risk Centric Threat Modeling)',
    version: 'Seven stages',
    purpose: 'A risk-centric, seven-stage process: define objectives, define technical scope, application decomposition, threat analysis, vulnerability and weakness analysis, attack modeling, risk and impact analysis.',
    bestTime: 'When you need to tie technical threats to business impact and decide what to fix first.',
    scope: 'A whole application or product, from business objectives to residual risk.',
    threatsFound: 'Attack paths ranked by business impact. It is a process wrapper around other techniques.',
    strengths: ['Starts from business objectives', 'Combines threats, weaknesses and impact in one flow'],
    limits: ['Heavier than STRIDE', 'Not AI-specific; AI knowledge has to come from other sources'],
    aigoatExample: 'Stage 7 for a refund scenario: what does an unauthorised refund cost, and which control is cheapest to ship first?',
    url: 'https://www.wiley.com/en-us/Risk+Centric+Threat+Modeling%3A+Process+for+Attack+Simulation+and+Threat+Analysis-p-9780470500965',
    urlLabel: 'Risk Centric Threat Modeling (Wiley)',
  },
  {
    id: 'linddun',
    name: 'LINDDUN',
    category: 'methodology',
    publisher: 'LINDDUN privacy threat modeling project (linddun.org)',
    version: 'Seven threat types; LINDDUN GO and PRO variants',
    purpose: 'Privacy threat modeling over a data-flow diagram. Seven types: Linking, Identifying, Non-repudiation, Detecting, Data disclosure, Unawareness and unintervenability, Non-compliance.',
    bestTime: 'Whenever a flow carries personal data (prompts, orders, profiles, retrieved documents).',
    scope: 'Privacy threats on data flows, stores and processes.',
    threatsFound: 'Privacy threats such as linkage across stores, excessive disclosure, lack of user awareness or control.',
    strengths: ['Systematic privacy coverage that STRIDE lacks', 'Lightweight GO variant for workshops'],
    limits: ['Privacy only', 'Not AI-specific; model memorisation and inference need AI sources'],
    aigoatExample: 'The Level 0 chat prompt puts every customer\'s orders in context: ask which LINDDUN types that touches.',
    url: 'https://linddun.org/threat-types/',
    urlLabel: 'LINDDUN privacy threat types',
  },
  {
    id: 'attack-trees',
    name: 'Attack Trees',
    category: 'methodology',
    publisher: 'Bruce Schneier (1999)',
    version: 'Technique (no version number)',
    purpose: 'Put an attacker goal at the root and break it into AND/OR sub-goals down to concrete steps, then annotate leaves with cost, skill or likelihood.',
    bestTime: 'When one outcome matters most (for example an unauthorised refund) and you want to see every path to it.',
    scope: 'One attacker goal at a time.',
    threatsFound: 'Alternative paths to the same goal, and the cheapest path to cut.',
    strengths: ['Shows which single control removes the most paths', 'Works well with the output of STRIDE or ATLAS'],
    limits: ['One goal per tree', 'Quality depends on the analyst imagining the branches'],
    aigoatExample: 'Root: refund an order I do not own. Branches: steer the agent, poison its memory, poison a tool result, or abuse an admin tool.',
    url: 'https://www.schneier.com/academic/archives/1999/12/attack_trees.html',
    urlLabel: 'Attack Trees (Schneier, 1999)',
  },
  {
    id: 'atlas',
    name: 'MITRE ATLAS',
    category: 'attack-kb',
    publisher: 'MITRE',
    version: 'Content release v2026.09 (16 tactics, 120 techniques, 88 sub-techniques, 40 mitigations, 73 case studies)',
    purpose: 'A matrix of adversary tactics and techniques against AI-enabled systems, with mitigations and real case studies.',
    bestTime: 'After you know the architecture and want named, realistic attacker moves and detection ideas.',
    scope: 'Adversary behaviour against AI systems across the attack lifecycle.',
    threatsFound: 'Technique-level attack steps (for example AML.T0051.001 indirect prompt injection, AML.T0070 RAG poisoning, AML.T0053 AI agent tool invocation).',
    strengths: ['Names techniques with stable IDs', 'Grounded in observed attacks and case studies'],
    limits: ['A catalogue of attacker behaviour, not a method for finding threats in your design', 'Does not tell you which control to build'],
    aigoatExample: 'Use ATLAS IDs to label each step of an attack path found with STRIDE or an attack tree.',
    url: 'https://atlas.mitre.org',
    urlLabel: 'MITRE ATLAS',
  },
  {
    id: 'owasp-llm',
    name: 'OWASP Top 10 for LLM Applications (2026)',
    category: 'taxonomy',
    publisher: 'OWASP GenAI Security Project',
    version: '2026 edition, published 2026-08-04 (supersedes 2025)',
    purpose: 'Ten ranked weakness classes for LLM applications: LLM01 Prompt Injection through LLM10 Improper Output Handling.',
    bestTime: 'To name and communicate a weakness class once you have found a threat.',
    scope: 'Weakness classes in LLM-based applications.',
    threatsFound: 'Named weakness classes. It does not find threats in your design on its own.',
    strengths: ['Widely recognised vocabulary', 'Includes an application architecture and threat modeling appendix'],
    limits: ['A top-ten list, not a method or a complete control set', 'Edition numbering differs between 2025 and 2026'],
    aigoatExample: 'AIGoat labs carry an OWASP LLM 2026 primary risk, for example llm06-1 maps to LLM06 Unbounded Consumption.',
    url: 'https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/',
    urlLabel: 'OWASP Top 10 for LLM Applications 2026',
  },
  {
    id: 'owasp-agentic',
    name: 'OWASP Top 10 for Agentic Applications (2026)',
    category: 'taxonomy',
    publisher: 'OWASP GenAI Security Project',
    version: '2026, published 2025-12-09 (ASI01 to ASI10)',
    purpose: 'Ten ranked risk classes for autonomous, tool-using AI agents, such as ASI01 Agent Goal Hijack, ASI02 Tool Misuse and Exploitation and ASI03 Identity and Privilege Abuse.',
    bestTime: 'When the system plans, calls tools or acts across systems.',
    scope: 'Agentic applications: goals, tools, identity, memory, inter-agent communication.',
    threatsFound: 'Named agent-specific risk classes.',
    strengths: ['Covers agent concerns the LLM list only touches', 'Pairs well with an agent-flow diagram'],
    limits: ['A taxonomy, not a method', 'Newer; terminology is still settling'],
    aigoatExample: 'asi03-1 (export another customer) maps to ASI03 Identity and Privilege Abuse.',
    url: 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/',
    urlLabel: 'OWASP Top 10 for Agentic Applications 2026',
  },
  {
    id: 'nist-ai-rmf',
    name: 'NIST AI RMF',
    category: 'risk-mgmt',
    publisher: 'NIST',
    version: 'AI RMF 1.0 (NIST AI 100-1, January 2023); Generative AI Profile (NIST AI 600-1, July 2024); Adversarial ML taxonomy (NIST AI 100-2 E2025)',
    purpose: 'Govern, Map, Measure and Manage AI risk across an organisation. The Generative AI Profile adds GenAI-specific risks and actions; AI 100-2 gives a taxonomy of attacks and mitigations.',
    bestTime: 'Programme level: ownership, measurement, acceptance of residual risk.',
    scope: 'Organisation and system level risk management, including trustworthiness.',
    threatsFound: 'It does not find threats. It structures who owns risk, how it is measured and how it is treated.',
    strengths: ['Common language for risk owners and auditors', 'Voluntary and sector-neutral'],
    limits: ['No technical threat discovery', 'Needs a method such as STRIDE or PASTA beneath it'],
    aigoatExample: 'Level 0 is a documented teaching baseline (Map). Evaluators are Measure. Raising a lab to Level 2 is Manage.',
    url: 'https://www.nist.gov/itl/ai-risk-management-framework',
    urlLabel: 'NIST AI Risk Management Framework',
  },
  {
    id: 'saif',
    name: 'Google SAIF (Secure AI Framework)',
    category: 'ai-framework',
    publisher: 'Google',
    version: 'Living framework with a SAIF Map; risk map content shared with the Coalition for Secure AI (CoSAI)',
    purpose: 'Secure-by-default guidance for AI across the lifecycle. Six core elements, a SAIF Map with four component areas (Data, Infrastructure, Model, Application), AI-specific risks mapped to controls, and an agent extension.',
    bestTime: 'When you need to locate a risk in an AI component and pick candidate controls, as a model creator, a model consumer, or both.',
    scope: 'The AI development and deployment lifecycle, plus agentic systems.',
    threatsFound: 'Not a threat-discovery method. It names AI risks (for example Prompt Injection, Rogue Actions, Denial of ML Service) and maps each to controls and to the party that can mitigate it.',
    strengths: ['Places risks in components', 'Official risk-to-control mapping', 'Agent-specific components, risks and controls'],
    limits: ['The six elements are not chronological steps', 'It does not decide likelihood or business impact for you'],
    aigoatExample: 'AIGoat is a model consumer: it uses a local model inside an app and agents. The Application, Model and Agent parts of the map are the most relevant.',
    url: 'https://saif.google/secure-ai-framework',
    urlLabel: 'Google SAIF: Secure AI Framework',
    extraLinks: [
      { label: 'SAIF risks', url: 'https://saif.google/secure-ai-framework/risks' },
      { label: 'SAIF controls', url: 'https://saif.google/secure-ai-framework/controls' },
      { label: 'SAIF components', url: 'https://saif.google/secure-ai-framework/components' },
      { label: 'SAIF: focus on agents', url: 'https://saif.google/focus-on-agents' },
    ],
  },
  {
    id: 'owasp-ai-exchange',
    name: 'OWASP AI Exchange',
    category: 'ai-framework',
    publisher: 'OWASP (Flagship project)',
    version: 'Latest version 1.0 on the OWASP project page; living website of 200+ pages',
    purpose: 'A broad AI security and privacy resource: threats, controls, an AI security matrix, a periodic table of threats and controls, testing guidance, privacy guidance and a risk analysis section that includes a decision tree.',
    bestTime: 'When you need detailed, practical threat and control guidance for AI and data-centric systems, including agentic and RAG systems, and testing and privacy guidance.',
    scope: 'AI security and privacy across development time and runtime, for predictive and generative AI.',
    threatsFound: 'Threat families (for example development-time poisoning and supply chain, runtime input threats, augmentation data leak and manipulation, agent escape) each linked to named controls.',
    strengths: ['Threats and controls in one place', 'Covers testing and privacy', 'Includes an agentic AI overview and a RAG systems overview'],
    limits: ['Large; needs a risk analysis step to select what applies', 'Not a diagramming method; it works best next to one'],
    aigoatExample: 'For unbounded consumption, the Exchange names runtime controls such as RATE LIMIT, DOS INPUT VALIDATION and LIMIT RESOURCES.',
    url: 'https://owaspai.org',
    urlLabel: 'OWASP AI Exchange',
    extraLinks: [
      { label: 'AI security overview and risk analysis', url: 'https://owaspai.org/docs/ai_security_overview/' },
      { label: 'General controls', url: 'https://owaspai.org/docs/1_general_controls/' },
      { label: 'Development-time threats', url: 'https://owaspai.org/docs/3_development_time_threats/' },
      { label: 'Runtime application security threats', url: 'https://owaspai.org/docs/4_runtime_application_security_threats/' },
      { label: 'AI security testing', url: 'https://owaspai.org/docs/5_testing/' },
      { label: 'AI privacy', url: 'https://owaspai.org/docs/6_privacy/' },
      { label: 'OWASP project page', url: 'https://owasp.org/projects/ai-exchange' },
    ],
  },
];


/**
 * Comparison matrix columns that go beyond the card text. Each cell is a short
 * analytical statement by AIGoat. "None" means the resource does not do that
 * job; it is not a weakness of the resource.
 */
export const MATRIX_COLUMNS = [
  { key: 'purpose', label: 'Primary purpose' },
  { key: 'lifecycle', label: 'Scope and lifecycle coverage' },
  { key: 'discovery', label: 'Threat discovery' },
  { key: 'riskAssessment', label: 'Risk assessment' },
  { key: 'mitigation', label: 'Mitigation selection' },
  { key: 'bestUse', label: 'Best use' },
  { key: 'limits', label: 'Limits and complements' },
];

export const MATRIX = {
  stride: {
    purpose: 'Find threats per element and flow.',
    lifecycle: 'Design and review of a described system.',
    discovery: 'Strong: six questions on every element and arrow.',
    riskAssessment: 'None built in; pair with a rating method.',
    mitigation: 'Generic property-to-control hints only.',
    bestUse: 'First pass on a data-flow diagram.',
    limits: 'Not AI-specific. Add ATLAS, SAIF or the AI Exchange for AI content.',
  },
  pasta: {
    purpose: 'Link technical threats to business impact.',
    lifecycle: 'Business objectives through residual risk.',
    discovery: 'Moderate: threat and attack modeling stages.',
    riskAssessment: 'Strong: dedicated risk and impact stage.',
    mitigation: 'Prioritised by impact.',
    bestUse: 'Deciding what to fix first.',
    limits: 'Heavy; needs AI knowledge from other sources.',
  },
  linddun: {
    purpose: 'Find privacy threats.',
    lifecycle: 'Design and review of data flows.',
    discovery: 'Strong for privacy threats only.',
    riskAssessment: 'Light; prioritise with your own scale.',
    mitigation: 'Privacy-enhancing mitigation guidance.',
    bestUse: 'Any flow carrying personal data.',
    limits: 'Privacy only. Add STRIDE for security properties.',
  },
  'attack-trees': {
    purpose: 'Enumerate paths to one attacker goal.',
    lifecycle: 'Any stage once a goal is chosen.',
    discovery: 'Strong for one goal; none outside it.',
    riskAssessment: 'Leaf cost and likelihood ratings.',
    mitigation: 'Shows which control cuts the most paths.',
    bestUse: 'Deep dive on a high-value outcome.',
    limits: 'One goal per tree. Seed it from STRIDE or ATLAS.',
  },
  atlas: {
    purpose: 'Catalogue adversary techniques against AI.',
    lifecycle: 'Attack lifecycle from reconnaissance to impact.',
    discovery: 'Supplies technique ideas; not a method for your design.',
    riskAssessment: 'None; observed case studies inform likelihood.',
    mitigation: 'Lists technique-level mitigations.',
    bestUse: 'Naming attacker steps and planning tests.',
    limits: 'Attacker view only. Pair with a method and a control source.',
  },
  'owasp-llm': {
    purpose: 'Name ten weakness classes for LLM apps.',
    lifecycle: 'Application level.',
    discovery: 'A checklist of classes; not a method.',
    riskAssessment: 'Ranking only.',
    mitigation: 'Guidance per class.',
    bestUse: 'Shared vocabulary for findings.',
    limits: 'Top ten, not a full control set.',
  },
  'owasp-agentic': {
    purpose: 'Name ten risk classes for agentic apps.',
    lifecycle: 'Agent runtime and integration.',
    discovery: 'A checklist of agent risk classes.',
    riskAssessment: 'Ranking only.',
    mitigation: 'Guidance per class.',
    bestUse: 'Naming agent risks.',
    limits: 'Taxonomy, not a method.',
  },
  'nist-ai-rmf': {
    purpose: 'Govern, map, measure and manage AI risk.',
    lifecycle: 'Whole organisation and AI lifecycle.',
    discovery: 'None directly.',
    riskAssessment: 'Strong: structures measurement and ownership.',
    mitigation: 'Manage function; profile actions for GenAI.',
    bestUse: 'Governance and audit conversations.',
    limits: 'Needs a threat method beneath it.',
  },
  saif: {
    purpose: 'Locate AI risks in components and map them to controls.',
    lifecycle: 'Data, infrastructure, model and application, plus agents.',
    discovery: 'Prompts you with official AI risks per component; not a method.',
    riskAssessment: 'Risk self assessment and governance controls; no scoring for your system.',
    mitigation: 'Strong: official risk-to-control mapping and who can mitigate.',
    bestUse: 'Mapping AI risks and controls across the lifecycle.',
    limits: 'Complements STRIDE, PASTA, LINDDUN and attack trees; does not replace them.',
  },
  'owasp-ai-exchange': {
    purpose: 'Broad AI security and privacy threats, controls and tests.',
    lifecycle: 'Development time and runtime; predictive and generative AI.',
    discovery: 'Strong threat coverage and a risk-analysis decision tree; not a diagram method.',
    riskAssessment: 'Risk analysis section for selecting threats and controls.',
    mitigation: 'Strong: named controls, testing and privacy guidance.',
    bestUse: 'Enriching a threat inventory and choosing controls.',
    limits: 'Large; select with a risk analysis. Pair with a diagram method.',
  },
};

export const FRAMEWORK_BY_ID = Object.fromEntries(FRAMEWORKS.map((f) => [f.id, f]));

/** Official SAIF facts used by the scenarios and the SAIF explainer. */
export const SAIF_ELEMENTS = [
  'Expand strong security foundations to the AI ecosystem',
  'Extend detection and response to bring AI into an organization\u2019s threat universe',
  'Automate defenses to keep pace with existing and new threats',
  'Harmonize platform-level controls to ensure consistent security across the organization',
  'Adapt controls to adjust mitigations and create faster feedback loops for AI deployment',
  'Contextualize AI system risks in surrounding business processes',
];

export const SAIF_COMPONENT_AREAS = [
  { area: 'Data', components: ['Data Sources', 'Data Filtering and Processing', 'Training Data'] },
  { area: 'Infrastructure', components: ['Model Frameworks and Code', 'Training, Tuning, and Evaluation', 'Data and Model Storage', 'Model Serving'] },
  { area: 'Model', components: ['The Model', 'Input Handling', 'Output Handling'] },
  { area: 'Application', components: ['Application', 'Agent'] },
];

export const SAIF_AGENT_COMPONENTS = [
  'Application and Perception',
  'Reasoning core',
  'Orchestration (agent memory, tools, content for RAG, optional auxiliary models)',
  'Response rendering',
];

/**
 * Official SAIF risk to control mapping, copied from the SAIF risks page.
 * Only the risks used by the scenarios are listed. "who" is the party the SAIF
 * page says can mitigate the risk.
 */
export const SAIF_RISKS = {
  'Data Poisoning': { who: 'Model Creators', controls: ['Training Data Sanitization', 'Secure-by-Default ML Tooling', 'Model and Data Integrity Management', 'Model and Data Access Control', 'Model and Data Inventory Management'] },
  'Model Source Tampering': { who: 'Model Creators', controls: ['Secure-by-Default ML Tooling', 'Model and Data Integrity Management', 'Model and Data Access Control', 'Model and Data Inventory Management'] },
  'Model Deployment Tampering': { who: 'Model Creators, Model Consumers', controls: ['Secure-by-Default ML Tooling'] },
  'Denial of ML Service': { who: 'Model Consumers', controls: ['Application Access Management'] },
  'Insecure Integrated Component': { who: 'Model Consumers', controls: ['Agent Permissions'] },
  'Prompt Injection': { who: 'Model Creators, Model Consumers', controls: ['Input Validation and Sanitization', 'Adversarial Training and Testing', 'Output Validation and Sanitization'] },
  'Sensitive Data Disclosure': { who: 'Model Creators, Model Consumers', controls: ['Privacy Enhancing Technologies', 'User Data Management', 'Output Validation and Sanitization', 'Agent Permissions', 'Agent User Control', 'Agent Observability'] },
  'Insecure Model Output': { who: 'Model Consumers', controls: ['Output Validation and Sanitization'] },
  'Rogue Actions': { who: 'Model Consumers', controls: ['Agent Permissions', 'Agent User Control', 'Agent Observability', 'Output Validation and Sanitization'] },
};

/** OWASP AI Exchange control names that appear in the checked pages. */
export const AIX_CONTROLS = [
  'LEAST MODEL PRIVILEGE', 'INPUT SEGREGATION', 'PROMPT INJECTION I/O HANDLING', 'LIMIT RESOURCES',
  'RATE LIMIT', 'DOS INPUT VALIDATION', 'MONITOR USE', 'OVERSIGHT', 'MODEL ACCESS CONTROL',
  'AUGMENTATION DATA CONFIDENTIALITY', 'AUGMENTATION DATA INTEGRITY', 'ENCODE MODEL OUTPUT',
  'SENSITIVE OUTPUT HANDLING', 'DATA MINIMIZE', 'SUPPLY CHAIN MANAGE', 'DEV SECURITY',
  'SEGREGATE DATA', 'CONTINUOUS VALIDATION', 'MODEL INPUT CONFIDENTIALITY', 'ALLOWED DATA',
];

/**
 * Role each framework plays inside a scenario. Used to label the five lenses.
 * "discovery" lenses find threats; the others contextualise, map or manage them.
 */
export const LENS_ROLES = [
  {
    id: 'discovery',
    label: 'Threat discovery',
    frameworks: 'STRIDE, LINDDUN or Attack Trees',
    description: 'Finds threats in the diagram. Use the one that fits; do not force all three.',
  },
  {
    id: 'context',
    label: 'Attack and vulnerability context',
    frameworks: 'MITRE ATLAS and OWASP guidance',
    description: 'Names the attacker technique (ATLAS) and the weakness class (OWASP LLM, OWASP Agentic).',
  },
  {
    id: 'saif',
    label: 'Google SAIF',
    frameworks: 'Google SAIF',
    description: 'Places the risk in an AI component area, names the official SAIF risk, and lists the official candidate controls.',
  },
  {
    id: 'aix',
    label: 'OWASP AI Exchange',
    frameworks: 'OWASP AI Exchange',
    description: 'Gives AI security and privacy threat, control, testing and guidance content for the same scenario.',
  },
  {
    id: 'risk',
    label: 'Business impact and risk management',
    frameworks: 'PASTA or NIST AI RMF',
    description: 'Ties the technical threat to impact and ownership.',
  },
];

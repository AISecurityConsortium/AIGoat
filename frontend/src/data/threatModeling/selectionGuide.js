/**
 * Framework selection guide.
 *
 * Each entry is a situation, not a framework. The recommendation is AIGoat
 * teaching guidance (an analytical recommendation), not an official ruling by
 * any framework body. Ids refer to FRAMEWORKS in ./frameworks.js.
 */

export const SELECTION_GUIDE = [
  {
    id: 'locate-ai-risk',
    situation: 'I need to see where AI-specific risks sit in my AI system and which controls apply.',
    primary: 'saif',
    why: 'SAIF places each risk in a component area (Data, Infrastructure, Model, Application, plus the agent extension) and maps each risk to named controls and to the party that can mitigate it.',
    uncovers: 'Which component owns the risk, whether you are the model creator or the model consumer, and candidate controls for that risk.',
    complementary: ['owasp-ai-exchange', 'stride'],
    complementaryNote: 'Use STRIDE on your own diagram to find threats, then use SAIF to locate and control them. Use the AI Exchange for deeper control detail.',
  },
  {
    id: 'detailed-ai-guidance',
    situation: 'I need detailed AI security and privacy threats, controls and testing guidance, including for RAG and agents.',
    primary: 'owasp-ai-exchange',
    why: 'The AI Exchange covers development-time and runtime threats, a control set, an AI security matrix, testing guidance, privacy guidance and a risk analysis section with a decision tree.',
    uncovers: 'Threat families such as augmentation data leak or manipulation, supply-chain model poisoning and agent escape, each linked to named controls and tests.',
    complementary: ['saif', 'atlas'],
    complementaryNote: 'Pair with SAIF for component placement and with ATLAS for named attacker techniques.',
  },
  {
    id: 'diagram-threats',
    situation: 'I have an architecture diagram and want to find threats per component and data flow.',
    primary: 'stride',
    why: 'STRIDE is a per-element, per-flow checklist that works on any data-flow diagram, including the AI flows on this page.',
    uncovers: 'Spoofing, tampering, repudiation, disclosure, denial of service and privilege escalation on each arrow and store.',
    complementary: ['atlas', 'owasp-ai-exchange'],
    complementaryNote: 'Label each threat with an ATLAS technique and look up controls in the AI Exchange or SAIF.',
  },
  {
    id: 'agent-paths',
    situation: 'I need every plausible path to an agent taking an unauthorised action.',
    primary: 'attack-trees',
    why: 'Attack trees explore alternative routes to one attacker objective, so they show model-steering, memory, tool-result and admin-tool paths side by side.',
    uncovers: 'Which paths exist, which are cheapest, and which single control (for example an approval or a per-object authorisation check) cuts several at once.',
    complementary: ['saif', 'owasp-ai-exchange', 'atlas'],
    complementaryNote: 'Seed the tree from architecture analysis, then use SAIF agent controls, the AI Exchange agentic guidance and ATLAS technique IDs to enrich and test it.',
  },
  {
    id: 'attacker-moves',
    situation: 'I want realistic attacker techniques, detection ideas or a red-team plan.',
    primary: 'atlas',
    why: 'ATLAS lists adversary tactics and techniques against AI systems with mitigations and case studies.',
    uncovers: 'Named techniques with stable IDs and observed case studies you can turn into test cases.',
    complementary: ['owasp-llm', 'owasp-agentic'],
    complementaryNote: 'Use the OWASP lists to name the weakness class behind each technique.',
  },
  {
    id: 'governance',
    situation: 'I need to show ownership, measurement and acceptance of AI risk to management or an auditor.',
    primary: 'nist-ai-rmf',
    why: 'NIST AI RMF structures Govern, Map, Measure and Manage across the organisation; the Generative AI Profile adds GenAI-specific actions.',
    uncovers: 'Who owns each risk, how it is measured and what residual risk is accepted. It does not find technical threats.',
    complementary: ['pasta', 'saif'],
    complementaryNote: 'Use PASTA for impact analysis and SAIF for controls and the Risk Governance control.',
  },
  {
    id: 'one-goal',
    situation: 'One outcome matters most (for example an unauthorised refund) and I want every path to it.',
    primary: 'attack-trees',
    why: 'An attack tree puts the goal at the root and splits it into AND/OR sub-goals, which shows the cheapest path and the single control that cuts most paths.',
    uncovers: 'Alternative routes to the same outcome and where one control removes several branches.',
    complementary: ['stride', 'atlas'],
    complementaryNote: 'Seed branches from STRIDE findings and label leaves with ATLAS techniques.',
  },
  {
    id: 'personal-data',
    situation: 'Prompts, orders, profiles or retrieved documents contain personal data.',
    primary: 'linddun',
    why: 'LINDDUN covers privacy threats that STRIDE does not: linking, identifying, detecting, unawareness and non-compliance.',
    uncovers: 'Linkage across stores, excessive disclosure and missing user awareness or control over their data.',
    complementary: ['owasp-ai-exchange', 'saif'],
    complementaryNote: 'The AI Exchange has an AI privacy section; SAIF names Sensitive Data Disclosure, Inferred Sensitive Data and Excessive Data Handling.',
  },
  {
    id: 'business-impact',
    situation: 'I must rank threats by business impact and decide what to fix first.',
    primary: 'pasta',
    why: 'PASTA is risk-centric: it starts from business objectives and ends with attack modeling and risk and impact analysis.',
    uncovers: 'Which attack paths carry the highest business impact and where to spend effort.',
    complementary: ['nist-ai-rmf', 'stride'],
    complementaryNote: 'Use STRIDE inside the threat analysis stage and NIST AI RMF to record ownership.',
  },
  {
    id: 'agentic',
    situation: 'The system plans, calls tools or acts on behalf of users.',
    primary: 'saif',
    why: 'SAIF has an agent extension with its own components (application and perception, reasoning core, orchestration, response rendering), risks and controls such as Agent Permissions, Agent User Control and Agent Observability.',
    uncovers: 'Where tools, memory and RAG content sit in the agent, and which agent controls apply to each.',
    complementary: ['owasp-agentic', 'owasp-ai-exchange'],
    complementaryNote: 'Name the risks with OWASP Agentic (ASI01 to ASI10) and use the AI Exchange agentic overview and agent controls for depth.',
  },
  {
    id: 'shared-vocabulary',
    situation: 'I need a shared vocabulary to report findings from labs, scans or tests.',
    primary: 'owasp-llm',
    why: 'The OWASP LLM Top 10 (2026) gives widely recognised weakness class names and IDs.',
    uncovers: 'A name and a rank for the weakness class. It does not find threats.',
    complementary: ['atlas', 'owasp-agentic'],
    complementaryNote: 'Add ATLAS technique IDs for attacker behaviour and OWASP Agentic for agent systems.',
  },
];

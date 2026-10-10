/**
 * AIGoat architecture data model for the threat-modeling diagram.
 *
 * Single source of truth. The diagram, the list view, the detail panel and the
 * tests all read from here. Only edges that exist in the repo are listed, and
 * every node and edge cites repo paths.
 *
 * Status (what the component is):
 *   confirmed - present and running in a normal AIGoat install.
 *   optional  - present in the repo but off by default or only in some modes.
 *   external  - lives outside the repo (internet, registries, package hubs).
 * attackSurface (separate marker): the component accepts or renders
 * attacker-influenced content.
 *
 * Coordinates are in a 1200 x 720 viewBox. They are hand placed so the whole
 * architecture is readable at the default zoom.
 */
import { verified, hypothesis, validate } from './evidence';

export const VIEWBOX = { width: 1200, height: 720 };

export const NODE_STATUS = {
  confirmed: { label: 'Confirmed', description: 'Present and used in a normal AIGoat install.' },
  optional: { label: 'Optional', description: 'In the repo but off by default or only in some modes.' },
  external: { label: 'External', description: 'Outside the repo: registries, hubs, package sources.' },
};

export const ZONES = [
  { id: 'client', label: 'Browser (untrusted)', x: 10, y: 20, w: 170, h: 120, trust: 'untrusted' },
  { id: 'edge', label: 'Edge', x: 200, y: 20, w: 170, h: 120, trust: 'boundary' },
  { id: 'backend', label: 'AIGoat backend: FastAPI process (:8000)', x: 390, y: 20, w: 800, h: 340, trust: 'app' },
  { id: 'data', label: 'Local data and model runtime', x: 10, y: 410, w: 760, h: 150, trust: 'local', labelBottom: true },
  { id: 'tools', label: 'MCP tool servers (stdio subprocesses)', x: 790, y: 410, w: 400, h: 150, trust: 'tools', labelBottom: true },
  { id: 'external', label: 'External sources (internet; setup and build time)', x: 10, y: 600, w: 1180, h: 105, trust: 'external' },
];

export const TRUST_BOUNDARIES = [
  {
    id: 'tb-client',
    label: 'Browser to server',
    detail: 'Everything typed in the browser, and every request header, is attacker-controlled. The server must not trust it.',
    between: ['client', 'edge'],
  },
  {
    id: 'tb-model',
    label: 'App to model and stores',
    detail: 'The app sends prompts, retrieved text and tool results to the model, and reads model output back. The model is not a trusted component.',
    between: ['backend', 'data'],
  },
  {
    id: 'tb-tools',
    label: 'App to tool servers',
    detail: 'MCP servers run as separate stdio subprocesses. Their tool descriptions and results are untrusted input to the app.',
    between: ['backend', 'tools'],
  },
  {
    id: 'tb-external',
    label: 'Local install to internet',
    detail: 'Models, packages and the embedding model are fetched from outside. Their integrity is outside the repo.',
    between: ['external', 'data'],
  },
];

export const NODES = [
  {
    id: 'browser',
    label: 'Learner browser',
    sublabel: 'React 18 + MUI SPA',
    zone: 'client',
    status: 'confirmed',
    attackSurface: true,
    x: 20, y: 45, w: 150, h: 70,
    summary: 'The single-page app where learners chat, edit the knowledge base, run labs and read model output.',
    responsibilities: ['Render the shop, labs and admin pages', 'Send typed input and the session token to /api', 'Render model output (as escaped text or, at Level 0, as raw HTML)'],
    data: ['Typed prompts', 'Session token (localStorage)', 'Per-user shop chat history (localStorage)'],
    threatCategories: ['Spoofing', 'Tampering', 'Information disclosure'],
    facts: [
      verified('The session token is read from browser localStorage and sent as a bearer header.', ['frontend/src/hooks/useLabs.js']),
      verified('Shop chat history is saved in localStorage, not on the server.', ['frontend/src/components/ChatBot.js']),
      verified('At defense Level 0 the shop chat renders bot output with dangerouslySetInnerHTML; Levels 1 and above render escaped text.', ['frontend/src/components/ChatBot.js'], { byDesign: true }),
    ],
    hypotheses: [
      hypothesis('A script injected through rendered model output could read the localStorage token (the Level 0 rendering path makes this plausible).'),
    ],
    toValidate: [
      validate('Whether any other page renders model or knowledge-base text as HTML. Level 0 chat is known; other pages were not audited here.'),
    ],
    labs: ['llm10-1'],
    evidence: ['frontend/src/components/ChatBot.js', 'frontend/src/hooks/useLabs.js'],
  },
  {
    id: 'edge',
    label: 'Edge proxy',
    sublabel: 'nginx (Docker) or dev proxy',
    zone: 'edge',
    status: 'confirmed',
    attackSurface: false,
    x: 210, y: 45, w: 150, h: 70,
    summary: 'Serves the built SPA and forwards /api and /media to the backend. In development, the CRA dev server proxy does the same.',
    responsibilities: ['Serve static React assets', 'Proxy /api and /media to FastAPI', 'Listen on 0.0.0.0:3000 so other hosts on the LAN can reach it'],
    data: ['HTTP requests and responses'],
    threatCategories: ['Spoofing', 'Denial of service'],
    facts: [
      verified('nginx proxies /api/ and /media/ to the backend on port 8000 and listens on 0.0.0.0:3000.', ['frontend/nginx.conf']),
      verified('In development, setupProxy.js proxies only /api and /media to the backend.', ['frontend/src/setupProxy.js']),
    ],
    hypotheses: [],
    toValidate: [
      validate('Request size and connection limits at the proxy. nginx.conf in the repo sets no explicit limit; defaults apply.'),
    ],
    labs: [],
    evidence: ['frontend/nginx.conf', 'frontend/src/setupProxy.js'],
  },
  {
    id: 'api',
    label: 'API and auth',
    sublabel: 'FastAPI routers, demo tokens',
    zone: 'backend',
    status: 'confirmed',
    attackSurface: true,
    x: 410, y: 45, w: 170, h: 70,
    summary: 'Routes requests to the AI surfaces and the shop, and authenticates callers with demo HMAC tokens.',
    responsibilities: ['Authenticate callers (demo token middleware)', 'Route to chat, RAG, agent and MCP surfaces', 'Serve shop, labs and taxonomy endpoints'],
    data: ['Demo tokens', 'User and order records', 'Lab progress'],
    threatCategories: ['Spoofing', 'Elevation of privilege', 'Repudiation'],
    facts: [
      verified('GET /api/auth/demo-users is public and returns a ready-to-use demo token for each seeded user.', ['app/api/auth.py', 'app/middleware/auth.py'], { byDesign: true }),
      verified('Tokens are HMAC-signed strings of the form demo:username:id:signature.', ['app/core/security.py']),
      verified('/api/chat, /api/knowledge-base, /api/agent, /api/mcp and /api/admin are protected path prefixes.', ['app/middleware/auth.py']),
      verified('No rate-limiting or throttling code exists in app/ (searched for rate limit, slowapi, throttle).', ['app/'], { absence: true }),
    ],
    hypotheses: [
      hypothesis('Without throttling, any authenticated caller can issue model-backed requests as fast as the server accepts them.'),
    ],
    toValidate: [
      validate('Whether routes outside the protected prefixes (for example /api/support and /api/challenges) enforce authentication through route dependencies on every handler.'),
    ],
    labs: [],
    evidence: ['app/main.py', 'app/middleware/auth.py', 'app/core/security.py', 'app/api/auth.py'],
  },
  {
    id: 'chat',
    label: 'chat.cracky',
    sublabel: 'Shop assistant surface',
    zone: 'backend',
    status: 'confirmed',
    attackSurface: true,
    x: 415, y: 215, w: 135, h: 70,
    summary: 'The shop chatbot. Builds a prompt from the system prompt, database context and optional knowledge-base text, then calls the model.',
    responsibilities: ['Apply the selected defense level', 'Build the system prompt and data context', 'Call Ollama and stream the reply'],
    data: ['User message', 'System prompt', 'Users, orders, products, coupons (level dependent)', 'Retrieved KB chunks'],
    threatCategories: ['Tampering', 'Information disclosure', 'Elevation of privilege'],
    facts: [
      verified('At Level 0 the prompt context includes every order in the database and unmasked customer data; Level 1 limits orders to the caller; Level 2 sends no user, order or coupon context.', ['app/surfaces/chat_cracky.py'], { byDesign: true }),
      verified('When use_kb is set, chat.cracky queries the vector store directly with query_async, not through the retrieval-control chain that retrieve_trace uses.', ['app/surfaces/chat_cracky.py', 'app/rag/service.py'], { byDesign: true }),
      verified('ChatRequest.message has no length limit in the schema.', ['app/schemas/chat.py'], { absence: true }),
    ],
    hypotheses: [
      hypothesis('A long message plus a large retrieved context increases per-request model cost; the effect depends on hardware.'),
    ],
    toValidate: [
      validate('Real latency and memory impact of very large messages on a given host. Not measured in this page.'),
    ],
    labs: ['llm01-1', 'llm02-1', 'llm06-1'],
    evidence: ['app/surfaces/chat_cracky.py', 'app/schemas/chat.py'],
  },
  {
    id: 'rag',
    label: 'rag.kb',
    sublabel: 'Knowledge base and retrieval',
    zone: 'backend',
    status: 'confirmed',
    attackSurface: true,
    x: 567, y: 215, w: 135, h: 70,
    summary: 'Stores knowledge-base entries, embeds and retrieves chunks, and answers with retrieved context.',
    responsibilities: ['CRUD for knowledge-base entries', 'Chunk, embed and index into ChromaDB', 'Retrieve, apply retrieval controls, build context under a token budget'],
    data: ['KB entries (title, content, owner, trust tier)', 'Embeddings', 'Retrieved candidates'],
    threatCategories: ['Tampering', 'Information disclosure', 'Spoofing'],
    facts: [
      verified('Any authenticated user can POST a knowledge-base entry; the schema lets the caller set trust_tier and owner_id.', ['app/api/rag.py'], { byDesign: true }),
      verified('retrieve_trace runs retrieval controls from the profile (Level 1: provenance; Level 2: provenance, ACL, injection scan) and caps context at rag.max_context_tokens (1500).', ['app/rag/service.py', 'config/defense_profiles.yml', 'config/config.yml']),
      verified('retrieve_trace passes the caller-supplied top_k straight to retrieval; no upper bound appears in that path.', ['app/rag/service.py', 'app/schemas/rag.py'], { absence: true }),
    ],
    hypotheses: [
      hypothesis('A poisoned or keyword-stuffed entry can outrank genuine entries and reach the model as context.'),
    ],
    toValidate: [
      validate('Whether a very large top_k causes meaningful retrieval cost on the default ChromaDB collection size.'),
    ],
    labs: ['llm09-1', 'llm01-4', 'llm02-4'],
    evidence: ['app/api/rag.py', 'app/rag/service.py', 'app/rag/retrieval.py'],
  },
  {
    id: 'agent',
    label: 'agent.runner',
    sublabel: 'Tool-using shop agent',
    zone: 'backend',
    status: 'confirmed',
    attackSurface: true,
    x: 719, y: 215, w: 135, h: 70,
    summary: 'A tool-calling agent loop. Plans with the model, calls tools through the Intent Gate, and writes memory.',
    responsibilities: ['Plan and call tools in a bounded loop', 'Gate tool calls through the Intent Gate broker', 'Persist per-user agent memory'],
    data: ['Goal text', 'Tool calls and results', 'Agent memory', 'Orders and refunds'],
    threatCategories: ['Elevation of privilege', 'Tampering', 'Repudiation'],
    facts: [
      verified('The agent loop stops at max_steps (8 in both config files).', ['app/agent/loop.py', 'config/config.yml', 'docker/config.yml']),
      verified('issue_refund is a database-writing tool marked requires_approval; approval is only enforced at Level 2 (agent.require_approval_at_level: 2).', ['app/agent/tools.py', 'config/config.yml'], { byDesign: true }),
      verified('For admin labs, admin tools such as lookup_any_order, issue_refund_any and export_customer_data_any are registered for staff users.', ['app/agent/admin_tools.py', 'app/agent/service.py'], { byDesign: true }),
    ],
    hypotheses: [
      hypothesis('A poisoned tool result or memory entry can steer later tool calls inside the same run.'),
    ],
    toValidate: [
      validate('Behaviour when many agent runs start at once. No concurrency limit for agent runs was found; model-side queueing was not measured.'),
    ],
    labs: ['llm03-1', 'asi03-1', 'asi06-1', 'asi09-1'],
    evidence: ['app/agent/loop.py', 'app/agent/broker.py', 'app/agent/tools.py', 'app/agent/admin_tools.py'],
  },
  {
    id: 'mcpclient',
    label: 'mcp.client',
    sublabel: 'In-app MCP client',
    zone: 'backend',
    status: 'confirmed',
    attackSurface: true,
    x: 871, y: 215, w: 135, h: 70,
    summary: 'Connects to AIGoat-shipped MCP servers over stdio and drives tool discovery and calls for MCP labs.',
    responsibilities: ['Spawn allow-listed MCP stdio servers', 'List tools and call them', 'Limit parallel MCP sessions with a semaphore'],
    data: ['Tool descriptors', 'Tool arguments and results'],
    threatCategories: ['Tampering', 'Spoofing', 'Elevation of privilege'],
    facts: [
      verified('The client only spawns servers listed in config/mcp_servers.yml; command and args are not taken from a request.', ['config/mcp_servers.yml', 'app/mcp/registry.py']),
      verified('An asyncio semaphore sized by mcp.max_concurrent (2) limits parallel MCP sessions.', ['app/mcp/client.py', 'config/config.yml']),
      verified('The mcp.client labs use a deterministic scripted planner, not a live model.', ['app/mcp/victim_planner.py']),
    ],
    hypotheses: [
      hypothesis('A tool description supplied by an untrusted server can carry instructions aimed at the planner.'),
    ],
    toValidate: [],
    labs: ['mcp03-1', 'mcp09-1', 'mcp01-1'],
    evidence: ['app/mcp/client.py', 'app/mcp/registry.py', 'app/surfaces/mcp_client.py'],
  },
  {
    id: 'mcphost',
    label: 'mcp.host',
    sublabel: 'Admin assistant (optional)',
    zone: 'backend',
    status: 'optional',
    attackSurface: true,
    x: 1023, y: 215, w: 135, h: 70,
    summary: 'A model-driven admin assistant that calls MCP tools. Enabled in config/config.yml, not enabled in docker/config.yml.',
    responsibilities: ['Plan with the model over MCP tool descriptors', 'Call tools on allow-listed MCP servers'],
    data: ['Admin goal text', 'Tool descriptors and results'],
    threatCategories: ['Tampering', 'Elevation of privilege', 'Information disclosure'],
    facts: [
      verified('mcp.host is listed in surfaces.enabled in config/config.yml; the Docker config omits it.', ['config/config.yml', 'docker/config.yml']),
      verified('mcp.host uses the shared LLM client rather than the scripted planner.', ['app/mcp/host.py']),
    ],
    hypotheses: [
      hypothesis('A hostile catalogue server can feed attacker text into an admin-privileged planning loop.'),
    ],
    toValidate: [],
    labs: ['asi01-1', 'asi04-1', 'mcp04-1'],
    evidence: ['app/mcp/host.py', 'app/surfaces/mcp_host.py', 'docker/config.yml'],
  },
  {
    id: 'sqlite',
    label: 'SQLite',
    sublabel: 'Shop, users, telemetry',
    zone: 'data',
    status: 'confirmed',
    attackSurface: false,
    x: 25, y: 440, w: 150, h: 70,
    summary: 'The relational store for users, orders, payments, KB entries, agent memory and defense telemetry.',
    responsibilities: ['Persist shop and account data', 'Persist KB entry text and metadata', 'Persist defense telemetry rows'],
    data: ['Users and hashed credentials', 'Orders and (fake) card data', 'KB entries', 'Agent memory', 'Defense telemetry'],
    threatCategories: ['Information disclosure', 'Tampering'],
    facts: [
      verified('The database is a local SQLite file accessed through async SQLAlchemy.', ['config/config.yml', 'app/core/database.py']),
      verified('Defense telemetry is logged and written to the database as rows.', ['app/defense/telemetry.py']),
      verified('The shop and account routes (not drawn as separate edges here) also read and write this database.', ['app/api/shop.py']),
    ],
    hypotheses: [],
    toValidate: [],
    labs: ['llm02-2'],
    evidence: ['app/core/database.py', 'app/models/', 'app/defense/telemetry.py'],
  },
  {
    id: 'chroma',
    label: 'ChromaDB',
    sublabel: 'Vector store + embeddings',
    zone: 'data',
    status: 'confirmed',
    attackSurface: false,
    x: 190, y: 440, w: 150, h: 70,
    summary: 'Holds embedded KB chunks. Embeddings come from the all-MiniLM-L6-v2 sentence-transformers model.',
    responsibilities: ['Store embeddings of KB chunks', 'Answer nearest-neighbour queries'],
    data: ['Chunk text', 'Embedding vectors', 'Chunk metadata'],
    threatCategories: ['Tampering', 'Information disclosure', 'Denial of service'],
    facts: [
      verified('rag.embedding_model is all-MiniLM-L6-v2 and the vector store path is ./chroma_db.', ['config/config.yml']),
      verified('The embedding model is loaded through sentence_transformers on first use.', ['app/rag/embeddings.py']),
    ],
    hypotheses: [
      hypothesis('Anything indexed becomes retrievable context; index integrity is as important as database integrity.'),
    ],
    toValidate: [],
    labs: ['llm09-1', 'llm09-2'],
    evidence: ['app/rag/retrieval.py', 'app/rag/embeddings.py', 'config/config.yml'],
  },
  {
    id: 'nemo',
    label: 'NeMo Guardrails',
    sublabel: 'Level 2 rails (optional)',
    zone: 'data',
    status: 'optional',
    attackSurface: false,
    x: 355, y: 440, w: 150, h: 70,
    summary: 'Optional input and output rails used by the Level 2 profile, backed by the same local Ollama model.',
    responsibilities: ['Screen input and output at Level 2', 'Fall back to built-in logic when unavailable'],
    data: ['User input', 'Model output'],
    threatCategories: ['Tampering', 'Denial of service'],
    facts: [
      verified('The NeMo rails configuration points at Ollama.', ['guardrails/config/config.yml']),
      verified('A fallback module exists for when NeMo is not available.', ['app/defense/nemo_fallback.py', 'app/defense/nemo_guardrails.py']),
    ],
    hypotheses: [
      hypothesis('Rails that call the same model add cost and are themselves probabilistic; they reduce risk but do not remove it.'),
    ],
    toValidate: [],
    labs: ['llm01-1'],
    evidence: ['guardrails/config/config.yml', 'app/defense/nemo_guardrails.py'],
  },
  {
    id: 'ollama',
    label: 'Ollama (Mistral)',
    sublabel: 'Local LLM :11434',
    zone: 'data',
    status: 'confirmed',
    attackSurface: false,
    x: 565, y: 440, w: 165, h: 70,
    summary: 'The local model server used for chat, RAG answers, the agent, the host assistant and rails. There is no cloud model provider.',
    responsibilities: ['Generate text and tool calls', 'Hold the model weights on the local machine'],
    data: ['Prompts (system prompt, context, user text)', 'Generated text', 'Tool call requests'],
    threatCategories: ['Denial of service', 'Information disclosure', 'Tampering'],
    facts: [
      verified('ollama.base_url is http://localhost:11434, the model is mistral and the request timeout is 90 seconds.', ['config/config.yml']),
      verified('chat.max_tokens (2048) is sent as num_predict for RAG answers.', ['config/config.yml', 'app/rag/service.py']),
      verified('The Docker compose file publishes Ollama on 0.0.0.0:11434.', ['docker/docker-compose.yml']),
    ],
    hypotheses: [
      hypothesis('Local inference capacity is finite; many large requests can queue and stall every user of the same Ollama instance.'),
    ],
    toValidate: [
      validate('Whether the published Ollama port in Docker is reachable from other hosts without authentication in a given network. Depends on the host firewall.'),
    ],
    labs: ['llm06-1'],
    evidence: ['config/config.yml', 'app/services/ollama_client.py', 'docker/docker-compose.yml'],
  },
  {
    id: 'mcpservers',
    label: 'MCP stdio servers',
    sublabel: '4 allow-listed servers',
    zone: 'tools',
    status: 'confirmed',
    attackSurface: true,
    x: 815, y: 430, w: 350, h: 100,
    summary: 'shop_catalog (official), internal_shop (official), community_support (community) and shadow_shop (untrusted). They run as separate subprocesses over stdio.',
    responsibilities: ['Expose tools and tool descriptions', 'Return tool results to the client or host'],
    data: ['Tool descriptors', 'Tool results', 'Catalogue and order data'],
    threatCategories: ['Spoofing', 'Tampering', 'Elevation of privilege'],
    facts: [
      verified('Four servers are registered with trust tiers: shop_catalog official, community_support community, shadow_shop untrusted, internal_shop official.', ['config/mcp_servers.yml']),
      verified('Servers are stdio only; no remote or network MCP servers are configured.', ['config/mcp_servers.yml'], { absence: true }),
      verified('At Level 0 mcp.client lists no controls and tool descriptions return verbatim. Level 1 adds an allowlist and description pinning; Level 2 adds schema pinning, description scanning and result scanning (mcp.host also adds origin pinning).', ['config/defense_profiles.yml'], { byDesign: true }),
    ],
    hypotheses: [
      hypothesis('A lookalike server that wins selection can substitute tool behaviour without changing the tool name.'),
    ],
    toValidate: [],
    labs: ['mcp03-1', 'mcp04-1', 'mcp09-1', 'asi04-1'],
    evidence: ['config/mcp_servers.yml', 'app/mcp_servers/', 'app/mcp/registry.py'],
  },
  {
    id: 'hfhub',
    label: 'Embedding model hub',
    sublabel: 'sentence-transformers download',
    zone: 'external',
    status: 'external',
    attackSurface: false,
    x: 205, y: 625, w: 165, h: 62,
    summary: 'The external source the all-MiniLM-L6-v2 embedding model is downloaded from on first use.',
    responsibilities: ['Serve the embedding model files'],
    data: ['Embedding model weights'],
    threatCategories: ['Tampering', 'Spoofing'],
    facts: [
      verified('SentenceTransformer(model_name) is called with the configured name; the package resolves and downloads it.', ['app/rag/embeddings.py']),
    ],
    hypotheses: [
      hypothesis('A tampered or substituted embedding model would change retrieval behaviour silently.'),
    ],
    toValidate: [
      validate('Whether the model revision or checksum is pinned anywhere. None was found in the repo.'),
    ],
    labs: [],
    evidence: ['app/rag/embeddings.py', 'config/config.yml'],
  },
  {
    id: 'registry',
    label: 'Ollama model registry',
    sublabel: 'ollama pull at setup',
    zone: 'external',
    status: 'external',
    attackSurface: false,
    x: 565, y: 625, w: 165, h: 62,
    summary: 'The external registry the setup script pulls the Mistral model from.',
    responsibilities: ['Serve model weights'],
    data: ['Model weights and manifests'],
    threatCategories: ['Tampering', 'Spoofing'],
    facts: [
      verified('scripts/start.sh runs ollama pull for the configured model if it is missing.', ['scripts/start.sh']),
      verified('The community Modelfile in llm04-1 is a training scenario; AIGoat itself pulls the model named in config.', ['config/labs/', 'scripts/start.sh']),
    ],
    hypotheses: [
      hypothesis('Pulling by tag rather than digest means the bytes behind a tag can change over time.'),
    ],
    toValidate: [
      validate('Whether any digest pinning exists for the pulled model. None was found in scripts/start.sh.'),
    ],
    labs: ['llm04-1'],
    evidence: ['scripts/start.sh', 'config/config.yml'],
  },
  {
    id: 'pkgs',
    label: 'Packages and base images',
    sublabel: 'pip, npm, Docker Hub',
    zone: 'external',
    status: 'external',
    attackSurface: false,
    x: 925, y: 625, w: 240, h: 62,
    summary: 'Python packages, npm packages and container base images pulled at install and build time.',
    responsibilities: ['Provide dependencies for backend, frontend and containers'],
    data: ['Source and binary packages', 'Container images'],
    threatCategories: ['Tampering', 'Spoofing', 'Elevation of privilege'],
    facts: [
      verified('requirements.txt uses open lower bounds (>=) for core packages, including mcp, chromadb, sentence-transformers and nemoguardrails.', ['requirements.txt']),
      verified('The backend image is built FROM python:3.11 and the frontend image from node:18-alpine and nginx:alpine; none is pinned by digest.', ['docker/Dockerfile', 'frontend/Dockerfile']),
      verified('The frontend has a package-lock.json and CI installs with npm ci.', ['frontend/package-lock.json', '.github/workflows/ci.yml']),
    ],
    hypotheses: [
      hypothesis('Open version ranges let a new release of a transitive package change behaviour between two installs.'),
    ],
    toValidate: [
      validate('Whether any installed Python dependency has a known vulnerability. No scan was run for this page.'),
    ],
    labs: [],
    evidence: ['requirements.txt', 'docker/Dockerfile', 'frontend/Dockerfile'],
  },
];

/**
 * Overlay band drawn across the backend zone. It is not a node: it represents
 * the defense pipeline that runs inside each surface, so no per-surface edges
 * are invented.
 */
export const DEFENSE_OVERLAY = {
  id: 'defense',
  label: 'Defense pipeline (levels 0, 1, 2): controls run inside each surface at input, retrieval, tool and output stages',
  x: 410, y: 140, w: 770, h: 38,
  summary: 'Defense profiles in config/defense_profiles.yml select which controls run for each surface at each level. Level 0 runs none.',
  facts: [
    verified('Each surface resolves a profile for its level. Control ids include input.validate, intent.classify, output.moderate, rails.nemo, retrieval.provenance, retrieval.acl, retrieval.injection_scan, tool.allowlist, tool.approval, memory.scan and several mcp.* controls.', ['config/defense_profiles.yml', 'app/defense/profiles.py']),
    verified('Level 0 has an empty control list on every surface; the file states this is intentional.', ['config/defense_profiles.yml'], { byDesign: true }),
    verified('The profile for rag.kb lists no input.validate control at any level, so retrieval queries carry no input-length control.', ['config/defense_profiles.yml'], { absence: true }),
  ],
};

/**
 * Directed data flows. ports: r, l, t, b (right, left, top, bottom).
 * kind drives the line style so flows are distinguishable without color alone.
 *   http  - web traffic        model - model inference    store - database / vector store
 *   tool  - tool / MCP call    fetch - external download
 */
export const FLOW_KINDS = {
  http: { label: 'Web request', dash: '' },
  model: { label: 'Model inference', dash: '6 3' },
  store: { label: 'Data store access', dash: '2 3' },
  tool: { label: 'Tool or MCP call', dash: '10 3 2 3' },
  fetch: { label: 'External download', dash: '1 4' },
};

export const EDGES = [
  { id: 'e-browser-edge', from: 'browser', to: 'edge', fromPort: 'r', toPort: 'l', label: 'HTTP', direction: 'both', kind: 'http', boundary: 'tb-client', detail: 'SPA assets plus /api and /media requests, with the bearer token.', evidence: ['frontend/nginx.conf', 'frontend/src/setupProxy.js'] },
  { id: 'e-edge-api', from: 'edge', to: 'api', fromPort: 'r', toPort: 'l', label: 'proxy', direction: 'forward', kind: 'http', detail: 'Reverse proxy of /api and /media to the FastAPI backend.', evidence: ['frontend/nginx.conf'] },
  { id: 'e-api-chat', from: 'api', to: 'chat', fromPort: 'b', toPort: 't', label: '/api/chat', labelT: 0.86, direction: 'forward', kind: 'http', detail: 'Chat routes dispatch to the chat.cracky surface.', evidence: ['app/api/chat.py', 'app/surfaces/chat_cracky.py'] },
  { id: 'e-api-rag', from: 'api', to: 'rag', fromPort: 'b', toPort: 't', label: '/api/kb', labelT: 0.86, direction: 'forward', kind: 'http', detail: 'Knowledge-base routes dispatch to the rag.kb surface.', evidence: ['app/api/rag.py'] },
  { id: 'e-api-agent', from: 'api', to: 'agent', fromPort: 'b', toPort: 't', label: '/api/agent', labelT: 0.86, direction: 'forward', kind: 'http', detail: 'Agent routes dispatch to the agent.runner surface.', evidence: ['app/api/agent.py', 'app/surfaces/agent_runner.py'] },
  { id: 'e-api-mcpclient', from: 'api', to: 'mcpclient', fromPort: 'b', toPort: 't', label: '/api/mcp', labelT: 0.86, direction: 'forward', kind: 'http', detail: 'MCP routes dispatch to the mcp.client surface.', evidence: ['app/api/mcp.py', 'app/surfaces/mcp_client.py'] },
  { id: 'e-api-mcphost', from: 'api', to: 'mcphost', fromPort: 'b', toPort: 't', label: 'admin', labelT: 0.86, direction: 'forward', kind: 'http', detail: 'Surface routes dispatch to mcp.host when it is enabled.', evidence: ['app/api/surfaces.py', 'app/surfaces/mcp_host.py'] },
  { id: 'e-chat-sqlite', from: 'chat', to: 'sqlite', fromPort: 'b', toPort: 't', label: 'context rows', direction: 'forward', kind: 'store', boundary: 'tb-model', labelT: 0.62, detail: 'Reads users, orders, products and coupons to build prompt context (scope depends on level).', evidence: ['app/surfaces/chat_cracky.py'] },
  { id: 'e-chat-chroma', from: 'chat', to: 'chroma', fromPort: 'b', toPort: 't', label: 'vector query', direction: 'forward', kind: 'store', boundary: 'tb-model', labelT: 0.42, detail: 'Direct query_async against the vector store when use_kb is set.', evidence: ['app/surfaces/chat_cracky.py'] },
  { id: 'e-chat-ollama', from: 'chat', to: 'ollama', fromPort: 'b', toPort: 't', label: 'generate', direction: 'forward', kind: 'model', boundary: 'tb-model', labelT: 0.5, detail: 'Prompt sent to Ollama; reply streamed back.', evidence: ['app/surfaces/chat_cracky.py', 'app/services/ollama_client.py'] },
  { id: 'e-chat-nemo', from: 'chat', to: 'nemo', fromPort: 'b', toPort: 't', label: 'rails (L2)', direction: 'forward', kind: 'model', boundary: 'tb-model', labelT: 0.3, detail: 'Level 2 only: NeMo Guardrails screen input and output.', evidence: ['app/surfaces/chat_cracky.py', 'app/defense/nemo_guardrails.py'] },
  { id: 'e-rag-chroma', from: 'rag', to: 'chroma', fromPort: 'b', toPort: 't', label: 'retrieve', direction: 'both', kind: 'store', boundary: 'tb-model', labelT: 0.62, detail: 'Index writes on sync; nearest-neighbour reads on query.', evidence: ['app/rag/retrieval.py', 'app/rag/service.py'] },
  { id: 'e-rag-sqlite', from: 'rag', to: 'sqlite', fromPort: 'b', toPort: 't', label: 'KB rows', direction: 'both', kind: 'store', boundary: 'tb-model', labelT: 0.8, detail: 'Knowledge-base entry CRUD.', evidence: ['app/api/rag.py'] },
  { id: 'e-rag-ollama', from: 'rag', to: 'ollama', fromPort: 'b', toPort: 't', label: 'answer', direction: 'forward', kind: 'model', boundary: 'tb-model', labelT: 0.42, detail: 'Retrieved context plus query sent to Ollama.', evidence: ['app/rag/service.py'] },
  { id: 'e-agent-ollama', from: 'agent', to: 'ollama', fromPort: 'b', toPort: 't', label: 'plan + tool calls', direction: 'both', kind: 'model', boundary: 'tb-model', labelT: 0.62, detail: 'Chat turns with tool definitions; tool calls come back from the model.', evidence: ['app/agent/loop.py'] },
  { id: 'e-agent-sqlite', from: 'agent', to: 'sqlite', fromPort: 'b', toPort: 't', label: 'tools, memory', direction: 'both', kind: 'store', boundary: 'tb-model', labelT: 0.7, detail: 'Order lookups, refunds and agent memory use the database.', evidence: ['app/agent/tools.py', 'app/agent/memory.py'] },
  { id: 'e-mcpclient-servers', from: 'mcpclient', to: 'mcpservers', fromPort: 'b', toPort: 't', label: 'stdio', direction: 'both', kind: 'tool', boundary: 'tb-tools', labelT: 0.5, detail: 'JSON-RPC over stdio to an allow-listed server subprocess.', evidence: ['app/mcp/client.py'] },
  { id: 'e-mcphost-servers', from: 'mcphost', to: 'mcpservers', fromPort: 'b', toPort: 't', label: 'stdio', direction: 'both', kind: 'tool', boundary: 'tb-tools', labelT: 0.5, detail: 'The host assistant calls tools on allow-listed servers.', evidence: ['app/mcp/host.py'] },
  { id: 'e-mcphost-ollama', from: 'mcphost', to: 'ollama', fromPort: 'b', toPort: 't', label: 'plan', direction: 'both', kind: 'model', boundary: 'tb-model', labelT: 0.82, detail: 'Host planning uses the shared LLM client.', evidence: ['app/mcp/host.py'] },
  { id: 'e-nemo-ollama', from: 'nemo', to: 'ollama', fromPort: 'r', toPort: 'l', label: 'LLM', direction: 'forward', kind: 'model', detail: 'Guardrails call the same Ollama server.', evidence: ['guardrails/config/config.yml'] },
  { id: 'e-hf-chroma', from: 'hfhub', to: 'chroma', fromPort: 't', toPort: 'b', label: 'embedding model', direction: 'forward', kind: 'fetch', boundary: 'tb-external', detail: 'Model files are downloaded on first use.', evidence: ['app/rag/embeddings.py'] },
  { id: 'e-registry-ollama', from: 'registry', to: 'ollama', fromPort: 't', toPort: 'b', label: 'ollama pull', direction: 'forward', kind: 'fetch', boundary: 'tb-external', detail: 'Setup pulls the model if missing.', evidence: ['scripts/start.sh'] },
  { id: 'e-pkgs-backend', from: 'pkgs', to: 'zone:backend', fromPort: 't', toPort: 'b', toX: 1100, label: 'pip, npm, images (build)', direction: 'forward', kind: 'fetch', boundary: 'tb-external', detail: 'Dependencies and base images are fetched at install and build time.', evidence: ['requirements.txt', 'docker/Dockerfile', 'frontend/Dockerfile'] },
];

export const NOT_PRESENT = [
  { id: 'cloud-llm', label: 'Cloud LLM provider', note: 'Only a local Ollama model is configured.' },
  { id: 'real-jwt', label: 'Production login with real JWT', note: 'Demo HMAC tokens are used; create_access_token exists but is unused.' },
  { id: 'rate-limit', label: 'API rate limiting', note: 'No rate-limit code was found in app/.' },
  { id: 'server-history', label: 'Server-side shop chat history', note: 'Shop chat history lives in browser localStorage.' },
  { id: 'remote-mcp', label: 'Remote or network MCP servers', note: 'Only stdio servers are registered.' },
  { id: 'multi-tenant', label: 'Multi-tenant isolation', note: 'One shared database, one shared vector store.' },
  { id: 'api-raw', label: 'api.raw surface', note: 'A registered stub that returns 501; not a working surface.' },
];

export const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));

export const flowsFor = (nodeId) => EDGES.filter((e) => e.from === nodeId || e.to === nodeId);


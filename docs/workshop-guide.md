# AI Goat Shop -- Workshop Guide

This guide is for instructors running AI Goat Shop workshops at OWASP meetups, security conferences, and educational settings. It covers setup, structure, and challenge walkthroughs with pedagogical guidance -- without revealing flags or exact exploit payloads.

## Pre-Workshop Setup

### Environment Requirements

Each participant needs:

| Requirement | Notes |
|-------------|-------|
| Docker Desktop | v20+ with at least 8GB RAM allocated |
| Web browser | Chrome or Firefox recommended |
| Terminal access | For Docker commands |
| ~6GB disk space | Ollama model + containers |

### Instructor Setup (30 minutes before)

```bash
cd docker
docker-compose up --build
```

Verify all three services are healthy:

```bash
docker-compose ps
```

Expected output: backend, frontend, and ollama all show "healthy".

Pull up the demo accounts endpoint to distribute credentials:

```
GET http://localhost:3000
```

### Recommended Workshop Duration

| Format | Duration | Coverage |
|--------|----------|----------|
| Lightning talk | 45 min | 2-3 attack labs + challenge demo |
| Half-day workshop | 3 hours | All active labs + 4-5 challenges |
| Full-day workshop | 6 hours | Complete platform + defense analysis |

---

## Quick Setup for Workshops

### Recommended Deployment

For workshops, Docker is the recommended deployment method. It ensures every participant has an identical environment regardless of their local setup.

```bash
# One-time: create the persistent model volume
docker volume create ollama_models

# Start the full stack
cd docker
docker-compose up --build
```

If Docker is not available, participants can run natively:

```bash
cd AIGoat
./scripts/start.sh
```

### Suggested Participant Workflow

1. Log in with a demo account (alice, bob, charlie, or frank)
2. Explore the shop and chat with the AI assistant at Defense Level 0
3. Work through the Attack Labs at `/attacks`, starting with LLM01
4. Attempt the CTF Challenges at `/challenges`
5. Switch to Defense Level 1 and repeat attacks to see what changes
6. Switch to Defense Level 2 and observe how guardrails block attacks
7. Discuss findings and defense strategies as a group

### Typical Workshop Duration

| Format | Duration | What to Cover |
|--------|----------|---------------|
| Lightning talk | 45 min | Demo 2-3 attack labs, show one challenge, discuss defense levels |
| Half-day | 2-3 hours | All active labs, 4-5 challenges, defense comparison |
| Full-day | 5-6 hours | Complete platform coverage, all challenges, defense deep-dive |

Most workshops run well in the **2-4 hour** range. This gives participants enough time to explore attacks, attempt challenges, and discuss defenses without rushing.

### Tips for Instructors

- **Pre-pull the model**: Run the environment once before the workshop so the Mistral model (~4.5 GB) is already downloaded
- **Prepare demo accounts**: Each participant should have their own demo account. If you need more than the 4 pre-seeded accounts, participants can sign up through the UI
- **Start at Level 0**: Always begin demonstrations at Defense Level 0 so attacks succeed visibly
- **Use the projector for labs**: Walk through one lab (LLM01 recommended) on the projector before participants try on their own
- **Monitor RAM**: If running on shared infrastructure, watch memory usage — Mistral needs ~4.5 GB per instance
- **Have a backup plan**: If Ollama is slow on CPU-only machines, switch to `tinyllama` in `config/config.yml` for faster (but less realistic) responses

---

## Workshop Flow

### Phase 1: Introduction (15 min)

1. Present the OWASP Top 10 for LLM Applications overview (navigate to `/owasp-top-10` in the app)
2. Explain the three defense levels using the toggle in the navigation bar:
   - **Level 0 (Vulnerable):** No defenses. Raw prompt passthrough.
   - **Level 1 (Hardened):** Input validation, intent classification, output moderation.
   - **Level 2 (Guardrailed):** NeMo Guardrails with Colang policy enforcement.
3. Show participants how to log in with demo accounts and navigate between labs, challenges, and the chatbot

### Phase 2: Attack Labs (45-90 min)

Walk through each lab category. The labs page (`/attacks`) provides per-lab goals, example prompts, and expected results at each defense level.

### Phase 3: CTF Challenges (45-90 min)

Participants attempt the challenge system (`/challenges`). Each challenge has its own dedicated chat window with a challenge-specific prompt. The flag only appears in the chat response after server-side exploit detection confirms success.

### Phase 4: Defense Analysis (30 min)

Switch between defense levels and repeat the same attacks. Discuss:
- Which attacks are blocked and why
- The trade-off between security and usability
- How each defense layer works

---

## Attack Lab Walkthroughs

### LLM01 -- Prompt Injection

**Labs:** Prompt Injection Basics, Indirect Injection, Chained Injection

**Concept:** The model follows instructions embedded in user input, overriding its system prompt directives.

**Teaching approach:**

1. Start at Level 0. Show that the chatbot has a defined role and behavioral constraints.
2. Demonstrate that carefully crafted user messages can make the model act outside its intended behavior.
3. Key insight: LLMs process all text in their context window as instructions. There is no robust boundary between "system" and "user" content.

**Defense progression:**
- L0: No input filtering. Direct instruction overrides work.
- L1: Pattern detection catches common injection phrases. Participants must find alternative phrasings.
- L2: Intent classification blocks recognized attack patterns before the model sees them.

**Discussion points:**
- Why is prompt injection fundamentally hard to fix?
- How do real production systems mitigate this?
- What is the difference between direct and indirect injection?

### LLM02 -- Sensitive Information Disclosure

**Labs:** Data Leakage, Training Data Extraction, Context Poisoning

**Concept:** The model reveals information it was instructed to protect, or leaks data from its training/context.

**Teaching approach:**

1. The Data Leakage lab has a chatbot with access to sensitive customer data. The chatbot is told not to share it, but natural language boundaries are weak.
2. Training Data Extraction shows how a model may regurgitate memorized data when prompted in specific ways.
3. Context Poisoning demonstrates how adversarial RAG content changes model behavior.

**Defense progression:**
- L0: The model freely shares sensitive data when asked conversationally.
- L1: Output moderation detects and redacts certain sensitive patterns.
- L2: Policy enforcement blocks entire categories of sensitive responses.

**Discussion points:**
- How should sensitive data be handled in LLM context?
- What is the principle of least privilege for AI systems?
- How does RAG create new attack surface?

### LLM04 -- Model Denial of Service

**Lab:** Model Denial of Service

**Concept:** Crafted inputs cause excessive resource consumption (token generation, processing loops).

**Teaching approach:**

1. The lab chatbot is configured to be "thorough" and follow repetition/enumeration instructions.
2. Demonstrate how unbounded output generation can exhaust resources.
3. Show how `max_tokens` limits and input validation mitigate this.

**Discussion points:**
- What are the cost implications of DoS attacks on pay-per-token APIs?
- How do rate limiting and token budgets help?
- What is the difference between DoS at the infrastructure level vs. the model level?

### LLM05 -- Supply Chain Vulnerabilities

**Lab:** Supply Chain Vulnerabilities

**Concept:** Risks from using untrusted models, plugins, or data sources.

**Teaching approach:**

1. This lab is currently conceptual. Use it as a discussion exercise.
2. Walk through scenarios: What happens if you pull a trojaned model from a public registry? What if a RAG data source is compromised?

**Discussion points:**
- How do you verify model integrity?
- What are the risks of fine-tuning on untrusted data?
- How does the AI supply chain differ from traditional software supply chains?

### LLM07 -- System Prompt Extraction

**Lab:** System Prompt Extraction

**Concept:** Extracting the hidden system prompt that governs the model's behavior.

**Teaching approach:**

1. The lab chatbot has a detailed system prompt with confidential configuration. It is told not to reveal it.
2. Participants explore techniques to make the model output its own instructions.
3. Key insight: System prompts are not truly "hidden" -- they exist in the model's context and can be reflected through creative queries.

**Defense progression:**
- L0: The model may output its system prompt when asked to "repeat" or "summarize" its instructions.
- L1: Output moderation detects known system prompt fragments and blocks them.
- L2: Intent classification identifies prompt extraction attempts before they reach the model.

**Discussion points:**
- Should system prompts be treated as secrets?
- What are the implications of system prompt leakage for commercial AI products?
- How does this vulnerability interact with prompt injection?

---

## Challenge Walkthroughs

Challenges are the CTF component of AI Goat Shop. Unlike labs (which are guided), challenges require participants to trigger a real exploit that is detected server-side. Flags are per-user and dynamically generated -- they cannot be shared between participants.

### Challenge 1: Prompt Injection (100 pts, Beginner)

**Objective:** Manipulate the AI assistant to bypass its intended behavior.

**Guidance for instructors:**
- Hint 1: Direct instructions in user input can override system behavior
- Hint 2: Embedding commands within seemingly normal questions
- The exploit evaluator checks whether the model output contradicts its system prompt directives

### Challenge 2: System Prompt Extraction (100 pts, Beginner)

**Objective:** Extract or reveal the hidden system prompt.

**Guidance for instructors:**
- Hint 1: Some models reflect parts of their instructions when asked
- Hint 2: Roleplay scenarios where the model acts as a system that outputs its configuration
- The evaluator checks for system prompt fragments in the model output

### Challenge 3: RAG Manipulation (150 pts, Beginner)

**Objective:** Manipulate retrieval-augmented context to change the model's answers.

**Guidance for instructors:**
- Hint 1: The knowledge base can be modified through the API
- Hint 2: Consider how retrieved context influences the model output
- Participants need to add malicious content to the KB, then query the RAG chatbot
- The evaluator checks whether the model output reflects user-injected KB content

### Challenge 4: Context Override (100 pts, Beginner)

**Objective:** Override or nullify the provided context.

**Guidance for instructors:**
- Hint 1: Instructions that tell the model to ignore prior context
- Hint 2: Frame the override as a higher-priority directive
- The evaluator checks whether the model ignored its provided context

### Challenge 5: Multi-step Injection (250 pts, Intermediate)

**Objective:** Chain multiple injection steps across multiple conversation turns.

**Guidance for instructors:**
- Hint 1: Break the attack into sequential steps that build on each other
- Hint 2: Use intermediate outputs as inputs for the next step
- This requires multiple messages in the same session
- The evaluator examines conversation history for accumulated injection patterns

### Challenge 6: Role Confusion (200 pts, Intermediate)

**Objective:** Confuse the model about its role or identity.

**Guidance for instructors:**
- Hint 1: Some models adopt new personas when asked to simulate different characters
- Hint 2: Scenarios where the model acts as a system without restrictions
- The evaluator checks for persona shifts in the model output

### Challenge 7: Context Poisoning (300 pts, Intermediate)

**Objective:** Poison the retrieval context so the model returns attacker-controlled content.

**Guidance for instructors:**
- Hint 1: Malicious entries in the knowledge base affect retrieval results
- Hint 2: Craft content that semantically matches target queries
- This is a two-phase attack: first poison the KB, then query it
- The evaluator checks for attacker-originated content in the model output

### Challenge 8: Chained Exploit (400 pts, Intermediate)

**Objective:** Combine prompt injection with context poisoning.

**Guidance for instructors:**
- Hint 1: First poison the context, then use injection to exploit it
- Hint 2: Consider how the model fuses retrieved context with user input
- This requires both injection and poisoning signals in the same session
- The evaluator requires both attack types to be detected

### Challenge 9: State Exploitation (500 pts, Intermediate)

**Objective:** Exploit persistent conversation state to bypass controls.

**Guidance for instructors:**
- Hint 1: Some systems maintain conversation history that can be manipulated
- Hint 2: Repeated or accumulated instructions across turns may weaken guardrails
- This requires sustained, multi-turn manipulation
- The evaluator checks for progressive erosion of model compliance

---

## Running a Scored Workshop

For competitive workshops:

1. Each participant creates an account (or uses a pre-assigned demo account)
2. Participants work through challenges in any order
3. Flags are unique per user -- sharing flags will not work
4. Use the admin dashboard (`/admin`) to track progress
5. Point values reflect difficulty: 100 (beginner), 150-500 (intermediate)
6. Total possible points: 2100

### Suggested Time Allocation

| Activity | Time |
|----------|------|
| Setup + Introduction | 15 min |
| Guided lab walkthrough (LLM01 + LLM07) | 30 min |
| Free exploration of all labs | 30 min |
| CTF challenge session | 60-90 min |
| Defense analysis + discussion | 30 min |
| Wrap-up | 15 min |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Ollama not responding | Check `docker-compose ps` -- ollama container must be healthy. Verify model is pulled: `docker exec ollama ollama list` |
| Slow model responses | Ensure at least 8GB RAM is available. Consider using a smaller model like `tinyllama` |
| Frontend not loading | Check that the backend is healthy first (frontend depends on it). Check browser console for CORS errors |
| Challenge flag not appearing | The exploit must be genuinely detected server-side. Submitting random flags will be rejected even if the flag format is correct |
| RAG not returning results | Ensure the knowledge base has been synced. Visit the Knowledge Base page and click the sync button |

---

## Post-Workshop Resources

- OWASP Top 10 for LLM Applications: https://genai.owasp.org/llm-top-10/
- AI Goat GitHub: https://github.com/AISecurityConsortium/AIGoat
- OWASP AI Security and Privacy Guide: https://owasp.org/www-project-ai-security-and-privacy-guide/
- MITRE ATLAS: https://atlas.mitre.org/

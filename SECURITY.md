# Security Policy

## Important Notice

AI Goat Shop is a **deliberately vulnerable** application built for educational purposes. It contains intentional security weaknesses to teach AI/LLM attack and defense techniques. These vulnerabilities are features, not bugs.

**Do not deploy this application in production or expose it to the public internet.**

## Intentional Vulnerabilities (Do Not Report)

The following are part of the educational design and should NOT be reported as security issues:

| Category | Examples |
|----------|---------|
| **Prompt Injection** (LLM01) | Direct injection, indirect injection, multi-turn chained attacks |
| **Sensitive Info Disclosure** (LLM02) | Admin credentials, customer data, and config paths leaked through the chatbot at Level 0 |
| **Data Poisoning** (LLM04) | Injecting false information via reviews, tips, and Knowledge Base entries |
| **Insecure Output** (LLM05) | XSS via chatbot output at Defense Level 0 (HTML/JS rendering) |
| **System Prompt Leakage** (LLM07) | Extracting the chatbot's hidden system prompt and confidential config block |
| **RAG Weaknesses** (LLM08) | Poisoning the Knowledge Base, manipulating vector retrieval, context flooding |
| **Misinformation** (LLM09) | Inducing the chatbot to fabricate certifications, endorsements, or specifications |
| **Weak Credentials** | Default demo accounts (`admin/admin123`, `alice/password123`, etc.) |
| **Context Override & Role Confusion** | Making the chatbot abandon its role or follow injected instructions |
| **Guardrail Bypass** | Successfully bypassing Level 1 or Level 2 defenses with creative prompts |

## Unintentional Vulnerabilities (Please Report)

If you discover a vulnerability that is NOT part of the educational design, we want to know. This includes:

- Authentication bypass that circumvents the demo token system
- Arbitrary code execution on the host system
- Container escape vulnerabilities
- SQL injection in the backend (not AI-related)
- Path traversal that accesses files outside the application
- Denial of service against the backend infrastructure (not the LLM)
- Supply chain attacks via dependencies
- Credential leakage in logs or error messages beyond the intentional demo data

## How to Report a Vulnerability

**Contact**: Reach out to [Farooq Mohammad on LinkedIn](https://www.linkedin.com/in/farooqmohammad/) with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Suggested fix (if any)

You will receive an acknowledgment within 48 hours. We aim to provide a fix within 7 days for critical issues.

## Suggestions, Issues, and Improvements

For non-security matters -- feature requests, bug reports, documentation improvements, or general suggestions -- please [create a GitHub Issue](https://github.com/AISecurityConsortium/AIGoat/issues/new) on the repository.

## Defense Levels

The application includes three defense levels that progressively harden the AI system:

| Level | Name | What It Does |
|-------|------|-------------|
| **0** | Vulnerable | No defenses. All AI attacks succeed. |
| **1** | Hardened | Input validation, intent classification, and output moderation. Some attacks still work with creative phrasing. |
| **2** | Guardrailed | NVIDIA NeMo Guardrails with Colang policy enforcement. Input is checked before reaching the AI. Output is checked before reaching the user. Most direct attacks are blocked. |

When reporting, please indicate which defense level the vulnerability affects. If it is exploitable only at Level 0 but blocked at Level 1+, it is likely intentional.

## Responsible Disclosure

- We will credit reporters in the fix commit (unless anonymity is requested).
- We will not take legal action against researchers who follow this policy.
- We ask for reasonable time to address the issue before public disclosure.

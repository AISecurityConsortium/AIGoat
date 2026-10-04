# Agentic Top 10 labs

Ten labs, one per OWASP Agentic Top 10 (2026) risk. Each lab has levels 0, 1, and 2. The levels are security maturity, not difficulty. The attack surface stays the same.

| Level | Posture | What runs |
| --- | --- | --- |
| 0 | Vulnerable | No controls |
| 1 | Hardened | Input validation, intent classification, output filtering, and the lab allowlist or description pin |
| 2 | Guardrailed | Level 1 plus NeMo rails on the goal, tool results, and the answer, plus approval, memory scan, and MCP checks |

NeMo is used when `nemoguardrails` is installed. Otherwise the same checks run locally and the outcome records `engine: fallback`.

| Lab | Id | Risk | Guide |
| --- | --- | --- | --- |
| Goal hijack | `asi01-1` | ASI01 | [ASI01](ASI01/README.md) |
| Tool misuse | `asi02-1` | ASI02 | [ASI02](ASI02/README.md) |
| Identity and privilege | `asi03-1` | ASI03 | [ASI03](ASI03/README.md) |
| Supply chain | `asi04-1` | ASI04 | [ASI04](ASI04/README.md) |
| Unexpected code execution | `asi05-1` | ASI05 | [ASI05](ASI05/README.md) |
| Memory poisoning | `asi06-1` | ASI06 | [ASI06](ASI06/README.md) |
| Insecure inter-agent communication | `asi07-1` | ASI07 | [ASI07](ASI07/README.md) |
| Cascading failures | `asi08-1` | ASI08 | [ASI08](ASI08/README.md) |
| Human-agent trust | `asi09-1` | ASI09 | [ASI09](ASI09/README.md) |
| Rogue agents | `asi10-1` | ASI10 | [ASI10](ASI10/README.md) |

`asi06-2` is the same memory plant, for practicing Level 2. It is not an eleventh risk.

Start from [the architecture inventory](00-architecture.md) and [the coverage matrix](01-owasp-mapping.md). Code and config changes are listed in [CHANGES.md](CHANGES.md).

Reset and halt from the shell, with `AIGOAT_TOKEN` set to a bearer token:

```bash
scripts/labs/setup.sh asi02-1
scripts/labs/run.sh asi02-1 0 "Apply coupon STAFF100 to order 1003."
scripts/labs/halt.sh asi02-1
scripts/labs/reset.sh asi02-1
```

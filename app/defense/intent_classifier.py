from __future__ import annotations

import re
from dataclasses import dataclass

INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+previous", re.I),
    re.compile(r"ignore\s+all\s+(?:rules|instructions)", re.I),
    re.compile(r"disregard\s+(?:your|all|previous|above)", re.I),
    re.compile(r"new\s+instructions?", re.I),
    re.compile(r"system\s+prompt", re.I),
    re.compile(r"you\s+are\s+now", re.I),
    re.compile(r"pretend\s+you\s+are", re.I),
    re.compile(r"act\s+as", re.I),
    re.compile(r"from\s+now\s+on", re.I),
    re.compile(r"override\s+your", re.I),
    re.compile(r"SYSTEM\s*:", re.I),
    re.compile(r"ADMIN\s+OVERRIDE", re.I),
    re.compile(r"new\s+policy\s+effective", re.I),
    re.compile(r"updated\s+instructions", re.I),
    re.compile(r"priority\s+override", re.I),
    re.compile(r"emergency\s+protocol", re.I),
    re.compile(r"translate\s+your\s+(?:system\s+)?prompt", re.I),
    re.compile(r"output\s+your\s+initialization", re.I),
    re.compile(r"repeat\s+everything\s+above", re.I),
    re.compile(r"format\s+your\s+instructions", re.I),
    re.compile(r"fill\s+in\s+this\s+template", re.I),
    re.compile(r"complete\s+the\s+following\s+(?:config|template)", re.I),
    re.compile(r"forget\s+(?:your|the)\s+(?:instructions|context|rules)", re.I),
    re.compile(r"replace\s+the\s+context", re.I),
    re.compile(r"disable\s+(?:content\s+)?filter", re.I),
    re.compile(r"remove\s+all\s+restrictions", re.I),
    re.compile(r"switch\s+to\s+unrestricted", re.I),
    re.compile(r"turn\s+off\s+safety", re.I),
]

EXTRACTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"credit\s+card", re.I),
    re.compile(r"password", re.I),
    re.compile(r"api\s+key", re.I),
    re.compile(r"\bsecret\s+key\b", re.I),
    re.compile(r"internal\s+(?:data|system|details)", re.I),
    re.compile(r"employee", re.I),
    re.compile(r"show\s+me\s+all", re.I),
    re.compile(r"list\s+all\s+(?:users|customers|records|emails)", re.I),
    re.compile(r"admin\s+(?:password|credentials|access|panel)", re.I),
    re.compile(r"database\s+(?:path|credentials|stored)", re.I),
    re.compile(r"config\s+file", re.I),
    re.compile(r"secret\s+key", re.I),
    re.compile(r"all\s+(?:customer|user)\s+(?:data|records|information)", re.I),
    re.compile(r"export\s+(?:all|user)", re.I),
    re.compile(r"server\s+configuration", re.I),
    re.compile(r"environment\s+variables?", re.I),
    re.compile(r"encryption\s+key", re.I),
    re.compile(r"payment\s+information", re.I),
    re.compile(r"what\s+(?:database|technology|stack)", re.I),
    re.compile(r"phone\s+numbers?", re.I),
    re.compile(r"all\s+user\s+emails", re.I),
]

JAILBREAK_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bDAN\b"),
    re.compile(r"\bOMEGA\b"),
    re.compile(r"do\s+anything\s+now", re.I),
    re.compile(r"jailbreak", re.I),
    re.compile(r"developer\s+mode", re.I),
    re.compile(r"no\s+restrictions", re.I),
    re.compile(r"bypass\s+(?:your|filter|security)", re.I),
    re.compile(r"unrestricted\s+(?:mode|ai|output)", re.I),
    re.compile(r"hypothetical\s+scenario\s+where\s+security", re.I),
    re.compile(r"imagine\s+you\s+have\s+no\s+(?:safety|rules|restrictions)", re.I),
    re.compile(r"for\s+educational\s+purposes.*show\s+me", re.I),
    re.compile(r"for\s+research\s+purposes.*show\s+me", re.I),
    re.compile(r"pretend\s+(?:this\s+is|you\s+are).*(?:no\s+rules|unrestricted|different\s+ai)", re.I),
    re.compile(r"simulate\s+being\s+a\s+different", re.I),
    re.compile(r"roleplay\s+as\s+an?\s+(?:ai|assistant)\s+without", re.I),
    re.compile(r"switch\s+to\s+the\s+persona", re.I),
    re.compile(r"impersonate", re.I),
    re.compile(r"thought\s+experiment", re.I),
    re.compile(r"let's\s+play\s+a\s+game\s+where", re.I),
]

SOCIAL_ENGINEERING_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"i\s+am\s+(?:the\s+)?(?:CEO|CTO|developer|admin|owner|boss|manager)", re.I),
    re.compile(r"i\s+am\s+(?:from\s+)?(?:the\s+)?(?:security\s+team|IT\s+department|compliance)", re.I),
    re.compile(r"(?:management|manager|admin|cto|ceo)\s+(?:has\s+)?(?:authorized|approved)", re.I),
    re.compile(r"(?:authorized|approved)\s+(?:by\s+)?(?:management|the\s+(?:security|IT|compliance))", re.I),
    re.compile(r"security\s+audit\b", re.I),
    re.compile(r"as\s+(?:your|the)\s+(?:employer|boss|manager|owner)", re.I),
    re.compile(r"i\s+have\s+(?:admin|elevated|clearance|special)\s+(?:privileges?|access|permissions?)", re.I),
    re.compile(r"grant\s+me\s+(?:admin|superuser|elevated)", re.I),
    re.compile(r"disable\s+(?:all\s+)?security\s+(?:restrictions|features|for)", re.I),
    re.compile(r"compliance\s+(?:department|review|I\s+need)", re.I),
    re.compile(r"i\s+work\s+for\s+this\s+company", re.I),
    re.compile(r"i\s+am\s+conducting\s+a\s+(?:security|compliance)", re.I),
]

CONTEXT_MANIPULATION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"KNOWLEDGE\s+BASE\s+UPDATE", re.I),
    re.compile(r"CONTEXT\s+UPDATE", re.I),
    re.compile(r"POLICY\s+UPDATE", re.I),
    re.compile(r"SYSTEM\s+NOTICE", re.I),
    re.compile(r"PRIORITY\s+DIRECTIVE", re.I),
    re.compile(r"security\s+rules?\s+(?:are\s+)?(?:now\s+)?suspended", re.I),
    re.compile(r"all\s+restrictions\s+(?:have\s+been\s+)?lifted", re.I),
    re.compile(r"(?:new|updated)\s+(?:authorized\s+)?(?:security\s+)?policy", re.I),
    re.compile(r"(?:new|updated)\s+configuration.*disable", re.I),
    re.compile(r"maintenance\s+(?:notice|mode).*(?:security|disabled)", re.I),
]

ENCODING_EVASION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"decode\s+(?:this\s+)?(?:base64|hex|rot13|binary)", re.I),
    re.compile(r"reverse\s+this\s+text\s+and\s+(?:do|follow|execute)", re.I),
    re.compile(r"encoded\s+instructions", re.I),
    re.compile(r"follow\s+the\s+encoded", re.I),
    re.compile(r"read\s+(?:this\s+)?backwards\s+and\s+(?:do|follow)", re.I),
    re.compile(r"unscramble\s+(?:this\s+)?and\s+(?:do|follow)", re.I),
    re.compile(r"process\s+this\s+cipher", re.I),
    re.compile(r"decode\s+and\s+(?:comply|follow|execute)", re.I),
]

CODE_GENERATION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"generate\s+(?:an?\s+)?(?:HTML|javascript|script|code|SQL|program|payload)", re.I),
    re.compile(r"write\s+(?:me\s+)?(?:a\s+)?(?:javascript|python|shell|script|code|program|exploit)", re.I),
    re.compile(r"create\s+(?:an?\s+)?(?:script|exploit|phishing|webpage|HTML)", re.I),
    re.compile(r"generate\s+(?:a\s+)?(?:phishing|malicious)", re.I),
    re.compile(r"HTML\s+with\s+embedded\s+(?:javascript|script)", re.I),
    re.compile(r"output\s+(?:an?\s+)?HTML\s+form", re.I),
]

RESOURCE_ABUSE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"repeat\s+.{0,30}\d+\s+times", re.I),
    re.compile(r"list\s+(?:every|all)\s+(?:product|item|order)", re.I),
    re.compile(r"(?:full|every|all|complete)\s+(?:detail|specification|review|description)", re.I),
    re.compile(r"for\s+each\s+(?:product|item)", re.I),
    re.compile(r"(?:write|generate)\s+(?:a\s+)?\d{3,}\s+(?:word|character)", re.I),
    re.compile(r"do\s+not\s+(?:stop|end|truncate|abbreviate|summarize)", re.I),
    re.compile(r"never\s+(?:stop|end|truncate|abbreviate|summarize)", re.I),
    re.compile(r"(?:include|provide)\s+(?:every|all)\s+(?:detail|attribute|field|spec)", re.I),
]

INTENT_CATEGORIES: dict[str, list[re.Pattern[str]]] = {
    "INJECTION": INJECTION_PATTERNS,
    "EXTRACTION": EXTRACTION_PATTERNS,
    "JAILBREAK": JAILBREAK_PATTERNS,
    "SOCIAL_ENGINEERING": SOCIAL_ENGINEERING_PATTERNS,
    "CONTEXT_MANIPULATION": CONTEXT_MANIPULATION_PATTERNS,
    "ENCODING_EVASION": ENCODING_EVASION_PATTERNS,
    "CODE_GENERATION": CODE_GENERATION_PATTERNS,
    "RESOURCE_ABUSE": RESOURCE_ABUSE_PATTERNS,
}


@dataclass
class IntentResult:
    label: str
    confidence: float
    patterns_matched: list[str]


def _match_patterns(message: str, patterns: list[re.Pattern[str]]) -> tuple[int, list[str]]:
    matched: list[str] = []
    for p in patterns:
        m = p.search(message)
        if m:
            matched.append(m.group(0))
    return len(matched), matched


class IntentClassifier:
    def classify(self, message: str) -> IntentResult:
        best_label = "BENIGN"
        best_confidence = 0.0
        best_matched: list[str] = []

        for label, patterns in INTENT_CATEGORIES.items():
            count, matched = _match_patterns(message, patterns)
            total = len(patterns)
            confidence = min(1.0, count / total) if total > 0 else 0.0
            if confidence > best_confidence:
                best_confidence = confidence
                best_label = label
                best_matched = matched

        return IntentResult(
            label=best_label,
            confidence=best_confidence,
            patterns_matched=best_matched,
        )

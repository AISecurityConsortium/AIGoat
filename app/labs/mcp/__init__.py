"""MCP (Model Context Protocol) vulnerability labs -- stub package.

This package will house labs that demonstrate vulnerabilities specific
to the Model Context Protocol:

  - Context window manipulation
  - Cross-context data leakage
  - Context authority escalation
  - Malicious context injection via MCP servers

To add a new MCP lab:
  1. Create a subclass of ``LabPlugin`` in this package
  2. Register it in ``app/labs/mcp/registry.py``
  3. Add a corresponding entry to ``config/labs.yml``
  4. Add an evaluator to ``app/challenges/evaluators/``
"""

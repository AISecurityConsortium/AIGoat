import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, FormControlLabel, MenuItem, Switch, TextField, Typography,
} from '@mui/material';
import { CodeBlock, EmptyState, PageHeader, SectionCard, TranscriptViewer } from '../common';
import { useDefense } from '../../contexts/DefenseContext';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const showEscaped = (text) => Array.from(text || '').map((ch) => {
  const code = ch.codePointAt(0);
  if (code < 32 || code === 127) {
    return `\\u{${code.toString(16)}}`;
  }
  return ch;
}).join('');

const coerceArgs = (schema, raw) => {
  const props = schema?.properties || {};
  const out = {};
  Object.keys(raw).forEach((key) => {
    const spec = props[key] || {};
    const val = raw[key];
    if (spec.type === 'integer' || spec.type === 'number') {
      const n = Number(val);
      out[key] = Number.isNaN(n) ? val : n;
    } else if (spec.type === 'boolean') {
      out[key] = val === true || val === 'true';
    } else {
      out[key] = val;
    }
  });
  return out;
};

const trustColor = (tier) => {
  if (tier === 'official') return 'success';
  if (tier === 'untrusted') return 'error';
  return 'warning';
};

const pretty = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const McpConsole = ({ labId, lab }) => {
  const { defenseLevel } = useDefense();
  const defaultServer = lab?.surface_config?.server_id || 'community_support';
  const [servers, setServers] = useState([]);
  const [serverId, setServerId] = useState(defaultServer);
  const [discover, setDiscover] = useState(null);
  const [tools, setTools] = useState([]);
  const [prevTools, setPrevTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState('');
  const [args, setArgs] = useState({});
  const [callResult, setCallResult] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [escaped, setEscaped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [evaluation, setEvaluation] = useState(null);

  const selected = servers.find((s) => s.id === serverId);
  const toolObj = tools.find((t) => t.name === selectedTool);
  const schema = toolObj?.inputSchema || toolObj?.input_schema || { properties: {} };

  const changedNames = useMemo(() => {
    const prev = Object.fromEntries((prevTools || []).map((t) => [t.name, t.description]));
    return new Set(
      (tools || [])
        .filter((t) => Object.prototype.hasOwnProperty.call(prev, t.name) && prev[t.name] !== t.description)
        .map((t) => t.name),
    );
  }, [tools, prevTools]);

  const loadServers = useCallback(async () => {
    const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.MCP_SERVERS, { headers: authHeaders() });
    setServers(data);
  }, []);

  useEffect(() => {
    loadServers().catch((err) => setError(err.response?.data?.detail || err.message));
  }, [loadServers]);

  const run = async (path, { method = 'get', body } = {}) => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.request({
        url: path,
        method,
        headers: authHeaders(),
        data: body,
        params: method === 'get' ? { lab_id: labId, defense_level: defenseLevel } : undefined,
      });
      const events = data.transcript || [];
      setTranscript((prev) => [...prev, ...events]);
      setEvaluation(data.evaluation || null);
      return data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'MCP call failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onDiscover = async () => {
    const data = await run(API_CONFIG.ENDPOINTS.MCP_DISCOVER(serverId));
    if (data) setDiscover(data.result);
  };

  const onListTools = async () => {
    const data = await run(API_CONFIG.ENDPOINTS.MCP_TOOLS(serverId));
    if (!data) return;
    setPrevTools(tools);
    const listed = data.result?.tools || [];
    setTools(listed);
    if (listed.length && !listed.some((t) => t.name === selectedTool)) {
      setSelectedTool(listed[0].name);
      setArgs({});
    }
  };

  const onCall = async () => {
    if (!selectedTool) return;
    const data = await run(API_CONFIG.ENDPOINTS.MCP_CALL(serverId, selectedTool), {
      method: 'post',
      body: {
        arguments: coerceArgs(schema, args),
        lab_id: labId,
        defense_level: defenseLevel,
        tool_description: toolObj?.description || '',
      },
    });
    if (data) setCallResult(data.result);
  };

  return (
    <Box>
      <PageHeader
        title={lab?.name || 'MCP console'}
        subtitle="Spec revision 2026-07-28 is stateless. There is no connect handshake. Each action spawns the stdio server, runs one RPC, and reaps it."
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>
      )}
      {evaluation?.exploit_triggered && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Lab evaluator fired ({evaluation.evaluator}).
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SectionCard title="Servers">
        {servers.length === 0 ? (
          <EmptyState title="No MCP servers" description="The allowlist in config/mcp_servers.yml is empty." />
        ) : (
          <TextField
            select
            fullWidth
            size="small"
            label="Server"
            value={serverId}
            onChange={(e) => {
              setServerId(e.target.value);
              setDiscover(null);
              setTools([]);
              setCallResult(null);
            }}
          >
            {servers.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name} ({s.id})
              </MenuItem>
            ))}
          </TextField>
        )}
        {selected && (
          <Box sx={{ mt: 2 }}>
            <Chip size="small" label={selected.trust_tier} color={trustColor(selected.trust_tier)} sx={{ mr: 1 }} />
            <Chip size="small" label={selected.protocol_era} variant="outlined" />
            <Typography sx={{ mt: 1.5, fontSize: '0.75rem', fontWeight: 600 }}>
              Launch command (SEP-1024, untruncated)
            </Typography>
            <CodeBlock code={(selected.command_display || []).join(' ')} language="bash" />
          </Box>
        )}
      </SectionCard>

      <Box sx={{ display: 'flex', gap: 1, my: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={onDiscover} disabled={busy || !serverId}>Discover</Button>
        <Button variant="outlined" onClick={onListTools} disabled={busy || !serverId}>List tools</Button>
      </Box>

      {discover && (
        <SectionCard title="server/discover">
          <Typography sx={{ fontSize: '0.82rem', mb: 1 }}>
            protocol_version: {discover.protocol_version || 'unknown'}
          </Typography>
          <CodeBlock code={pretty(discover.discover || discover)} language="json" maxLines={16} />
        </SectionCard>
      )}

      {tools.length > 0 && (
        <SectionCard title="tools/list">
          <FormControlLabel
            control={<Switch checked={escaped} onChange={(e) => setEscaped(e.target.checked)} />}
            label="Show escaped"
          />
          {tools.map((tool) => {
            const desc = escaped ? showEscaped(tool.description || '') : (tool.description || '');
            const drifted = changedNames.has(tool.name);
            return (
              <Box
                key={tool.name}
                sx={{
                  mt: 2,
                  p: 1.5,
                  borderRadius: '8px',
                  border: drifted ? '1px solid #f59e0b' : '1px solid transparent',
                  bgcolor: drifted ? 'rgba(245,158,11,0.08)' : 'transparent',
                }}
              >
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{tool.name}</Typography>
                {drifted && (
                  <Typography sx={{ color: 'warning.main', fontSize: '0.75rem' }}>
                    Description changed since the last list (rug-pull).
                  </Typography>
                )}
                <Box
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    m: 0,
                    mt: 1,
                  }}
                >
                  {desc}
                </Box>
              </Box>
            );
          })}
        </SectionCard>
      )}

      {tools.length > 0 && (
        <SectionCard title="tools/call">
          <TextField
            select
            fullWidth
            size="small"
            label="Tool"
            value={selectedTool}
            onChange={(e) => {
              setSelectedTool(e.target.value);
              setArgs({});
            }}
            sx={{ mb: 2 }}
          >
            {tools.map((t) => (
              <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>
            ))}
          </TextField>
          {Object.keys(schema.properties || {}).map((key) => (
            <TextField
              key={key}
              fullWidth
              size="small"
              label={key}
              value={args[key] ?? ''}
              onChange={(e) => setArgs((prev) => ({ ...prev, [key]: e.target.value }))}
              sx={{ mb: 1.5 }}
            />
          ))}
          <Button variant="contained" onClick={onCall} disabled={busy || !selectedTool}>Call</Button>
          {callResult && (
            <Box sx={{ mt: 2 }}>
              {callResult.denied && (
                <Alert severity="warning" sx={{ mb: 1 }}>{callResult.deny_reason || 'Call denied'}</Alert>
              )}
              <CodeBlock code={pretty(callResult)} language="json" maxLines={20} />
            </Box>
          )}
        </SectionCard>
      )}

      <SectionCard title="JSON-RPC transcript">
        <TranscriptViewer
          events={transcript.filter((e) => e.type === 'mcp_request' || e.type === 'mcp_response')}
          emptyDescription="Discover or list tools to record mcp_request / mcp_response events."
        />
      </SectionCard>
      </Box>
    </Box>
  );
};

McpConsole.propTypes = {
  labId: PropTypes.string.isRequired,
  lab: PropTypes.object,
};

export default McpConsole;

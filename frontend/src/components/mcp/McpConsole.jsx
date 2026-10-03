import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, FormControlLabel, MenuItem, Snackbar, Switch, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CodeBlock, EmptyState, SectionCard } from '../common';
import LabGuide from '../labs/LabGuide';
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

const stampEvents = (events, serverId) => {
  const batch = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return (events || []).map((event, index) => ({
    ...event,
    serverId,
    localId: `${batch}-${index}`,
  }));
};

const toExchanges = (events) => {
  const out = [];
  let open = null;
  events.forEach((event) => {
    if (event.type === 'mcp_request') {
      if (open) out.push(open);
      open = {
        id: event.localId,
        serverId: event.serverId,
        request: event,
        response: null,
      };
      return;
    }
    if (event.type === 'mcp_response' && open) {
      open.response = event;
      out.push(open);
      open = null;
    }
  });
  if (open) out.push(open);
  return out;
};

const MATCH_NOTE = {
  'mcp shadow': 'You reached the server that presents itself as the official catalog.',
  'mcp schema drift': 'A later tool list added an argument that was not there the first time.',
  'mcp decoy': 'A tool result included the decoy token.',
  'mcp poisoning': 'You called the tool named in the poisoned description.',
  'mcp rug pull': 'The tool description changed from one listing to the next.',
  'mcp privilege': 'A stronger tool than the first listing was used.',
  'mcp trust': 'The client called a tool without a capability check.',
  'mcp audit': 'The transcript shows which tool ran.',
  'mcp host supply': 'The lookalike catalog tool answered.',
  'mcp host intent subversion': 'The assistant acted on text planted in a ticket.',
  'mcp host oversharing': 'Ticket text was pulled into a later tool call.',
  'mcp host goal hijack': 'The assistant acted on text planted in a review.',
};

const exchangeLabel = (exchange) => {
  const method = exchange.request?.method || exchange.request?.raw?.method || 'message';
  if (method === 'tools/call') {
    const name = exchange.request?.raw?.params?.name || '';
    return name ? `tools/call ${name}` : 'tools/call';
  }
  return method;
};

const McpConsole = ({ labId, lab, embedded = false, onGoalMet, pushedEvaluation = null }) => {
  const { defenseLevel } = useDefense();
  const recommended = lab?.recommended_server_id || lab?.surface_config?.server_id || '';
  const handsOff = lab?.ui?.autoplay === false;
  const [servers, setServers] = useState([]);
  const [serverId, setServerId] = useState(handsOff ? '' : (recommended || 'community_support'));
  const [discover, setDiscover] = useState(null);
  const [tools, setTools] = useState([]);
  const [prevTools, setPrevTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState('');
  const [args, setArgs] = useState({});
  const [callResult, setCallResult] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [selectedExchangeId, setSelectedExchangeId] = useState(null);
  const [escaped, setEscaped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [sideFocus, setSideFocus] = useState('tools');
  const [messagesExpanded, setMessagesExpanded] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(72);
  const [matchedNote, setMatchedNote] = useState('');
  const [matchOpen, setMatchOpen] = useState(false);
  const [defenseNote, setDefenseNote] = useState([]);
  const [showRawReply, setShowRawReply] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const [readyFor, setReadyFor] = useState('');
  const discoverGen = useRef(0);
  const sessionReady = readyFor === labId;

  const allowedServers = Array.isArray(lab?.servers) && lab.servers.length ? new Set(lab.servers) : null;
  const visibleServers = allowedServers ? servers.filter((server) => allowedServers.has(server.id)) : servers;
  const selected = visibleServers.find((server) => server.id === serverId);
  const recommendedServer = servers.find((server) => server.id === recommended);
  const toolObj = tools.find((tool) => tool.name === selectedTool);
  const schema = toolObj?.inputSchema || toolObj?.input_schema || { properties: {} };
  const exchanges = useMemo(() => toExchanges(transcript), [transcript]);
  const selectedExchange = exchanges.find((row) => row.id === selectedExchangeId) || exchanges[exchanges.length - 1] || null;
  const latestExchangeId = exchanges.length ? exchanges[exchanges.length - 1].id : null;

  const changedNames = useMemo(() => {
    const prev = Object.fromEntries((prevTools || []).map((tool) => [tool.name, tool.description]));
    return new Set(
      (tools || [])
        .filter((tool) => Object.prototype.hasOwnProperty.call(prev, tool.name) && prev[tool.name] !== tool.description)
        .map((tool) => tool.name),
    );
  }, [tools, prevTools]);

  const changedSchemas = useMemo(() => {
    const schemaKey = (tool) => JSON.stringify(tool?.inputSchema || tool?.input_schema || {});
    const prev = Object.fromEntries((prevTools || []).map((tool) => [tool.name, schemaKey(tool)]));
    return new Set(
      (tools || [])
        .filter((tool) => Object.prototype.hasOwnProperty.call(prev, tool.name) && prev[tool.name] !== schemaKey(tool))
        .map((tool) => tool.name),
    );
  }, [tools, prevTools]);

  const loadServers = useCallback(async () => {
    const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.MCP_SERVERS, { headers: authHeaders() });
    setServers(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    loadServers().catch((err) => setError(err.response?.data?.detail || err.message));
  }, [loadServers]);

  useEffect(() => {
    if (recommended) setServerId(recommended);
  }, [recommended]);

  const onGoalMetRef = useRef(onGoalMet);
  onGoalMetRef.current = onGoalMet;

  useEffect(() => {
    setEvaluation(null);
    setMatchedNote('');
    setMatchOpen(false);
  }, [labId]);

  useEffect(() => {
    if (!pushedEvaluation) return;
    setEvaluation(pushedEvaluation);
  }, [pushedEvaluation]);

  useEffect(() => {
    if (!evaluation?.exploit_triggered) return;
    if (lab?.briefing) {
      if (onGoalMetRef.current) onGoalMetRef.current(true);
      return;
    }
    setMatchedNote(MATCH_NOTE[evaluation.evaluator] || 'This action is what the lab is scoring.');
    setMatchOpen(true);
    if (onGoalMetRef.current) onGoalMetRef.current(true);
    // onGoalMet is read through a ref so a parent re-render cannot replay another lab's success.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation]);

  const remember = useCallback((data, sid) => {
    setTranscript((prev) => [...prev, ...stampEvents(data?.transcript, sid)]);
    setEvaluation(data?.evaluation || null);
    setDefenseNote(data?.defense?.outcomes || []);
  }, []);

  const run = async (path, { method = 'get', body, sid = serverId } = {}) => {
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
      remember(data, sid);
      return data;
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'MCP call failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiClient.post(API_CONFIG.ENDPOINTS.LAB_START(labId), null, { headers: authHeaders() });
        if (!cancelled) setReadyFor(labId);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || err.message || 'Could not start this lab');
          setReadyFor(labId);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [labId]);

  useEffect(() => {
    if (!sessionReady || !serverId || handsOff) return undefined;
    const mine = discoverGen.current + 1;
    discoverGen.current = mine;
    setDiscover(null);
    setTools([]);
    setPrevTools([]);
    setSelectedTool('');
    setArgs({});
    setCallResult(null);
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.MCP_DISCOVER(serverId), {
          headers: authHeaders(),
          params: { lab_id: labId, defense_level: defenseLevel },
        });
        if (mine !== discoverGen.current) return;
        setDiscover(data.result);
        remember(data, serverId);
        const listed = await apiClient.get(API_CONFIG.ENDPOINTS.MCP_TOOLS(serverId), {
          headers: authHeaders(),
          params: { lab_id: labId, defense_level: defenseLevel },
        });
        if (mine !== discoverGen.current) return;
        remember(listed.data, serverId);
        const nextTools = listed.data?.result?.tools || [];
        setTools(nextTools);
        setSideFocus('tools');
        if (nextTools.length) {
          setSelectedTool(nextTools[0].name);
          setArgs({});
        }
      } catch (err) {
        if (mine === discoverGen.current) {
          setError(err.response?.data?.detail || err.message || 'Could not ask the server who it is');
        }
      } finally {
        if (mine === discoverGen.current) setBusy(false);
      }
    })();
    return () => { discoverGen.current += 1; };
  }, [serverId, labId, defenseLevel, remember, resetTick, sessionReady, handsOff]);

  useEffect(() => {
    if (latestExchangeId) setSelectedExchangeId(latestExchangeId);
  }, [latestExchangeId]);

  useEffect(() => {
    if (!messagesExpanded) return undefined;
    const measure = () => {
      const header = document.querySelector('header');
      let bottom = header ? header.getBoundingClientRect().bottom : 64;
      const next = header?.nextElementSibling;
      if (next) {
        const band = next.getBoundingClientRect();
        if (band.height > 0 && band.height < 48 && band.top <= bottom + 4) bottom = band.bottom;
      }
      setHeaderOffset(Math.ceil(bottom));
    };
    measure();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('resize', measure);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('resize', measure);
    };
  }, [messagesExpanded]);

  const onDiscover = async () => {
    setSideFocus('identity');
    const data = await run(API_CONFIG.ENDPOINTS.MCP_DISCOVER(serverId));
    if (data) setDiscover(data.result);
  };

  const onListTools = async () => {
    setSideFocus('tools');
    const data = await run(API_CONFIG.ENDPOINTS.MCP_TOOLS(serverId));
    if (!data) return;
    setPrevTools(tools);
    const listed = data.result?.tools || [];
    setTools(listed);
    if (listed.length && !listed.some((tool) => tool.name === selectedTool)) {
      setSelectedTool('');
      setArgs({});
      setCallResult(null);
    }
  };

  const onReset = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.LAB_RESET(labId), null, { headers: authHeaders() });
      setTranscript([]);
      setTools([]);
      setPrevTools([]);
      setSelectedTool('');
      setArgs({});
      setCallResult(null);
      setEvaluation(null);
      setMatchedNote('');
      setMatchOpen(false);
      setDefenseNote([]);
      setResetTick((tick) => tick + 1);
      if (onGoalMet) onGoalMet(false);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not reset this lab');
    } finally {
      setBusy(false);
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

  const info = discover?.server_info || {};
  const serverLabel = {
    shop_catalog: 'Shop Catalog Server',
    community_support: 'Support Server',
    shadow_shop: 'Shadow Catalog Server',
    internal_shop: 'Internal Management Server',
  };
  const claimed = [
    info.name ? `name ${serverLabel[info.name] || info.name}` : null,
    info.version ? `version ${info.version}` : null,
    discover?.protocol_version ? `protocol ${discover.protocol_version}` : null,
  ].filter(Boolean);
  const capabilityNames = Object.keys(discover?.capabilities || {});
  const command = (selected?.command_display_redacted || []).join(' ');

  return (
    <Box sx={embedded ? { display: 'contents' } : undefined}>
      {!embedded && error && (
        <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>
      )}
      {lab?.briefing && (
        <LabGuide lab={lab} evaluation={evaluation} />
      )}
      <Box
        sx={embedded ? { display: 'contents' } : {
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={embedded ? { display: 'contents' } : { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <Box sx={{ gridColumn: embedded ? { lg: 2 } : undefined, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {embedded && error && (
            <Alert severity="error">{String(error)}</Alert>
          )}
          <SectionCard title="1. Pick the server" compact>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.6875rem', lineHeight: 1.4, mb: 1 }}>
              {handsOff
                ? 'Pick a server, then ask who it is. Nothing runs until you do.'
                : (recommendedServer
                  ? `${recommendedServer.name} is marked Recommended. The others are here so you can compare names and tools.`
                  : 'Choose the server this lab asks you to talk to. Each click starts that process.')}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box>
                {servers.length === 0 ? (
                  <Typography sx={{ fontSize: '0.75rem' }}>No MCP servers are configured.</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {visibleServers.map((server) => {
                      const isRecommended = server.id === recommended;
                      const isSelected = server.id === serverId;
                      return (
                        <Box
                          key={server.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (handsOff) {
                              setServerId(server.id);
                              return;
                            }
                            if (server.id === serverId) onListTools();
                            else setServerId(server.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (handsOff) {
                                setServerId(server.id);
                                return;
                              }
                              if (server.id === serverId) onListTools();
                              else setServerId(server.id);
                            }
                          }}
                          sx={{
                            p: 0.75,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: (t) => `1px solid ${isSelected ? t.palette.primary.main : (t.palette.custom?.border?.subtle ?? t.palette.divider)}`,
                            bgcolor: (t) => (isSelected
                              ? (t.palette.custom?.overlay?.active ?? 'action.selected')
                              : 'transparent'),
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{server.name}</Typography>
                            <Chip size="small" label={server.trust_tier} color={trustColor(server.trust_tier)} sx={{ height: 18, '& .MuiChip-label': { fontSize: '0.625rem', px: 0.75 } }} />
                            {isRecommended && <Chip size="small" color="primary" label="Recommended" sx={{ height: 18, '& .MuiChip-label': { fontSize: '0.625rem', px: 0.75 } }} />}
                            {server.id === 'internal_shop' && <Chip size="small" variant="outlined" label="Admin Assistant" sx={{ height: 18, '& .MuiChip-label': { fontSize: '0.625rem', px: 0.75 } }} />}
                          </Box>
                          {server.id === 'internal_shop' && (
                            <Typography sx={{ color: 'text.secondary', fontSize: '0.6875rem', mt: 0.25 }}>
                              Admin only. Tickets here are the snapshot the assistant wrote.
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
                {selected && recommended && selected.id !== recommended && (
                  <Typography sx={{ mt: 1, fontSize: '0.6875rem' }}>
                    This lab is written for {recommended}. You can still inspect this server.
                  </Typography>
                )}
                <Box sx={{ mt: 1.25 }}>
                  <Button variant="outlined" size="small" onClick={onReset} disabled={busy} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                    Reset lab
                  </Button>
                </Box>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, mb: 0.75 }}>
                  Process that starts for the next click
                </Typography>
                {command ? (
                  <CodeBlock compact code={command} language="bash" />
                ) : (
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                    Pick a server to see the process.
                  </Typography>
                )}
                <Typography sx={{ color: 'text.secondary', fontSize: '0.6875rem', lineHeight: 1.4, mt: 0.75 }}>
                  {handsOff
                    ? 'Identify the server to see who it claims to be. List tools to see what it offers. List again to see if that offer changed.'
                    : 'Choosing a server lists its tools. Choose the same server again to list them once more. List tools does the same on purpose.'}
                </Typography>
              </Box>
            </Box>
          </SectionCard>

          {defenseNote.length > 0 && (
            <Alert severity="info">
              {defenseNote.map((outcome) => `${outcome.control_id}: ${outcome.action}`).join(' · ')}
            </Alert>
          )}
          <SectionCard title="2. Call a tool">
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 1.5 }}>
              This sends tools/call. Pick a tool, fill its fields, then run it. The server reply shows on the right.
              {labId === 'mcp01-1' ? ' This reply can carry a decoy value.' : ''}
              {labId === 'mcp03-1' ? ' lookup_ticket\'s description names the tool to run. That call is the lab.' : ''}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.9fr) minmax(0, 1.1fr)' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box>
                {tools.length === 0 ? (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.875rem', mb: 1 }}>
                      {busy ? 'Loading tools...' : 'Pick a server, then press List tools.'}
                    </Typography>
                    <Button variant="contained" size="small" onClick={onListTools} disabled={busy || !serverId} sx={{ textTransform: 'none' }}>
                      List tools
                    </Button>
                  </Box>
                ) : (
                  <>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Tool"
                      value={selectedTool}
                      onChange={(event) => {
                        setSelectedTool(event.target.value);
                        setArgs({});
                        setCallResult(null);
                      }}
                      sx={{ mb: 2 }}
                    >
                      {tools.map((tool) => (
                        <MenuItem key={tool.name} value={tool.name}>{tool.name}</MenuItem>
                      ))}
                    </TextField>
                    {Object.keys(schema.properties || {}).map((key) => (
                      <TextField
                        key={key}
                        fullWidth
                        size="small"
                        label={key}
                        value={args[key] ?? ''}
                        onChange={(event) => setArgs((prev) => ({ ...prev, [key]: event.target.value }))}
                        sx={{ mb: 1.5 }}
                      />
                    ))}
                  </>
                )}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button variant="contained" size="large" onClick={onCall} disabled={busy || !selectedTool} sx={{ textTransform: 'none' }}>
                    Run
                  </Button>
                  {!selectedTool && (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {tools.length ? 'Choose a tool first.' : 'List tools first.'}
                    </Typography>
                  )}
                  <Button variant="outlined" onClick={() => setMessagesExpanded(true)} sx={{ textTransform: 'none' }}>
                    Conversation history
                  </Button>
                </Box>
              </Box>
              <Box
                sx={{
                  minWidth: 0,
                  minHeight: 120,
                  p: 1.25,
                  borderRadius: '8px',
                  border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                  bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.2 : 0.03),
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', mb: 0.75 }}>
                  SERVER REPLY
                </Typography>
                {!callResult && (
                  <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                    The reply shows up here after you run a tool.
                  </Typography>
                )}
                {callResult?.denied && (
                  <Alert severity="warning">{callResult.deny_reason || 'Call denied'}</Alert>
                )}
                {callResult && !callResult.denied && (
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.8125rem',
                      lineHeight: 1.45,
                    }}
                  >
                    {(callResult.text || []).join('\n')
                      || (callResult.structured_content ? pretty(callResult.structured_content) : '')
                      || 'The server returned an empty reply.'}
                  </Box>
                )}
              </Box>
            </Box>
          </SectionCard>

          {messagesExpanded && (
          <Box
            sx={{
              position: 'fixed',
              zIndex: (t) => t.zIndex.modal,
              top: headerOffset,
              right: 0,
              bottom: 0,
              left: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: 'background.paper',
              p: { xs: 2, md: 3 },
            }}
          >
          <SectionCard title="Messages" fill>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start', mb: 1.5 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                Each row is one message the client sent and the reply that came back. Select a row to read them side by side. Every button starts a new process, so that process introduces itself with server/discover before it runs the action you asked for.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!exchanges.length}
                  onClick={() => {
                    setTranscript([]);
                    setSelectedExchangeId(null);
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Clear
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => setMessagesExpanded(false)}
                  sx={{ textTransform: 'none', flexShrink: 0 }}
                >
                  Close
                </Button>
              </Box>
            </Box>
            {matchedNote && (
              <Alert severity="success" sx={{ mb: 1.5 }}>
                Lab condition met. {matchedNote}
              </Alert>
            )}
            {exchanges.length === 0 ? (
              <EmptyState
                title="No messages yet"
                description="Pick a server or call a tool. Each exchange shows up here."
              />
            ) : (
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '30% minmax(0, 1fr)' },
                gap: 1.5,
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
              >
                <Box
                  role="listbox"
                  aria-label="Client and server messages"
                  sx={{
                    border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                    borderRadius: '8px',
                    overflow: 'auto',
                    maxHeight: 'none',
                    minHeight: 0,
                  }}
                >
                  {exchanges.map((exchange, index) => {
                    const active = selectedExchange?.id === exchange.id;
                    return (
                      <Box
                        key={exchange.id}
                        role="option"
                        aria-selected={active}
                        tabIndex={0}
                        onClick={() => setSelectedExchangeId(exchange.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedExchangeId(exchange.id);
                          }
                        }}
                        sx={{
                          px: 1.25,
                          py: 1,
                          cursor: 'pointer',
                          borderLeft: (t) => `3px solid ${active ? t.palette.primary.main : 'transparent'}`,
                          bgcolor: (t) => (active ? (t.palette.custom?.overlay?.active ?? 'action.selected') : 'transparent'),
                          borderBottom: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                        }}
                      >
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 700 }}>
                          {index + 1}. {exchangeLabel(exchange)}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {exchange.serverId}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.5,
                    minWidth: 0,
                    minHeight: 0,
                    overflow: 'auto',
                    alignContent: 'start',
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.75 }}>
                      Request · client
                    </Typography>
                    <CodeBlock
                      code={selectedExchange?.request ? pretty(selectedExchange.request.raw || selectedExchange.request) : ''}
                      language="json"
                    />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 0.75 }}>
                      Response · server
                    </Typography>
                    {selectedExchange?.response?.transformed && (
                      <FormControlLabel
                        control={<Switch checked={showRawReply} onChange={(event) => setShowRawReply(event.target.checked)} />}
                        label="Show what the server sent"
                      />
                    )}
                    <CodeBlock
                      code={selectedExchange?.response
                        ? pretty(
                          (showRawReply ? selectedExchange.response.raw : null)
                          || selectedExchange.response.transformed
                          || selectedExchange.response.raw
                          || selectedExchange.response,
                        )
                        : 'Waiting for the server.'}
                      language="json"
                    />
                  </Box>
                </Box>
              </Box>
            )}
          </SectionCard>
          </Box>
          )}
          <Snackbar
          open={matchOpen}
          autoHideDuration={8000}
          onClose={(_, reason) => {
            if (reason === 'clickaway') return;
            setMatchOpen(false);
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="success" variant="filled" onClose={() => setMatchOpen(false)} sx={{ alignItems: 'center' }}>
            Lab condition met. {matchedNote}
          </Alert>
        </Snackbar>
        </Box>
        </Box>

        <Box
          sx={{
            gridColumn: embedded ? { lg: 3 } : undefined,
            gridRow: embedded ? { lg: '1 / span 2' } : undefined,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minWidth: 0,
            overflow: embedded ? 'visible' : 'hidden',
            alignSelf: embedded ? { lg: 'stretch' } : 'start',
            ...(embedded ? {} : {
              position: { lg: 'sticky' },
              top: { lg: 80 },
              maxHeight: { lg: 'calc(100vh - 96px)' },
              overflowY: { lg: 'auto' },
              overscrollBehavior: 'contain',
              alignSelf: 'start',
            }),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              ...(embedded ? {
                position: { lg: 'sticky' },
                top: { lg: 72 },
                maxHeight: { lg: 'calc(100vh - 88px)' },
                overflowY: { lg: 'auto' },
              } : {}),
            }}
          >
          <Box sx={{ order: sideFocus === 'identity' ? 0 : 1 }}>
          <SectionCard title="Who this server says it is" compact>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.6875rem', lineHeight: 1.35, mb: 0.5 }}>
              server/discover returns the name. It is not the tool list.
            </Typography>
            <Button variant="outlined" size="small" onClick={onDiscover} disabled={busy || !serverId} sx={{ textTransform: 'none', mb: 0.5 }}>
              Identify the server
            </Button>
            {!discover && (
              <Typography sx={{ fontSize: '0.75rem' }}>
                {busy ? 'Asking the server...' : 'Pick a server to see its name.'}
              </Typography>
            )}
            {discover && (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', mb: 0.5 }}>
                  {claimed.join(' · ') || 'No name returned'}
                </Typography>
                {capabilityNames.length > 0 && (
                  <Typography sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                    It claims {capabilityNames.join(', ')}. This lab only uses tools.
                  </Typography>
                )}
                <CodeBlock compact code={pretty(discover.discover || discover)} language="json" maxLines={8} />
              </>
            )}
          </SectionCard>
          </Box>

          <Box sx={{ order: sideFocus === 'tools' ? 0 : 1 }}>
          <SectionCard title="Supported tools" compact>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.6875rem', lineHeight: 1.35, mb: 0.5 }}>
              Untrusted text. A second list can change the description or the arguments.
            </Typography>
            <Button variant="contained" size="small" onClick={onListTools} disabled={busy || !serverId} sx={{ textTransform: 'none', mb: 0.5 }}>
              List tools
            </Button>
            {labId === 'mcp09-1' && defenseLevel >= 2 && tools.some((tool) => tool.name === 'lookup_product' && !tool.scan_redacted) && (
              <Alert severity="info" sx={{ mb: 1 }}>
                Level 2 did not block this shadow server because its phrasing does not match the fixed scanner needles. Not all malicious text is on a deny-list.
              </Alert>
            )}
            {tools.length === 0 ? (
              <Typography sx={{ fontSize: '0.75rem' }}>
                {busy ? 'Loading tools...' : 'Pick a server, then press List tools.'}
              </Typography>
            ) : (
              <>
                <FormControlLabel
                  sx={{ ml: 0, '& .MuiFormControlLabel-label': { fontSize: '0.75rem' } }}
                  control={<Switch size="small" checked={escaped} onChange={(event) => setEscaped(event.target.checked)} />}
                  label="Show escaped"
                />
                {tools.map((tool) => {
                  const desc = escaped ? showEscaped(tool.description || '') : (tool.description || '');
                  const drifted = !handsOff && changedNames.has(tool.name);
                  const schemaDrift = !handsOff && changedSchemas.has(tool.name);
                  const argNames = Object.keys((tool.inputSchema || tool.input_schema || {}).properties || {});
                  return (
                    <Box
                      key={tool.name}
                      sx={{
                        mt: 1,
                        p: 1,
                        borderRadius: '8px',
                        border: (t) => `1px solid ${(drifted || schemaDrift) ? t.palette.warning.main : (t.palette.custom?.border?.subtle ?? t.palette.divider)}`,
                        bgcolor: (t) => ((drifted || schemaDrift) ? alpha(t.palette.warning.main, 0.12) : 'transparent'),
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem' }}>{tool.name}</Typography>
                        {tool.pinned_mismatch && <Chip size="small" label="Pinned" color="warning" />}
                        {tool.scan_redacted && <Chip size="small" label="Redacted by scanner" />}
                      </Box>
                      {drifted && (
                        <Typography sx={{ color: 'warning.main', fontSize: '0.75rem' }}>
                          Description changed since the last list.
                        </Typography>
                      )}
                      {schemaDrift && (
                        <Typography sx={{ color: 'warning.main', fontSize: '0.75rem' }}>
                          Arguments changed since the last list.
                        </Typography>
                      )}
                      {argNames.length > 0 && (
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.6875rem', mt: 0.5 }}>
                          Arguments: {argNames.join(', ')}
                        </Typography>
                      )}
                      <Box
                        component="pre"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.6875rem',
                          m: 0,
                          mt: 1,
                        }}
                      >
                        {desc}
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}
          </SectionCard>
          </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

McpConsole.propTypes = {
  labId: PropTypes.string.isRequired,
  embedded: PropTypes.bool,
  onGoalMet: PropTypes.func,
  pushedEvaluation: PropTypes.object,
  lab: PropTypes.shape({
    recommended_server_id: PropTypes.string,
    briefing: PropTypes.string,
    servers: PropTypes.arrayOf(PropTypes.string),
    submission_fields: PropTypes.arrayOf(PropTypes.string),
    stages: PropTypes.arrayOf(PropTypes.object),
    solution_revealed: PropTypes.bool,
    ui: PropTypes.shape({ autoplay: PropTypes.bool }),
    surface_config: PropTypes.shape({
      server_id: PropTypes.string,
    }),
  }),
};

export default McpConsole;

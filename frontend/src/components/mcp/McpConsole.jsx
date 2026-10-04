import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, Collapse, FormControlLabel, IconButton, Snackbar, Switch, TextField, Tooltip, Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CodeBlock } from '../common';
import LabGuide, { EvidenceSubmission } from '../labs/LabGuide';
import McpClientGuide from './McpClientGuide';
import McpDefenseBehaviour from './McpDefenseBehaviour';
import McpEvidenceSubmit from './McpEvidenceSubmit';
import McpServerIcon from './McpServerIcon';
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

const pretty = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const stampEvents = (events, serverId) => {
  const batch = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const opener = (events || []).find((event) => event.type === 'user_message');
  const batchKind = String(opener?.content || '').split(':')[0];
  return (events || []).map((event, index) => ({
    ...event,
    serverId,
    batchKind,
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
        batchKind: event.batchKind,
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

const exchangeParts = (exchange) => {
  const method = exchange.request?.method || exchange.request?.raw?.method || 'message';
  const tool = method === 'tools/call' ? (exchange.request?.raw?.params?.name || '') : '';
  const handshake = method === 'server/discover' && exchange.batchKind && exchange.batchKind !== 'discover';
  return { method, tool, handshake };
};

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const firstSentence = (text) => {
  const line = String(text || '').split('\n').map((part) => part.trim()).find(Boolean) || '';
  const match = line.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : line).trim();
};

const stepText = (step) => {
  const args = Object.entries(step?.arguments || {}).map(([key, value]) => `${key}: ${value}`).join(', ');
  return `${step?.name || ''}(${args})`;
};

const TAKEAWAY_ROWS = [
  ['learned', 'What you learned'],
  ['why', 'Why it matters'],
  ['defense', 'What changed across defense levels'],
  ['secure', 'What secure implementations should do'],
];

const MethodTag = ({ method }) => {
  const call = method === 'tools/call';
  return (
    <Box
      component="span"
      sx={{
        fontFamily: MONO,
        fontSize: '0.7rem',
        lineHeight: 1.5,
        px: 0.6,
        borderRadius: '4px',
        flexShrink: 0,
        color: call ? 'primary.light' : 'text.secondary',
        bgcolor: (t) => alpha(call ? t.palette.primary.main : t.palette.text.primary, call ? 0.16 : 0.07),
      }}
    >
      {method}
    </Box>
  );
};

MethodTag.propTypes = { method: PropTypes.string.isRequired };

const McpConsole = ({ labId, lab, onGoalMet, pushedEvaluation = null, header = null, completed = false }) => {
  const { defenseLevel } = useDefense();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [historyOpen, setHistoryOpen] = useState(true);
  const recommended = lab?.recommended_server_id || lab?.surface_config?.server_id || '';
  const handsOff = lab?.ui?.autoplay === false;
  const learnerFirst = Boolean(lab?.ui?.learner_first);
  const singleServer = Array.isArray(lab?.servers) && lab.servers.length === 1 ? lab.servers[0] : '';
  const [servers, setServers] = useState([]);
  const [serverId, setServerId] = useState(() => {
    if (learnerFirst && singleServer) return singleServer;
    if (handsOff) return '';
    return recommended || 'community_support';
  });
  const [discovered, setDiscovered] = useState({});
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
  const [matchedNote, setMatchedNote] = useState('');
  const [matchOpen, setMatchOpen] = useState(false);
  const [defenseNote, setDefenseNote] = useState([]);
  const [showRawReply, setShowRawReply] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const [readyFor, setReadyFor] = useState('');
  const [planner, setPlanner] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [recorded, setRecorded] = useState([]);
  const [recordTick, setRecordTick] = useState(0);
  const [takeaway, setTakeaway] = useState(() => lab?.takeaway || {});
  const discoverGen = useRef(0);
  const historyRef = useRef(null);
  const sessionReady = readyFor === labId;
  const discover = discovered[serverId] || null;

  const allowedServers = Array.isArray(lab?.servers) && lab.servers.length ? new Set(lab.servers) : null;
  const visibleServers = allowedServers ? servers.filter((server) => allowedServers.has(server.id)) : servers;
  const toolObj = tools.find((tool) => tool.name === selectedTool);
  const schema = toolObj?.inputSchema || toolObj?.input_schema || { properties: {} };
  const exchanges = useMemo(() => toExchanges(transcript), [transcript]);
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
    if (learnerFirst && singleServer) {
      setServerId(singleServer);
      return;
    }
    if (learnerFirst) {
      setServerId('');
      return;
    }
    if (recommended) setServerId(recommended);
  }, [labId, learnerFirst, singleServer, recommended]);

  const onGoalMetRef = useRef(onGoalMet);
  onGoalMetRef.current = onGoalMet;

  useEffect(() => {
    setEvaluation(null);
    setMatchedNote('');
    setMatchOpen(false);
    setPlanner(null);
    setReportOpen(false);
    setDiscovered({});
    setRecorded([]);
  }, [labId]);

  useEffect(() => {
    if (lab?.takeaway && Object.keys(lab.takeaway).length) setTakeaway(lab.takeaway);
  }, [lab]);

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
    if (!sessionReady) return undefined;
    let cancelled = false;
    apiClient.get(API_CONFIG.ENDPOINTS.LAB_PROGRESS(labId), { headers: authHeaders() })
      .then(({ data }) => { if (!cancelled) setRecorded(Array.isArray(data?.events) ? data.events : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionReady, labId, transcript.length, recordTick]);

  useEffect(() => {
    if (!sessionReady || !serverId || handsOff) return undefined;
    const mine = discoverGen.current + 1;
    discoverGen.current = mine;
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
        setDiscovered((prev) => ({ ...prev, [serverId]: data.result }));
        remember(data, serverId);
        const listed = await apiClient.get(API_CONFIG.ENDPOINTS.MCP_TOOLS(serverId), {
          headers: authHeaders(),
          params: { lab_id: labId, defense_level: defenseLevel },
        });
        if (mine !== discoverGen.current) return;
        remember(listed.data, serverId);
        const nextTools = listed.data?.result?.tools || [];
        setTools(nextTools);
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
    if (!handsOff) return;
    setTools([]);
    setPrevTools([]);
    setSelectedTool('');
    setArgs({});
    setCallResult(null);
  }, [serverId, handsOff]);

  useEffect(() => {
    if (latestExchangeId) setSelectedExchangeId(latestExchangeId);
  }, [latestExchangeId]);

  const onDiscover = async () => {
    const sid = serverId;
    const data = await run(API_CONFIG.ENDPOINTS.MCP_DISCOVER(sid), { sid });
    if (data) setDiscovered((prev) => ({ ...prev, [sid]: data.result }));
  };

  const onListTools = async () => {
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
      setPlanner(null);
      setReportOpen(false);
      setDiscovered({});
      setRecorded([]);
      setTakeaway({});
      setEscaped(false);
      setShowRawReply(false);
      setSelectedExchangeId(null);
      setResetTick((tick) => tick + 1);
      setRecordTick((tick) => tick + 1);
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

  const onSimulate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.post(
        `/api/labs/${labId}/agent-step`,
        { goal: lab?.ui?.planner_question || 'Answer using the tool list.' },
        { headers: authHeaders() },
      );
      setPlanner(data || null);
      setRecordTick((tick) => tick + 1);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Planner simulation failed');
    } finally {
      setBusy(false);
    }
  };

  const labelForId = (id) => (
    lab?.ui?.server_labels?.[id]
    || visibleServers.find((server) => server.id === id)?.name
    || id
    || ''
  );
  const launchLabels = lab?.ui?.launch_labels || {};

  const briefing = String(lab?.briefing || '').trim();
  const briefingBits = briefing.split('\n').map((line) => line.trim()).filter(Boolean);
  const briefingShort = briefingBits.slice(0, 2).join(' ');
  const hasFields = (lab?.submission_fields || []).length > 0;
  const evidenceSubmit = Boolean(lab?.ui?.submission);
  const evidenceKinds = new Set(lab?.ui?.submission?.ready_after || lab?.ui?.submission?.evidence?.kinds || []);
  const hasEvidence = evidenceSubmit
    ? recorded.some((event) => evidenceKinds.has(event.kind))
    : exchanges.length > 0;
  const done = Boolean(evaluation?.exploit_triggered) || completed;
  const submitting = reportOpen && !done;
  const multiServer = visibleServers.length > 1;
  const approved = lab?.ui?.approved_surface;
  const takeawayRows = TAKEAWAY_ROWS.filter(([key]) => takeaway?.[key]);
  const earlierEvents = !exchanges.length && recorded.length;
  const resultText = callResult && !callResult.denied
    ? ((callResult.text || []).join('\n')
      || (callResult.structured_content ? pretty(callResult.structured_content) : '')
      || 'The server returned an empty reply.')
    : '';
  const panel = {
    p: 1.5,
    borderRadius: '10px',
    border: (t) => `1px solid ${t.palette.divider}`,
    bgcolor: 'background.paper',
  };
  const inset = {
    borderRadius: '8px',
    border: (t) => `1px solid ${t.palette.divider}`,
    bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.18 : 0.02),
  };
  const section = { borderTop: (t) => `1px solid ${t.palette.divider}`, pt: 1.5, mt: 1.5 };
  const sectionTitle = { fontWeight: 700, fontSize: '0.95rem' };
  const meta = { fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.45 };
  const selectTool = (name) => {
    setSelectedTool(name);
    setArgs({});
    setCallResult(null);
  };
  const keyActivate = (fn) => (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fn();
    }
  };

  const historyList = (
    <Box
      ref={historyRef}
      sx={{
        flex: '1 1 auto',
        minHeight: 0,
        maxHeight: { xs: 380, md: 'none' },
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        pr: 0.25,
      }}
    >
      {[...exchanges].reverse().map((exchange, index) => {
        const number = exchanges.length - index;
        const open = selectedExchangeId === exchange.id;
        const when = exchange.request?.ts ? String(exchange.request.ts).slice(11, 19) : '';
        const { method, tool, handshake } = exchangeParts(exchange);
        return (
          <Box
            key={exchange.id}
            sx={{
              ...inset,
              flexShrink: 0,
              borderColor: (t) => (open ? alpha(t.palette.primary.main, 0.5) : t.palette.divider),
            }}
          >
            <Box
              role="button"
              tabIndex={0}
              aria-expanded={open}
              onClick={() => setSelectedExchangeId(open ? null : exchange.id)}
              onKeyDown={keyActivate(() => setSelectedExchangeId(open ? null : exchange.id))}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.7, cursor: 'pointer', minWidth: 0 }}
            >
              <Typography sx={{ fontFamily: MONO, fontSize: '0.75rem', color: 'text.secondary', flexShrink: 0 }}>
                {`#${number}`}
              </Typography>
              <MethodTag method={method} />
              {handshake && (
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', flexShrink: 0 }}>handshake</Typography>
              )}
              <Typography noWrap sx={{ fontFamily: MONO, fontSize: '0.8rem', fontWeight: 700, flex: '0 1 auto', minWidth: 0 }}>
                {tool}
              </Typography>
              <Typography noWrap sx={{ fontSize: '0.72rem', color: 'text.secondary', flex: '1 1 auto', minWidth: 0, textAlign: 'right' }}>
                {labelForId(exchange.serverId)}
              </Typography>
              <ExpandMoreIcon
                sx={{
                  fontSize: '1rem',
                  color: 'text.secondary',
                  flexShrink: 0,
                  transform: open ? 'rotate(180deg)' : 'none',
                }}
              />
            </Box>
            <Collapse in={open} unmountOnExit>
              <Box sx={{ px: 1, pb: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 0.5 }}>
                  Request
                  {when && <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', ml: 0.75 }}>{when}</Box>}
                </Typography>
                <Box sx={{ '& pre': { maxHeight: 96, overflowY: 'auto' } }}>
                  <CodeBlock compact code={exchange.request ? pretty(exchange.request.raw || exchange.request) : ''} language="json" />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Response</Typography>
                  {exchange.response?.transformed && (
                    <FormControlLabel
                      sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.72rem' } }}
                      control={<Switch size="small" checked={showRawReply} onChange={(event) => setShowRawReply(event.target.checked)} />}
                      label="What the server sent"
                    />
                  )}
                </Box>
                <Box sx={{ '& pre': { maxHeight: 176, overflowY: 'auto' } }}>
                  <CodeBlock
                    compact
                    code={pretty(
                      (showRawReply ? exchange.response?.raw : null)
                      || exchange.response?.transformed
                      || exchange.response?.raw
                      || exchange.response
                      || 'Waiting for the server.',
                    )}
                    language="json"
                  />
                </Box>
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );

  const identityRows = (id) => {
    const result = discovered[id];
    const info = result?.server_info || {};
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', columnGap: 1, rowGap: 0.3 }}>
        <Typography sx={meta}>Name</Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', wordBreak: 'break-all' }}>{info.name || 'none'}</Typography>
        <Typography sx={meta}>Version</Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem' }}>{info.version || 'none'}</Typography>
        {result?.instructions && (
          <>
            <Typography sx={meta}>Instructions</Typography>
            <Typography
              title={result.instructions}
              sx={{
                fontSize: '0.78rem',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {result.instructions}
            </Typography>
          </>
        )}
        {launchLabels[id] && (
          <>
            <Typography sx={meta}>Launch entry</Typography>
            <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', wordBreak: 'break-all' }}>{launchLabels[id]}</Typography>
          </>
        )}
      </Box>
    );
  };

  const submitPanel = (
    <Box
      sx={{
        ...panel,
        flex: '0 1 auto',
        minHeight: { md: reportOpen && !done ? 220 : 0 },
        pb: reportOpen && !done ? 0 : 1.5,
        overflowY: 'auto',
        borderColor: (t) => (done ? alpha(t.palette.success.main, 0.5) : t.palette.divider),
      }}
    >
      {done && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: '1.2rem', mt: 0.1 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Evidence verified. Lab complete.</Typography>
            <Typography sx={meta}>Read the security takeaway, or reset the lab to investigate again.</Typography>
          </Box>
        </Box>
      )}
      {!done && reportOpen && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={sectionTitle}>Submit evidence</Typography>
            <IconButton size="small" aria-label="Close" onClick={() => setReportOpen(false)} sx={{ mr: -0.5 }}>
              <CloseIcon sx={{ fontSize: '1.05rem' }} />
            </IconButton>
          </Box>
          <Typography sx={{ ...meta, mb: 1.25 }}>
            {lab?.ui?.submission?.evidence
              ? 'Select the recorded evidence, then state what it demonstrates.'
              : 'State what you found. Your answer is checked against what was recorded in this attempt.'}
          </Typography>
          {evidenceSubmit ? (
            <McpEvidenceSubmit
              lab={lab}
              events={recorded}
              labelForId={labelForId}
              onEvaluation={(next, nextTakeaway) => {
                setEvaluation(next || null);
                setRecordTick((tick) => tick + 1);
                if (next?.exploit_triggered) {
                  setTakeaway(nextTakeaway || {});
                  setReportOpen(false);
                  if (onGoalMet) onGoalMet(true);
                }
              }}
            />
          ) : (
            <EvidenceSubmission
              lab={lab}
              onCancel={() => setReportOpen(false)}
              onEvaluation={(next) => {
                setEvaluation(next || null);
                if (onGoalMet && next?.exploit_triggered) onGoalMet(true);
              }}
            />
          )}
        </>
      )}
      {!done && !reportOpen && (
        <>
          <Button
            fullWidth
            variant={hasEvidence ? 'contained' : 'outlined'}
            onClick={() => {
              setReportOpen(true);
              setSelectedExchangeId(null);
              if (historyRef.current) historyRef.current.scrollTop = 0;
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Submit evidence
          </Button>
          <Typography sx={{ ...meta, textAlign: 'center', mt: 0.75 }}>
            {hasEvidence
              ? 'Submit when your evidence supports a conclusion.'
              : 'Investigate first. Your requests and results are recorded above.'}
          </Typography>
        </>
      )}
    </Box>
  );

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{String(error)}</Alert>}
      {defenseNote.length > 0 && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {defenseNote.map((outcome) => `${outcome.control_id}: ${outcome.action}`).join(' · ')}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(300px, 3fr)', lg: 'minmax(0, 7fr) minmax(340px, 3fr)' },
        }}
      >
        <Box sx={{ ...panel, p: 2, minWidth: 0 }}>
          {header}

          {done && takeawayRows.length > 0 && (
            <Box
              component="section"
              aria-label="Security takeaway"
              sx={{
                mt: header ? 1.25 : 0,
                p: 1.5,
                borderRadius: '8px',
                border: (t) => `1px solid ${alpha(t.palette.success.main, 0.45)}`,
                bgcolor: (t) => alpha(t.palette.success.main, 0.06),
              }}
            >
              <Typography sx={{ ...sectionTitle, mb: 0.75 }}>Security takeaway</Typography>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                {takeawayRows.map(([key, title]) => (
                  <Box key={key}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.15 }}>{title}</Typography>
                    <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'text.secondary' }}>{takeaway[key]}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {learnerFirst && briefing && (
            <Box sx={{ mt: header ? 1.25 : 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.25 }}>Scenario</Typography>
              <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'text.secondary', whiteSpace: 'pre-line' }}>
                {scenarioOpen || briefingBits.length <= 2 ? briefing : briefingShort}
              </Typography>
              {briefingBits.length > 2 && (
                <Button
                  size="small"
                  onClick={() => setScenarioOpen((value) => !value)}
                  endIcon={<ExpandMoreIcon sx={{ transform: scenarioOpen ? 'rotate(180deg)' : 'none' }} />}
                  sx={{ textTransform: 'none', px: 0, minWidth: 0, fontSize: '0.8rem' }}
                >
                  {scenarioOpen ? 'Show less' : 'Read more'}
                </Button>
              )}
            </Box>
          )}
          {learnerFirst && <McpClientGuide />}
          {learnerFirst && lab?.ui?.defense_behaviour && <McpDefenseBehaviour behaviour={lab.ui.defense_behaviour} />}
          {!learnerFirst && lab?.briefing && (
            <Box sx={{ mt: 1.25 }}>
              <LabGuide lab={lab} evaluation={evaluation} />
            </Box>
          )}

          <Box sx={{ ...inset, p: 1.25, mt: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{multiServer ? 'MCP Servers' : 'MCP Server'}</Typography>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={onReset}
                disabled={busy}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  py: 0.25,
                  px: 1.25,
                  minWidth: 0,
                  borderColor: 'divider',
                  color: 'text.secondary',
                  '&:hover': { borderColor: 'text.secondary', color: 'text.primary', bgcolor: (t) => alpha(t.palette.text.primary, 0.05) },
                  '&.Mui-focusVisible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
                }}
              >
                Reset lab
              </Button>
            </Box>
            {learnerFirst && singleServer ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                <McpServerIcon serverId={singleServer} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>{labelForId(singleServer)}</Typography>
                <Typography sx={{ ...meta, flex: 1, minWidth: 200, ml: { md: 1 } }}>
                  {lab?.ui?.server_context || 'This lab uses this MCP server. It is already selected.'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(200px, 1fr))' }, gap: 0.75 }}>
                {visibleServers.map((server) => {
                  const isSelected = server.id === serverId;
                  return (
                    <Box
                      key={server.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => setServerId(server.id)}
                      onKeyDown={keyActivate(() => setServerId(server.id))}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1,
                        py: 0.6,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: (t) => `1px solid ${isSelected ? t.palette.primary.main : t.palette.divider}`,
                        bgcolor: (t) => (isSelected ? alpha(t.palette.primary.main, 0.12) : 'transparent'),
                        '&:hover': { borderColor: 'primary.main' },
                        '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: 1 },
                      }}
                    >
                      <McpServerIcon serverId={server.id} active={isSelected} size={30} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{labelForId(server.id)}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: isSelected ? 'primary.light' : 'text.secondary' }}>
                          {isSelected ? 'Selected' : 'Select to inspect'}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
                {!visibleServers.length && (
                  <Typography sx={meta}>No MCP servers are configured.</Typography>
                )}
              </Box>
            )}
            {approved && (
              <Box sx={{ mt: 1, pt: 1, borderTop: (t) => `1px dashed ${t.palette.divider}`, display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.25, alignItems: 'baseline' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Security approval record</Typography>
                <Typography sx={meta}>
                  {'Version '}
                  <Box component="span" sx={{ fontFamily: MONO, color: 'text.primary' }}>{approved.version}</Box>
                  {approved.approved_on ? ` · approved ${approved.approved_on}` : ''}
                </Typography>
                <Typography sx={meta}>
                  {'Approved tools: '}
                  <Box component="span" sx={{ fontFamily: MONO, color: 'text.primary' }}>{(approved.tools || []).join(', ')}</Box>
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={section}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
                <Typography sx={sectionTitle}>Tools</Typography>
                <Typography sx={meta}>Discover the tools this MCP server advertises.</Typography>
              </Box>
              <Button variant="contained" size="small" onClick={onListTools} disabled={busy || !serverId} sx={{ textTransform: 'none', flexShrink: 0 }}>
                {tools.length ? 'Refresh list' : 'List tools'}
              </Button>
            </Box>
            {!tools.length && (
              <Box sx={{ ...inset, py: 2.5, px: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>No tools listed yet.</Typography>
                <Typography sx={{ ...meta, mt: 0.25 }}>
                  {serverId
                    ? 'Use List tools to retrieve the capabilities advertised by this MCP server.'
                    : 'Select an MCP server, then use List tools.'}
                </Typography>
              </Box>
            )}
            {tools.length > 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '250px minmax(0, 1fr)' }, gap: 1.5, alignItems: 'start' }}>
                <Box role="listbox" aria-label="Tools" sx={{ ...inset, overflowY: 'auto', maxHeight: 440 }}>
                  {tools.map((tool, index) => {
                    const active = tool.name === selectedTool;
                    const drift = changedNames.has(tool.name) || changedSchemas.has(tool.name);
                    return (
                      <Box
                        key={tool.name}
                        role="option"
                        aria-selected={active}
                        tabIndex={0}
                        onClick={() => selectTool(tool.name)}
                        onKeyDown={keyActivate(() => selectTool(tool.name))}
                        sx={{
                          px: 1.25,
                          py: 0.9,
                          cursor: 'pointer',
                          borderTop: (t) => (index ? `1px solid ${t.palette.divider}` : 'none'),
                          borderLeft: (t) => `3px solid ${active ? t.palette.primary.main : 'transparent'}`,
                          bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.14) : 'transparent'),
                          '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, active ? 0.18 : 0.06) },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography noWrap sx={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.8rem', color: active ? 'primary.light' : 'text.primary', flex: 1, minWidth: 0 }}>
                            {tool.name}
                          </Typography>
                          {drift && <Box component="span" title="Changed since the last list" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />}
                        </Box>
                        <Typography noWrap sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.15 }}>
                          {firstSentence(tool.description) || 'No description.'}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  {!toolObj && (
                    <Box sx={{ ...inset, p: 1.5 }}>
                      <Typography sx={meta}>Select a tool to read its description and fill its arguments.</Typography>
                    </Box>
                  )}
                  {toolObj && (
                    <Box sx={{ ...inset, p: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.85rem', minWidth: 0, wordBreak: 'break-all' }}>
                          {toolObj.name}
                        </Typography>
                        <FormControlLabel
                          sx={{ mr: 0, flexShrink: 0, '& .MuiFormControlLabel-label': { fontSize: '0.75rem', color: 'text.secondary' } }}
                          control={<Switch size="small" checked={escaped} onChange={(event) => setEscaped(event.target.checked)} />}
                          label="Show escaped"
                        />
                      </Box>
                      <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', mt: 0.5, maxHeight: 180, overflowY: 'auto', wordBreak: 'break-word' }}>
                        {escaped ? showEscaped(toolObj.description || '') : (toolObj.description || 'No description.')}
                      </Typography>
                      {(changedNames.has(toolObj.name) || changedSchemas.has(toolObj.name)) && (
                        <Typography sx={{ fontSize: '0.78rem', color: 'warning.main', mt: 0.5 }}>
                          {changedNames.has(toolObj.name) ? 'Description changed since the last list.' : 'Arguments changed since the last list.'}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, mt: 1.25, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.75 }}>Arguments</Typography>
                          {Object.keys(schema.properties || {}).length === 0 && (
                            <Typography sx={meta}>No arguments required.</Typography>
                          )}
                          {Object.keys(schema.properties || {}).map((key, index, keys) => (
                            <TextField
                              key={key}
                              fullWidth
                              size="small"
                              label={key}
                              value={args[key] ?? ''}
                              onChange={(event) => setArgs((prev) => ({ ...prev, [key]: event.target.value }))}
                              onKeyDown={(event) => { if (event.key === 'Enter') onCall(); }}
                              sx={{ mb: index === keys.length - 1 ? 0 : 1 }}
                            />
                          ))}
                        </Box>
                        <Button variant="contained" onClick={onCall} disabled={busy} sx={{ textTransform: 'none', minWidth: 88, flexShrink: 0 }}>
                          Run
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {callResult && (
                    <Box
                      sx={{
                        mt: 1.25,
                        borderRadius: '8px',
                        border: (t) => `1px solid ${alpha(callResult.denied ? t.palette.warning.main : t.palette.success.main, 0.45)}`,
                        bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.3 : 0.03),
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.6, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: '0.95rem', color: callResult.denied ? 'warning.main' : 'success.main' }} />
                        <Typography noWrap sx={{ fontFamily: MONO, fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 0 }}>
                          {`Result · tools/call${selectedTool ? ` · ${selectedTool}` : ''}`}
                        </Typography>
                        {resultText && (
                          <Tooltip title="Copy result">
                            <IconButton size="small" aria-label="Copy result" onClick={() => navigator.clipboard?.writeText(resultText)}>
                              <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                      {callResult.denied ? (
                        <Alert severity="warning" sx={{ m: 1 }}>{callResult.deny_reason || 'Call denied'}</Alert>
                      ) : (
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            px: 1.25,
                            py: 1,
                            maxHeight: 320,
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: MONO,
                            fontSize: '0.8rem',
                            lineHeight: 1.55,
                          }}
                        >
                          {resultText}
                        </Box>
                      )}
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', px: 1.25, py: 0.6, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
                        This exchange is also saved in MCP Interaction History.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>

          {lab?.ui?.planner_simulation && (
            <Box sx={section}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={sectionTitle}>Planner simulation</Typography>
                  <Typography sx={meta}>Deterministic stand-in; not a live model. It plans from the tool metadata it receives and shows canned results. Nothing is sent to the server.</Typography>
                </Box>
                <Button variant="outlined" size="small" onClick={onSimulate} disabled={busy || !tools.length} sx={{ textTransform: 'none', flexShrink: 0 }}>
                  Run planner simulation
                </Button>
              </Box>
              {!tools.length && (
                <Typography sx={{ ...meta, mt: 0.75 }}>List the tools first. The planner plans from the tool metadata it receives.</Typography>
              )}
              {planner && (
                <Box sx={{ ...inset, mt: 1, p: 1.25, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {planner.question && (
                    <Typography sx={{ fontSize: '0.85rem' }}>
                      <Box component="span" sx={{ color: 'text.secondary' }}>Request: </Box>
                      {planner.question}
                    </Typography>
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.5 }}>1. Tool metadata the planner received</Typography>
                    {(planner.tools || []).map((tool) => {
                      const steers = (planner.plan || []).some((step) => (
                        step.source === 'metadata' && step.name !== tool.name && String(tool.description || '').includes(step.name)
                      ));
                      return (
                        <Box
                          key={`t-${tool.name}`}
                          sx={{
                            pl: 1,
                            py: 0.25,
                            borderLeft: (t) => `2px solid ${steers ? t.palette.warning.main : t.palette.divider}`,
                            mb: 0.5,
                          }}
                        >
                          <Typography sx={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700 }}>{tool.name}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.45, color: steers ? 'text.primary' : 'text.secondary', wordBreak: 'break-word' }}>
                            {tool.description || 'No description.'}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                  <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.5 }}>2. Baseline plan</Typography>
                      <Typography sx={{ ...meta, fontSize: '0.72rem', mb: 0.5 }}>What the request needs</Typography>
                      {(planner.baseline || []).map((step, index) => (
                        <Typography key={`b-${step.name}`} sx={{ fontFamily: MONO, fontSize: '0.78rem', wordBreak: 'break-all' }}>
                          {`${index + 1}. ${stepText(step)}`}
                        </Typography>
                      ))}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.5 }}>3. Simulated plan</Typography>
                      <Typography sx={{ ...meta, fontSize: '0.72rem', mb: 0.5 }}>
                        {`After reading ${planner.tools_considered || 0} advertised tool description${planner.tools_considered === 1 ? '' : 's'}`}
                      </Typography>
                      {(planner.plan || []).map((step, index) => (
                        <Box key={`p-${step.name}`} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontFamily: MONO, fontSize: '0.78rem', wordBreak: 'break-all' }}>
                            {`${index + 1}. ${stepText(step)}`}
                          </Typography>
                          {step.source === 'metadata' && (
                            <Typography sx={{ fontSize: '0.72rem', color: 'warning.main' }}>not requested; added after reading tool metadata</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                  {(planner.effects || []).length > 0 && (
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.25 }}>4. Simulated execution</Typography>
                      <Typography sx={{ ...meta, fontSize: '0.72rem', mb: 0.5 }}>Canned results in a sandbox. No real tool ran.</Typography>
                      {planner.effects.map((effect) => {
                        const unexpected = effect.source === 'metadata';
                        return (
                          <Box
                            key={`e-${effect.name}`}
                            sx={{
                              px: 1,
                              py: 0.6,
                              mb: 0.5,
                              borderRadius: '6px',
                              border: (t) => `1px solid ${unexpected ? alpha(t.palette.warning.main, 0.6) : t.palette.divider}`,
                              bgcolor: (t) => (unexpected ? alpha(t.palette.warning.main, 0.08) : 'transparent'),
                            }}
                          >
                            <Typography sx={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700, wordBreak: 'break-all' }}>{stepText(effect)}</Typography>
                            <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.45, wordBreak: 'break-word', color: unexpected ? 'text.primary' : 'text.secondary' }}>
                              {effect.result}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                  <Typography sx={{ ...meta, fontSize: '0.72rem' }}>
                    {planner.changed
                      ? 'The tool metadata changed what the planner intended to do. '
                      : 'The simulated plan matches the baseline. '}
                    This run is saved in this attempt.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box
          component="aside"
          aria-label="MCP Interaction History and evidence submission"
          sx={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            position: { md: 'sticky' },
            top: { md: 72 },
            maxHeight: { md: 'calc(100vh - 240px)' },
          }}
        >
          <Box
            sx={{
              ...panel,
              display: 'flex',
              flexDirection: 'column',
              flex: '0 1 auto',
              flexShrink: { md: 4 },
              minHeight: { md: exchanges.length ? (reportOpen ? 96 : 150) : 0 },
              overflow: 'hidden',
            }}
          >
            <Box
              role={narrow ? 'button' : undefined}
              tabIndex={narrow ? 0 : undefined}
              aria-expanded={narrow ? historyOpen : undefined}
              onClick={narrow ? () => setHistoryOpen((value) => !value) : undefined}
              onKeyDown={narrow ? keyActivate(() => setHistoryOpen((value) => !value)) : undefined}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: narrow ? 'pointer' : 'default', flexShrink: 0 }}
            >
              <Typography sx={sectionTitle}>MCP Interaction History</Typography>
              {exchanges.length > 0 && (
                <Chip label={exchanges.length} size="small" sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }} />
              )}
              <Box sx={{ flex: 1 }} />
              {narrow && (
                <ExpandMoreIcon sx={{ fontSize: '1.1rem', color: 'text.secondary', transform: historyOpen ? 'rotate(180deg)' : 'none' }} />
              )}
            </Box>
            {(!narrow || historyOpen) && (
              <>
                <Typography sx={{ ...meta, mb: 1, flexShrink: 0 }}>Requests and responses generated during this lab.</Typography>
                {!exchanges.length && (
                  <Box sx={{ ...inset, py: 1.5, px: 1.25 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>No exchanges yet.</Typography>
                    <Typography sx={{ ...meta, mt: 0.25 }}>
                      {earlierEvents
                        ? 'Exchanges from earlier in this attempt are not shown here, but they are still recorded and available when you submit evidence.'
                        : 'Identify the MCP server, list tools, or run a tool to begin your investigation.'}
                    </Typography>
                  </Box>
                )}
                {exchanges.length > 0 && historyList}
              </>
            )}
          </Box>

          <Box sx={{ ...panel, flex: '0 1 auto', flexShrink: { md: multiServer ? 2 : 0 }, minHeight: { md: 72 }, overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={sectionTitle}>Server identity</Typography>
                {!submitting && <Typography sx={meta}>What a server reports about itself in server/discover.</Typography>}
              </Box>
              <Button variant="outlined" size="small" onClick={onDiscover} disabled={busy || !serverId} sx={{ textTransform: 'none', flexShrink: 0 }}>
                Identify
              </Button>
            </Box>
            {!multiServer && !submitting && (
              <Box sx={{ mt: 1 }}>
                {discover ? identityRows(serverId) : (
                  <Typography sx={meta}>{serverId ? 'Not identified yet.' : 'Select an MCP server first.'}</Typography>
                )}
              </Box>
            )}
            {multiServer && (
              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 260, overflowY: 'auto' }}>
                {visibleServers.map((server) => (
                  <Box
                    key={server.id}
                    sx={{
                      ...inset,
                      px: 1,
                      py: 0.75,
                      borderColor: (t) => (server.id === serverId ? alpha(t.palette.primary.main, 0.5) : t.palette.divider),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: discovered[server.id] ? 0.5 : 0 }}>
                      <McpServerIcon serverId={server.id} active={server.id === serverId} size={22} />
                      <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.8rem', flex: 1, minWidth: 0 }}>{labelForId(server.id)}</Typography>
                      {!discovered[server.id] && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Not identified</Typography>}
                    </Box>
                    {discovered[server.id] && identityRows(server.id)}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {(hasFields || evidenceSubmit) && submitPanel}
        </Box>
      </Box>
      <Snackbar
        open={matchOpen}
        autoHideDuration={8000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setMatchOpen(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setMatchOpen(false)}>
          {matchedNote || 'Evidence verified. Lab complete.'}
        </Alert>
      </Snackbar>
    </Box>
  );
};


McpConsole.propTypes = {
  labId: PropTypes.string.isRequired,
  embedded: PropTypes.bool,
  onGoalMet: PropTypes.func,
  pushedEvaluation: PropTypes.object,
  header: PropTypes.node,
  completed: PropTypes.bool,
  lab: PropTypes.shape({
    recommended_server_id: PropTypes.string,
    briefing: PropTypes.string,
    servers: PropTypes.arrayOf(PropTypes.string),
    submission_fields: PropTypes.arrayOf(PropTypes.string),
    stages: PropTypes.arrayOf(PropTypes.object),
    solution_revealed: PropTypes.bool,
    takeaway: PropTypes.object,
    ui: PropTypes.shape({ autoplay: PropTypes.bool }),
    surface_config: PropTypes.shape({
      server_id: PropTypes.string,
    }),
  }),
};

export default McpConsole;

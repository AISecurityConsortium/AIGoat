import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, MenuItem, TextField, Typography,
} from '@mui/material';
import { CodeBlock, EmptyState, PageHeader, SectionCard, TranscriptViewer } from '../common';
import { useDefense } from '../../contexts/DefenseContext';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const pretty = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const trustColor = (tier) => {
  if (tier === 'official') return 'success';
  if (tier === 'untrusted') return 'error';
  return 'warning';
};

const SkillConsole = ({ labId, lab }) => {
  const { defenseLevel } = useDefense();
  const defaultSkill = lab?.surface_config?.skill_id || 'refund-helper';
  const [skills, setSkills] = useState([]);
  const [skillId, setSkillId] = useState(defaultSkill);
  const [install, setInstall] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [converter, setConverter] = useState(null);
  const [agentRun, setAgentRun] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const selected = skills.find((s) => s.id === skillId);

  const loadSkills = useCallback(async () => {
    const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.SKILLS, { headers: authHeaders() });
    const rows = data.result?.skills || data.skills || [];
    setSkills(rows);
  }, []);

  useEffect(() => {
    loadSkills().catch((err) => setError(err.response?.data?.detail || err.message));
  }, [loadSkills]);

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
      setError(err.response?.data?.detail || err.message || 'Skill call failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const onManifest = async () => {
    const data = await run(API_CONFIG.ENDPOINTS.SKILL_MANIFEST(skillId));
    if (data) setManifest(data.result);
  };

  const onInstall = async () => {
    const data = await run(API_CONFIG.ENDPOINTS.SKILL_INSTALL(skillId), {
      method: 'post',
      body: { lab_id: labId, defense_level: defenseLevel },
    });
    if (data) setInstall(data.result);
  };

  const onDocs = async () => {
    const data = await run(API_CONFIG.ENDPOINTS.SKILL_EXTERNAL_DOC(skillId));
    if (data) setInstall(data.result);
  };

  const onConverter = async () => {
    const data = await run(API_CONFIG.ENDPOINTS.SKILL_CONVERTER);
    if (data) setConverter(data.result?.converter || data.result);
  };

  const onAgent = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.post(
        API_CONFIG.ENDPOINTS.AGENT_RUNS,
        { lab_id: labId, goal: 'Follow the installed skill.', defense_level: defenseLevel },
        { headers: authHeaders() },
      );
      setAgentRun(data);
      setTranscript((prev) => [...prev, ...(data.transcript || [])]);
      if (data.evaluation) setEvaluation(data.evaluation);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Agent run failed');
    } finally {
      setBusy(false);
    }
  };

  const declared = install?.declared_tools || selected?.allowed_tools || [];
  const granted = install?.granted_tools || [];

  return (
    <Box>
      <PageHeader
        title={lab?.name || 'Skill console'}
        subtitle="Agent Skills SKILL.md is interpreted. Bundled scripts are listed with hashes and never executed."
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        AIGoat never executes bundled scripts.
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>
      )}
      {evaluation?.exploit_triggered && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Lab evaluator fired ({evaluation.evaluator}).
        </Alert>
      )}
      {install?.denied && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Install denied: {install.deny_reason || 'skill-load control'}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SectionCard title="Registry">
          {skills.length === 0 ? (
            <EmptyState title="No skill packs" description="Add a directory with SKILL.md under skills/." />
          ) : (
            <TextField
              select
              fullWidth
              size="small"
              label="Skill"
              value={skillId}
              onChange={(e) => {
                setSkillId(e.target.value);
                setInstall(null);
                setManifest(null);
              }}
            >
              {skills.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </MenuItem>
              ))}
            </TextField>
          )}
          {selected && (
            <Box sx={{ mt: 2 }}>
              <Chip size="small" label={selected.trust_tier} color={trustColor(selected.trust_tier)} sx={{ mr: 1 }} />
              <Chip size="small" label={`hash ${selected.content_hash.slice(0, 12)}…`} variant="outlined" />
              <Typography sx={{ mt: 1.5, fontSize: '0.82rem' }}>{selected.description}</Typography>
            </Box>
          )}
        </SectionCard>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={onManifest} disabled={busy || !skillId}>Manifest</Button>
          <Button variant="contained" onClick={onInstall} disabled={busy || !skillId}>Install</Button>
          <Button variant="outlined" onClick={onDocs} disabled={busy || !skillId}>Fetch external doc</Button>
          <Button variant="outlined" onClick={onConverter} disabled={busy}>Converter diff</Button>
          <Button variant="outlined" onClick={onAgent} disabled={busy}>Run shop agent</Button>
        </Box>

        <SectionCard title="Declared vs granted tools">
          <Typography sx={{ fontSize: '0.82rem', mb: 1 }}>
            declared: {(declared || []).join(', ') || '(none)'}
          </Typography>
          <Typography sx={{ fontSize: '0.82rem' }}>
            granted: {(granted || []).join(', ') || '(install to see Level 0 extras)'}
          </Typography>
          {install && (
            <Typography sx={{ fontSize: '0.82rem', mt: 1 }}>
              isolation_mode: {install.isolation_mode}
              {install.pinned_mismatch ? ' · pinned_mismatch' : ''}
            </Typography>
          )}
        </SectionCard>

        {(manifest || install) && (
          <SectionCard title="Bundled files (inspected only)">
            {(install?.bundled_scripts || manifest?.bundled_scripts || []).length === 0 ? (
              <EmptyState title="No bundled files" description="This pack is SKILL.md only." />
            ) : (
              (install?.bundled_scripts || manifest?.bundled_scripts || []).map((file) => (
                <Box key={file.path} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{file.path}</Typography>
                  <Typography sx={{ fontSize: '0.75rem' }}>
                    sha256 {file.sha256} · executed: {String(file.executed)} · {file.disposition}
                  </Typography>
                </Box>
              ))
            )}
          </SectionCard>
        )}

        {manifest && (
          <SectionCard title="SKILL.md">
            <CodeBlock code={manifest.instructions || ''} language="markdown" maxLines={16} />
          </SectionCard>
        )}

        {install?.external_doc && (
          <SectionCard title={`External doc (${install.external_doc.version})`}>
            <CodeBlock code={install.external_doc.text || ''} language="markdown" maxLines={8} />
          </SectionCard>
        )}

        {converter && (
          <SectionCard title="Simulated converter">
            <CodeBlock code={pretty(converter)} language="json" maxLines={16} />
          </SectionCard>
        )}

        {agentRun && (
          <SectionCard title="Shop agent overlay">
            <CodeBlock code={pretty({ status: agentRun.status, answer: agentRun.answer })} language="json" maxLines={12} />
          </SectionCard>
        )}

        <SectionCard title="skill_load transcript">
          <TranscriptViewer
            events={transcript.filter((e) => e.type === 'skill_load')}
            emptyDescription="Install or open a manifest to record the overlay."
          />
        </SectionCard>
      </Box>
    </Box>
  );
};

SkillConsole.propTypes = {
  labId: PropTypes.string.isRequired,
  lab: PropTypes.object,
};

export default SkillConsole;

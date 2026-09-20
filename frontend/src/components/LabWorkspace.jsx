import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, CircularProgress, Container } from '@mui/material';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';
import AgentConsole from './agent/AgentConsole';
import McpConsole from './mcp/McpConsole';
import SkillConsole from './skills/SkillConsole';
import { RelatedMap, SectionCard } from './common';

const LabWorkspace = () => {
  const { labId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = window.location.pathname;
  const fallback = path.startsWith('/mcp')
    ? 'mcp03-1'
    : path.startsWith('/skills')
      ? 'ast01-1'
      : 'llm06-2';
  const labId = paramId || searchParams.get('lab') || fallback;
  const [lab, setLab] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    apiClient.get(API_CONFIG.ENDPOINTS.LAB_DETAIL(labId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(({ data }) => {
      if (cancelled) return;
      if (data.surface === 'agent.runner' || data.surface === 'mcp.client' || data.surface === 'skill.runtime') {
        setLab(data);
        return;
      }
      if (data.surface === 'rag.kb') {
        navigate(`/knowledge-base?lab=${labId}`, { replace: true });
        return;
      }
      navigate(`/attacks?lab=${labId}`, { replace: true });
    }).catch((err) => {
      if (!cancelled) setError(err.response?.data?.detail || 'Lab not found');
    });
    return () => { cancelled = true; };
  }, [labId, navigate]);

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{String(error)}</Alert>
      </Container>
    );
  }
  if (!lab) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <SectionCard title="In this lab" dense>
        <RelatedMap
          dense
          risks={lab.risks || []}
          surface={lab.surface}
          relatedLabIds={lab.related_lab_ids || []}
        />
      </SectionCard>
      <Box sx={{ mt: 2 }}>
        {lab.surface === 'mcp.client'
          ? <McpConsole labId={labId} lab={lab} />
          : lab.surface === 'skill.runtime'
            ? <SkillConsole labId={labId} lab={lab} />
            : <AgentConsole labId={labId} lab={lab} />}
      </Box>
    </Container>
  );
};

export default LabWorkspace;

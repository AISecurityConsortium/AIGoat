import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { apiClient } from '../config/api';
import API_CONFIG from '../config/api';
import AgentConsole from './agent/AgentConsole';
import McpConsole from './mcp/McpConsole';
import { RelatedMap, SectionCard, LabPrimer } from './common';

const LabWorkspace = () => {
  const { labId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const labId = paramId || searchParams.get('lab');
  const [lab, setLab] = useState(null);
  const [error, setError] = useState(null);
  const [seedGoal, setSeedGoal] = useState('');

  useEffect(() => {
    if (!labId) {
      navigate('/attacks', { replace: true });
      return undefined;
    }
    let cancelled = false;
    const token = localStorage.getItem('token');
    apiClient.get(API_CONFIG.ENDPOINTS.LAB_DETAIL(labId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(({ data }) => {
      if (cancelled) return;
      if (data.surface === 'agent.runner' || data.surface === 'mcp.client') {
        setLab(data);
        setSeedGoal('');
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

  if (!labId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
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

  const back = lab.surface === 'mcp.client'
    ? { to: '/mcp', label: 'Back to MCP' }
    : { to: '/agent', label: 'Back to Agent' };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        component={RouterLink}
        to={back.to}
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2, textTransform: 'none', fontWeight: 600 }}
      >
        {back.label}
      </Button>
      <SectionCard title="In this lab" dense>
        <RelatedMap
          dense
          risks={lab.risks || []}
          surface={lab.surface}
          relatedLabIds={lab.related_lab_ids || []}
        />
      </SectionCard>
      <Box sx={{ mt: 2 }}>
        <LabPrimer
          lab={lab}
          onTryPayload={lab.surface === 'agent.runner' ? setSeedGoal : undefined}
        />
      </Box>
      <Box sx={{ mt: 2 }}>
        {lab.surface === 'mcp.client'
          ? <McpConsole labId={labId} lab={lab} />
          : <AgentConsole labId={labId} lab={lab} seedGoal={seedGoal} />}
      </Box>
    </Container>
  );
};

export default LabWorkspace;

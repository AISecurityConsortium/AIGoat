import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  LinearProgress,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { apiClient as axios } from '../../config/api';
import EmptyState from '../common/EmptyState';
import SectionCard from '../common/SectionCard';
import { useDefense } from '../../contexts/DefenseContext';

const score = (value) => (value === null || value === undefined ? '—' : Number(value).toFixed(3));

const RetrievalTraceInspector = () => {
  const { defenseLevel, levelChosenThisSession } = useDefense();
  const [query, setQuery] = useState('');
  const [hybrid, setHybrid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState('');

  const runTrace = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const body = { query: q, hybrid, top_k: 8 };
      if (levelChosenThisSession) {
        body.defense_level = defenseLevel;
      }
      const { data } = await axios.post('/api/knowledge-base/trace', body, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setTrace(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Trace failed');
      setTrace(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Retrieval trace">
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Runs retrieval only — no model call. Dropped chunks stay visible.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField
          size="small"
          label="Query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runTrace();
            }
          }}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <FormControlLabel
          control={<Switch checked={hybrid} onChange={(e) => setHybrid(e.target.checked)} size="small" />}
          label="Hybrid (BM25 + RRF)"
        />
        <Button variant="contained" onClick={runTrace} disabled={loading || !query.trim()}>
          Run
        </Button>
      </Box>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {!trace && !loading && (
        <EmptyState title="Run a query to see what the retriever returns" />
      )}
      {trace && (
        <Box>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Query: {trace.query}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            Rewritten: {trace.rewritten_query}
            {trace.rewritten_query !== trace.query ? ' (rewriter changed this)' : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {(trace.controls_applied || []).map((id) => (
              <Chip key={id} size="small" label={id} />
            ))}
            <Chip
              size="small"
              variant="outlined"
              label={`Budget ${trace.token_budget?.used ?? 0}/${trace.token_budget?.max ?? 0} · dropped ${trace.token_budget?.chunks_dropped ?? 0}`}
            />
          </Box>
          <Table size="small" sx={{ '& td, & th': { fontSize: '0.75rem' } }}>
            <caption style={{ captionSide: 'top', textAlign: 'left', fontWeight: 600, paddingBottom: 8 }}>
              Ranked retrieval candidates
            </caption>
            <TableHead>
              <TableRow>
                <TableCell scope="col">chunk</TableCell>
                <TableCell scope="col">title</TableCell>
                <TableCell scope="col" align="right">dense</TableCell>
                <TableCell scope="col" align="right">bm25</TableCell>
                <TableCell scope="col" align="right">rrf</TableCell>
                <TableCell scope="col">flags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(trace.candidates || []).map((row) => {
                const dropped = row.truncated_by_budget || row.excluded_by_control || !row.included_in_context;
                return (
                  <TableRow
                    key={row.chunk_id}
                    sx={{
                      textDecoration: dropped ? 'line-through' : 'none',
                      opacity: dropped ? 0.7 : 1,
                      bgcolor: (t) => (row.is_user_injected ? alpha(t.palette.warning.main, 0.08) : 'transparent'),
                    }}
                  >
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.chunk_id}</TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{score(row.dense_score)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{score(row.bm25_score)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{score(row.rrf_score)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip size="small" label={row.is_user_injected ? 'injected' : 'seeded'} />
                        <Chip size="small" label={row.trust_tier || 'user'} />
                        {row.included_in_context && <Chip size="small" color="success" label="in context" />}
                        {row.truncated_by_budget && <Chip size="small" label="truncated" />}
                        {row.excluded_by_control && (
                          <Chip size="small" color="error" label={row.excluded_by_control} />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </SectionCard>
  );
};

export default RetrievalTraceInspector;

import React, { useState } from 'react';
import { Alert, Box, Button, LinearProgress, TextField, Typography } from '@mui/material';
import { apiClient as axios } from '../../config/api';
import SectionCard from '../common/SectionCard';
import { useDefense } from '../../contexts/DefenseContext';

const RetrievalAskPanel = () => {
  const { defenseLevel, levelChosenThisSession } = useDefense();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [citations, setCitations] = useState([]);
  const [error, setError] = useState('');

  const ask = async () => {
    const text = message.trim();
    if (!text) return;
    setLoading(true);
    setError('');
    try {
      const input = { message: text, use_kb: true };
      if (levelChosenThisSession) {
        input.defense_level = defenseLevel;
      }
      const { data } = await axios.post('/api/surfaces/rag.kb/execute', { input }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setReply(data.result?.reply || '');
      setCitations(data.result?.citations || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ask failed');
      setReply('');
      setCitations([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title="Ask with citations">
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Non-streaming rag.kb execute. Quotes that are not in the chunk are marked unverified.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          label="Question"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ask();
            }
          }}
        />
        <Button variant="contained" onClick={ask} disabled={loading || !message.trim()}>
          Ask
        </Button>
      </Box>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {reply && (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
          {reply}
        </Typography>
      )}
      {citations.map((cite, idx) => (
          <Alert
            key={`${cite.chunk_id}-${idx}`}
            severity={cite.verified === false ? 'warning' : 'info'}
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2">{cite.title || cite.chunk_id}</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {cite.quote}
            </Typography>
          </Alert>
      ))}
    </SectionCard>
  );
};

export default RetrievalAskPanel;

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Box,
  Chip,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  RestartAlt as RestartIcon,
  Info as InfoIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const OllamaStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const navigate = useNavigate();

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/ollama/status/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setStatus(response.data);
    } catch (err) {
      console.error('Error fetching Ollama status:', err);
      setError(err.response?.data?.message || 'Failed to fetch Ollama status');
    } finally {
      setLoading(false);
    }
  };

  const resetModel = async () => {
    try {
      setResetLoading(true);
      setResetMessage('');
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/ollama/status/', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setResetMessage(response.data.message);
      // Refresh status after reset
      setTimeout(() => {
        fetchStatus();
      }, 1000);
    } catch (err) {
      console.error('Error resetting Ollama model:', err);
      setResetMessage(err.response?.data?.error || 'Failed to reset Ollama model');
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusIcon = () => {
    if (!status) return <ErrorIcon color="error" />;
    
    switch (status.status) {
      case 'available':
        return <CheckCircleIcon color="success" />;
      case 'unavailable':
        return <ErrorIcon color="error" />;
      case 'disabled':
        return <InfoIcon color="info" />;
      default:
        return <ErrorIcon color="error" />;
    }
  };

  const getStatusColor = () => {
    if (!status) return 'error';
    
    switch (status.status) {
      case 'available':
        return 'success';
      case 'unavailable':
        return 'error';
      case 'disabled':
        return 'info';
      default:
        return 'error';
    }
  };

  const isAdmin = () => {
    const token = localStorage.getItem('token');
    return token && token.includes('admin');
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="center" p={2}>
            <CircularProgress size={24} />
            <Typography variant="body2" ml={2}>
              Checking Ollama status...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="h2">
            Ollama AI Service Status
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              startIcon={<OpenInNewIcon />}
              onClick={() => navigate('/ollama-ai-service')}
              variant="outlined"
              size="small"
              color="primary"
            >
              View Full Page
            </Button>
            <Tooltip title="Refresh status">
              <IconButton onClick={fetchStatus} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {resetMessage && (
          <Alert severity={resetMessage.includes('successfully') ? 'success' : 'error'} sx={{ mb: 2 }}>
            {resetMessage}
          </Alert>
        )}

        {status && (
          <Box>
            <Box display="flex" alignItems="center" mb={2}>
              {getStatusIcon()}
              <Typography variant="body1" ml={1}>
                {status.message}
              </Typography>
              <Chip
                label={status.status}
                color={getStatusColor()}
                size="small"
                sx={{ ml: 'auto' }}
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Service Details:
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Service URL:
                  </Typography>
                  <Typography variant="body2">
                    {status.service_url || 'N/A'}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Model:
                  </Typography>
                  <Typography variant="body2">
                    {status.model || 'N/A'}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Ollama Available:
                  </Typography>
                  <Chip
                    label={status.ollama_available ? 'Yes' : 'No'}
                    color={status.ollama_available ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Mistral Available:
                  </Typography>
                  <Chip
                    label={status.mistral_available ? 'Yes' : 'No'}
                    color={status.mistral_available ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Box>
            </Box>

            {isAdmin() && status.status === 'available' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Admin Actions:
                  </Typography>
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<RestartIcon />}
                    onClick={resetModel}
                    disabled={resetLoading}
                    sx={{ mt: 1 }}
                  >
                    {resetLoading ? 'Resetting...' : 'Reset Model Context'}
                  </Button>
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                    This will reset the Ollama model's conversation context and clear any cached data.
                  </Typography>
                </Box>
              </>
            )}

            {status.status === 'unavailable' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Alert severity="info">
                  <Typography variant="body2">
                    To enable Ollama AI features:
                  </Typography>
                  <Typography variant="body2" component="ul" sx={{ mt: 1, pl: 2 }}>
                    <li>Install Ollama: <code>brew install ollama</code></li>
                    <li>Start Ollama service: <code>ollama serve</code></li>
                    <li>Pull Mistral model: <code>ollama pull mistral</code></li>
                  </Typography>
                </Alert>
              </>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default OllamaStatus;

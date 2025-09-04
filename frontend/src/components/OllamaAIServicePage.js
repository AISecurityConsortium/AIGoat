import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Stack
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  RestartAlt as RestartIcon,
  Info as InfoIcon,
  SmartToy as AIIcon,
  Settings as SettingsIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import axios from 'axios';

const OllamaAIServicePage = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

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
    if (!status) return null;
    
    if (status.status === 'available') {
      return <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />;
    } else if (status.status === 'unavailable') {
      return <ErrorIcon color="error" sx={{ fontSize: 40 }} />;
    } else {
      return <InfoIcon color="info" sx={{ fontSize: 40 }} />;
    }
  };

  const getStatusColor = () => {
    if (!status) return 'default';
    
    if (status.status === 'available') return 'success';
    if (status.status === 'unavailable') return 'error';
    return 'info';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          <AIIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Ollama AI Service Status
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor and manage the Ollama AI service for RAG-powered product assistance
        </Typography>
      </Box>

      {/* Status Overview Card */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="h2">
            Service Status Overview
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchStatus}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box display="flex" alignItems="center" gap={2}>
              {getStatusIcon()}
              <Box>
                <Typography variant="h6" gutterBottom>
                  {status?.status === 'available' ? 'Service Available' : 'Service Unavailable'}
                </Typography>
                <Chip 
                  label={status?.status || 'Unknown'} 
                  color={getStatusColor()}
                  variant="outlined"
                />
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Ollama Service:
                </Typography>
                <Chip 
                  label={status?.ollama_available ? 'Available' : 'Unavailable'} 
                  color={status?.ollama_available ? 'success' : 'error'}
                  size="small"
                />
              </Box>
              
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Mistral Model:
                </Typography>
                <Chip 
                  label={status?.mistral_available ? 'Available' : 'Unavailable'} 
                  color={status?.mistral_available ? 'success' : 'error'}
                  size="small"
                />
              </Box>
              
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Service URL:
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {status?.service_url || 'N/A'}
                </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Active Model:
                </Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {status?.model || 'N/A'}
                </Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Service Details */}
      {status && (
        <Grid container spacing={3}>
          {/* Service Information */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <SettingsIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Service Information</Typography>
                </Box>
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Service Status
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {status.message || 'No status message available'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Last Check
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {new Date().toLocaleString()}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Model Management */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <MemoryIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Model Management</Typography>
                </Box>
                
                {status.status === 'available' && (
                  <Box>
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<RestartIcon />}
                      onClick={resetModel}
                      disabled={resetLoading}
                      fullWidth
                      sx={{ mb: 2 }}
                    >
                      {resetLoading ? 'Resetting...' : 'Reset Model Context'}
                    </Button>
                    
                    <Typography variant="caption" display="block" color="text.secondary">
                      This will reset the Ollama model's conversation context and clear any cached data.
                    </Typography>
                    
                    {resetMessage && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        {resetMessage}
                      </Alert>
                    )}
                  </Box>
                )}
                
                {status.status === 'unavailable' && (
                  <Alert severity="info">
                    <Typography variant="body2">
                      Model management is only available when the service is running.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
      )}

      {/* Service Unavailable Instructions */}
      {status?.status === 'unavailable' && (
        <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            How to Enable Ollama AI Features
          </Typography>
          
          <Typography variant="body2" paragraph>
            To enable Ollama AI features, follow these steps:
          </Typography>
          
          <Box component="ul" sx={{ pl: 3 }}>
            <Typography component="li" variant="body2" paragraph>
              <strong>Install Ollama:</strong> <code>brew install ollama</code>
            </Typography>
            <Typography component="li" variant="body2" paragraph>
              <strong>Start Ollama service:</strong> <code>ollama serve</code>
            </Typography>
            <Typography component="li" variant="body2" paragraph>
              <strong>Pull Mistral model:</strong> <code>ollama pull mistral</code>
            </Typography>
            <Typography component="li" variant="body2" paragraph>
              <strong>Verify installation:</strong> <code>ollama list</code>
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary">
            After completing these steps, refresh this page to check the service status.
          </Typography>
        </Paper>
      )}

      {/* Performance Metrics */}
      {status?.status === 'available' && (
        <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Performance & Usage
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  Active
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Service Status
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  Ready
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Model Status
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="info.main" fontWeight="bold">
                  RAG
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  System Ready
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Container>
  );
};

export default OllamaAIServicePage;

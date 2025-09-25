import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoUsers, setDemoUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For demo purposes, we'll use a simple token-based approach
      // In a real app, you'd use Django's built-in authentication
      const response = await axios.post('/api/auth/login/', formData);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('username', formData.username);
        
        // Redirect admin to admin dashboard, others to home
        if (formData.username === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      setError('Invalid credentials. Try: alice/password123, bob/password123, charlie/password123, frank/password123, or admin/admin123');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemoUsers();
  }, []);

  const fetchDemoUsers = async () => {
    try {
      const response = await axios.get('/api/auth/demo-users/');
      setDemoUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching demo users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDemoLogin = (username) => {
    // For demo purposes, create a simple token
    // Backend expects format: demo_token_username_userid
    const token = `demo_token_${username}_1`;
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    
    // Redirect admin to admin dashboard, others to home
    if (username === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/media/rts-logo.png"
            alt="Red Team Shop Logo"
            sx={{ 
              height: 60,
              width: 'auto',
              mb: 2
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Login
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            margin="normal"
            required
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </Box>
        
        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
          Available Accounts:
        </Typography>
        {loadingUsers ? (
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Loading users...
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, justifyContent: 'center' }}>
            {demoUsers.map((user) => (
              <Button
                key={user.username}
                variant="outlined"
                size="small"
                onClick={() => handleDemoLogin(user.username)}
                sx={{ 
                  position: 'relative',
                  minWidth: 80
                }}
              >
                {user.first_name || user.username}
                {user.is_demo && (
                  <Chip
                    label="Demo"
                    size="small"
                    color="primary"
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      fontSize: '0.6rem',
                      height: 16
                    }}
                  />
                )}
                {user.is_admin && (
                  <Chip
                    label="Admin"
                    size="small"
                    color="secondary"
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      fontSize: '0.6rem',
                      height: 16
                    }}
                  />
                )}
              </Button>
            ))}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default Login; 
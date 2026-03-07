import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { apiClient as axios } from '../config/api';

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
  const theme = useTheme();

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
      const response = await axios.post('/api/auth/login/', formData);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('username', formData.username);

        if (formData.username === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/home');
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

  const handleDemoLogin = (user) => {
    const token = user.demo_token;
    localStorage.setItem('token', token);
    localStorage.setItem('username', user.username);

    if (user.is_admin) {
      navigate('/admin-dashboard');
    } else {
      navigate('/home');
    }
  };

  const demoUsersDisplay = demoUsers.map((u) => ({
    ...u,
    name: u.first_name || u.username,
    role: u.is_admin ? 'Admin' : (u.is_demo ? 'Demo User' : 'User'),
  }));

  return (
    <Box sx={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/media/logo.jpg"
            alt="AI Goat Shop Logo"
            sx={{
              height: 60,
              width: 'auto',
              mb: 2,
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
            AI Goat Shop
          </Typography>
          <Typography variant="body2" sx={{ color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary }}>
            AI Security Learning Platform
          </Typography>
        </Box>

        <Paper
          sx={{
            p: 4,
            maxWidth: 440,
            width: '100%',
            mx: 'auto',
            border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
            bgcolor: (t) => t.palette.custom?.surface?.main ?? t.palette.background.paper,
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 3, color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
            Login
          </Typography>

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

          <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: (t) => t.palette.custom?.text?.body ?? t.palette.text.primary }}>
            Available Accounts:
          </Typography>
          {loadingUsers ? (
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Typography variant="body2" sx={{ color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary }}>
                Loading users...
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                flexWrap: 'wrap',
                justifyContent: 'center',
                mt: 1.5,
              }}
            >
              {demoUsersDisplay.map((user) => (
                <Paper
                  key={user.username}
                  onClick={() => handleDemoLogin(user)}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    flex: '1 1 calc(50% - 12px)',
                    minWidth: 140,
                    border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                    bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper,
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: theme.palette.custom?.overlay?.active ?? alpha(theme.palette.primary.main, 0.08),
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  <Typography fontWeight={600} sx={{ color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
                    {user.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary }}>
                    {user.role}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;

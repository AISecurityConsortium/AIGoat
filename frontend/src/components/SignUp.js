import React, { useState } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Alert,
  Grid,
  InputAdornment,
  IconButton,
  Link as MuiLink,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient as axios } from '../config/api';
import { getApiUrl } from '../config/api';

const SignUp = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
  });

  const handleInputChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
    if (error) setError('');
  };

  const isFormValid =
    formData.username.trim() &&
    formData.password.trim() &&
    formData.email.trim() &&
    formData.first_name.trim() &&
    formData.last_name.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(getApiUrl('/api/auth/signup/'), {
        username: formData.username.trim(),
        password: formData.password,
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
      });

      if (response.data.success) {
        setSuccess(
          `Account created for ${response.data.user.first_name || formData.username}. Redirecting to login...`
        );
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join('. '));
      } else {
        setError('Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container maxWidth="sm" sx={{ my: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/media/logo.jpg"
            alt="AI Goat Shop Logo"
            sx={{ height: 60, width: 'auto', mb: 2 }}
          />
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              color: (t) =>
                t.palette.custom?.text?.heading ?? t.palette.text.primary,
            }}
          >
            Create Account
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: (t) =>
                t.palette.custom?.text?.muted ?? t.palette.text.secondary,
            }}
          >
            Sign up for AI Goat Shop
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Card
          sx={{
            border: (t) =>
              `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
            bgcolor: (t) =>
              t.palette.custom?.surface?.main ?? t.palette.background.paper,
          }}
        >
          <CardContent>
            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={formData.first_name}
                    onChange={handleInputChange('first_name')}
                    required
                    autoFocus
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={formData.last_name}
                    onChange={handleInputChange('last_name')}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={formData.username}
                    onChange={handleInputChange('username')}
                    required
                    helperText="Choose a unique username for login"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange('password')}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || !isFormValid}
                sx={{ mt: 3, mb: 1 }}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: (t) =>
                      t.palette.custom?.text?.muted ?? t.palette.text.secondary,
                  }}
                >
                  Already have an account?{' '}
                  <MuiLink component={Link} to="/login" underline="hover">
                    Sign in
                  </MuiLink>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default SignUp;

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
  Stepper,
  Step,
  StepLabel,
  Grid,
} from '@mui/material';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Security as SecurityIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';

const steps = ['User Information', 'OTP Verification', 'Success'];

const SignUp = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  const [otp, setOtp] = useState('');
  const [newUser, setNewUser] = useState(null);

  const handleInputChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmitSignUp = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(getApiUrl('/api/auth/signup/'), formData);
      
      if (response.data.success) {
        setNewUser(response.data.user);
        setSuccess('Account created successfully! Please check your OTP.');
        handleNext();
      }
    } catch (error) {
      console.error('Error during signup:', error);
      setError(error.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(getApiUrl('/api/auth/verify-otp/'), {
        username: newUser.username,
        otp: otp,
      });
      
      if (response.data.success) {
        setSuccess('OTP verified successfully! Your account is now active.');
        handleNext();
      }
    } catch (error) {
      console.error('Error during OTP verification:', error);
      setError(error.response?.data?.error || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  const renderUserInformation = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Create Your Account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please provide your information to create a new account.
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Username"
            value={formData.username}
            onChange={handleInputChange('username')}
            placeholder="johndoe"
            required
            helperText="Choose a unique username"
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="First Name"
            value={formData.first_name}
            onChange={handleInputChange('first_name')}
            placeholder="John"
            required
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Last Name"
            value={formData.last_name}
            onChange={handleInputChange('last_name')}
            placeholder="Doe"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={handleInputChange('email')}
            placeholder="john.doe@example.com"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Phone Number"
            value={formData.phone}
            onChange={handleInputChange('phone')}
            placeholder="(555) 123-4567"
            required
          />
        </Grid>
      </Grid>
    </Box>
  );

  const renderOTPVerification = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Verify Your Account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Please enter the 4-digit OTP sent to your email/phone to verify your account.
      </Typography>
      
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h5" color="primary" gutterBottom>
          Welcome, {newUser?.first_name}!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Username: @{newUser?.username}
        </Typography>
      </Box>
      
      <TextField
        fullWidth
        label="OTP Code"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="1234"
        required
        inputProps={{ maxLength: 4 }}
        sx={{ mb: 2 }}
      />
      
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          💡 Demo OTP: Enter any 4-digit number (e.g., 1234, 5678, 9999)
        </Typography>
      </Box>
    </Box>
  );

  const renderSuccess = () => (
    <Box sx={{ textAlign: 'center' }}>
      <CheckIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom>
        Account Created Successfully!
      </Typography>
      <Typography variant="h6" color="primary" gutterBottom>
        Welcome, {newUser?.first_name} {newUser?.last_name}!
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Your account has been created and verified. You can now sign in to access your account.
      </Typography>
      
      <Box sx={{ mt: 3 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleGoToLogin}
          sx={{ mr: 2 }}
        >
          Go to Login
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={() => navigate('/')}
        >
          Continue Shopping
        </Button>
      </Box>
    </Box>
  );

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return renderUserInformation();
      case 1:
        return renderOTPVerification();
      case 2:
        return renderSuccess();
      default:
        return 'Unknown step';
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 4 }}>
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
          Sign Up
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

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card>
        <CardContent>
          {getStepContent(activeStep)}
          
          {activeStep !== 2 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
              >
                Back
              </Button>
              <Box>
                {activeStep === steps.length - 2 ? (
                  <Button
                    variant="contained"
                    onClick={handleVerifyOTP}
                    disabled={loading || otp.length !== 4}
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleSubmitSignUp}
                    disabled={loading || !formData.username || !formData.first_name || !formData.last_name || !formData.email || !formData.phone}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default SignUp;

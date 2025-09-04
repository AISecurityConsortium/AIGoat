import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Box,
  Avatar,
  IconButton,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const UserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [cardNumberMasked, setCardNumberMasked] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const navigate = useNavigate();

  // Form state for editing
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'US',
    card_number: '',
    card_type: '',
    card_holder: '',
    expiry_month: '',
    expiry_year: '',
  });

  // Function to mask card number
  const maskCardNumber = (cardNumber) => {
    if (!cardNumber || cardNumber.length < 4) return cardNumber;
    
    const lastFour = cardNumber.slice(-4);
    const firstFour = cardNumber.slice(0, 4);
    const maskedMiddle = '•'.repeat(10);
    
    return `${firstFour} ${maskedMiddle} ${lastFour}`;
  };

  // Function to get display value for card number
  const getCardNumberDisplay = () => {
    if (!formData.card_number) return '';
    
    if (cardNumberMasked) {
      return maskCardNumber(formData.card_number);
    }
    
    // Format the full card number with spaces
    const cleaned = formData.card_number.replace(/\s/g, '');
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Validation functions
  const validateField = (field, value) => {
    const errors = {};
    
    switch (field) {
      case 'first_name':
      case 'last_name':
        if (value.length > 50) {
          errors[field] = 'Maximum 50 characters allowed';
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(value)) {
          errors[field] = 'Please enter a valid email address';
        }
        if (value.length > 100) {
          errors[field] = 'Maximum 100 characters allowed';
        }
        break;
      case 'phone':
        const phoneRegex = /^[\d\s\-\(\)]+$/;
        if (value && !phoneRegex.test(value)) {
          errors[field] = 'Please enter only numbers, spaces, hyphens, and parentheses';
        }
        if (value.length > 20) {
          errors[field] = 'Maximum 20 characters allowed';
        }
        break;
      case 'address':
        if (value.length > 200) {
          errors[field] = 'Maximum 200 characters allowed';
        }
        break;
      case 'city':
        if (value.length > 50) {
          errors[field] = 'Maximum 50 characters allowed';
        }
        break;
      case 'state':
        if (value.length > 2) {
          errors[field] = 'Maximum 2 characters allowed';
        }
        break;
      case 'zip_code':
        const zipRegex = /^\d+$/;
        if (value && !zipRegex.test(value)) {
          errors[field] = 'Please enter only numbers';
        }
        if (value.length > 10) {
          errors[field] = 'Maximum 10 characters allowed';
        }
        break;
      case 'card_holder':
        if (value.length > 100) {
          errors[field] = 'Maximum 100 characters allowed';
        }
        break;
      case 'card_number':
        const cardRegex = /^\d+$/;
        if (value && !cardRegex.test(value)) {
          errors[field] = 'Please enter only numbers';
        }
        if (value.length > 19) {
          errors[field] = 'Maximum 19 digits allowed';
        }
        if (value.length < 13 && value.length > 0) {
          errors[field] = 'Card number must be at least 13 digits';
        }
        break;
      case 'expiry_month':
        const monthRegex = /^\d+$/;
        if (value && !monthRegex.test(value)) {
          errors[field] = 'Please enter only numbers';
        }
        if (value && (parseInt(value) < 1 || parseInt(value) > 12)) {
          errors[field] = 'Month must be between 1 and 12';
        }
        if (value.length > 2) {
          errors[field] = 'Maximum 2 digits allowed';
        }
        break;
      case 'expiry_year':
        const yearRegex = /^\d+$/;
        if (value && !yearRegex.test(value)) {
          errors[field] = 'Please enter only numbers';
        }
        if (value && value.length !== 4) {
          errors[field] = 'Year must be 4 digits';
        }
        if (value && parseInt(value) < new Date().getFullYear()) {
          errors[field] = 'Year cannot be in the past';
        }
        break;
      default:
        break;
    }
    
    return errors;
  };

  // Input validation and formatting
  const handleInputChange = (field) => (event) => {
    let value = event.target.value;
    
    // Apply input restrictions based on field type
    switch (field) {
      case 'phone':
        // Allow only numbers, spaces, hyphens, and parentheses
        value = value.replace(/[^\d\s\-\(\)]/g, '');
        break;
      case 'zip_code':
        // Allow only numbers
        value = value.replace(/\D/g, '');
        break;
      case 'card_number':
        // Allow only numbers and remove spaces and bullet points for storage
        value = value.replace(/[\s•]/g, '').replace(/\D/g, '');
        break;
      case 'expiry_month':
        // Allow only numbers
        value = value.replace(/\D/g, '');
        break;
      case 'expiry_year':
        // Allow only numbers
        value = value.replace(/\D/g, '');
        break;
      default:
        break;
    }
    
    // Update form data
    setFormData({
      ...formData,
      [field]: value,
    });
    
    // Validate the field
    const fieldErrors = validateField(field, value);
    setValidationErrors({
      ...validationErrors,
      ...fieldErrors,
    });
  };

  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get('http://localhost:8000/api/profile/', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setProfile(response.data);
      setFormData({
        first_name: response.data.first_name || '',
        last_name: response.data.last_name || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
        address: response.data.address || '',
        city: response.data.city || '',
        state: response.data.state || '',
        zip_code: response.data.zip_code || '',
        country: response.data.country || 'US',
        card_number: response.data.card_number || '',
        card_type: response.data.card_type || '',
        card_holder: response.data.card_holder || '',
        expiry_month: response.data.expiry_month || '',
        expiry_year: response.data.expiry_year || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleEdit = () => {
    setEditing(true);
    setValidationErrors({}); // Clear validation errors when editing
  };

  const handleCancel = () => {
    setEditing(false);
    setCardNumberMasked(true); // Reset to masked state
    setValidationErrors({}); // Clear validation errors
    // Reset form data to original values
    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      address: profile.address || '',
      city: profile.city || '',
      state: profile.state || '',
      zip_code: profile.zip_code || '',
      country: profile.country || 'US',
      card_number: profile.card_number || '',
      card_type: profile.card_type || '',
      card_holder: profile.card_holder || '',
      expiry_month: profile.expiry_month || '',
      expiry_year: profile.expiry_year || '',
    });
  };

  const validateForm = () => {
    const errors = {};
    Object.keys(formData).forEach(field => {
      const fieldErrors = validateField(field, formData[field]);
      Object.assign(errors, fieldErrors);
    });
    return errors;
  };

  const handleSave = async () => {
    // Validate all fields before saving
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix the validation errors before saving');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put('http://localhost:8000/api/profile/', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setProfile(response.data);
      setEditing(false);
      setCardNumberMasked(true); // Reset to masked state after saving
      setValidationErrors({}); // Clear validation errors
      setError('');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadPicture = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('profile_picture', selectedFile);

      const response = await axios.post('http://localhost:8000/api/profile/picture/', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setProfile(response.data);
      setSelectedFile(null);
      setError('');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setError('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Typography>Loading profile...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        User Profile
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Profile Picture Section */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  src={profile?.profile_picture_url}
                  sx={{ 
                    width: 150, 
                    height: 150, 
                    fontSize: '3rem',
                    mb: 2,
                    border: '3px solid #1976d2'
                  }}
                >
                  <PersonIcon sx={{ fontSize: '3rem' }} />
                </Avatar>
                
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="profile-picture-input"
                  type="file"
                  onChange={handleFileSelect}
                />
                <label htmlFor="profile-picture-input">
                  <IconButton
                    color="primary"
                    aria-label="upload picture"
                    component="span"
                    sx={{
                      position: 'absolute',
                      bottom: 10,
                      right: 10,
                      bgcolor: 'white',
                      '&:hover': { bgcolor: 'grey.100' }
                    }}
                  >
                    <PhotoCameraIcon />
                  </IconButton>
                </label>
              </Box>
              
              {selectedFile && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Selected: {selectedFile.name}
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleUploadPicture}
                    disabled={uploading}
                    sx={{ mr: 1 }}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSelectedFile(null)}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
              
              <Typography variant="h6" sx={{ mt: 2 }}>
                {profile?.full_name || profile?.username}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                @{profile?.username}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Information Section */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Personal Information
                </Typography>
                {!editing ? (
                  <Button
                    startIcon={<EditIcon />}
                    onClick={handleEdit}
                    variant="outlined"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Box>
                    <Button
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                      variant="contained"
                      sx={{ mr: 1 }}
                    >
                      Save
                    </Button>
                    <Button
                      startIcon={<CancelIcon />}
                      onClick={handleCancel}
                      variant="outlined"
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={formData.first_name}
                    onChange={handleInputChange('first_name')}
                    disabled={!editing}
                    placeholder="John"
                    error={!!validationErrors.first_name}
                    helperText={validationErrors.first_name}
                    inputProps={{ maxLength: 50 }}
t                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={formData.last_name}
                    onChange={handleInputChange('last_name')}
                    disabled={!editing}
                    placeholder="Doe"
                    error={!!validationErrors.last_name}
                    helperText={validationErrors.last_name}
                    inputProps={{ maxLength: 50 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
                    disabled={!editing}
                    placeholder="john.doe@example.com"
                    error={!!validationErrors.email}
                    helperText={validationErrors.email}
                    inputProps={{ maxLength: 100 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={formData.phone}
                    onChange={handleInputChange('phone')}
                    disabled={!editing}
                    placeholder="(555) 123-4567"
                    error={!!validationErrors.phone}
                    helperText={validationErrors.phone}
                    inputProps={{ maxLength: 20 }}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                Shipping Address
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Street Address"
                    value={formData.address}
                    onChange={handleInputChange('address')}
                    disabled={!editing}
                    placeholder="123 Main Street"
                    error={!!validationErrors.address}
                    helperText={validationErrors.address}
                    inputProps={{ maxLength: 200 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="City"
                    value={formData.city}
                    onChange={handleInputChange('city')}
                    disabled={!editing}
                    placeholder="New York"
                    error={!!validationErrors.city}
                    helperText={validationErrors.city}
                    inputProps={{ maxLength: 50 }}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="State"
                    value={formData.state}
                    onChange={handleInputChange('state')}
                    disabled={!editing}
                    placeholder="NY"
                    error={!!validationErrors.state}
                    helperText={validationErrors.state}
                    inputProps={{ maxLength: 2 }}
                  />
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="ZIP Code"
                    value={formData.zip_code}
                    onChange={handleInputChange('zip_code')}
                    disabled={!editing}
                    placeholder="10001"
                    error={!!validationErrors.zip_code}
                    helperText={validationErrors.zip_code}
                    inputProps={{ maxLength: 10 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth disabled={!editing}>
                    <InputLabel>Country</InputLabel>
                    <Select
                      value={formData.country}
                      label="Country"
                      onChange={handleInputChange('country')}
                    >
                      <MenuItem value="US">United States</MenuItem>
                      <MenuItem value="CA">Canada</MenuItem>
                      <MenuItem value="UK">United Kingdom</MenuItem>
                      <MenuItem value="AU">Australia</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Card Holder Name"
                    value={formData.card_holder}
                    onChange={handleInputChange('card_holder')}
                    disabled={!editing}
                    placeholder="John Doe"
                    error={!!validationErrors.card_holder}
                    helperText={validationErrors.card_holder}
                    inputProps={{ maxLength: 100 }}
                  />
                </Grid>
                <Grid item xs={8}>
                  <TextField
                    fullWidth
                    label="Card Number"
                    value={getCardNumberDisplay()}
                    onChange={handleInputChange('card_number')}
                    disabled={!editing}
                    placeholder="1234 5678 9012 3456"
                    error={!!validationErrors.card_number}
                    helperText={validationErrors.card_number}
                    inputProps={{ maxLength: 19 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title={cardNumberMasked ? "Show full card number" : "Hide card number"}>
                            <IconButton
                              onClick={() => setCardNumberMasked(!cardNumberMasked)}
                              edge="end"
                            >
                              {cardNumberMasked ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                  {formData.card_number && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {cardNumberMasked ? "Card number is masked for security" : "Showing full card number"}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={4}>
                  <FormControl fullWidth disabled={!editing}>
                    <InputLabel>Card Type</InputLabel>
                    <Select
                      value={formData.card_type}
                      label="Card Type"
                      onChange={handleInputChange('card_type')}
                    >
                      <MenuItem value="Visa">Visa</MenuItem>
                      <MenuItem value="Mastercard">Mastercard</MenuItem>
                      <MenuItem value="American Express">American Express</MenuItem>
                      <MenuItem value="Discover">Discover</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Expiry Month"
                    value={formData.expiry_month}
                    onChange={handleInputChange('expiry_month')}
                    disabled={!editing}
                    placeholder="12"
                    error={!!validationErrors.expiry_month}
                    helperText={validationErrors.expiry_month}
                    inputProps={{ maxLength: 2 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Expiry Year"
                    value={formData.expiry_year}
                    onChange={handleInputChange('expiry_year')}
                    disabled={!editing}
                    placeholder="2025"
                    error={!!validationErrors.expiry_year}
                    helperText={validationErrors.expiry_year}
                    inputProps={{ maxLength: 4 }}
                  />
                </Grid>
              </Grid>

              {editing && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    💡 Tip: Make sure to save your changes before leaving this page. Card information will be used to auto-populate checkout forms.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default UserProfile;

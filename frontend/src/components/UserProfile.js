import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Grid, Button, TextField, Avatar, IconButton,
  Alert, FormControl, InputLabel, Select, MenuItem, InputAdornment, Tooltip,
  Chip, Snackbar,
} from '@mui/material';
import {
  Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon, Person as PersonIcon,
  Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
  CreditCard as CreditCardIcon, LocalShipping as ShippingIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiClient as axios } from '../config/api';
import { getApiUrl } from '../config/api';
import { alpha } from '@mui/material/styles';

const SectionCard = ({ children, sx, ...rest }) => (
  <Box
    sx={{
      bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
      border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
      borderRadius: '14px',
      overflow: 'hidden',
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Box>
);

const SectionHeader = ({ icon: Icon, title, action }) => (
  <Box sx={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    px: 3, py: 2,
    borderBottom: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
    bgcolor: (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.02),
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {Icon && <Icon sx={{ fontSize: '1.1rem', color: 'primary.main' }} />}
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.primary' }}>
        {title}
      </Typography>
    </Box>
    {action}
  </Box>
);

const StyledInput = ({ label, ...rest }) => (
  <TextField
    fullWidth size="small" label={label}
    sx={{
      '& .MuiOutlinedInput-root': {
        borderRadius: '10px', fontSize: '0.88rem',
        bgcolor: (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03),
        '& fieldset': { borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider },
        '&:hover fieldset': { borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider },
        '&.Mui-focused fieldset': { borderColor: (t) => alpha(t.palette.primary.main, 0.5) },
      },
      '& .MuiInputLabel-root': { fontSize: '0.82rem' },
      '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: (t) => t.palette.text.primary, opacity: 0.85 },
    }}
    {...rest}
  />
);

const UserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [cardNumberMasked, setCardNumberMasked] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address: '', city: '', state: '', zip_code: '', country: 'US',
    card_number: '', card_type: '', card_holder: '', expiry_month: '', expiry_year: '',
  });

  const maskCardNumber = (num) => {
    if (!num || num.length < 4) return num;
    return `${num.slice(0, 4)} ${'*'.repeat(Math.max(0, num.length - 8))} ${num.slice(-4)}`;
  };

  const getCardNumberDisplay = () => {
    if (!formData.card_number) return '';
    if (cardNumberMasked) return maskCardNumber(formData.card_number);
    const cleaned = formData.card_number.replace(/\s/g, '');
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const validateField = (field, value) => {
    const errors = {};
    switch (field) {
      case 'first_name': case 'last_name':
        if (value.length > 50) errors[field] = 'Max 50 characters'; break;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field] = 'Invalid email';
        if (value.length > 100) errors[field] = 'Max 100 characters'; break;
      case 'phone':
        if (value && !/^[\d\s\-()]+$/.test(value)) errors[field] = 'Invalid phone';
        if (value.length > 20) errors[field] = 'Max 20 characters'; break;
      case 'card_number':
        if (value && !/^\d+$/.test(value)) errors[field] = 'Numbers only';
        if (value.length > 19) errors[field] = 'Max 19 digits';
        if (value.length > 0 && value.length < 13) errors[field] = 'Min 13 digits'; break;
      case 'expiry_month':
        if (value && (parseInt(value) < 1 || parseInt(value) > 12)) errors[field] = '1-12'; break;
      case 'expiry_year':
        if (value && value.length !== 4) errors[field] = '4 digits';
        if (value && parseInt(value) < new Date().getFullYear()) errors[field] = 'Past year'; break;
      default: break;
    }
    return errors;
  };

  const handleInputChange = (field) => (event) => {
    let value = event.target.value;
    if (['phone'].includes(field)) value = value.replace(/[^\d\s\-()]/g, '');
    if (['zip_code', 'card_number', 'expiry_month', 'expiry_year'].includes(field))
      value = field === 'card_number' ? value.replace(/[\s*]/g, '').replace(/\D/g, '') : value.replace(/\D/g, '');
    setFormData({ ...formData, [field]: value });
    setValidationErrors({ ...validationErrors, ...validateField(field, value) });
  };

  const fetchProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }
      const response = await axios.get(getApiUrl('/api/profile/'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(response.data);
      const d = response.data;
      setFormData({
        first_name: d.first_name || '', last_name: d.last_name || '', email: d.email || '',
        phone: d.phone || '', address: d.address || '', city: d.city || '',
        state: d.state || '', zip_code: d.zip_code || '', country: d.country || 'US',
        card_number: d.card_number || '', card_type: d.card_type || '',
        card_holder: d.card_holder || '', expiry_month: d.expiry_month || '', expiry_year: d.expiry_year || '',
      });
    } catch {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleCancel = () => {
    setEditing(false);
    setCardNumberMasked(true);
    setValidationErrors({});
    if (profile) {
      const d = profile;
      setFormData({
        first_name: d.first_name || '', last_name: d.last_name || '', email: d.email || '',
        phone: d.phone || '', address: d.address || '', city: d.city || '',
        state: d.state || '', zip_code: d.zip_code || '', country: d.country || 'US',
        card_number: d.card_number || '', card_type: d.card_type || '',
        card_holder: d.card_holder || '', expiry_month: d.expiry_month || '', expiry_year: d.expiry_year || '',
      });
    }
  };

  const handleSave = async () => {
    const errors = {};
    Object.keys(formData).forEach(f => Object.assign(errors, validateField(f, formData[f])));
    if (Object.keys(errors).length > 0) { setValidationErrors(errors); return; }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(getApiUrl('/api/profile/'), formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(response.data);
      setEditing(false);
      setCardNumberMasked(true);
      setValidationErrors({});
      setSnack({ open: true, message: 'Profile updated successfully', severity: 'success' });
    } catch {
      setSnack({ open: true, message: 'Failed to update profile', severity: 'error' });
    }
  };

  const handleUploadPicture = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('profile_picture', selectedFile);
      const response = await axios.post(getApiUrl('/api/profile/picture/'), fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setProfile(response.data);
      setSelectedFile(null);
      setSnack({ open: true, message: 'Profile picture updated', severity: 'success' });
    } catch {
      setSnack({ open: true, message: 'Failed to upload picture', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>Loading profile...</Typography>
      </Box>
    );
  }

  const initials = `${(formData.first_name || '')[0] || ''}${(formData.last_name || '')[0] || ''}`.toUpperCase() || (profile?.username?.[0] || '?').toUpperCase();

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}

        <Grid container spacing={3}>
          {/* Left column - Identity Card */}
          <Grid item xs={12} md={4}>
            <SectionCard sx={{ position: 'sticky', top: 24 }}>
              {/* Gradient banner */}
              <Box sx={{
                height: 100,
                background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${alpha(t.palette.primary.main, 0.6)} 100%)`,
                position: 'relative',
              }} />

              {/* Avatar */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: '-48px', pb: 3, px: 3 }}>
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <Avatar
                    src={profile?.profile_picture_url}
                    sx={{
                      width: 96, height: 96, fontSize: '1.6rem', fontWeight: 700,
                      border: (t) => `4px solid ${t.palette.custom?.surface?.elevated ?? t.palette.background.paper}`,
                      bgcolor: (t) => t.palette.primary.main,
                      boxShadow: (t) => `0 4px 20px ${alpha(t.palette.common.black, 0.4)}`,
                    }}
                  >
                    {initials}
                  </Avatar>
                  <input accept="image/*" style={{ display: 'none' }} id="profile-picture-input" type="file" onChange={(e) => setSelectedFile(e.target.files[0])} />
                  <label htmlFor="profile-picture-input">
                    <IconButton
                      component="span" size="small"
                      sx={{
                        position: 'absolute', bottom: -2, right: -2,
                        bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
                        border: (t) => `2px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.15) },
                        width: 32, height: 32,
                      }}
                    >
                      <PhotoCameraIcon sx={{ fontSize: '0.9rem', color: 'primary.main' }} />
                    </IconButton>
                  </label>
                </Box>

                {selectedFile && (
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Button size="small" variant="contained" onClick={handleUploadPicture} disabled={uploading}
                      sx={{ textTransform: 'none', fontSize: '0.75rem', borderRadius: '8px' }}>
                      {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => setSelectedFile(null)}
                      sx={{ textTransform: 'none', fontSize: '0.75rem', borderRadius: '8px' }}>
                      Cancel
                    </Button>
                  </Box>
                )}

                <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: 'text.primary', textAlign: 'center' }}>
                  {profile?.full_name || profile?.username}
                </Typography>
                <Typography sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontSize: '0.82rem', mb: 1.5 }}>
                  @{profile?.username}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Chip label={formData.email || 'No email'} size="small" variant="outlined"
                    sx={{ fontSize: '0.72rem', borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider, color: 'text.secondary' }} />
                  {formData.city && (
                    <Chip label={`${formData.city}, ${formData.state}`} size="small" variant="outlined"
                      sx={{ fontSize: '0.72rem', borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider, color: 'text.secondary' }} />
                  )}
                </Box>

                {/* Quick stats */}
                <Box sx={{
                  display: 'flex', gap: 2, mt: 3, width: '100%',
                  p: 2, borderRadius: '10px',
                  bgcolor: (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03),
                  border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                }}>
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600, color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', letterSpacing: '0.05em' }}>
                      Member Since
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.primary', mt: 0.3 }}>
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ width: '1px', bgcolor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider }} />
                  <Box sx={{ flex: 1, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600, color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', letterSpacing: '0.05em' }}>
                      Card
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.primary', mt: 0.3 }}>
                      {formData.card_type || 'None'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </SectionCard>
          </Grid>

          {/* Right column - Editable sections */}
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              {/* Action bar */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                {!editing ? (
                  <Button startIcon={<EditIcon sx={{ fontSize: '0.9rem' }} />} onClick={() => { setEditing(true); setValidationErrors({}); }}
                    variant="outlined" size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderRadius: '10px',
                      borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                      color: 'text.primary', px: 2.5,
                      '&:hover': { borderColor: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.06) },
                    }}>
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button startIcon={<CancelIcon sx={{ fontSize: '0.9rem' }} />} onClick={handleCancel} size="small"
                      sx={{ textTransform: 'none', fontSize: '0.8rem', borderRadius: '10px', color: 'text.secondary' }}>
                      Discard
                    </Button>
                    <Button startIcon={<SaveIcon sx={{ fontSize: '0.9rem' }} />} onClick={handleSave} variant="contained" size="small"
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderRadius: '10px', px: 2.5, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                      Save Changes
                    </Button>
                  </>
                )}
              </Box>

              {/* Personal Information */}
              <SectionCard>
                <SectionHeader icon={PersonIcon} title="Personal Information" />
                <Box sx={{ p: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <StyledInput label="First Name" value={formData.first_name} onChange={handleInputChange('first_name')}
                        disabled={!editing} error={!!validationErrors.first_name} helperText={validationErrors.first_name} inputProps={{ maxLength: 50 }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <StyledInput label="Last Name" value={formData.last_name} onChange={handleInputChange('last_name')}
                        disabled={!editing} error={!!validationErrors.last_name} helperText={validationErrors.last_name} inputProps={{ maxLength: 50 }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <StyledInput label="Email" type="email" value={formData.email} onChange={handleInputChange('email')}
                        disabled={!editing} error={!!validationErrors.email} helperText={validationErrors.email} inputProps={{ maxLength: 100 }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <StyledInput label="Phone" value={formData.phone} onChange={handleInputChange('phone')}
                        disabled={!editing} error={!!validationErrors.phone} helperText={validationErrors.phone} inputProps={{ maxLength: 20 }} />
                    </Grid>
                  </Grid>
                </Box>
              </SectionCard>

              {/* Shipping Address */}
              <SectionCard>
                <SectionHeader icon={ShippingIcon} title="Shipping Address" />
                <Box sx={{ p: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <StyledInput label="Street Address" value={formData.address} onChange={handleInputChange('address')}
                        disabled={!editing} inputProps={{ maxLength: 200 }} />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <StyledInput label="City" value={formData.city} onChange={handleInputChange('city')}
                        disabled={!editing} inputProps={{ maxLength: 50 }} />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <StyledInput label="State" value={formData.state} onChange={handleInputChange('state')}
                        disabled={!editing} inputProps={{ maxLength: 2 }} />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <StyledInput label="ZIP" value={formData.zip_code} onChange={handleInputChange('zip_code')}
                        disabled={!editing} error={!!validationErrors.zip_code} helperText={validationErrors.zip_code} inputProps={{ maxLength: 10 }} />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <FormControl fullWidth size="small" disabled={!editing}>
                        <InputLabel sx={{ fontSize: '0.82rem' }}>Country</InputLabel>
                        <Select value={formData.country} label="Country" onChange={handleInputChange('country')}
                          sx={{
                            borderRadius: '10px', fontSize: '0.88rem',
                            bgcolor: (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03),
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider },
                          }}>
                          <MenuItem value="US">US</MenuItem>
                          <MenuItem value="CA">Canada</MenuItem>
                          <MenuItem value="UK">UK</MenuItem>
                          <MenuItem value="AU">Australia</MenuItem>
                          <MenuItem value="IN">India</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Box>
              </SectionCard>

              {/* Payment Information */}
              <SectionCard>
                <SectionHeader
                  icon={CreditCardIcon}
                  title="Payment Method"
                  action={
                    formData.card_number && (
                      <Chip
                        label={formData.card_type || 'Card'}
                        size="small"
                        sx={{
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                          color: 'primary.main', fontWeight: 600, fontSize: '0.7rem',
                          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
                        }}
                      />
                    )
                  }
                />
                <Box sx={{ p: 3 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <StyledInput label="Cardholder Name" value={formData.card_holder} onChange={handleInputChange('card_holder')}
                        disabled={!editing} inputProps={{ maxLength: 100 }} />
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      <StyledInput
                        label="Card Number" value={getCardNumberDisplay()} onChange={handleInputChange('card_number')}
                        disabled={!editing} error={!!validationErrors.card_number} helperText={validationErrors.card_number}
                        inputProps={{ maxLength: 19, style: { fontFamily: 'monospace', letterSpacing: '0.1em' } }}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip title={cardNumberMasked ? 'Reveal' : 'Mask'}>
                                <IconButton onClick={() => setCardNumberMasked(!cardNumberMasked)} edge="end" size="small">
                                  {cardNumberMasked ? <VisibilityOffIcon sx={{ fontSize: '1rem' }} /> : <VisibilityIcon sx={{ fontSize: '1rem' }} />}
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <FormControl fullWidth size="small" disabled={!editing}>
                        <InputLabel sx={{ fontSize: '0.82rem' }}>Card Type</InputLabel>
                        <Select value={formData.card_type} label="Card Type" onChange={handleInputChange('card_type')}
                          sx={{
                            borderRadius: '10px', fontSize: '0.88rem',
                            bgcolor: (t) => alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.03),
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider },
                          }}>
                          <MenuItem value="Visa">Visa</MenuItem>
                          <MenuItem value="Mastercard">Mastercard</MenuItem>
                          <MenuItem value="American Express">Amex</MenuItem>
                          <MenuItem value="Discover">Discover</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StyledInput label="Exp Month" value={formData.expiry_month} onChange={handleInputChange('expiry_month')}
                        disabled={!editing} error={!!validationErrors.expiry_month} helperText={validationErrors.expiry_month}
                        inputProps={{ maxLength: 2, style: { textAlign: 'center' } }} placeholder="MM" />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StyledInput label="Exp Year" value={formData.expiry_year} onChange={handleInputChange('expiry_year')}
                        disabled={!editing} error={!!validationErrors.expiry_year} helperText={validationErrors.expiry_year}
                        inputProps={{ maxLength: 4, style: { textAlign: 'center' } }} placeholder="YYYY" />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      {formData.card_number && !editing && (
                        <Box sx={{
                          display: 'flex', alignItems: 'center', gap: 1, p: 1.5,
                          borderRadius: '10px',
                          bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
                          border: (t) => `1px solid ${alpha(t.palette.warning.main, 0.15)}`,
                        }}>
                          <ShieldIcon sx={{ fontSize: '0.9rem', color: 'warning.main' }} />
                          <Typography sx={{ fontSize: '0.72rem', color: 'warning.main', fontWeight: 500 }}>
                            Card data stored for checkout auto-fill
                          </Typography>
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                </Box>
              </SectionCard>

            </Box>
          </Grid>
        </Grid>
      </Container>

      <Snackbar
        open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.severity} sx={{ width: '100%', borderRadius: '10px' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserProfile;

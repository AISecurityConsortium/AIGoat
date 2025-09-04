import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Box,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  LocationOn as LocationIcon,
  ShoppingCart as CartIcon,
  CheckCircle as CheckIcon,
  LocalOffer as CouponIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const steps = ['Cart Review', 'Shipping Information', 'Payment Details', 'Order Confirmation'];

const CheckoutForm = ({ cart, onBack }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  const navigate = useNavigate();

  // Form states
  const [shippingInfo, setShippingInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  });

  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardType: '',
  });

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  // Auto-populate form with user profile data
  useEffect(() => {
    const populateFormFromProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await axios.get('/api/profile/data/', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const profile = response.data;
          
          // Auto-populate shipping information
          setShippingInfo(prev => ({
            ...prev,
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            email: profile.email || '',
            phone: profile.phone || '',
            address: profile.address || '',
            city: profile.city || '',
            state: profile.state || '',
            zipCode: profile.zip_code || '',
            country: profile.country || 'US',
          }));

          // Auto-populate payment information (if available)
          setPaymentInfo(prev => ({
            ...prev,
            cardHolder: profile.card_holder || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            cardNumber: profile.card_number || '',
            cardType: profile.card_type || '',
            expiryMonth: profile.expiry_month || '',
            expiryYear: profile.expiry_year || '',
          }));
        }
      } catch (error) {
        console.log('Could not auto-populate form with profile data:', error);
        // This is not a critical error, so we don't show it to the user
      }
    };

    populateFormFromProfile();
  }, []);

  const calculateTotal = () => {
    return cart.items.reduce((total, item) => {
      return total + (item.product_price * item.quantity);
    }, 0);
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    const subtotal = calculateTotal();
    if (appliedCoupon.discount_type === 'percentage') {
      let discount = (subtotal * appliedCoupon.discount_value) / 100;
      if (appliedCoupon.maximum_discount) {
        discount = Math.min(discount, appliedCoupon.maximum_discount);
      }
      return discount;
    } else {
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  };

  const calculateFinalTotal = () => {
    return calculateTotal() - calculateDiscount();
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setCouponLoading(true);
    setCouponError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/coupons/apply/', {
        coupon_code: couponCode.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAppliedCoupon(response.data.coupon);
      setCouponCode('');
      setCouponError('');
    } catch (error) {
      console.error('Error applying coupon:', error);
      setCouponError(error.response?.data?.error || 'Failed to apply coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  const generateOrderId = () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `RT-${timestamp.slice(-6)}-${random}`;
  };

  const handleShippingChange = (field) => (event) => {
    setShippingInfo({
      ...shippingInfo,
      [field]: event.target.value,
    });
  };

  const handlePaymentChange = (field) => (event) => {
    let value = event.target.value;
    
    // Format card number with spaces
    if (field === 'cardNumber') {
      value = value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
      if (value.length > 19) value = value.slice(0, 19);
    }
    
    // Format CVV
    if (field === 'cvv') {
      value = value.replace(/\D/g, '').slice(0, 4);
    }
    
    // Auto-detect card type
    if (field === 'cardNumber') {
      const cleanNumber = value.replace(/\s/g, '');
      if (cleanNumber.startsWith('4')) {
        setPaymentInfo(prev => ({ ...prev, cardType: 'Visa' }));
      } else if (cleanNumber.startsWith('5')) {
        setPaymentInfo(prev => ({ ...prev, cardType: 'MasterCard' }));
      } else if (cleanNumber.startsWith('3')) {
        setPaymentInfo(prev => ({ ...prev, cardType: 'American Express' }));
      } else {
        setPaymentInfo(prev => ({ ...prev, cardType: '' }));
      }
    }

    setPaymentInfo({
      ...paymentInfo,
      [field]: value,
    });
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmitOrder = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const newOrderId = generateOrderId();
      
      // Create order with shipping and payment info
      const orderData = {
        shipping_info: shippingInfo,
        payment_info: paymentInfo,
        order_id: newOrderId,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
      };

      const response = await axios.post('/api/checkout/', orderData, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.data.success) {
        setOrderId(newOrderId);
        setActiveStep(3); // Move to confirmation step
        // Dispatch cart update event
        window.dispatchEvent(new Event('cartUpdated'));
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      setError('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderCartReview = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Order Summary
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {cart.items.map((item) => (
            <Card key={item.id} variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={2}>
                    <img
                      src={item.product_image_url}
                      alt={item.product_name}
                      style={{ 
                        width: '60px', 
                        height: '60px', 
                        objectFit: 'cover',
                        borderRadius: '4px'
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle1">
                      {item.product_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Quantity: {item.quantity}
                    </Typography>
                  </Grid>
                  <Grid item xs={4} sx={{ textAlign: 'right' }}>
                    <Typography variant="subtitle1">
                      ${(item.product_price * item.quantity).toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          ))}
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Order Summary
              </Typography>
              
              {/* Coupon Section */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <CouponIcon sx={{ mr: 0.5, fontSize: 16 }} />
                  Apply Coupon
                </Typography>
                
                {appliedCoupon ? (
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      label={`${appliedCoupon.code} - ${appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}%` : `$${appliedCoupon.discount_value}`}`}
                      color="success"
                      onDelete={handleRemoveCoupon}
                      deleteIcon={<CloseIcon />}
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      size="small"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      disabled={couponLoading}
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                    >
                      {couponLoading ? <CircularProgress size={16} /> : 'Apply'}
                    </Button>
                  </Box>
                )}
                
                {couponError && (
                  <Alert severity="error" sx={{ mt: 1, fontSize: '0.75rem' }}>
                    {couponError}
                  </Alert>
                )}
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Subtotal:</Typography>
                <Typography>${calculateTotal().toFixed(2)}</Typography>
              </Box>
              
              {appliedCoupon && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography color="success.main">Discount:</Typography>
                  <Typography color="success.main">
                    -${calculateDiscount().toFixed(2)}
                  </Typography>
                </Box>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6" color="primary">
                  ${calculateFinalTotal().toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderShippingForm = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Shipping Information
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="First Name"
            value={shippingInfo.firstName}
            onChange={handleShippingChange('firstName')}
            placeholder="John"
            required
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Last Name"
            value={shippingInfo.lastName}
            onChange={handleShippingChange('lastName')}
            placeholder="Doe"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={shippingInfo.email}
            onChange={handleShippingChange('email')}
            placeholder="john.doe@example.com"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Phone Number"
            value={shippingInfo.phone}
            onChange={handleShippingChange('phone')}
            placeholder="(555) 123-4567"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Street Address"
            value={shippingInfo.address}
            onChange={handleShippingChange('address')}
            placeholder="123 Main Street"
            required
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="City"
            value={shippingInfo.city}
            onChange={handleShippingChange('city')}
            placeholder="New York"
            required
          />
        </Grid>
        <Grid item xs={3}>
          <TextField
            fullWidth
            label="State"
            value={shippingInfo.state}
            onChange={handleShippingChange('state')}
            placeholder="NY"
            required
          />
        </Grid>
        <Grid item xs={3}>
          <TextField
            fullWidth
            label="ZIP Code"
            value={shippingInfo.zipCode}
            onChange={handleShippingChange('zipCode')}
            placeholder="10001"
            required
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>Country</InputLabel>
            <Select
              value={shippingInfo.country}
              label="Country"
              onChange={handleShippingChange('country')}
            >
              <MenuItem value="US">United States</MenuItem>
              <MenuItem value="CA">Canada</MenuItem>
              <MenuItem value="UK">United Kingdom</MenuItem>
              <MenuItem value="AU">Australia</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );

  const renderPaymentForm = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        <CreditCardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Payment Information
      </Typography>
      {paymentInfo.cardType && (
        <Box sx={{ mb: 2 }}>
          <Chip 
            label={paymentInfo.cardType} 
            color="primary" 
            size="small"
            sx={{ mr: 1 }}
          />
        </Box>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Card Number"
            value={paymentInfo.cardNumber}
            onChange={handlePaymentChange('cardNumber')}
            placeholder="1234 5678 9012 3456"
            required
            inputProps={{ maxLength: 19 }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Cardholder Name"
            value={paymentInfo.cardHolder}
            onChange={handlePaymentChange('cardHolder')}
            placeholder="JOHN DOE"
            required
          />
        </Grid>
        <Grid item xs={4}>
          <FormControl fullWidth>
            <InputLabel>Month</InputLabel>
            <Select
              value={paymentInfo.expiryMonth}
              label="Month"
              onChange={handlePaymentChange('expiryMonth')}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <MenuItem key={month} value={month.toString().padStart(2, '0')}>
                  {month.toString().padStart(2, '0')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4}>
          <FormControl fullWidth>
            <InputLabel>Year</InputLabel>
            <Select
              value={paymentInfo.expiryYear}
              label="Year"
              onChange={handlePaymentChange('expiryYear')}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                <MenuItem key={year} value={year.toString()}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={4}>
          <TextField
            fullWidth
            label="CVV"
            value={paymentInfo.cvv}
            onChange={handlePaymentChange('cvv')}
            placeholder="123"
            required
            inputProps={{ maxLength: 4 }}
          />
        </Grid>
      </Grid>
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          🔒 Your payment information is secure and encrypted. We use industry-standard SSL encryption to protect your data.
        </Typography>
      </Box>
    </Box>
  );

  const renderConfirmation = () => (
    <Box sx={{ textAlign: 'center' }}>
      <CheckIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom>
        Order Placed Successfully!
      </Typography>
      <Typography variant="h6" color="primary" gutterBottom>
        Order ID: {orderId}
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Thank you for your purchase! You will receive a confirmation email shortly.
      </Typography>
      <Box sx={{ mt: 3 }}>
        <Button
          variant="contained"
          onClick={() => navigate('/orders')}
          sx={{ mr: 2 }}
        >
          View Orders
        </Button>
        <Button
          variant="outlined"
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
        return renderCartReview();
      case 1:
        return renderShippingForm();
      case 2:
        return renderPaymentForm();
      case 3:
        return renderConfirmation();
      default:
        return 'Unknown step';
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Checkout
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
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
          
          {activeStep !== 3 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                disabled={activeStep === 0}
                onClick={activeStep === 0 ? onBack : handleBack}
              >
                {activeStep === 0 ? 'Back to Cart' : 'Back'}
              </Button>
              <Box>
                {activeStep === steps.length - 2 ? (
                  <Button
                    variant="contained"
                    onClick={handleSubmitOrder}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Place Order'}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                  >
                    Next
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

export default CheckoutForm;

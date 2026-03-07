import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Box,
  IconButton,
  Alert,
  Paper,
  Skeleton,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon, ShoppingCart } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiClient as axios } from '../config/api';
import { getApiUrl } from '../config/api';
import { useTheme } from '@mui/material/styles';
import CheckoutForm from './CheckoutForm';

const Cart = () => {
  const theme = useTheme();
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const navigate = useNavigate();

  const fetchCart = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get(getApiUrl('/api/cart/'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setCart(response.data);
    } catch (error) {
      console.error('Error fetching cart:', error);
      setError('Failed to load cart');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (newQuantity < 1) return;

    try {
      const token = localStorage.getItem('token');
      await axios.patch(getApiUrl(`/api/cart/items/${itemId}/`), {
        quantity: newQuantity
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      fetchCart();
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(getApiUrl(`/api/cart/items/${itemId}/`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      fetchCart();
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const handleCheckout = () => {
    setShowCheckout(true);
  };

  const handleBackToCart = () => {
    setShowCheckout(false);
  };

  const calculateTotal = () => {
    return cart.items.reduce((total, item) => {
      return total + (item.product_price * item.quantity);
    }, 0);
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, gap: 2 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ bgcolor: theme.palette.custom?.surface?.elevated ?? theme.palette.action.hover }} />
        <Skeleton variant="rectangular" width="100%" height={120} sx={{ maxWidth: 600, borderRadius: 2, bgcolor: theme.palette.custom?.surface?.elevated ?? theme.palette.action.hover }} />
        <Skeleton variant="rectangular" width="100%" height={120} sx={{ maxWidth: 600, borderRadius: 2, bgcolor: theme.palette.custom?.surface?.elevated ?? theme.palette.action.hover }} />
        <Typography sx={{ color: theme.palette.custom?.text?.muted ?? theme.palette.text.secondary }}>Loading cart...</Typography>
      </Container>
    );
  }

  if (showCheckout) {
    return <CheckoutForm cart={cart} onBack={handleBackToCart} />;
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}
      >
        Shopping Cart
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {cart.items.length === 0 ? (
        <Card sx={{ border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}` }}>
          <CardContent sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ShoppingCart sx={{ fontSize: 80, color: (t) => t.palette.custom?.text?.muted ?? t.palette.text.secondary }} />
            <Typography variant="h6" align="center" sx={{ color: (t) => t.palette.custom?.text?.body ?? t.palette.text.primary }}>
              Your cart is empty
            </Typography>
            <Button variant="contained" onClick={() => navigate('/home')}>
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)' },
              gap: 1.5,
              mb: 3,
            }}
          >
            {cart.items.map((item) => (
              <Card
                key={item.id}
                sx={{
                  border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                  bgcolor: (t) => t.palette.custom?.surface?.main ?? t.palette.background.paper,
                  borderRadius: '10px',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                    transform: 'translateY(-2px)',
                    boxShadow: (t) => `0 3px 12px ${t.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}`,
                  },
                }}
              >
                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="img"
                    src={item.product_image_url}
                    alt={item.product_name}
                    sx={{
                      width: '100%',
                      height: 100,
                      objectFit: 'cover',
                      borderRadius: '10px 10px 0 0',
                    }}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemoveItem(item.id)}
                    sx={{
                      position: 'absolute', top: 4, right: 4, p: 0.5,
                      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(4px)',
                      '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)' },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: '0.85rem' }} />
                  </IconButton>
                </Box>

                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Typography
                    sx={{
                      fontWeight: 700, fontSize: '0.75rem', color: 'text.primary',
                      mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {item.product_name}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: (t) => t.palette.custom?.brand?.primary ?? 'primary.main', mb: 1 }}>
                    ₹{item.product_price}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                    bgcolor: (t) => t.palette.custom?.surface?.sunken ?? t.palette.action.hover,
                    borderRadius: '6px', py: 0.25,
                  }}>
                    <IconButton
                      size="small"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      sx={{ width: 24, height: 24 }}
                    >
                      <RemoveIcon sx={{ fontSize: '0.75rem' }} />
                    </IconButton>
                    <TextField
                      size="small"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                      inputProps={{ style: { textAlign: 'center', padding: '2px 0', fontWeight: 700, fontSize: '0.75rem' } }}
                      sx={{ width: 36, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      sx={{ width: 24, height: 24 }}
                    >
                      <AddIcon sx={{ fontSize: '0.75rem' }} />
                    </IconButton>
                  </Box>

                  <Typography sx={{ textAlign: 'center', mt: 0.5, fontWeight: 700, fontSize: '0.68rem', color: 'text.secondary' }}>
                    Subtotal: ₹{(item.product_price * item.quantity).toFixed(0)}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderRadius: '12px',
              border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
              bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total ({cart.items.length} item{cart.items.length !== 1 ? 's' : ''})
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
                ₹{calculateTotal().toFixed(0)}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              onClick={handleCheckout}
              sx={{ px: 4, borderRadius: '10px', fontWeight: 700 }}
            >
              Place Order
            </Button>
          </Paper>
        </>
      )}
    </Container>
  );
};

export default Cart;

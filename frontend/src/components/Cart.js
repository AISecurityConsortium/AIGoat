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
  IconButton,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import CheckoutForm from './CheckoutForm';

const Cart = () => {
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
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
  };

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
      // Dispatch cart update event
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
      // Dispatch cart update event
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
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Typography>Loading cart...</Typography>
      </Container>
    );
  }

  if (showCheckout) {
    return <CheckoutForm cart={cart} onBack={handleBackToCart} />;
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Shopping Cart
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {cart.items.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" align="center">
              Your cart is empty
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" onClick={() => navigate('/')}>
                Continue Shopping
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid container spacing={2}>
            {cart.items.map((item) => (
              <Grid item xs={12} key={item.id}>
                <Card>
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={3}>
                        <img
                          src={item.product_image_url}
                          alt={item.product_name}
                          style={{ 
                            width: '80px', 
                            height: '80px', 
                            objectFit: 'cover',
                            borderRadius: '4px'
                          }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="h6">
                          {item.product_name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ${item.product_price}
                        </Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          >
                            <RemoveIcon />
                          </IconButton>
                          <TextField
                            size="small"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                            sx={{ width: 60 }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          >
                            <AddIcon />
                          </IconButton>
                          <IconButton
                            color="error"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5">
              Total: ${calculateTotal().toFixed(2)}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={handleCheckout}
            >
              Place Order
            </Button>
          </Box>
        </>
      )}
    </Container>
  );
};

export default Cart; 
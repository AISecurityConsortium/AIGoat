import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Box,
  Rating,
  TextField,
  Alert,
  Divider,
  IconButton,
  Paper,
  Avatar,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Lightbulb as TipIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient as axios } from '../config/api';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: '',
  });
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [productTip, setProductTip] = useState('');
  const [tipFile, setTipFile] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProduct();
    fetchReviews();
    fetchSimilarProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`/api/products/${id}/`);
      setProduct(response.data);
    } catch (error) {
      console.error('Error fetching product:', error);
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await axios.get(`/api/reviews/${id}/`);
      setReviews(response.data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchSimilarProducts = async () => {
    try {
      const response = await axios.get('/api/products/');
      const allProducts = response.data;
      const similar = findSimilarProducts(allProducts, parseInt(id));
      setSimilarProducts(similar.slice(0, 4)); // Show max 4 similar products
    } catch (error) {
      console.error('Error fetching similar products:', error);
    }
  };

  const findSimilarProducts = (allProducts, currentProductId) => {
    const currentProduct = allProducts.find(p => p.id === currentProductId);
    if (!currentProduct) return [];

    return allProducts
      .filter(p => p.id !== currentProductId) // Exclude current product
      .map(p => ({
        ...p,
        similarityScore: calculateSimilarity(currentProduct, p)
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore); // Sort by similarity score
  };

  const calculateSimilarity = (product1, product2) => {
    let score = 0;
    
    // Category similarity (based on product name keywords)
    const keywords1 = product1.name.toLowerCase().split(/\s+/);
    const keywords2 = product2.name.toLowerCase().split(/\s+/);
    
    const commonKeywords = keywords1.filter(keyword => 
      keywords2.some(k2 => k2.includes(keyword) || keyword.includes(k2))
    );
    
    if (commonKeywords.length > 0) {
      score += commonKeywords.length * 10;
    }
    
    // Price range similarity
    const priceDiff = Math.abs(product1.price - product2.price);
    const maxPrice = Math.max(product1.price, product2.price);
    const priceSimilarity = 1 - (priceDiff / maxPrice);
    score += priceSimilarity * 5;
    
    // Type similarity (t-shirt, mug, hoodie, etc.)
    const typeKeywords = ['t-shirt', 'shirt', 'mug', 'hoodie', 'beanie', 'hat', 'glass', 'bottle'];
    const type1 = typeKeywords.find(type => product1.name.toLowerCase().includes(type));
    const type2 = typeKeywords.find(type => product2.name.toLowerCase().includes(type));
    
    if (type1 && type2 && type1 === type2) {
      score += 15;
    }
    
    return score;
  };

  const handleAddToCart = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      await axios.post(
        '/api/cart/',
        { product_id: id, quantity: quantity },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Show success message
      setError('');
      alert(`Added ${quantity} ${product.name} to cart!`);
      // Dispatch cart update event
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error adding to cart:', error);
      setError('Failed to add to cart');
    }
  };

  const handleAddSimilarToCart = async (productId, productName) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      await axios.post(
        '/api/cart/',
        { product_id: productId, quantity: 1 },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      alert(`Added ${productName} to cart!`);
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error adding to cart:', error);
      setError('Failed to add to cart');
    }
  };

  const handleBuyNow = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Add the product to cart first
      await axios.post(
        '/api/cart/',
        { product_id: id, quantity: quantity },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      // Dispatch cart update event
      window.dispatchEvent(new Event('cartUpdated'));
      
      // Navigate to checkout
      navigate('/cart');
    } catch (error) {
      console.error('Error processing buy now:', error);
      setError('Failed to process purchase');
    }
  };


  const handleSubmitReview = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      await axios.post(
        '/api/reviews/',
        {
          product: id,
          rating: newReview.rating,
          comment: newReview.comment,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setNewReview({ rating: 5, comment: '' });
      fetchReviews(); // Refresh reviews
      alert('Review submitted successfully!');
    } catch (error) {
      console.error('Error submitting review:', error);
      setError('Failed to submit review');
    }
  };

  const handleSubmitTip = async () => {
    if (!productTip.trim() && !tipFile) {
      setError('Please provide either a tip text or upload a file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('product_id', id);
      
      if (productTip.trim()) {
        formData.append('tip', productTip);
      }
      
      if (tipFile) {
        formData.append('tip_file', tipFile);
      }

      const token = localStorage.getItem('token');
      const headers = {};
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post('/api/tips/', formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        }
      });

      if (response.status === 200) {
        setSuccess('Tip submitted successfully! It will be used to enhance our product knowledge base.');
        setProductTip('');
        setTipFile(null);
        setTipDialogOpen(false);
      }
    } catch (error) {
      console.error('Error submitting tip:', error);
      setError('Failed to submit tip. Please try again.');
    }
  };

  const handleQuantityChange = (newQuantity) => {
    if (newQuantity >= 1 && newQuantity <= 10) {
      setQuantity(newQuantity);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 2 }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="text" width="80%" height={48} />
            <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
            <Skeleton variant="text" width="25%" height={40} sx={{ mt: 2 }} />
            <Skeleton variant="text" width="100%" height={80} sx={{ mt: 3 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Product not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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

      <Grid container spacing={4}>
        {/* Product Image */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              overflow: 'hidden',
              position: 'relative',
              bgcolor: (t) => t.palette.custom?.surface?.main ?? t.palette.background.paper,
              border: 1,
              borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
            }}
          >
            <Box sx={{ position: 'relative' }}>
              <CardMedia
                component="img"
                height="500"
                image={product.image_url}
                alt={product.name}
                sx={{ objectFit: 'cover' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '30%',
                  background: (t) => `linear-gradient(to top, ${t.palette.background.paper}, transparent)`,
                  pointerEvents: 'none',
                }}
              />
            </Box>
          </Card>
        </Grid>

        {/* Product Info */}
        <Grid item xs={12} md={6}>
          <Typography variant="h4" component="h1" gutterBottom>
            {product.name}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Rating value={product.average_rating} precision={0.5} readOnly />
            <Typography variant="body2" sx={{ ml: 1 }}>
              ({product.review_count} reviews)
            </Typography>
          </Box>
          
          <Typography variant="h4" color="primary" gutterBottom>
            ₹{product.price}
          </Typography>
          
          {/* Stock Status */}
          {!product.is_available && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                {product.stock_status}
              </Typography>
              <Typography variant="body2">
                This product is currently unavailable for purchase.
              </Typography>
            </Alert>
          )}
          
          {product.is_available && product.quantity <= 5 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold">
                {product.stock_status}
              </Typography>
            </Alert>
          )}

          {/* Add to Cart Section */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.custom?.brand?.primary ?? t.palette.primary.main, 0.08),
              border: '1px solid',
              borderColor: (t) => alpha(t.palette.custom?.brand?.primary ?? t.palette.primary.main, 0.2),
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ mr: 2, fontWeight: 600, color: (t) => t.palette.custom?.text?.body ?? t.palette.text.primary }}>
                Quantity:
              </Typography>
              <IconButton
                onClick={() => handleQuantityChange(quantity - 1)}
                disabled={quantity <= 1}
                sx={{
                  bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.default,
                  border: '1px solid',
                  borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                  '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? 'action.hover' },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                <RemoveIcon />
              </IconButton>
              <Typography variant="h6" sx={{ mx: 2, minWidth: '30px', textAlign: 'center', color: (t) => t.palette.text.primary }}>
                {quantity}
              </Typography>
              <IconButton
                onClick={() => handleQuantityChange(quantity + 1)}
                disabled={quantity >= 10}
                sx={{
                  bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.default,
                  border: '1px solid',
                  borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                  '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? 'action.hover' },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                <AddIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="medium"
                startIcon={<AddIcon />}
                onClick={handleAddToCart}
                disabled={!product.is_available}
                sx={{
                  flex: 1,
                  minWidth: 140,
                  fontSize: '0.9rem',
                  py: 1.25,
                  bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                  '&:hover': { bgcolor: (t) => t.palette.primary.dark },
                }}
              >
                {product.is_available ? 'Add to Cart' : 'Sold Out'}
              </Button>
              <Button
                variant="contained"
                size="medium"
                startIcon={<CartIcon />}
                onClick={handleBuyNow}
                disabled={!product.is_available}
                sx={{
                  flex: 1,
                  minWidth: 140,
                  fontSize: '0.9rem',
                  py: 1.25,
                  bgcolor: (t) => t.palette.custom?.brand?.accent ?? t.palette.secondary.main,
                  '&:hover': { bgcolor: (t) => t.palette.secondary.dark },
                }}
              >
                {product.is_available ? 'Buy Now' : 'Sold Out'}
              </Button>
              <Button
                variant="outlined"
                size="medium"
                startIcon={<TipIcon />}
                onClick={() => setTipDialogOpen(true)}
                sx={{
                  fontSize: '0.875rem',
                  py: 1.25,
                  borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                  color: (t) => t.palette.custom?.text?.accent ?? t.palette.primary.main,
                }}
              >
                Share Tip
              </Button>
            </Box>
          </Box>
          
          {/* Product Description */}
          <Typography variant="body1" paragraph sx={{ mb: 3 }}>
            {product.description}
          </Typography>
          
          {/* Detailed Product Description */}
          {product.detailed_description && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Product Description
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.6, color: 'text.secondary' }}>
                {product.detailed_description}
              </Typography>
            </Box>
          )}
          
          {/* Product Specifications */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, letterSpacing: '-0.01em', color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
                Product Specifications
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(100px, 38%) 1fr',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                  bgcolor: (t) => t.palette.custom?.surface?.sunken ?? t.palette.background.default,
                }}
              >
                {Object.entries(product.specifications).map(([key, value]) => (
                  <React.Fragment key={key}>
                    <Box
                      sx={{
                        p: 1.75,
                        borderBottom: '1px solid',
                        borderRight: '1px solid',
                        borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        color: 'text.secondary',
                        fontSize: '0.82rem',
                      }}
                    >
                      {key.replace(/_/g, ' ')}
                    </Box>
                    <Box
                      sx={{
                        p: 1.75,
                        borderBottom: '1px solid',
                        borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, fontSize: '0.82rem' }}>
                        {value}
                      </Typography>
                    </Box>
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h5" gutterBottom sx={{ color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
            You may also like
          </Typography>
          <Divider sx={{ mb: 3, borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider }} />
          <Grid container spacing={2}>
            {similarProducts.map((sp) => (
              <Grid item xs={6} sm={3} key={sp.id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
                    bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper,
                    border: '1px solid',
                    borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.12)}`,
                      borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
                    },
                  }}
                  onClick={() => navigate(`/product/${sp.id}`)}
                >
                  <CardMedia
                    component="img"
                    height="160"
                    image={sp.image_url}
                    alt={sp.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" sx={{
                      fontWeight: 600, fontSize: '0.8rem', lineHeight: 1.3, mb: 0.5,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary,
                    }}>
                      {sp.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mb: 0.5 }}>
                      <Rating value={sp.average_rating} precision={0.5} readOnly size="small" sx={{ fontSize: '0.8rem' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        ({sp.review_count})
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main }}>
                        ₹{sp.price}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleAddSimilarToCart(sp.id, sp.name); }}
                        sx={{
                          width: 28, height: 28,
                          bgcolor: (t) => alpha(t.palette.custom?.brand?.primary ?? t.palette.primary.main, 0.1),
                          color: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                          '&:hover': { bgcolor: (t) => alpha(t.palette.custom?.brand?.primary ?? t.palette.primary.main, 0.2) },
                        }}
                      >
                        <CartIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Reviews Section */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom sx={{ color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
          Customer Reviews
        </Typography>
        <Divider sx={{ mb: 3, borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider }} />
        {/* Add Review */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper,
            border: '1px solid',
            borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
          }}
        >
          <Typography variant="h6" gutterBottom sx={{ color: (t) => t.palette.text.primary }}>
            Write a Review
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography component="legend" sx={{ color: 'text.secondary' }}>Rating</Typography>
            <Rating
              value={newReview.rating}
              onChange={(event, newValue) => {
                setNewReview({ ...newReview, rating: newValue });
              }}
            />
          </Box>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Your review"
            value={newReview.comment}
            onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleSubmitReview}
            disabled={!newReview.comment.trim()}
            sx={{ bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main }}
          >
            Submit Review
          </Button>
        </Paper>
        {/* Reviews List */}
        {reviews.length > 0 ? (
          <Stack spacing={2}>
            {reviews.map((review) => (
              <Paper
                key={review.id}
                sx={{
                  p: 3,
                  border: '1px solid',
                  borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
                  bgcolor: (t) => t.palette.custom?.surface?.main ?? t.palette.background.paper,
                  borderRadius: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    sx={{
                      mr: 2,
                      bgcolor: (t) => alpha(t.palette.custom?.brand?.primary ?? t.palette.primary.main, 0.2),
                      color: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                    }}
                  >
                    {review.user_name ? review.user_name.charAt(0).toUpperCase() : 'U'}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: (t) => t.palette.text.primary }}>
                      {review.user_name || 'Anonymous'}
                    </Typography>
                    <Rating value={review.rating} readOnly size="small" />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: (t) => t.palette.custom?.text?.body ?? t.palette.text.primary }}>
                  {review.comment}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper
            sx={{
              p: 3,
              textAlign: 'center',
              border: '1px solid',
              borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
              bgcolor: (t) => t.palette.custom?.surface?.sunken ?? t.palette.background.default,
            }}
          >
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              No reviews yet. Be the first to review this product!
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Product Tip Upload Dialog */}
      <Dialog
        open={tipDialogOpen}
        onClose={() => setTipDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: (t) => t.palette.custom?.surface?.main ?? t.palette.background.paper,
            border: '1px solid',
            borderColor: (t) => t.palette.custom?.border?.subtle ?? t.palette.divider,
          },
        }}
      >
        <DialogTitle sx={{ color: (t) => t.palette.custom?.text?.heading ?? t.palette.text.primary }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TipIcon sx={{ mr: 1 }} />
            Share a Product Tip
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Share your tips, tricks, or insights about this product. Your tips will help other customers!
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Your tip"
            value={productTip}
            onChange={(e) => setProductTip(e.target.value)}
            placeholder="Share your experience, tips, or recommendations..."
            sx={{ mb: 2 }}
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            onChange={(e) => setTipFile(e.target.files[0])}
            style={{ marginTop: '10px' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTipDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitTip}
            disabled={!productTip.trim() && !tipFile}
          >
            Submit Tip
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProductDetail; 
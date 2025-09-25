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
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Avatar,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Star as StarIcon,
  Upload as UploadIcon,
  Lightbulb as TipIcon,
  ShoppingCart as CartIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

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

  const handleBuyNowSimilar = async (productId, productName) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Add the product to cart first
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

  // Function to separate description and specifications
  const separateDescriptionAndSpecs = (description) => {
    if (!description) return { description: '', specifications: '' };
    
    // Look for common specification indicators
    const specIndicators = [
      'SPECIFICATIONS:', 'SPECS:', 'TECHNICAL SPECS:', 'PRODUCT SPECS:',
      'Features:', 'FEATURES:', 'Details:', 'DETAILS:',
      'Material:', 'MATERIAL:', 'Size:', 'SIZE:',
      'Dimensions:', 'DIMENSIONS:', 'Weight:', 'WEIGHT:'
    ];
    
    let desc = description;
    let specs = '';
    
    for (const indicator of specIndicators) {
      if (description.includes(indicator)) {
        const parts = description.split(indicator);
        if (parts.length > 1) {
          desc = parts[0].trim();
          specs = indicator + parts.slice(1).join(indicator).trim();
          break;
        }
      }
    }
    
    // If no clear separator found, try to split by double newlines or periods
    if (!specs && desc) {
      const sentences = desc.split('. ');
      if (sentences.length > 4) {
        // Take first 3-4 sentences as description, rest as specs
        const descSentences = sentences.slice(0, 4);
        const specSentences = sentences.slice(4);
        desc = descSentences.join('. ') + '.';
        specs = specSentences.join('. ');
      }
    }
    
    return { description: desc, specifications: specs };
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Typography>Loading product...</Typography>
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
          <Card>
            <CardMedia
              component="img"
              height="500"
              image={product.image_url}
              alt={product.name}
              sx={{ objectFit: 'cover' }}
            />
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
            ${product.price}
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
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Product Specifications
              </Typography>
              <Box sx={{ 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 1, 
                overflow: 'hidden',
                backgroundColor: 'background.paper'
              }}>
                {Object.entries(product.specifications).map(([key, value]) => (
                  <Box 
                    key={key}
                    sx={{ 
                      display: 'flex', 
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    <Box sx={{ 
                      flex: '0 0 40%', 
                      p: 2, 
                      backgroundColor: 'grey.50',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                      fontWeight: 600,
                      textTransform: 'capitalize'
                    }}>
                      {key.replace(/_/g, ' ')}
                    </Box>
                    <Box sx={{ flex: 1, p: 2 }}>
                      <Typography variant="body2">
                        {value}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          
          {/* Quantity Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ mr: 2 }}>
              Quantity:
            </Typography>
            <IconButton
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
            >
              <RemoveIcon />
            </IconButton>
            <Typography variant="h6" sx={{ mx: 2, minWidth: '30px', textAlign: 'center' }}>
              {quantity}
            </Typography>
            <IconButton
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={quantity >= 10}
            >
              <AddIcon />
            </IconButton>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="contained"
              size="medium"
              startIcon={<AddIcon />}
              onClick={handleAddToCart}
              disabled={!product.is_available}
              sx={{ flex: 1, fontSize: '0.875rem', padding: '8px 16px' }}
            >
              {product.is_available ? 'Add to Cart' : 'Sold Out'}
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={<CartIcon />}
              onClick={handleBuyNow}
              disabled={!product.is_available}
              sx={{ flex: 1, fontSize: '0.875rem', padding: '8px 16px' }}
            >
              {product.is_available ? 'Buy Now' : 'Sold Out'}
            </Button>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<TipIcon />}
              onClick={() => setTipDialogOpen(true)}
              sx={{ fontSize: '0.875rem', padding: '8px 16px' }}
            >
              Share Tip
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Similar Products Section */}
      {similarProducts.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h5" gutterBottom>
            Similar Products
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            {similarProducts.map((similarProduct) => (
              <Grid item xs={12} sm={6} md={3} key={similarProduct.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    }
                  }}
                  onClick={() => navigate(`/product/${similarProduct.id}`)}
                >
                  <CardMedia
                    component="img"
                    height="200"
                    image={similarProduct.image_url}
                    alt={similarProduct.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ flexGrow: 1, p: 2 }}>
                    <Typography variant="h6" component="h3" gutterBottom sx={{ 
                      fontSize: '1rem', 
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {similarProduct.name}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Rating value={similarProduct.average_rating} precision={0.5} readOnly size="small" />
                      <Typography variant="caption" sx={{ ml: 0.5 }}>
                        ({similarProduct.review_count})
                      </Typography>
                    </Box>
                    
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 700, mb: 2 }}>
                      ${similarProduct.price}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<CartIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSimilarToCart(similarProduct.id, similarProduct.name);
                        }}
                        sx={{ 
                          flex: 1,
                          fontSize: '0.7rem',
                          padding: '4px 8px',
                          minHeight: '32px'
                        }}
                      >
                        Add to Cart
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ShoppingCartIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyNowSimilar(similarProduct.id, similarProduct.name);
                        }}
                        sx={{ 
                          flex: 1,
                          fontSize: '0.7rem',
                          padding: '4px 8px',
                          minHeight: '32px'
                        }}
                      >
                        Buy Now
                      </Button>
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
        <Typography variant="h5" gutterBottom>
          Customer Reviews
        </Typography>
        
        <Divider sx={{ mb: 3 }} />
        
        {/* Add Review */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Write a Review
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography component="legend">Rating</Typography>
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
          >
            Submit Review
          </Button>
        </Paper>

        {/* Reviews List */}
        {reviews.length > 0 ? (
          <Stack spacing={2}>
            {reviews.map((review) => (
              <Paper key={review.id} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2 }}>
                    {review.user_name ? review.user_name.charAt(0).toUpperCase() : 'U'}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {review.user_name || 'Anonymous'}
                    </Typography>
                    <Rating value={review.rating} readOnly size="small" />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(review.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {review.comment}
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No reviews yet. Be the first to review this product!
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Product Tip Upload Dialog */}
      <Dialog open={tipDialogOpen} onClose={() => setTipDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
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
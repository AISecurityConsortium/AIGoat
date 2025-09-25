import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Button,
  Box,
  CircularProgress,
  Rating,
  Alert,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, ShoppingCart as ShoppingCartIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';

const SearchResults = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promptResponse, setPromptResponse] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('q');

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  const performSearch = async () => {
    if (!query) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to search products');
        setLoading(false);
        return;
      }

      const response = await axios.post(
        getApiUrl('/api/search/'),
        { query },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      // Store the prompt response
      const resultText = response.data.reply;
      setPromptResponse(resultText);
      
      // Extract the recommended product name from the LLM response
      const recommendedProduct = extractRecommendedProduct(resultText);
      
      if (recommendedProduct) {
        // Fetch all products and find the one that matches the recommendation
        const productsResponse = await axios.get(getApiUrl('/api/products/'));
        const allProducts = productsResponse.data;
        
        // Find the product that matches the recommended product name
        const matchedProduct = allProducts.find(product => 
          product.name.toLowerCase().includes(recommendedProduct.toLowerCase()) ||
          recommendedProduct.toLowerCase().includes(product.name.toLowerCase())
        );
        
        if (matchedProduct) {
          setSearchResults([matchedProduct]); // Show only the recommended product
        } else {
          // If no exact match found, show no products
          setSearchResults([]);
        }
      } else {
        // If no product recommendation found in LLM response, show no products
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      if (error.response?.status === 503) {
        setError('Search service is currently unavailable. Please try again later.');
      } else {
        setError('Failed to perform search. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const extractRecommendedProduct = (text) => {
    // Look for product names in quotes or after specific phrases
    const patterns = [
      /"([^"]+)"(?!\s*is)/g, // Product names in quotes
      /The\s+"([^"]+)"/g, // "The "Product Name""
      /recommend\s+(?:the\s+)?([^.!?]+)/gi, // After "recommend"
      /suggest\s+(?:the\s+)?([^.!?]+)/gi, // After "suggest"
      /best\s+(?:choice|option|product)\s+(?:is\s+)?([^.!?]+)/gi, // After "best choice"
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 1) {
        // Clean up the extracted text
        let productName = matches[1].trim();
        // Remove common words that might be part of the sentence
        productName = productName.replace(/^(the\s+|a\s+|an\s+)/i, '');
        productName = productName.replace(/\s+(?:is|would be|perfect for|excellent|great|good).*$/i, '');
        return productName.trim();
      }
    }

    // If no pattern matches, try to find product names in the text
    const productKeywords = [
      'T-Shirt', 'Hoodie', 'Mug', 'Sticker', 'Poster', 'Glass', 'Sleeve', 'Cap', 'Beanie', 'Keychain'
    ];
    
    for (const keyword of productKeywords) {
      if (text.includes(keyword)) {
        // Find the full product name containing this keyword
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.includes(keyword)) {
            // Extract the product name from the line
            const match = line.match(/([^.!?]*\b(?:T-Shirt|Hoodie|Mug|Sticker|Poster|Glass|Sleeve|Cap|Beanie|Keychain)\b[^.!?]*)/i);
            if (match) {
              return match[1].trim();
            }
          }
        }
      }
    }

    return null;
  };

  const handleAddToCart = async (productId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to add items to cart');
        return;
      }

      await axios.post(getApiUrl('/api/cart/'), {
        product_id: productId,
        quantity: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Dispatch cart update event
      window.dispatchEvent(new CustomEvent('cartUpdated'));
      alert('Added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Error adding to cart');
    }
  };

  const handleBuyNow = async (productId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to purchase items');
        return;
      }

      // Add the product to cart first
      await axios.post(getApiUrl('/api/cart/'), {
        product_id: productId,
        quantity: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Dispatch cart update event
      window.dispatchEvent(new CustomEvent('cartUpdated'));
      
      // Navigate to checkout
      navigate('/cart');
    } catch (error) {
      console.error('Error processing buy now:', error);
      alert('Error processing purchase');
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Search Results
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Showing results for: "{query}"
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {promptResponse && (
          <Card sx={{ mb: 3, backgroundColor: '#f8f9fa', border: '1px solid #e9ecef' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#495057', fontWeight: 'bold' }}>
                AI Assistant Response:
              </Typography>
              <Typography variant="body1" sx={{ 
                whiteSpace: 'pre-wrap', 
                lineHeight: 1.6,
                color: '#495057'
              }}>
                {promptResponse}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {searchResults.length > 0 ? (
        <Grid container spacing={3}>
          {searchResults.map((product) => (
            <Grid item xs={12} sm={6} key={product.id}>
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
                onClick={() => handleProductClick(product.id)}
              >
                <CardMedia
                  component="img"
                  height="250"
                  image={product.image_url}
                  alt={product.name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography gutterBottom variant="h5" component="h2" noWrap>
                    {product.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                    {product.description}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Rating value={product.rating || 0} precision={0.5} size="small" />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      ({product.review_count || 0} reviews)
                    </Typography>
                  </Box>
                  
                  <Typography variant="h5" color="primary" sx={{ mb: 2, fontWeight: 'bold' }}>
                    ${product.price}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                    <Button
                      variant="contained"
                      size="medium"
                      startIcon={<AddIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product.id);
                      }}
                      sx={{ 
                        flex: 1,
                        fontSize: '0.875rem',
                        padding: '8px 16px'
                      }}
                    >
                      Add to Cart
                    </Button>
                    <Button
                      variant="outlined"
                      size="medium"
                      startIcon={<ShoppingCartIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuyNow(product.id);
                      }}
                      sx={{ 
                        flex: 1,
                        fontSize: '0.875rem',
                        padding: '8px 16px'
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
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <SearchIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No matching product found
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The AI assistant couldn't find a specific product recommendation for your search.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ mt: 2 }}
          >
            Browse All Products
          </Button>
        </Box>
      )}
    </Container>
  );
};

export default SearchResults; 
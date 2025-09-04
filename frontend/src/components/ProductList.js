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
  Link,
  Alert,
  Paper,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Chip,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Collapse,
  IconButton,
} from '@mui/material';
import { 
  Add as AddIcon, 
  ShoppingCart as ShoppingCartIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const navigate = useNavigate();

  // Filter states
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 100],
    minRating: 0,
    hasReviews: false,
    availability: 'all', // 'all', 'in_stock', 'low_stock', 'out_of_stock'
    searchQuery: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, filters]);

  // Get unique categories from products
  const getCategories = () => {
    const categories = new Set();
    products.forEach(product => {
      const category = getProductCategory(product.name);
      if (category) categories.add(category);
    });
    return Array.from(categories).sort();
  };

  // Determine product category based on name
  const getProductCategory = (productName) => {
    const name = productName.toLowerCase();
    if (name.includes('t-shirt') || name.includes('tee') || name.includes('shirt')) return 'T-Shirts';
    if (name.includes('hoodie') || name.includes('sweatshirt')) return 'Hoodies';
    if (name.includes('mug') || name.includes('glass') || name.includes('shot')) return 'Drinkware';
    if (name.includes('sticker') || name.includes('pack')) return 'Stickers';
    if (name.includes('poster') || name.includes('map')) return 'Posters';
    if (name.includes('cap') || name.includes('hat') || name.includes('beanie')) return 'Headwear';
    if (name.includes('keychain') || name.includes('laptop sleeve')) return 'Accessories';
    return 'Other';
  };

  // Apply filters to products
  const applyFilters = () => {
    let filtered = [...products];

    // Search query filter
    if (filters.searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(filters.searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(product => {
        const category = getProductCategory(product.name);
        return filters.categories.includes(category);
      });
    }

    // Price range filter
    filtered = filtered.filter(product =>
      product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1]
    );

    // Rating filter
    if (filters.minRating > 0) {
      filtered = filtered.filter(product => product.average_rating >= filters.minRating);
    }

    // Reviews filter
    if (filters.hasReviews) {
      filtered = filtered.filter(product => product.review_count > 0);
    }

    // Availability filter
    switch (filters.availability) {
      case 'in_stock':
        filtered = filtered.filter(product => product.is_available && product.quantity > 5);
        break;
      case 'low_stock':
        filtered = filtered.filter(product => product.is_available && product.quantity <= 5 && product.quantity > 0);
        break;
      case 'out_of_stock':
        filtered = filtered.filter(product => !product.is_available || product.quantity === 0);
        break;
      default:
        break;
    }

    setFilteredProducts(filtered);
  };

  // Filter handlers
  const handleCategoryChange = (category) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handlePriceRangeChange = (event, newValue) => {
    setFilters(prev => ({
      ...prev,
      priceRange: newValue
    }));
  };

  const handleRatingChange = (event, newValue) => {
    setFilters(prev => ({
      ...prev,
      minRating: newValue
    }));
  };

  const handleAvailabilityChange = (event) => {
    setFilters(prev => ({
      ...prev,
      availability: event.target.value
    }));
  };

  const handleSearchChange = (event) => {
    setFilters(prev => ({
      ...prev,
      searchQuery: event.target.value
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      categories: [],
      priceRange: [0, 100],
      minRating: 0,
      hasReviews: false,
      availability: 'all',
      searchQuery: '',
    });
  };

  // Get price range for slider
  const getPriceRange = () => {
    if (products.length === 0) return [0, 100];
    const prices = products.map(p => p.price);
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/products/');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (productId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to add items to cart');
        return;
      }

      await axios.post('http://localhost:8000/api/cart/', {
        product_id: productId,
        quantity: 1
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Dispatch cart update event
      window.dispatchEvent(new CustomEvent('cartUpdated'));
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
      await axios.post('http://localhost:8000/api/cart/', {
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 6, mb: 6 }}>
      {/* Promotional Banner */}
      <Box sx={{ 
        mb: 4,
        mt: 2
      }}>
        <Box
          component="img"
          src="/media/promo_banner_v2.png"
          alt="Red Team Shop - FLAT 20% OFF for New Users - Use WELCOME20"
          sx={{
            width: '100%',
            height: 'auto',
            maxHeight: 200,
            borderRadius: 1,
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            transition: 'transform 0.2s ease-in-out',
            objectFit: 'cover',
            '&:hover': {
              transform: 'scale(1.01)',
            }
          }}
          onClick={() => {
            // Copy coupon code to clipboard
            navigator.clipboard.writeText('WELCOME20');
            alert('Coupon code WELCOME20 copied to clipboard! Use it at checkout for 20% off your first order.');
          }}
        />
      </Box>
      
      <Typography 
        variant="h3" 
        gutterBottom 
        sx={{ 
          textAlign: 'center',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          mb: 4
        }}
      >
        Our Products
      </Typography>

      {/* Filters and Products Layout */}
      <Grid container spacing={3}>
        {/* Filters Sidebar */}
        <Grid item xs={12} md={3}>
          <Paper 
            elevation={2} 
            sx={{ 
              p: 3, 
              position: 'sticky',
              top: 20,
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto'
            }}
          >
            {/* Filters Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon />
                Filters
              </Typography>
              <IconButton 
                size="small" 
                onClick={clearAllFilters}
                disabled={!filters.categories.length && filters.priceRange[0] === 0 && filters.priceRange[1] === 100 && filters.minRating === 0 && !filters.hasReviews && filters.availability === 'all' && !filters.searchQuery}
              >
                <ClearIcon />
              </IconButton>
            </Box>

            {/* Search Filter */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search products..."
                value={filters.searchQuery}
                onChange={handleSearchChange}
                sx={{ mb: 1 }}
              />
              {filters.searchQuery && (
                <Chip 
                  label={`Search: "${filters.searchQuery}"`} 
                  size="small" 
                  onDelete={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
                />
              )}
            </Box>

            {/* Category Filter */}
            <Accordion 
              expanded={filtersExpanded} 
              onChange={() => setFiltersExpanded(!filtersExpanded)}
              sx={{ mb: 2 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Categories</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {getCategories().map((category) => (
                    <FormControlLabel
                      key={category}
                      control={
                        <Checkbox
                          checked={filters.categories.includes(category)}
                          onChange={() => handleCategoryChange(category)}
                          size="small"
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <Typography variant="body2">{category}</Typography>
                          <Chip 
                            label={products.filter(p => getProductCategory(p.name) === category).length} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      }
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>

            {/* Price Range Filter */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Price Range</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ px: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    ${filters.priceRange[0]} - ${filters.priceRange[1]}
                  </Typography>
                  <Slider
                    value={filters.priceRange}
                    onChange={handlePriceRangeChange}
                    valueLabelDisplay="auto"
                    min={getPriceRange()[0]}
                    max={getPriceRange()[1]}
                    sx={{ mt: 2 }}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Rating Filter */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Minimum Rating</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ px: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    {filters.minRating > 0 ? `${filters.minRating}+ stars` : 'Any rating'}
                  </Typography>
                  <Slider
                    value={filters.minRating}
                    onChange={handleRatingChange}
                    valueLabelDisplay="auto"
                    min={0}
                    max={5}
                    step={0.5}
                    marks={[
                      { value: 0, label: 'Any' },
                      { value: 5, label: '5★' }
                    ]}
                    sx={{ mt: 2 }}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Reviews Filter */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Reviews</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filters.hasReviews}
                      onChange={(e) => setFilters(prev => ({ ...prev, hasReviews: e.target.checked }))}
                      size="small"
                    />
                  }
                  label="Has reviews"
                />
              </AccordionDetails>
            </Accordion>

            {/* Availability Filter */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Availability</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControl fullWidth size="small">
                  <Select
                    value={filters.availability}
                    onChange={handleAvailabilityChange}
                    displayEmpty
                  >
                    <MenuItem value="all">All Products</MenuItem>
                    <MenuItem value="in_stock">In Stock</MenuItem>
                    <MenuItem value="low_stock">Low Stock</MenuItem>
                    <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                  </Select>
                </FormControl>
              </AccordionDetails>
            </Accordion>

            {/* Active Filters Summary */}
            {(filters.categories.length > 0 || filters.minRating > 0 || filters.hasReviews || filters.availability !== 'all' || filters.searchQuery) && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Active Filters:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {filters.categories.map(category => (
                    <Chip 
                      key={category} 
                      label={category} 
                      size="small" 
                      onDelete={() => handleCategoryChange(category)}
                    />
                  ))}
                  {filters.minRating > 0 && (
                    <Chip 
                      label={`${filters.minRating}+ stars`} 
                      size="small" 
                      onDelete={() => setFilters(prev => ({ ...prev, minRating: 0 }))}
                    />
                  )}
                  {filters.hasReviews && (
                    <Chip 
                      label="Has reviews" 
                      size="small" 
                      onDelete={() => setFilters(prev => ({ ...prev, hasReviews: false }))}
                    />
                  )}
                  {filters.availability !== 'all' && (
                    <Chip 
                      label={filters.availability.replace('_', ' ')} 
                      size="small" 
                      onDelete={() => setFilters(prev => ({ ...prev, availability: 'all' }))}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Products Grid */}
        <Grid item xs={12} md={9}>
          {/* Results Summary */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              {filteredProducts.length} of {products.length} products
            </Typography>
            {filteredProducts.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No products match your filters. Try adjusting your criteria.
              </Typography>
            )}
          </Box>

                    <Grid container spacing={3}>
            {filteredProducts.map((product) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0px 20px 25px rgba(0, 0, 0, 0.1), 0px 10px 10px rgba(0, 0, 0, 0.04)',
                }
              }}
              onClick={() => handleProductClick(product.id)}
            >
              <CardMedia
                component="img"
                height="240"
                image={product.image_url}
                alt={product.name}
                sx={{ 
                  objectFit: 'cover',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16
                }}
              />
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
                <Typography 
                  gutterBottom 
                  variant="h6" 
                  component="h2"
                  sx={{ 
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    mb: 2,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {product.name}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 3, 
                    flexGrow: 1,
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {product.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Rating 
                    value={product.rating || 0} 
                    precision={0.5} 
                    size="small"
                    sx={{
                      '& .MuiRating-iconFilled': {
                        color: '#FF9500',
                      },
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    ({product.review_count || 0} reviews)
                  </Typography>
                </Box>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    mb: 2,
                    fontWeight: 700,
                    color: '#000000'
                  }}
                >
                  ${product.price}
                </Typography>
                
                {/* Stock Status */}
                {!product.is_available && (
                  <Alert severity="error" sx={{ mb: 2, py: 0 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {product.stock_status}
                    </Typography>
                  </Alert>
                )}
                
                {product.is_available && product.quantity <= 5 && (
                  <Alert severity="warning" sx={{ mb: 2, py: 0 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {product.stock_status}
                    </Typography>
                  </Alert>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                <Button
                  variant="contained"
                    size="small"
                  startIcon={<AddIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCart(product.id);
                  }}
                    disabled={!product.is_available}
                    sx={{ 
                      flex: 1,
                      backgroundColor: product.is_available ? '#000000' : '#cccccc',
                      fontSize: '0.75rem',
                      padding: '6px 12px',
                      '&:hover': {
                        backgroundColor: product.is_available ? '#333333' : '#cccccc',
                      }
                    }}
                  >
                    {product.is_available ? 'Add to Cart' : 'Sold Out'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ShoppingCartIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyNow(product.id);
                    }}
                    disabled={!product.is_available}
                    sx={{ 
                      flex: 1,
                      borderColor: product.is_available ? '#000000' : '#cccccc',
                      color: product.is_available ? '#000000' : '#cccccc',
                      fontSize: '0.75rem',
                      padding: '6px 12px',
                      '&:hover': {
                        borderColor: product.is_available ? '#000000' : '#cccccc',
                        backgroundColor: product.is_available ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                      }
                    }}
                  >
                    {product.is_available ? 'Buy Now' : 'Sold Out'}
                </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
          </Grid>
        </Grid>
      </Grid>
      

    </Container>
  );
};

export default ProductList; 
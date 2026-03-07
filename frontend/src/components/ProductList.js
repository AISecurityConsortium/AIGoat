import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Button,
  Box,
  Rating,
  Paper,
  FormControl,
  Slider,
  Chip,
  TextField,
  Select,
  MenuItem,
  IconButton,
  useMediaQuery,
  Skeleton,
  Snackbar,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { 
  AddShoppingCart as AddShoppingCartIcon,
  FilterList as FilterIcon,
  GitHub as GitHubIcon,
  StarBorder as StarBorderIcon,
  Visibility as VisibilityIcon,
  CallSplit as ForkIcon,
  WarningAmber as WarningIcon,
  BugReport as BugReportIcon,
  OpenInNew as OpenInNewIcon,
  Shield as ShieldIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiClient as axios } from '../config/api';
import { getApiUrl } from '../config/api';
import { useThemeMode } from '../contexts/ThemeContext';
import { useSearch } from '../contexts/SearchContext';

const GITHUB_REPO = 'AISecurityConsortium/AIGoat';

const HeroSection = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:900px)');
  const isLoggedIn = !!localStorage.getItem('token');
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const [ghStats, setGhStats] = useState({ stars: null, forks: null, watchers: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !cancelled) {
          setGhStats({
            stars: data.stargazers_count,
            forks: data.forks_count,
            watchers: data.subscribers_count,
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        gap: 0,
        mb: 2,
        background: 'transparent',
        minHeight: isMobile ? 'auto' : 360,
        overflow: 'hidden',
      }}
    >
      {/* Left: Text content */}
      <Box
        sx={{
          flex: isMobile ? 1 : '0 0 48%',
          p: isMobile ? 3 : 5,
          zIndex: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label="AI Security Consortium"
            component="a"
            href="https://www.aisecurityconsortium.org/"
            target="_blank"
            rel="noopener noreferrer"
            clickable
            icon={<OpenInNewIcon sx={{ fontSize: '0.65rem !important' }} />}
            sx={{
              bgcolor: isDark ? 'rgba(74,222,128,0.1)' : 'rgba(22,163,74,0.08)',
              color: isDark ? '#4ade80' : '#16a34a',
              fontWeight: 700,
              fontSize: '0.7rem',
              border: isDark ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(22,163,74,0.2)',
              letterSpacing: '0.04em',
              textDecoration: 'none',
              '&:hover': { bgcolor: isDark ? 'rgba(74,222,128,0.18)' : 'rgba(22,163,74,0.14)' },
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
          <Chip
            label="AI Security Learning Platform"
            sx={{
              bgcolor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(79, 70, 229, 0.06)',
              color: isDark ? '#818cf8' : '#4f46e5',
              fontWeight: 600,
              fontSize: '0.7rem',
              border: isDark ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid rgba(79, 70, 229, 0.15)',
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              component="a"
              href={`https://github.com/${GITHUB_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.4,
                color: isDark ? '#94a3b8' : '#64748b', textDecoration: 'none', fontSize: '0.68rem', fontWeight: 600,
                px: 0.75, py: 0.35, borderRadius: '5px',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                transition: 'all 0.15s',
                '&:hover': { color: isDark ? '#e2e8f0' : '#1e293b', borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              }}
            >
              <GitHubIcon sx={{ fontSize: '0.8rem' }} />
              GitHub
            </Box>
            <Box
              component="a"
              href={`https://github.com/${GITHUB_REPO}/stargazers`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.3,
                color: '#f59e0b', textDecoration: 'none', fontSize: '0.68rem', fontWeight: 600,
                px: 0.6, py: 0.35, borderRadius: '5px',
                border: '1px solid rgba(245,158,11,0.2)',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.4)' },
              }}
            >
              <StarBorderIcon sx={{ fontSize: '0.75rem' }} />
              Star{ghStats.stars !== null && <Box component="span" sx={{ ml: 0.3, fontWeight: 800 }}>{ghStats.stars}</Box>}
            </Box>
            <Box
              component="a"
              href={`https://github.com/${GITHUB_REPO}/fork`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.3,
                color: isDark ? '#94a3b8' : '#64748b', textDecoration: 'none', fontSize: '0.68rem', fontWeight: 600,
                px: 0.6, py: 0.35, borderRadius: '5px',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
                transition: 'all 0.15s',
                '&:hover': { color: isDark ? '#e2e8f0' : '#1e293b', borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              }}
            >
              <ForkIcon sx={{ fontSize: '0.75rem' }} />
              Fork{ghStats.forks !== null && <Box component="span" sx={{ ml: 0.3, fontWeight: 800 }}>{ghStats.forks}</Box>}
            </Box>
            <Box
              component="a"
              href={`https://github.com/${GITHUB_REPO}/watchers`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.3,
                color: isDark ? '#38bdf8' : '#0284c7', textDecoration: 'none', fontSize: '0.68rem', fontWeight: 600,
                px: 0.6, py: 0.35, borderRadius: '5px',
                border: isDark ? '1px solid rgba(56,189,248,0.2)' : '1px solid rgba(2,132,199,0.15)',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: isDark ? 'rgba(56,189,248,0.08)' : 'rgba(2,132,199,0.06)', borderColor: isDark ? 'rgba(56,189,248,0.4)' : 'rgba(2,132,199,0.3)' },
              }}
            >
              <VisibilityIcon sx={{ fontSize: '0.72rem' }} />
              Watch{ghStats.watchers !== null && <Box component="span" sx={{ ml: 0.3, fontWeight: 800 }}>{ghStats.watchers}</Box>}
            </Box>
          </Box>
        </Box>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            color: isDark ? '#e2e8f0' : '#1e293b',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            mb: 2,
            fontSize: isMobile ? '1.85rem' : '2.6rem',
          }}
        >
          Welcome to{' '}
          <Box component="span" sx={{
            background: isDark
              ? 'linear-gradient(135deg, #818cf8, #6366f1, #a78bfa)'
              : 'linear-gradient(135deg, #4f46e5, #6366f1, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            AI Goat Shop
          </Box>
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: isDark ? '#94a3b8' : '#64748b',
            mb: 4,
            lineHeight: 1.7,
            maxWidth: 480,
            fontSize: '0.95rem',
          }}
        >
          Your hands-on lab for exploring LLM vulnerabilities. Learn to attack and defend 
          AI systems through real-world exercises mapped to the OWASP Top 10 for LLM Applications.
        </Typography>
        {/* Vulnerable app warning */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            mb: 3,
            p: 1.5,
            borderRadius: '10px',
            maxWidth: 480,
            bgcolor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)',
            border: isDark ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(245,158,11,0.15)',
          }}
        >
          <WarningIcon sx={{ color: '#f59e0b', fontSize: '1.1rem', mt: 0.15, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: isDark ? '#fbbf24' : '#b45309', fontSize: '0.76rem', lineHeight: 1.5 }}>
            This is a <strong>deliberately vulnerable</strong> application designed for learning AI/LLM security. Do not deploy in production or expose to untrusted networks.
          </Typography>
        </Box>
        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {!isLoggedIn ? (
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/login')}
              sx={{
                bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                fontWeight: 600, px: 2.5, py: 0.8, borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem',
                '&:hover': { bgcolor: (t) => t.palette.primary.dark },
              }}
            >
              Get Started
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              onClick={() => { document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' }); }}
              sx={{
                bgcolor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                fontWeight: 600, px: 2.5, py: 0.8, borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem',
                '&:hover': { bgcolor: (t) => t.palette.primary.dark },
              }}
            >
              Browse Products
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/owasp-top-10')}
            sx={{
              borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
              color: (t) => t.palette.custom?.text?.body ?? t.palette.text.primary,
              fontWeight: 600, px: 2, py: 0.8, borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem',
              '&:hover': { borderColor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main, bgcolor: (t) => t.palette.custom?.overlay?.active ?? t.palette.action.hover },
            }}
          >
            OWASP Top 10
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate('/attacks')}
            sx={{
              borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
              color: (t) => t.palette.custom?.text?.body ?? t.palette.text.primary,
              fontWeight: 600, px: 2, py: 0.8, borderRadius: '8px', textTransform: 'none', fontSize: '0.8rem',
              '&:hover': { borderColor: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main, bgcolor: (t) => t.palette.custom?.overlay?.active ?? t.palette.action.hover },
            }}
          >
            Attack Labs
          </Button>
        </Box>

        {/* Platform stats */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
          {[
            { icon: <ShieldIcon sx={{ fontSize: '0.8rem' }} />, label: '10 OWASP LLM Risks', color: isDark ? '#f87171' : '#dc2626' },
            { icon: <BugReportIcon sx={{ fontSize: '0.8rem' }} />, label: '50+ Attack Scenarios', color: isDark ? '#fb923c' : '#ea580c' },
            { icon: <VerifiedIcon sx={{ fontSize: '0.8rem' }} />, label: '3 Defense Levels', color: isDark ? '#4ade80' : '#16a34a' },
          ].map((stat) => (
            <Box key={stat.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: stat.color, fontSize: '0.68rem', fontWeight: 600 }}>
              {stat.icon}
              {stat.label}
            </Box>
          ))}
        </Box>

        {/* Built by credit */}
        <Typography variant="caption" sx={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.65rem', display: 'block' }}>
          Built &amp; maintained by <strong>Farooq</strong> and <strong>Nal</strong> from the{' '}
          <Box
            component="a"
            href="https://www.aisecurityconsortium.org/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: isDark ? '#94a3b8' : '#64748b',
              textDecoration: 'underline',
              textDecorationColor: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.3)',
              textUnderlineOffset: '2px',
              '&:hover': { color: isDark ? '#e2e8f0' : '#334155' },
            }}
          >
            AI Security Consortium
          </Box>
          {' '}community.
        </Typography>
      </Box>

      {/* Right: Video player with vignette fade on all edges */}
      <Box
        sx={{
          flex: isMobile ? 1 : '0 0 30%',
          position: 'relative',
          height: isMobile ? 200 : 390,
          overflow: 'hidden',
          ml: isMobile ? 0 : 'auto',
          mr: isMobile ? 0 : 12,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: (t) => {
              const bg = t.palette.background.default;
              return isMobile
                ? `linear-gradient(to top, ${bg} 0%, transparent 40%)`
                : [
                    `linear-gradient(to right, ${bg} 0%, transparent 40%)`,
                    `linear-gradient(to left,  ${bg} 0%, transparent 40%)`,
                    `linear-gradient(to bottom,${bg} 0%, transparent 35%)`,
                    `linear-gradient(to top,   ${bg} 0%, transparent 35%)`,
                  ].join(', ');
            },
            backgroundSize: isMobile ? '100% 100%' : '50% 100%, 50% 100%, 100% 50%, 100% 50%',
            backgroundPosition: isMobile ? '0 0' : 'left, right, top, bottom',
            backgroundRepeat: 'no-repeat',
          },
        }}
      >
        <Box
          component="video"
          autoPlay
          loop
          muted
          playsInline
          src="/media/landing-page-video.mp4"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 35%',
            display: 'block',
          }}
        />
      </Box>
    </Box>
  );
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Rating' },
];

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [cartSnackbar, setCartSnackbar] = useState({ open: false, name: '' });
  const navigate = useNavigate();
  const { searchBarQuery, setSearchBarQuery } = useSearch();

  // Filter states
  const [filters, setFilters] = useState({
    categories: [],
    priceRange: [0, 5000],
    minRating: 0,
    hasReviews: false,
    availability: 'all', // 'all', 'in_stock', 'low_stock', 'out_of_stock'
    searchQuery: '',
  });

  useEffect(() => {
    setFilters(prev => ({ ...prev, searchQuery: searchBarQuery }));
    if (searchBarQuery) {
      setTimeout(() => {
        document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [searchBarQuery]);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Search query filter — match only product NAME (whole-word to avoid substrings like "cap" in "landscape")
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      if (q) {
        const wordRegex = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        filtered = filtered.filter(p => wordRegex.test(p.name));
      }
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

  // Sorted products based on sort dropdown
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    switch (sortBy) {
      case 'price_asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return list.sort((a, b) => b.price - a.price);
      case 'rating':
        return list.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
      case 'newest':
      default:
        return list.sort((a, b) => (b.id || 0) - (a.id || 0));
    }
  }, [filteredProducts, sortBy]);

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
    const val = event.target.value;
    setFilters(prev => ({ ...prev, searchQuery: val }));
    setSearchBarQuery(val);
  };

  const clearAllFilters = () => {
    setFilters({
      categories: [],
      priceRange: [0, 5000],
      minRating: 0,
      hasReviews: false,
      availability: 'all',
      searchQuery: '',
    });
    setSearchBarQuery('');
  };

  // Get price range for slider
  const getPriceRange = () => {
    if (products.length === 0) return [0, 5000];
    const prices = products.map(p => p.price);
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/products/'));
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
        navigate('/login');
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

      const addedProduct = products.find(p => p.id === productId);
      setCartSnackbar({ open: true, name: addedProduct?.name || 'Product' });
      window.dispatchEvent(new CustomEvent('cartUpdated'));
    } catch (error) {
      console.error('Error adding to cart:', error);
      setCartSnackbar({ open: true, name: '', error: true });
    }
  };

  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 1, mb: 6, px: { xs: 2, sm: 3, md: 12 } }}>
      <HeroSection />
      
      {/* Products Header Bar */}
      <Box
        id="products-section"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          pb: 2,
          borderBottom: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: (t) => t.palette.custom?.text?.heading ?? 'text.primary' }}>
            Our Products
          </Typography>
          <Chip
            label={loading ? '...' : filteredProducts.length}
            size="small"
            sx={{
              fontWeight: 700, fontSize: '0.7rem', height: 22,
              bgcolor: (t) => t.palette.custom?.overlay?.active ?? t.palette.action.selected,
              color: (t) => t.palette.custom?.text?.accent ?? t.palette.primary.main,
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            size="small"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(prev => !prev)}
            sx={{
              textTransform: 'none', fontWeight: 600, fontSize: '0.8rem',
              color: (t) => showFilters ? (t.palette.custom?.brand?.primary ?? t.palette.primary.main) : (t.palette.custom?.text?.muted ?? t.palette.text.secondary),
              borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider,
            }}
            variant={showFilters ? 'outlined' : 'text'}
          >
            Filters
          </Button>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              displayEmpty
              sx={{
                borderRadius: '8px', fontSize: '0.8rem',
                '& .MuiSelect-select': { py: 0.75, pr: 4 },
                '& fieldset': { borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider },
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8rem' }}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Active Filters Chips */}
      {(filters.categories.length > 0 || filters.minRating > 0 || filters.hasReviews || filters.availability !== 'all' || filters.searchQuery) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5, alignItems: 'center' }}>
          {filters.searchQuery && (
            <Chip label={`"${filters.searchQuery}"`} size="small" onDelete={() => { setFilters(prev => ({ ...prev, searchQuery: '' })); setSearchBarQuery(''); }} />
          )}
          {filters.categories.map(c => (
            <Chip key={c} label={c} size="small" onDelete={() => handleCategoryChange(c)} />
          ))}
          {filters.minRating > 0 && (
            <Chip label={`${filters.minRating}+ stars`} size="small" onDelete={() => setFilters(prev => ({ ...prev, minRating: 0 }))} />
          )}
          {filters.hasReviews && (
            <Chip label="Has reviews" size="small" onDelete={() => setFilters(prev => ({ ...prev, hasReviews: false }))} />
          )}
          {filters.availability !== 'all' && (
            <Chip label={filters.availability.replace('_', ' ')} size="small" onDelete={() => setFilters(prev => ({ ...prev, availability: 'all' }))} />
          )}
          <Button size="small" onClick={clearAllFilters} sx={{ textTransform: 'none', fontSize: '0.72rem', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}>
            Clear all
          </Button>
        </Box>
      )}

      {/* Filters + Products Layout */}
      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Compact Filters Sidebar */}
        {showFilters && (
          <Box
            sx={{
              width: 220,
              flexShrink: 0,
              display: { xs: 'none', md: 'block' },
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2,
                position: 'sticky',
                top: 80,
                maxHeight: 'calc(100vh - 100px)',
                overflowY: 'auto',
                bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper,
                border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                borderRadius: '10px',
                '&::-webkit-scrollbar': { width: 4 },
                '&::-webkit-scrollbar-thumb': { bgcolor: (t) => t.palette.custom?.border?.medium ?? t.palette.divider, borderRadius: 2 },
              }}
            >
              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search..."
                value={filters.searchQuery}
                onChange={handleSearchChange}
                sx={{ mb: 2, '& .MuiInputBase-root': { fontSize: '0.8rem', borderRadius: '8px' } }}
              />

              {/* Categories */}
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', mb: 1, display: 'block' }}>
                Categories
              </Typography>
              <Box sx={{ mb: 2 }}>
                {getCategories().map((category) => (
                  <Box
                    key={category}
                    onClick={() => handleCategoryChange(category)}
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      py: 0.5, px: 1, borderRadius: '6px', cursor: 'pointer', mb: 0.25,
                      bgcolor: (t) => filters.categories.includes(category) ? (t.palette.custom?.overlay?.active ?? t.palette.action.selected) : 'transparent',
                      '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.action.hover },
                      transition: 'background 0.15s',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: filters.categories.includes(category) ? 600 : 400, color: (t) => filters.categories.includes(category) ? (t.palette.custom?.text?.accent ?? t.palette.primary.main) : (t.palette.custom?.text?.body ?? 'text.primary') }}>
                      {category}
                    </Typography>
                    <Typography variant="caption" sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontSize: '0.68rem' }}>
                      {products.filter(p => getProductCategory(p.name) === category).length}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Price Range */}
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', mb: 0.5, display: 'block' }}>
                Price
              </Typography>
              <Box sx={{ px: 1, mb: 2 }}>
                <Typography variant="caption" sx={{ color: (t) => t.palette.custom?.text?.body ?? 'text.primary', fontSize: '0.72rem' }}>
                  ₹{filters.priceRange[0]} – ₹{filters.priceRange[1]}
                </Typography>
                <Slider
                  value={filters.priceRange}
                  onChange={handlePriceRangeChange}
                  valueLabelDisplay="auto"
                  min={getPriceRange()[0]}
                  max={getPriceRange()[1]}
                  size="small"
                  sx={{ mt: 1 }}
                />
              </Box>

              {/* Rating */}
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', mb: 0.5, display: 'block' }}>
                Rating
              </Typography>
              <Box sx={{ px: 1, mb: 2 }}>
                <Slider
                  value={filters.minRating}
                  onChange={handleRatingChange}
                  valueLabelDisplay="auto"
                  min={0}
                  max={5}
                  step={0.5}
                  size="small"
                  marks={[{ value: 0, label: 'Any' }, { value: 5, label: '5★' }]}
                  sx={{ '& .MuiSlider-markLabel': { fontSize: '0.65rem' } }}
                />
              </Box>

              {/* Availability */}
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', mb: 0.5, display: 'block' }}>
                Availability
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={filters.availability}
                  onChange={handleAvailabilityChange}
                  displayEmpty
                  sx={{ fontSize: '0.78rem', borderRadius: '8px', '& .MuiSelect-select': { py: 0.6 } }}
                >
                  <MenuItem value="all" sx={{ fontSize: '0.78rem' }}>All</MenuItem>
                  <MenuItem value="in_stock" sx={{ fontSize: '0.78rem' }}>In Stock</MenuItem>
                  <MenuItem value="low_stock" sx={{ fontSize: '0.78rem' }}>Low Stock</MenuItem>
                  <MenuItem value="out_of_stock" sx={{ fontSize: '0.78rem' }}>Out of Stock</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          </Box>
        )}

        {/* Products Grid */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!loading && filteredProducts.length === 0 && (
            <Typography variant="body2" sx={{ mb: 3, color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}>
              No products match your filters. Try adjusting your criteria.
            </Typography>
          )}

          <Grid container spacing={2}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Grid item xs={6} sm={4} md={showFilters ? 3 : 3} lg={showFilters ? 3 : 2.4} key={i}>
                  <Card sx={{ bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper, border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`, borderRadius: '10px' }}>
                    <Skeleton variant="rectangular" height={180} />
                    <CardContent sx={{ p: 1.5 }}>
                      <Skeleton variant="text" width="80%" height={18} />
                      <Skeleton variant="text" width="50%" height={14} sx={{ mt: 0.5 }} />
                      <Skeleton variant="text" width="35%" height={20} sx={{ mt: 1 }} />
                    </CardContent>
                  </Card>
                </Grid>
              ))
            ) : (
            sortedProducts.map((product) => {
              const category = getProductCategory(product.name);
              return (
              <Grid item xs={6} sm={4} md={showFilters ? 3 : 3} lg={showFilters ? 3 : 2.4} key={product.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                    border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
                    bgcolor: (t) => t.palette.custom?.surface?.elevated ?? t.palette.background.paper,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: (t) => `0 12px 28px ${alpha(t.palette.common.black, 0.15)}`,
                      borderColor: (t) => t.palette.custom?.border?.medium ?? t.palette.primary.main,
                      '& .product-image': { transform: 'scale(1.04)' },
                    },
                  }}
                  onClick={() => handleProductClick(product.id)}
                >
                  <Box sx={{ position: 'relative', overflow: 'hidden' }}>
                    <CardMedia
                      component="img"
                      height="180"
                      image={product.image_url}
                      alt={product.name}
                      className="product-image"
                      sx={{
                        objectFit: 'cover',
                        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                    {category && (
                      <Chip
                        label={category}
                        size="small"
                        sx={{
                          position: 'absolute', top: 8, left: 8,
                          bgcolor: (t) => alpha(t.palette.common.black, 0.6),
                          backdropFilter: 'blur(8px)',
                          color: '#fff',
                          fontWeight: 600, fontSize: '0.65rem', height: 22,
                        }}
                      />
                    )}
                    {product.is_available && product.quantity <= 5 && (
                      <Chip
                        label="Low Stock"
                        size="small"
                        sx={{
                          position: 'absolute', top: 8, right: 8,
                          bgcolor: (t) => t.palette.warning.main,
                          color: '#fff', fontWeight: 700, fontSize: '0.6rem', height: 20,
                        }}
                      />
                    )}
                    {!product.is_available && (
                      <Chip
                        label="Sold Out"
                        size="small"
                        sx={{
                          position: 'absolute', top: 8, right: 8,
                          bgcolor: (t) => t.palette.error.main,
                          color: '#fff', fontWeight: 700, fontSize: '0.6rem', height: 20,
                        }}
                      />
                    )}
                  </Box>
                  <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography
                      variant="body2"
                      component="h2"
                      sx={{
                        fontWeight: 600,
                        mb: 0.5,
                        fontSize: '0.82rem',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        color: (t) => t.palette.custom?.text?.heading ?? 'text.primary',
                      }}
                    >
                      {product.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mb: 0.75 }}>
                      <Rating value={product.average_rating || product.rating || 0} precision={0.5} size="small" readOnly sx={{ fontSize: '0.85rem' }} />
                      <Typography variant="caption" sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', fontSize: '0.68rem' }}>
                        ({product.review_count || 0})
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          color: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                          fontSize: '1rem',
                        }}
                      >
                        ₹{product.price}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleAddToCart(product.id); }}
                        disabled={!product.is_available}
                        sx={{
                          width: 30, height: 30,
                          bgcolor: (t) => t.palette.custom?.overlay?.hover ?? t.palette.action.hover,
                          '&:hover': { bgcolor: (t) => t.palette.custom?.overlay?.active ?? t.palette.action.selected },
                          color: (t) => t.palette.custom?.brand?.primary ?? t.palette.primary.main,
                        }}
                      >
                        <AddShoppingCartIcon sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
            }))}
          </Grid>
        </Box>
      </Box>

      <Snackbar
        open={cartSnackbar.open}
        autoHideDuration={2500}
        onClose={() => setCartSnackbar({ open: false, name: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setCartSnackbar({ open: false, name: '' })}
          severity={cartSnackbar.error ? 'error' : 'success'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {cartSnackbar.error ? 'Failed to add to cart' : `${cartSnackbar.name} added to cart`}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ProductList; 
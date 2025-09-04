import React, { useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  CircularProgress,
  Collapse,
  Card,
  CardContent,
  Fade,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useSearch } from '../contexts/SearchContext';
import axios from 'axios';

const SearchBar = () => {
  const { searchQuery, setSearchQuery } = useSearch();
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError('');
    setSearchResult(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:8000/api/search/', {
        query: searchQuery.trim()
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setSearchResult({
        reply: response.data.reply,
        query: response.data.query,
        personalized: response.data.personalized
      });
    } catch (error) {
      if (error.response?.status === 401) {
        setError('Please log in to use personalized search.');
      } else if (error.response?.status === 503) {
        setError('Search service is currently unavailable. Please try again later.');
      } else {
        setError('An error occurred while searching. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        elevation={1}
        sx={{
          p: 0.5,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 2,
          boxShadow: 1,
          background: 'white',
          mb: 2,
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Ask about products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          size="small"
          sx={{
            background: 'white',
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              fontSize: 14,
              p: 0,
              height: 36,
            },
            '& fieldset': { border: 'none' },
          }}
          inputProps={{ style: { padding: '6px 8px' } }}
        />
        <IconButton
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          sx={{ ml: 0.5, color: 'primary.main', height: 36, width: 36 }}
        >
          {isSearching ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
        </IconButton>
      </Paper>
      
      <Fade in={!!error} unmountOnExit>
        <Typography color="error" variant="body2" sx={{ mb: 2, fontSize: '0.75rem' }}>
          {error}
        </Typography>
      </Fade>
      
      <Collapse in={!!searchResult}>
        {searchResult && (
          <Card elevation={1} sx={{ borderRadius: 2, boxShadow: 1, background: 'white' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                {searchResult.personalized ? 'Personalized result' : 'Result'}
              </Typography>
              <Typography variant="body2" sx={{ 
                whiteSpace: 'pre-wrap', 
                lineHeight: 1.4,
                fontSize: '0.875rem',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                {searchResult.reply}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Collapse>
    </Box>
  );
};

export default SearchBar; 
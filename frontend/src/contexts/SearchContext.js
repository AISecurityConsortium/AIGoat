import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SearchContext = createContext();

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBarQuery, setSearchBarQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const location = useLocation();

  // Clear search fields when location changes
  useEffect(() => {
    // Clear search fields when navigating to different pages
    // Keep the search query only when staying on search-related pages
    const searchRelatedPaths = ['/search', '/chat'];
    const isSearchRelated = searchRelatedPaths.some(path => 
      location.pathname.startsWith(path)
    );

    if (!isSearchRelated) {
      setSearchQuery('');
      setSearchBarQuery('');
      setChatInput('');
    }
  }, [location.pathname]);

  // Clear specific search field
  const clearSearchField = (fieldType) => {
    switch (fieldType) {
      case 'header':
        setSearchBarQuery('');
        break;
      case 'searchBar':
        setSearchQuery('');
        break;
      case 'chat':
        setChatInput('');
        break;
      case 'all':
        setSearchQuery('');
        setSearchBarQuery('');
        setChatInput('');
        break;
      default:
        break;
    }
  };

  // Clear all search fields
  const clearAllSearchFields = () => {
    setSearchQuery('');
    setSearchBarQuery('');
    setChatInput('');
  };

  const value = {
    // Header search
    searchBarQuery,
    setSearchBarQuery,
    
    // SearchBar component
    searchQuery,
    setSearchQuery,
    
    // Chat input
    chatInput,
    setChatInput,
    
    // Utility functions
    clearSearchField,
    clearAllSearchFields,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}; 
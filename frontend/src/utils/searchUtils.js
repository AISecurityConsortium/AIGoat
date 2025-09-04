// Utility functions for search field management

/**
 * Clear all search fields in the application
 * @param {Function} clearAllSearchFields - Function from SearchContext
 */
export const clearAllSearchFields = (clearAllSearchFields) => {
  if (typeof clearAllSearchFields === 'function') {
    clearAllSearchFields();
  }
};

/**
 * Clear specific search field
 * @param {Function} clearSearchField - Function from SearchContext
 * @param {string} fieldType - Type of field to clear ('header', 'searchBar', 'chat', 'all')
 */
export const clearSearchField = (clearSearchField, fieldType) => {
  if (typeof clearSearchField === 'function') {
    clearSearchField(fieldType);
  }
};

/**
 * Check if current path is search-related
 * @param {string} pathname - Current pathname
 * @returns {boolean} - True if path is search-related
 */
export const isSearchRelatedPath = (pathname) => {
  const searchRelatedPaths = ['/search', '/chat'];
  return searchRelatedPaths.some(path => pathname.startsWith(path));
};

/**
 * Get search field state for debugging
 * @param {Object} searchContext - Search context object
 * @returns {Object} - Current search field states
 */
export const getSearchFieldStates = (searchContext) => {
  return {
    searchBarQuery: searchContext.searchBarQuery,
    searchQuery: searchContext.searchQuery,
    chatInput: searchContext.chatInput,
  };
};

/**
 * Log search field states for debugging
 * @param {Object} searchContext - Search context object
 * @param {string} location - Where the log is coming from
 */
export const logSearchStates = (searchContext, location = 'Unknown') => {
  console.log(`[Search Debug - ${location}]`, getSearchFieldStates(searchContext));
}; 
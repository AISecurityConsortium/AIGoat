"""
Feature Flags Configuration for Red Team Shop

This module contains feature flags that control which features are enabled
in the application. Features can be toggled on/off by modifying the values
in this file.
"""

# RAG (Retrieval-Augmented Generation) System
RAG_SYSTEM_ENABLED = True

# Admin Dashboard Features
ADMIN_DASHBOARD_ENABLED = True
ADMIN_ORDER_MANAGEMENT_ENABLED = True
ADMIN_USER_MANAGEMENT_ENABLED = True
ADMIN_INVENTORY_MANAGEMENT_ENABLED = True
ADMIN_COUPON_MANAGEMENT_ENABLED = True

# User Profile Features
USER_PROFILE_ENABLED = True
CARD_NUMBER_MASKING_ENABLED = True
INPUT_VALIDATION_ENABLED = True

# Search and Personalization
PERSONALIZED_SEARCH_ENABLED = True
PRODUCT_RECOMMENDATIONS_ENABLED = True

# Payment and Order Features
PAYMENT_PROCESSING_ENABLED = True
ORDER_TRACKING_ENABLED = True
COUPON_SYSTEM_ENABLED = True

# Chat and Support Features
CHAT_SYSTEM_ENABLED = True

def is_feature_enabled(feature_name):
    """
    Check if a specific feature is enabled.
    
    Args:
        feature_name (str): Name of the feature to check
        
    Returns:
        bool: True if feature is enabled, False otherwise
    """
    return globals().get(feature_name, False)

def get_enabled_features():
    """
    Get a dictionary of all enabled features.
    
    Returns:
        dict: Dictionary with feature names as keys and boolean values
    """
    return {
        'rag_system': RAG_SYSTEM_ENABLED,
        'admin_dashboard': ADMIN_DASHBOARD_ENABLED,
        'admin_order_management': ADMIN_ORDER_MANAGEMENT_ENABLED,
        'admin_user_management': ADMIN_USER_MANAGEMENT_ENABLED,
        'admin_inventory_management': ADMIN_INVENTORY_MANAGEMENT_ENABLED,
        'admin_coupon_management': ADMIN_COUPON_MANAGEMENT_ENABLED,
        'user_profile': USER_PROFILE_ENABLED,
        'card_number_masking': CARD_NUMBER_MASKING_ENABLED,
        'input_validation': INPUT_VALIDATION_ENABLED,
        'personalized_search': PERSONALIZED_SEARCH_ENABLED,
        'product_recommendations': PRODUCT_RECOMMENDATIONS_ENABLED,
        'payment_processing': PAYMENT_PROCESSING_ENABLED,
        'order_tracking': ORDER_TRACKING_ENABLED,
        'coupon_system': COUPON_SYSTEM_ENABLED,
        'chat_system': CHAT_SYSTEM_ENABLED,
    }

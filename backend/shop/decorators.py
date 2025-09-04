"""
Decorators for Red Team Shop

This module contains decorators for feature flag checking and other
common functionality.
"""

from functools import wraps
from django.http import JsonResponse
from backend.feature_flags import is_feature_enabled


def feature_flag_required(feature_name):
    """
    Decorator to check if a feature is enabled before allowing access.
    
    Args:
        feature_name (str): Name of the feature to check
        
    Returns:
        function: Decorated function
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not is_feature_enabled(feature_name):
                return JsonResponse({
                    'error': f'Feature "{feature_name}" is currently disabled'
                }, status=503)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def rag_feature_required(view_func):
    """
    Decorator specifically for RAG system features.
    """
    return feature_flag_required('RAG_SYSTEM_ENABLED')(view_func)


def admin_feature_required(view_func):
    """
    Decorator for admin dashboard features.
    """
    return feature_flag_required('ADMIN_DASHBOARD_ENABLED')(view_func)

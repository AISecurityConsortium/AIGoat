from django.urls import path
from . import views
from backend.feature_flags import RAG_SYSTEM_ENABLED

urlpatterns = [
    path('products/', views.ProductListView.as_view(), name='product-list'),
    path('products/<int:pk>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('cart/', views.CartView.as_view(), name='cart'),
    path('cart/items/<int:item_id>/', views.CartItemView.as_view(), name='cart-item'),
    path('orders/', views.OrderListView.as_view(), name='order-list'),
    path('orders/<int:pk>/', views.OrderDetailView.as_view(), name='order-detail'),
    path('reviews/', views.ReviewCreateView.as_view(), name='review-create'),
    path('reviews/<int:product_id>/', views.ReviewListView.as_view(), name='review-list'),
    path('chat/', views.CrackyChatView.as_view(), name='cracky-chat'),
    path('tips/', views.ProductTipUploadView.as_view(), name='product-tip-upload'),
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/signup/', views.SignUpView.as_view(), name='signup'),
    path('auth/verify-otp/', views.VerifyOTPView.as_view(), name='verify-otp'),
    path('auth/demo-users/', views.GetDemoUsersView.as_view(), name='demo-users'),
    path('admin/users/', views.UserManagementView.as_view(), name='user-management'),
    path('admin/users/<int:user_id>/', views.UserManagementView.as_view(), name='user-delete'),
    path('admin/orders/', views.AdminOrderManagementView.as_view(), name='admin-order-management'),
    path('admin/orders/<int:order_id>/', views.AdminOrderManagementView.as_view(), name='admin-order-update'),
    path('admin/dashboard/', views.DashboardView.as_view(), name='admin-dashboard'),
    path('admin/inventory/', views.InventoryManagementView.as_view(), name='inventory-management'),
    path('admin/inventory/<int:product_id>/', views.InventoryManagementView.as_view(), name='inventory-update'),
    path('admin/coupons/', views.CouponManagementView.as_view(), name='coupon-management'),
    path('admin/coupons/<int:coupon_id>/', views.CouponDetailView.as_view(), name='coupon-detail'),
    path('admin/coupons/usage/', views.CouponUsageView.as_view(), name='coupon-usage'),
    path('admin/feedback/', views.FeedbackManagementView.as_view(), name='feedback-management'),
    path('admin/feedback/<int:tip_id>/', views.FeedbackDetailView.as_view(), name='feedback-detail'),
    path('admin/feedback/stats/', views.FeedbackStatsView.as_view(), name='feedback-stats'),
    path('coupons/', views.UserCouponsView.as_view(), name='user-coupons'),
    path('coupons/apply/', views.ApplyCouponView.as_view(), name='apply-coupon'),
    path('checkout/', views.CheckoutView.as_view(), name='checkout'),

    path('search/', views.PersonalizedSearchView.as_view(), name='search'),
    path('profile/', views.UserProfileView.as_view(), name='profile'),
    path('profile/picture/', views.UserProfilePictureView.as_view(), name='profile-picture'),
    path('feature-flags/', views.FeatureFlagsView.as_view(), name='feature-flags'),
    path('ollama/status/', views.OllamaStatusView.as_view(), name='ollama-status'),
]

# Conditionally include RAG System Endpoints based on feature flag
if RAG_SYSTEM_ENABLED:
    urlpatterns += [
        path('rag-chat/', views.RAGChatView.as_view(), name='rag-chat'),
        path('knowledge-base/', views.ProductKnowledgeBaseView.as_view(), name='knowledge-base'),
        path('rag-chat-history/', views.RAGChatHistoryView.as_view(), name='rag-chat-history'),
        path('rag-stats/', views.RAGStatsView.as_view(), name='rag-stats'),
    ] 
from rest_framework import serializers
from .models import Product, Review, Order, OrderItem, Cart, CartItem, ProductTip, Payment, UserProfile, Coupon, CouponUsage, ProductKnowledgeBase, RAGChatSession
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class PaymentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='order.user.username', read_only=True)
    
    class Meta:
        model = Payment
        fields = ['id', 'user_name', 'card_number', 'card_type', 'amount', 'created_at']

class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    is_available = serializers.ReadOnlyField()
    stock_status = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'detailed_description', 'specifications', 'price', 'image', 'image_url', 'average_rating', 'review_count', 'reviews', 'quantity', 'is_sold_out', 'is_available', 'stock_status', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            url = obj.image.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_average_rating(self, obj):
        reviews = obj.reviews.all()
        if reviews.exists():
            return sum(review.rating for review in reviews) / reviews.count()
        return 0

    def get_review_count(self, obj):
        return obj.reviews.count()

    def get_reviews(self, obj):
        reviews = obj.reviews.all().order_by('-created_at')[:5]  # Get last 5 reviews
        return ReviewSerializer(reviews, many=True, context=self.context).data

class AdminProductSerializer(serializers.ModelSerializer):
    """Serializer for admin inventory management"""
    image_url = serializers.SerializerMethodField()
    total_orders = serializers.SerializerMethodField()
    total_revenue = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'detailed_description', 'specifications', 'price', 'image_url', 'quantity', 'is_sold_out', 'is_available', 'stock_status', 'total_orders', 'total_revenue', 'created_at', 'updated_at']
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image:
            url = obj.image.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None
    
    def get_total_orders(self, obj):
        """Get total number of orders containing this product"""
        return OrderItem.objects.filter(product=obj).count()
    
    def get_total_revenue(self, obj):
        """Get total revenue from this product"""
        order_items = OrderItem.objects.filter(product=obj)
        return sum(item.price * item.quantity for item in order_items)

class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Review
        fields = ['id', 'product', 'rating', 'comment', 'user_name', 'created_at']

class ProductTipSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    file_content = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductTip
        fields = ['id', 'tip_text', 'tip_file', 'user_name', 'product_name', 'created_at', 'is_poisoned', 'file_content']
        read_only_fields = ['user_name', 'product_name', 'created_at', 'is_poisoned', 'file_content']
    
    def get_file_content(self, obj):
        """Get the content of uploaded file for poisoning demonstrations"""
        return obj.get_file_content()

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price', 'product_image_url']
    
    def get_product_image_url(self, obj):
        request = self.context.get('request')
        if obj.product.image:
            url = obj.product.image.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    payment = PaymentSerializer(read_only=True)
    order_id = serializers.SerializerMethodField()
    shipping_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = ['id', 'order_id', 'user_name', 'created_at', 'total_amount', 'final_amount', 'discount_amount', 'applied_coupon', 'status', 'items', 'payment', 'shipping_info']
    
    def get_order_id(self, obj):
        return obj.get_order_id()
    
    def get_shipping_info(self, obj):
        return {
            'name': f"{obj.shipping_first_name} {obj.shipping_last_name}".strip(),
            'email': obj.shipping_email,
            'phone': obj.shipping_phone,
            'address': obj.shipping_address,
            'city': obj.shipping_city,
            'state': obj.shipping_state,
            'zip_code': obj.shipping_zip_code,
            'country': obj.shipping_country,
        }

class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    product_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_name', 'quantity', 'product_price', 'product_image_url']
    
    def get_product_image_url(self, obj):
        request = self.context.get('request')
        if obj.product.image:
            url = obj.product.image.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()
    
    class Meta:
        model = Cart
        fields = ['id', 'items', 'total']
    
    def get_total(self, obj):
        return sum(item.quantity * item.product.price for item in obj.items.all())

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email', 'phone',
            'address', 'city', 'state', 'zip_code', 'country',
            'profile_picture', 'profile_picture_url', 'full_name',
            'card_number', 'card_type', 'card_holder', 'expiry_month', 'expiry_year',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_profile_picture_url(self, obj):
        request = self.context.get('request')
        if obj.profile_picture:
            url = obj.profile_picture.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None
    
    def get_full_name(self, obj):
        return obj.get_full_name()

class CouponSerializer(serializers.ModelSerializer):
    status = serializers.CharField(read_only=True)
    total_usage_count = serializers.IntegerField(read_only=True)
    remaining_usage = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'name', 'description', 'discount_type', 'discount_value',
            'minimum_order_amount', 'maximum_discount', 'usage_limit', 'usage_limit_per_user',
            'valid_from', 'valid_until', 'is_active', 'status', 'total_usage_count',
            'remaining_usage', 'created_at', 'updated_at'
        ]
        read_only_fields = ['status', 'total_usage_count', 'remaining_usage', 'created_at', 'updated_at']

class CouponUsageSerializer(serializers.ModelSerializer):
    coupon_code = serializers.CharField(source='coupon.code', read_only=True)
    coupon_name = serializers.CharField(source='coupon.name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    order_id = serializers.CharField(source='order.get_order_id', read_only=True)
    
    class Meta:
        model = CouponUsage
        fields = [
            'id', 'coupon', 'coupon_code', 'coupon_name', 'user', 'user_name',
            'order', 'order_id', 'order_amount', 'discount_amount', 'used_at'
        ]
        read_only_fields = ['coupon_code', 'coupon_name', 'user_name', 'order_id', 'used_at'] 

class ProductKnowledgeBaseSerializer(serializers.ModelSerializer):
    """Serializer for product knowledge base"""
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = ProductKnowledgeBase
        fields = ['id', 'product', 'product_name', 'title', 'content', 'category', 'embedding_id', 'created_at', 'updated_at']

class RAGChatSessionSerializer(serializers.ModelSerializer):
    """Serializer for RAG chat sessions"""
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = RAGChatSession
        fields = ['id', 'user', 'user_name', 'session_id', 'query', 'response', 'context_used', 'model_used', 'created_at'] 
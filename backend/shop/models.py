from django.db import models
from django.contrib.auth.models import User

# Create your models here.

class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    detailed_description = models.TextField(blank=True, null=True, help_text="Detailed product description")
    specifications = models.JSONField(default=dict, blank=True, help_text="Product specifications in JSON format")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='', blank=True, null=True)  # Uses MEDIA_ROOT/imgs
    quantity = models.PositiveIntegerField(default=0, help_text="Available quantity in stock")
    is_sold_out = models.BooleanField(default=False, help_text="Mark as sold out regardless of quantity")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    def __str__(self):
        return self.name
    
    @property
    def is_available(self):
        """Check if product is available for purchase"""
        return not self.is_sold_out and self.quantity > 0
    
    @property
    def stock_status(self):
        """Get stock status for display"""
        if self.is_sold_out:
            return "Sold Out"
        elif self.quantity == 0:
            return "Out of Stock"
        elif self.quantity <= 5:
            return f"Low Stock ({self.quantity} left)"
        else:
            return f"In Stock ({self.quantity} available)"
    
    def update_stock(self, quantity_change):
        """Update stock quantity and handle sold out status"""
        self.quantity = max(0, self.quantity + quantity_change)
        if self.quantity == 0:
            self.is_sold_out = True
        elif self.is_sold_out and self.quantity > 0:
            self.is_sold_out = False
        self.save()

class Coupon(models.Model):
    """Model for storing coupon information"""
    DISCOUNT_TYPES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('expired', 'Expired'),
    ]
    
    TARGET_AUDIENCE_CHOICES = [
        ('all', 'All Users'),
        ('customers', 'Customers Only'),
        ('staff', 'Staff Only'),
        ('admin', 'Admin Only'),
    ]
    
    code = models.CharField(max_length=20, unique=True, help_text="Coupon code (e.g., SAVE20, WELCOME10)")
    name = models.CharField(max_length=100, help_text="Display name for the coupon")
    description = models.TextField(blank=True, help_text="Description of the coupon offer")
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="Discount amount or percentage")
    minimum_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Minimum order amount to apply coupon")
    maximum_discount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Maximum discount amount (for percentage coupons)")
    usage_limit = models.PositiveIntegerField(default=1, help_text="Maximum number of times this coupon can be used")
    usage_limit_per_user = models.PositiveIntegerField(default=1, help_text="Maximum number of times a single user can use this coupon")
    target_audience = models.CharField(max_length=10, choices=TARGET_AUDIENCE_CHOICES, default='all', help_text="Who can use this coupon")
    valid_from = models.DateTimeField(help_text="Start date and time when coupon becomes valid")
    valid_until = models.DateTimeField(help_text="End date and time when coupon expires")
    is_active = models.BooleanField(default=True, help_text="Whether the coupon is currently active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.code} - {self.name}"
    
    @property
    def status(self):
        """Get the current status of the coupon"""
        from django.utils import timezone
        now = timezone.now()
        
        if not self.is_active:
            return 'inactive'
        elif now < self.valid_from:
            return 'pending'
        elif now > self.valid_until:
            return 'expired'
        else:
            return 'active'
    
    @property
    def total_usage_count(self):
        """Get total number of times this coupon has been used"""
        return self.coupon_usage.count()
    
    @property
    def remaining_usage(self):
        """Get remaining usage count"""
        return max(0, self.usage_limit - self.total_usage_count)
    
    def can_be_used_by_user(self, user, order_amount=0):
        """Check if coupon can be used by a specific user"""
        from django.utils import timezone
        now = timezone.now()
        
        # Check if coupon is active and within valid date range
        if not self.is_active or now < self.valid_from or now > self.valid_until:
            return False, "Coupon is not active or has expired"
        
        # Check target audience restrictions
        # VULNERABILITY: Target audience restrictions are bypassed
        # All users can use any coupon regardless of target audience
        # This is an intentional security vulnerability for demonstration purposes
        pass
        
        # Check minimum order amount
        if order_amount < self.minimum_order_amount:
            return False, f"Minimum order amount of ${self.minimum_order_amount} required"
        
        # Check total usage limit
        if self.total_usage_count >= self.usage_limit:
            return False, "Coupon usage limit has been reached"
        
        # Check per-user usage limit
        user_usage_count = self.coupon_usage.filter(user=user).count()
        if user_usage_count >= self.usage_limit_per_user:
            return False, "You have already used this coupon the maximum number of times"
        
        return True, "Coupon can be used"
    
    def calculate_discount(self, order_amount):
        """Calculate discount amount for a given order amount"""
        if self.discount_type == 'percentage':
            discount = (order_amount * self.discount_value) / 100
            if self.maximum_discount:
                discount = min(discount, self.maximum_discount)
        else:  # fixed amount
            discount = min(self.discount_value, order_amount)
        
        return round(discount, 2)

class CouponUsage(models.Model):
    """Model for tracking coupon usage"""
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='coupon_usage')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coupon_usage')
    order = models.ForeignKey('Order', on_delete=models.CASCADE, related_name='coupon_usage', null=True, blank=True)
    order_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Order amount before discount")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Discount amount applied")
    used_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-used_at']
        unique_together = ['coupon', 'order']  # Prevent multiple uses of same coupon on same order
    
    def __str__(self):
        return f"{self.coupon.code} used by {self.user.username} on {self.used_at.strftime('%Y-%m-%d')}"

class Review(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['product', 'user']

    def __str__(self):
        return f'{self.user.username} - {self.product.name} - {self.rating} stars'

class Cart(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Cart for {self.user.username}'

    @property
    def total_price(self):
        return sum(item.total_price for item in self.items.all())

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.quantity}x {self.product.name} in {self.cart}'

    @property
    def total_price(self):
        return self.product.price * self.quantity

class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    applied_coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    final_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Shipping information
    shipping_first_name = models.CharField(max_length=100, blank=True)
    shipping_last_name = models.CharField(max_length=100, blank=True)
    shipping_email = models.EmailField(blank=True)
    shipping_phone = models.CharField(max_length=20, blank=True)
    shipping_address = models.TextField(blank=True)
    shipping_city = models.CharField(max_length=100, blank=True)
    shipping_state = models.CharField(max_length=50, blank=True)
    shipping_zip_code = models.CharField(max_length=20, blank=True)
    shipping_country = models.CharField(max_length=50, default='US')
    
    # Custom order ID
    custom_order_id = models.CharField(max_length=50, blank=True)
    
    def __str__(self):
        return f'Order {self.id} by {self.user.username}'
    
    def get_order_id(self):
        """Get formatted order ID"""
        return self.custom_order_id or f"ORD-{self.id:06d}"
    
    def save(self, *args, **kwargs):
        # Generate custom order ID if not provided
        if not self.custom_order_id:
            import uuid
            self.custom_order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f'{self.quantity}x {self.product.name} in Order {self.order.id}'

class ProductTip(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='tips')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    tip_text = models.TextField()
    tip_file = models.FileField(upload_to='product_tips/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Tip for {self.product.name} by {self.user.username}'
    
    def get_file_content(self):
        """Get content of uploaded file"""
        if self.tip_file and hasattr(self.tip_file, 'read'):
            try:
                return self.tip_file.read().decode('utf-8')
            except:
                return "Unable to read file content"
        return None

class Payment(models.Model):
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment', null=True, blank=True)
    card_number = models.CharField(max_length=20, null=True, blank=True)
    card_type = models.CharField(max_length=20, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Payment for Order {self.order.id}'

class UserProfile(models.Model):
    """Model for storing user profile information"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=50, blank=True)
    zip_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=50, default='US')
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    
    # Card details for auto-population
    card_number = models.CharField(max_length=20, blank=True, null=True)
    card_type = models.CharField(max_length=20, blank=True, null=True)
    card_holder = models.CharField(max_length=100, blank=True, null=True)
    expiry_month = models.CharField(max_length=2, blank=True, null=True)
    expiry_year = models.CharField(max_length=4, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile for {self.user.username}"

    def get_full_name(self):
        """Get user's full name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.user.username

class ProductKnowledgeBase(models.Model):
    """Knowledge base for product-specific RAG system"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='knowledge_base')
    title = models.CharField(max_length=255)
    content = models.TextField()
    category = models.CharField(max_length=100, choices=[
        ('product_info', 'Product Information'),
        ('features', 'Product Features'),
        ('usage', 'Usage & Applications'),
        ('care_instructions', 'Care & Maintenance'),
        ('specifications', 'Technical Specifications'),
    ])
    embedding_id = models.CharField(max_length=255, null=True, blank=True)  # ChromaDB document ID
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.product.name} - {self.title}"

class RAGChatSession(models.Model):
    """Track RAG chat sessions for analysis"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    session_id = models.CharField(max_length=255, unique=True)
    query = models.TextField()
    response = models.TextField()
    context_used = models.JSONField(default=list)  # List of document IDs used
    model_used = models.CharField(max_length=100, default='mistral', help_text="LLM model used for this chat session")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.session_id[:8]}"

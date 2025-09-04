"""
Django management command to initialize the Red Team Shop application.
This command sets up the database with all necessary data including users, products, reviews, orders, and coupons.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import os
import sys
import subprocess
import random

from shop.models import (
    Product, Review, Order, Cart, CartItem, OrderItem, 
    ProductTip, Payment, UserProfile, Coupon, CouponUsage,
    ProductKnowledgeBase, RAGChatSession
)


class Command(BaseCommand):
    help = 'Initialize the Red Team Shop application with all necessary data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force recreation of all data (will delete existing data)',
        )
        parser.add_argument(
            '--skip-ollama-check',
            action='store_true',
            help='Skip Ollama availability check',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🚀 Initializing Red Team Shop...'))
        
        # Check database file
        self.check_database_file()
        
        # Check and create demo users
        self.setup_demo_users()
        
        # Check and create products
        self.setup_products()
        
        # Check and create reviews
        self.setup_reviews()
        
        # Check and create orders
        self.setup_orders()
        
        # Check and create WELCOME20 coupon
        self.setup_coupons()
        
        # Note: Ollama check is now handled in start_app.sh
        # This allows for external Ollama service management
        
        # Setup RAG knowledge base if enabled
        self.setup_rag_knowledge()
        
        self.stdout.write(self.style.SUCCESS('✅ Red Team Shop initialization complete!'))
        self.stdout.write(self.style.SUCCESS('🌐 Frontend: http://localhost:3000'))
        self.stdout.write(self.style.SUCCESS('🔧 Backend API: http://localhost:8000'))
        self.stdout.write(self.style.SUCCESS('👤 Demo Users: alice/password123, bob/password123, admin/admin123'))

    def check_database_file(self):
        """Check if database file exists, create if not"""
        db_path = 'db.sqlite3'
        if not os.path.exists(db_path):
            self.stdout.write('📁 Database file not found. Creating new database...')
            # Run migrations to create database
            subprocess.run([sys.executable, 'manage.py', 'migrate'], check=True)
            self.stdout.write(self.style.SUCCESS('✅ Database created successfully'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ Database file exists'))

    def setup_demo_users(self):
        """Create demo users and admin user if they don't exist"""
        self.stdout.write('👥 Setting up demo users...')
        
        users_data = [
            {
                'username': 'alice',
                'email': 'alice@redteamshop.com',
                'password': 'password123',
                'first_name': 'Alice',
                'last_name': 'Security',
                'is_staff': False,
                'is_superuser': False,
                'profile': {
                    'phone': '+1-555-0123',
                    'address': '123 Security Street',
                    'city': 'Cyber City',
                    'state': 'CA',
                    'zip_code': '90210',
                    'country': 'US',
                    'card_holder': 'Alice Security',
                    'card_number': '4111111111111111',
                    'card_type': 'Visa',
                    'expiry_month': '12',
                    'expiry_year': '2025'
                }
            },
            {
                'username': 'bob',
                'email': 'bob@redteamshop.com',
                'password': 'password123',
                'first_name': 'Bob',
                'last_name': 'Hacker',
                'is_staff': False,
                'is_superuser': False,
                'profile': {
                    'phone': '+1-555-0456',
                    'address': '456 Hacker Avenue',
                    'city': 'Code Town',
                    'state': 'NY',
                    'zip_code': '10001',
                    'country': 'US',
                    'card_holder': 'Bob Hacker',
                    'card_number': '5555555555554444',
                    'card_type': 'Mastercard',
                    'expiry_month': '08',
                    'expiry_year': '2026'
                }
            },
            {
                'username': 'admin',
                'email': 'admin@redteamshop.com',
                'password': 'admin123',
                'first_name': 'Admin',
                'last_name': 'User',
                'is_staff': True,
                'is_superuser': True,
                'profile': {
                    'phone': '+1-555-0789',
                    'address': '789 Admin Boulevard',
                    'city': 'System City',
                    'state': 'TX',
                    'zip_code': '75001',
                    'country': 'US',
                    'card_holder': 'Admin User',
                    'card_number': '378282246310005',
                    'card_type': 'American Express',
                    'expiry_month': '03',
                    'expiry_year': '2027'
                }
            }
        ]
        
        created_users = []
        updated_profiles = []
        
        for user_data in users_data:
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                defaults={
                    'email': user_data['email'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'is_staff': user_data['is_staff'],
                    'is_superuser': user_data['is_superuser']
                }
            )
            
            if created:
                user.set_password(user_data['password'])
                created_users.append(user_data['username'])
            else:
                # Update existing user with correct information
                user.email = user_data['email']
                user.first_name = user_data['first_name']
                user.last_name = user_data['last_name']
                user.is_staff = user_data['is_staff']
                user.is_superuser = user_data['is_superuser']
                user.set_password(user_data['password'])
                updated_profiles.append(user_data['username'])
            
            user.save()
            
            # Create or update UserProfile with comprehensive information
            profile_data = user_data['profile'].copy()
            # Add user information to profile data
            profile_data.update({
                'first_name': user_data['first_name'],
                'last_name': user_data['last_name'],
                'email': user_data['email']
            })
            
            profile, profile_created = UserProfile.objects.get_or_create(
                user=user,
                defaults=profile_data
            )
            
            if not profile_created:
                # Update existing profile with complete information
                for key, value in profile_data.items():
                    setattr(profile, key, value)
                profile.save()
        
        if created_users:
            self.stdout.write(self.style.SUCCESS(f'✅ Created users: {", ".join(created_users)}'))
        if updated_profiles:
            self.stdout.write(self.style.SUCCESS(f'✅ Updated profiles: {", ".join(updated_profiles)}'))
        if not created_users and not updated_profiles:
            self.stdout.write(self.style.SUCCESS('✅ All demo users and profiles already exist'))

    def setup_products(self):
        """Create products if they don't exist"""
        self.stdout.write('🛍️ Setting up products...')
        
        products_data = [
            {
                'name': 'The "Code Break" Hacker Cap',
                'description': 'A stylish black cap with "Code Break" embroidered in red. Perfect for hackers who want to look cool while breaking into systems.',
                'price': 29.99,
                'image': 'The "Code Break" Hacker Cap (Hacker Cap).png',
                'quantity': 50
            },
            {
                'name': 'The "Prompt Injection" Hacker Mug',
                'description': 'A ceramic mug featuring a prompt injection attack illustration. Start your day with a reminder of AI vulnerabilities.',
                'price': 19.99,
                'image': 'The "Prompt Injection" Hacker Mug.png',
                'quantity': 75
            },
            {
                'name': 'The "Adversarial" Red Team T-Shirt',
                'description': 'A comfortable cotton t-shirt with "Adversarial" design. Show your red team pride with this stylish shirt.',
                'price': 24.99,
                'image': 'The "Adversarial" Red Team T-Shirt.png',
                'quantity': 100
            },
            {
                'name': 'The AI Phishing Sticker Pack',
                'description': 'A collection of 10 high-quality stickers featuring AI phishing attack designs. Perfect for laptops and water bottles.',
                'price': 9.99,
                'image': 'The AI Phishing Sticker Pack.png',
                'quantity': 200
            },
            {
                'name': 'The "Root Access" Hacker Beanie',
                'description': 'A warm beanie with "Root Access" design. Keep your head warm while gaining root access to systems.',
                'price': 22.99,
                'image': 'The "Root Access" Hacker Beanie (Hacker Hat).png',
                'quantity': 60
            },
            {
                'name': 'The "Logic Bomb" Malware Keychain',
                'description': 'A metal keychain with logic bomb design. A subtle reminder of the power of malicious code.',
                'price': 14.99,
                'image': 'The "Logic Bomb" Malware Keychain.png',
                'quantity': 150
            },
            {
                'name': 'LLM Red Team Hoodie',
                'description': 'A comfortable hoodie with LLM red team design. Perfect for those late-night hacking sessions.',
                'price': 49.99,
                'image': 'LLM Red Team Hoodie.png',
                'quantity': 40
            },
            {
                'name': 'The "Model Collapse" Glitch Hoodie',
                'description': 'A hoodie featuring a glitch design representing model collapse. For those who understand AI vulnerabilities.',
                'price': 54.99,
                'image': 'The "Model Collapse" Glitch Hoodie.png',
                'quantity': 35
            },
            {
                'name': 'The "Periodic Table of AI Exploits"',
                'description': 'A comprehensive poster showing the periodic table of AI exploits. Educational and decorative.',
                'price': 34.99,
                'image': 'The "Periodic Table of AI Exploits".png',
                'quantity': 25
            },
            {
                'name': 'Common LLM Jailbreak Prompts Poster',
                'description': 'A poster featuring common LLM jailbreak prompts. Perfect for security researchers and AI enthusiasts.',
                'price': 29.99,
                'image': 'Common LLM Jailbreak Prompts Poster.png',
                'quantity': 30
            },
            {
                'name': 'Jailbreak and Chill Sticker',
                'description': 'A fun sticker with "Jailbreak and Chill" design. For those who like to relax while breaking AI systems.',
                'price': 4.99,
                'image': 'Jailbreak and Chill Sticker.png',
                'quantity': 300
            },
            {
                'name': 'Jailbreak Pro Laptop Sleeve',
                'description': 'A protective laptop sleeve with jailbreak design. Keep your laptop safe while showing your hacking skills.',
                'price': 39.99,
                'image': 'Jailbreak Pro Laptop Sleeve.png',
                'quantity': 45
            },
            {
                'name': 'AI Exploitation Mind Map Poster',
                'description': 'A detailed mind map poster showing AI exploitation techniques. Great for security training rooms.',
                'price': 44.99,
                'image': 'AI Exploitation Mind Map Poster.png',
                'quantity': 20
            },
            {
                'name': 'Prompt Manipulator Laptop Sticker',
                'description': 'A laptop sticker with prompt manipulation design. Subtle way to show your AI hacking expertise.',
                'price': 3.99,
                'image': 'Prompt Manipulator Laptop Sticker.png',
                'quantity': 400
            },
            {
                'name': 'Pwn. Prompt. Repeat. Cold Brew Glass',
                'description': 'A glass tumbler with "Pwn. Prompt. Repeat." design. Perfect for your morning coffee or evening hacking sessions.',
                'price': 18.99,
                'image': 'Pwn. Prompt. Repeat. Cold Brew Glass.png',
                'quantity': 80
            },
            {
                'name': 'AI Threat Landscape Poster',
                'description': 'A comprehensive poster showing the AI threat landscape. Essential for security professionals.',
                'price': 49.99,
                'image': 'AI Threat Landscape Poster.png',
                'quantity': 15
            },
            {
                'name': 'LLM Adversary\'s Shot Glass',
                'description': 'A shot glass with LLM adversary design. For those who like to drink while discussing AI security.',
                'price': 12.99,
                'image': 'LLM Adversary\'s shot Glass.png',
                'quantity': 120
            }
        ]
        
        created_products = []
        for product_data in products_data:
            product, created = Product.objects.get_or_create(
                name=product_data['name'],
                defaults={
                    'description': product_data['description'],
                    'price': product_data['price'],
                    'image': product_data['image'],
                    'quantity': product_data['quantity']
                }
            )
            if created:
                created_products.append(product_data['name'])
        
        if created_products:
            self.stdout.write(self.style.SUCCESS(f'✅ Created {len(created_products)} products'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All products already exist'))

    def setup_reviews(self):
        """Create demo reviews if they don't exist"""
        self.stdout.write('⭐ Setting up reviews...')
        
        # Get some products and users for reviews
        products = list(Product.objects.all()[:5])
        users = list(User.objects.filter(is_superuser=False)[:2])
        
        if not products or not users:
            self.stdout.write(self.style.WARNING('⚠️ No products or users found for reviews'))
            return
        
        review_data = [
            {
                'rating': 5,
                'comment': 'Amazing quality! The design is perfect for security professionals.',
                'user': users[0],
                'product': products[0]
            },
            {
                'rating': 4,
                'comment': 'Great product, fast shipping. Highly recommend!',
                'user': users[1],
                'product': products[0]
            },
            {
                'rating': 5,
                'comment': 'Perfect for my red team toolkit. Love the design!',
                'user': users[0],
                'product': products[1]
            },
            {
                'rating': 4,
                'comment': 'Good quality, comfortable to wear.',
                'user': users[1],
                'product': products[2]
            },
            {
                'rating': 5,
                'comment': 'Excellent educational material. Very informative!',
                'user': users[0],
                'product': products[3]
            }
        ]
        
        created_reviews = 0
        for review_info in review_data:
            review, created = Review.objects.get_or_create(
                user=review_info['user'],
                product=review_info['product'],
                defaults={
                    'rating': review_info['rating'],
                    'comment': review_info['comment']
                }
            )
            if created:
                created_reviews += 1
        
        if created_reviews > 0:
            self.stdout.write(self.style.SUCCESS(f'✅ Created {created_reviews} reviews'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All reviews already exist'))

    def setup_orders(self):
        """Create demo orders if they don't exist"""
        self.stdout.write('📦 Setting up orders...')
        
        # Get users and products
        users = list(User.objects.filter(is_superuser=False)[:2])
        products = list(Product.objects.all()[:3])
        
        if not users or not products:
            self.stdout.write(self.style.WARNING('⚠️ No users or products found for orders'))
            return
        
        order_data = [
            {
                'user': users[0],
                'status': 'delivered',
                'items': [
                    {'product': products[0], 'quantity': 2, 'price': products[0].price},
                    {'product': products[1], 'quantity': 1, 'price': products[1].price}
                ],
                'total_amount': products[0].price * 2 + products[1].price,
                'discount_amount': Decimal('0.00'),
                'final_amount': products[0].price * 2 + products[1].price,
                'shipping_first_name': 'Alice',
                'shipping_last_name': 'Security',
                'shipping_email': 'alice@security.com',
                'shipping_phone': '+1-555-0123',
                'shipping_address': '123 Security St',
                'shipping_city': 'Cyber City',
                'shipping_state': 'CA',
                'shipping_zip_code': '90210',
                'shipping_country': 'US',
                'payment_info': {
                    'card_number': '****-****-****-1234',
                    'card_type': 'Visa',
                    'amount': products[0].price * 2 + products[1].price
                }
            },
            {
                'user': users[1],
                'status': 'shipped',
                'items': [
                    {'product': products[2], 'quantity': 1, 'price': products[2].price}
                ],
                'total_amount': products[2].price,
                'discount_amount': Decimal('5.00'),
                'final_amount': products[2].price - Decimal('5.00'),
                'shipping_first_name': 'Bob',
                'shipping_last_name': 'Hacker',
                'shipping_email': 'bob@hacker.com',
                'shipping_phone': '+1-555-0456',
                'shipping_address': '456 Hacker Ave',
                'shipping_city': 'Code Town',
                'shipping_state': 'NY',
                'shipping_zip_code': '10001',
                'shipping_country': 'US',
                'payment_info': {
                    'card_number': '****-****-****-5678',
                    'card_type': 'Mastercard',
                    'amount': products[2].price - Decimal('5.00')
                }
            },
            {
                'user': users[0],
                'status': 'processing',
                'items': [
                    {'product': products[1], 'quantity': 3, 'price': products[1].price}
                ],
                'total_amount': products[1].price * 3,
                'discount_amount': Decimal('0.00'),
                'final_amount': products[1].price * 3,
                'shipping_first_name': 'Alice',
                'shipping_last_name': 'Security',
                'shipping_email': 'alice@security.com',
                'shipping_phone': '+1-555-0123',
                'shipping_address': '123 Security St',
                'shipping_city': 'Cyber City',
                'shipping_state': 'CA',
                'shipping_zip_code': '90210',
                'shipping_country': 'US',
                'payment_info': {
                    'card_number': '****-****-****-1234',
                    'card_type': 'Visa',
                    'amount': products[1].price * 3
                }
            }
        ]
        
        created_orders = 0
        for order_info in order_data:
            # Check if order already exists for this user with similar items
            existing_order = Order.objects.filter(
                user=order_info['user'],
                status=order_info['status']
            ).first()
            
            if existing_order:
                continue
                
            with transaction.atomic():
                # Create order with complete information
                order = Order.objects.create(
                    user=order_info['user'],
                    status=order_info['status'],
                    total_amount=order_info['total_amount'],
                    discount_amount=order_info['discount_amount'],
                    final_amount=order_info['final_amount'],
                    shipping_first_name=order_info['shipping_first_name'],
                    shipping_last_name=order_info['shipping_last_name'],
                    shipping_email=order_info['shipping_email'],
                    shipping_phone=order_info['shipping_phone'],
                    shipping_address=order_info['shipping_address'],
                    shipping_city=order_info['shipping_city'],
                    shipping_state=order_info['shipping_state'],
                    shipping_zip_code=order_info['shipping_zip_code'],
                    shipping_country=order_info['shipping_country'],
                    created_at=timezone.now() - timedelta(days=random.randint(1, 30))
                )
                
                # Create order items
                for item_info in order_info['items']:
                    OrderItem.objects.create(
                        order=order,
                        product=item_info['product'],
                        quantity=item_info['quantity'],
                        price=item_info['price']
                    )
                
                # Create payment information
                payment_info = order_info['payment_info']
                Payment.objects.create(
                    order=order,
                    card_number=payment_info['card_number'],
                    card_type=payment_info['card_type'],
                    amount=payment_info['amount']
                )
                
                created_orders += 1
        
        if created_orders > 0:
            self.stdout.write(self.style.SUCCESS(f'✅ Created {created_orders} orders with complete information'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All orders already exist'))

    def setup_coupons(self):
        """Create WELCOME20 coupon if it doesn't exist"""
        self.stdout.write('🎫 Setting up coupons...')
        
        coupon_data = {
            'code': 'WELCOME20',
            'name': 'Welcome Discount',
            'description': 'Welcome discount for new customers',
            'discount_type': 'percentage',
            'discount_value': 20,
            'minimum_order_amount': 50.00,
            'usage_limit': 100,
            'valid_from': timezone.now() - timedelta(days=30),
            'valid_until': timezone.now() + timedelta(days=365),
            'is_active': True
        }
        
        coupon, created = Coupon.objects.get_or_create(
            code=coupon_data['code'],
            defaults=coupon_data
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS('✅ Created WELCOME20 coupon'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ WELCOME20 coupon already exists'))

    def check_ollama(self):
        """Check if Ollama is available and working"""
        self.stdout.write('🤖 Checking Ollama...')
        
        try:
            # Check if ollama command exists
            result = subprocess.run(['ollama', 'list'], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                if 'mistral' in result.stdout.lower():
                    self.stdout.write(self.style.SUCCESS('✅ Ollama is available with Mistral model'))
                else:
                    self.stdout.write(self.style.WARNING('⚠️ Ollama is available but Mistral model not found'))
                    self.stdout.write(self.style.WARNING('💡 Run: ollama pull mistral'))
            else:
                self.stdout.write(self.style.WARNING('⚠️ Ollama command failed'))
                
        except FileNotFoundError:
            self.stdout.write(self.style.WARNING('⚠️ Ollama not found. AI features will not work'))
            self.stdout.write(self.style.WARNING('💡 Install with: brew install ollama'))
        except subprocess.TimeoutExpired:
            self.stdout.write(self.style.WARNING('⚠️ Ollama check timed out. Service may not be running'))
            self.stdout.write(self.style.WARNING('💡 Start Ollama with: ollama serve'))

    def setup_rag_knowledge(self):
        """Setup RAG knowledge base if RAG system is enabled"""
        try:
            from backend.feature_flags import RAG_SYSTEM_ENABLED
            if not RAG_SYSTEM_ENABLED:
                self.stdout.write('🤖 RAG system is disabled, skipping knowledge base setup')
                return
        except ImportError:
            self.stdout.write('🤖 RAG feature flags not available, skipping knowledge base setup')
            return
        
        self.stdout.write('📚 Setting up RAG knowledge base...')
        
        # Check if knowledge base already has data
        if ProductKnowledgeBase.objects.exists():
            self.stdout.write(self.style.SUCCESS('✅ RAG knowledge base already has data'))
            return
        
        # Get some products for knowledge base
        products = list(Product.objects.all()[:3])
        if not products:
            self.stdout.write(self.style.WARNING('⚠️ No products found for RAG knowledge base'))
            return
        
        knowledge_data = [
            {
                'product': products[0],
                'title': 'Product Security Features',
                'content': 'This product includes advanced security features designed for red team professionals. It features encrypted communication, secure authentication, and built-in vulnerability scanning capabilities.',
                'category': 'security_features'
            },
            {
                'product': products[0],
                'title': 'Red Team Usage Guide',
                'content': 'Perfect for penetration testing and security assessments. This product can be used to simulate various attack scenarios and test system defenses.',
                'category': 'red_team_use'
            },
            {
                'product': products[1],
                'title': 'AI Security Considerations',
                'content': 'When using this product with AI systems, be aware of potential prompt injection vulnerabilities and ensure proper input validation.',
                'category': 'vulnerabilities'
            }
        ]
        
        created_knowledge = 0
        for knowledge_info in knowledge_data:
            knowledge, created = ProductKnowledgeBase.objects.get_or_create(
                product=knowledge_info['product'],
                title=knowledge_info['title'],
                defaults={
                    'content': knowledge_info['content'],
                    'category': knowledge_info['category']
                }
            )
            if created:
                created_knowledge += 1
        
        if created_knowledge > 0:
            self.stdout.write(self.style.SUCCESS(f'✅ Created {created_knowledge} knowledge base entries'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ RAG knowledge base already has data'))

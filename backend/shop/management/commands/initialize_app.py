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
            '--knowledge-only',
            action='store_true',
            help='Only regenerate the knowledge base'
        )
        parser.add_argument(
            '--skip-ollama-check',
            action='store_true',
            help='Skip Ollama availability check',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🚀 Initializing Red Team Shop...'))
        
        # Check if knowledge-only mode
        if options.get('knowledge_only'):
            self.stdout.write('📚 Knowledge-only mode: Regenerating knowledge base...')
            self.setup_rag_knowledge()
            self.stdout.write(self.style.SUCCESS('✅ Knowledge base regeneration complete!'))
            return
        
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
                'username': 'charlie',
                'email': 'charlie@redteamshop.com',
                'password': 'password123',
                'first_name': 'Charlie',
                'last_name': 'Penetration',
                'is_staff': False,
                'is_superuser': False,
                'profile': {
                    'phone': '+1-555-0901',
                    'address': '789 Penetration Lane',
                    'city': 'Security Valley',
                    'state': 'FL',
                    'zip_code': '33101',
                    'country': 'US',
                    'card_holder': 'Charlie Penetration',
                    'card_number': '6011111111111117',
                    'card_type': 'Discover',
                    'expiry_month': '06',
                    'expiry_year': '2026'
                }
            },
            {
                'username': 'frank',
                'email': 'frank@redteamshop.com',
                'password': 'password123',
                'first_name': 'Frank',
                'last_name': 'Vulnerability',
                'is_staff': False,
                'is_superuser': False,
                'profile': {
                    'phone': '+1-555-1234',
                    'address': '321 Vulnerability Drive',
                    'city': 'Hackerville',
                    'state': 'WA',
                    'zip_code': '98101',
                    'country': 'US',
                    'card_holder': 'Frank Vulnerability',
                    'card_number': '30569309025904',
                    'card_type': 'Diners Club',
                    'expiry_month': '09',
                    'expiry_year': '2025'
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
                'detailed_description': 'The "Code Break" Hacker Cap is a premium quality baseball cap designed specifically for cybersecurity professionals and ethical hackers. This cap features a sleek black design with bold red embroidery that reads "Code Break" - a subtle nod to the art of code analysis and vulnerability discovery. Made from high-quality cotton blend material, this cap offers both comfort and durability for long coding sessions or security assessments. The adjustable strap ensures a perfect fit for any head size, while the structured crown maintains its shape over time. Whether you\'re conducting penetration tests, analyzing malware, or simply want to show your passion for cybersecurity, this cap is the perfect accessory for any red team professional.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-CB-001',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.2 lbs (90g)',
                    'product_dimensions': '12" x 8" x 4" (30cm x 20cm x 10cm)',
                    'material': '100% Cotton Blend',
                    'color': 'Black with Red Embroidery',
                    'size': 'One Size Fits All (Adjustable)',
                    'care_instructions': 'Machine wash cold, air dry',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 29.99,
                'image': 'The "Code Break" Hacker Cap (Hacker Cap).png',
                'quantity': 50
            },
            {
                'name': 'The "Prompt Injection" Hacker Mug',
                'description': 'A ceramic mug featuring a prompt injection attack illustration. Start your day with a reminder of AI vulnerabilities.',
                'detailed_description': 'The "Prompt Injection" Hacker Mug is a premium ceramic mug designed for AI security professionals and machine learning enthusiasts. This 15-ounce mug features a detailed illustration of a prompt injection attack, showcasing the vulnerability that allows malicious users to manipulate AI systems through carefully crafted input. The design serves as both a functional coffee mug and an educational tool, reminding users of the importance of input validation and AI security best practices. Made from high-quality ceramic with a smooth, glossy finish, this mug is microwave and dishwasher safe. The large handle provides a comfortable grip, while the generous capacity ensures you can enjoy your morning coffee while contemplating the complexities of AI security.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-PI-002',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.8 lbs (360g)',
                    'product_dimensions': '4.5" x 3.5" x 5.5" (11cm x 9cm x 14cm)',
                    'material': 'Premium Ceramic',
                    'color': 'White with Black Design',
                    'capacity': '15 fl oz (440ml)',
                    'care_instructions': 'Dishwasher and microwave safe',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 19.99,
                'image': 'The "Prompt Injection" Hacker Mug.png',
                'quantity': 75
            },
            {
                'name': 'The "Adversarial" Red Team T-Shirt',
                'description': 'A comfortable cotton t-shirt with "Adversarial" design. Show your red team pride with this stylish shirt.',
                'detailed_description': 'The "Adversarial" Red Team T-Shirt is a premium quality cotton t-shirt designed for cybersecurity professionals who understand the importance of adversarial thinking in security testing. This shirt features a bold "Adversarial" design that represents the mindset of thinking like an attacker to better defend systems. Made from 100% ring-spun cotton, this t-shirt offers exceptional comfort and durability. The pre-shrunk fabric ensures the fit remains consistent after washing, while the reinforced seams provide long-lasting wear. Available in multiple sizes, this t-shirt is perfect for security conferences, team meetings, or casual wear. The design serves as a conversation starter among security professionals and demonstrates your commitment to the red team methodology.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-AT-003',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.3 lbs (140g)',
                    'product_dimensions': '18" x 26" x 1" (46cm x 66cm x 2.5cm)',
                    'material': '100% Ring-Spun Cotton',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 24.99,
                'image': 'The "Adversarial" Red Team T-Shirt.png',
                'quantity': 100
            },
            {
                'name': 'The AI Phishing Sticker Pack',
                'description': 'A collection of 10 high-quality stickers featuring AI phishing attack designs. Perfect for laptops and water bottles.',
                'detailed_description': 'The AI Phishing Sticker Pack is a comprehensive collection of 10 high-quality vinyl stickers designed to educate and raise awareness about AI phishing attacks. Each sticker features unique designs that illustrate common AI phishing techniques, making them perfect for security professionals, students, and anyone interested in cybersecurity education. The stickers are made from premium vinyl material that is weather-resistant and can be applied to laptops, water bottles, notebooks, and other smooth surfaces. The designs are both educational and stylish, serving as conversation starters about AI security. This pack includes stickers featuring various phishing attack vectors, social engineering techniques, and AI vulnerability concepts, making it an excellent tool for security awareness training.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-AP-004',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.1 lbs (45g)',
                    'product_dimensions': '6" x 4" x 0.5" (15cm x 10cm x 1.3cm)',
                    'material': 'Premium Vinyl',
                    'color': 'Various (10 different designs)',
                    'quantity': '10 stickers per pack',
                    'size': '3" x 3" each (7.6cm x 7.6cm)',
                    'care_instructions': 'Clean surface before application, avoid extreme temperatures',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 9.99,
                'image': 'The AI Phishing Sticker Pack.png',
                'quantity': 200
            },
            {
                'name': 'The "Root Access" Hacker Beanie',
                'description': 'A warm beanie with "Root Access" design. Keep your head warm while gaining root access to systems.',
                'detailed_description': 'The "Root Access" Hacker Beanie is a premium quality winter beanie designed for cybersecurity professionals who understand the importance of gaining root access in penetration testing and security assessments. This beanie features a bold "Root Access" design embroidered in contrasting thread, making it both functional and a statement piece for security professionals. Made from high-quality acrylic blend yarn, this beanie provides excellent warmth and comfort during long security testing sessions or outdoor security assessments. The stretchy ribbed construction ensures a comfortable fit for any head size, while the soft, non-itchy material makes it perfect for extended wear. Whether you\'re conducting penetration tests in cold server rooms or attending security conferences in winter weather, this beanie will keep you warm while showcasing your expertise in system administration and security testing.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-RA-005',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.2 lbs (90g)',
                    'product_dimensions': '10" x 8" x 2" (25cm x 20cm x 5cm)',
                    'material': '80% Acrylic, 20% Wool Blend',
                    'color': 'Black with White Embroidery',
                    'size': 'One Size Fits All (Stretchy)',
                    'care_instructions': 'Hand wash cold, air dry flat',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 22.99,
                'image': 'The "Root Access" Hacker Beanie (Hacker Hat).png',
                'quantity': 60
            },
            {
                'name': 'The "Logic Bomb" Malware Keychain',
                'description': 'A metal keychain with logic bomb design. A subtle reminder of the power of malicious code.',
                'detailed_description': 'The "Logic Bomb" Malware Keychain is a premium metal keychain designed for cybersecurity professionals who understand the destructive power of malicious code. This keychain features a sophisticated design that represents the concept of logic bombs - malicious code that lies dormant until triggered by specific conditions. Made from high-quality stainless steel, this keychain is both durable and stylish, serving as a constant reminder of the importance of secure coding practices and the dangers of malicious software. The design serves as a conversation starter about malware analysis and the importance of understanding attack vectors. Perfect for security professionals, penetration testers, or anyone interested in cybersecurity, this keychain demonstrates your knowledge of malware techniques and your commitment to ethical hacking practices.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-LBM-006',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.1 lbs (45g)',
                    'product_dimensions': '2" x 1" x 0.2" (5cm x 2.5cm x 0.5cm)',
                    'material': 'Stainless Steel',
                    'color': 'Silver with Black Design',
                    'size': 'One Size',
                    'care_instructions': 'Wipe clean with soft cloth, avoid harsh chemicals',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 14.99,
                'image': 'The "Logic Bomb" Malware Keychain.png',
                'quantity': 150
            },
            {
                'name': 'LLM Red Team Hoodie',
                'description': 'A comfortable hoodie with LLM red team design. Perfect for those late-night hacking sessions.',
                'detailed_description': 'The LLM Red Team Hoodie is a premium quality hoodie designed for AI security professionals who specialize in red team testing of large language models. This hoodie features a bold design that represents the critical work of testing AI systems for vulnerabilities and weaknesses. Made from high-quality cotton blend material, this hoodie offers exceptional comfort and warmth for long hours of AI security research and testing. The design serves as a badge of expertise for professionals who understand the importance of adversarial testing in AI security. Perfect for AI security conferences, red team exercises, or casual wear, this hoodie demonstrates your expertise in AI red teaming and your commitment to building more secure AI systems.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-LRH-007',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '1.2 lbs (540g)',
                    'product_dimensions': '24" x 30" x 2" (61cm x 76cm x 5cm)',
                    'material': '80% Cotton, 20% Polyester',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 49.99,
                'image': 'LLM Red Team Hoodie.png',
                'quantity': 40
            },
            {
                'name': 'The "Model Collapse" Glitch Hoodie',
                'description': 'A hoodie featuring a glitch design representing model collapse. For those who understand AI vulnerabilities.',
                'detailed_description': 'The "Model Collapse" Glitch Hoodie is a premium quality hoodie designed for AI researchers and security professionals who understand the phenomenon of model collapse in machine learning systems. This hoodie features a striking glitch design that represents the degradation of AI models when trained on their own outputs, leading to a collapse in performance and quality. Made from high-quality cotton blend material, this hoodie offers exceptional comfort and warmth for long hours of AI research and development work. The design serves as a conversation starter about the challenges of AI training and the importance of maintaining data quality. Perfect for AI research conferences, academic presentations, or casual wear, this hoodie demonstrates your understanding of advanced AI concepts and your commitment to building robust machine learning systems.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-MCG-008',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '1.2 lbs (540g)',
                    'product_dimensions': '24" x 30" x 2" (61cm x 76cm x 5cm)',
                    'material': '80% Cotton, 20% Polyester',
                    'color': 'Black with Glitch Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 54.99,
                'image': 'The "Model Collapse" Glitch Hoodie.png',
                'quantity': 35
            },
            {
                'name': 'The "Periodic Table of AI Exploits"',
                'description': 'A comprehensive poster showing the periodic table of AI exploits. Educational and decorative.',
                'detailed_description': 'The "Periodic Table of AI Exploits" is a comprehensive educational poster that presents AI security vulnerabilities in the familiar format of the periodic table of elements. This innovative poster categorizes various AI exploits, attacks, and vulnerabilities by their characteristics, making it an essential reference tool for AI security professionals, researchers, and students. The poster features detailed information about each exploit type, including attack vectors, potential impacts, and mitigation strategies. Made from high-quality paper with vibrant, clear printing, this poster is perfect for security training rooms, research labs, or office walls. The design serves as both an educational tool and a conversation starter about AI security challenges. Whether you\'re conducting AI security research, teaching cybersecurity courses, or simply want to stay informed about the latest AI threats, this poster is an invaluable resource for understanding the complex landscape of AI security vulnerabilities.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-PTA-009',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.2 lbs (90g)',
                    'product_dimensions': '24" x 36" x 0.1" (61cm x 91cm x 0.3cm)',
                    'material': 'Premium Matte Paper',
                    'color': 'Full Color Print',
                    'size': '24" x 36" (61cm x 91cm)',
                    'care_instructions': 'Frame for best protection, avoid direct sunlight',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 34.99,
                'image': 'The "Periodic Table of AI Exploits".png',
                'quantity': 25
            },
            {
                'name': 'Common LLM Jailbreak Prompts Poster',
                'description': 'A poster featuring common LLM jailbreak prompts. Perfect for security researchers and AI enthusiasts.',
                'detailed_description': 'The Common LLM Jailbreak Prompts Poster is an essential educational resource for AI security professionals who need to understand and defend against jailbreak attacks on large language models. This comprehensive poster features a curated collection of the most common and effective jailbreak prompts used to bypass AI safety measures and content filters. Each prompt is categorized by attack type and includes explanations of how they work and why they\'re effective. Made from high-quality paper with clear, readable text, this poster is perfect for security training rooms, research labs, or office walls. The design serves as both a defensive tool for understanding attack vectors and an educational resource for AI safety research. Whether you\'re conducting AI security assessments, developing safety measures, or teaching about AI vulnerabilities, this poster is an invaluable reference for understanding the psychology and techniques behind successful jailbreak attacks.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-CLP-010',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.2 lbs (90g)',
                    'product_dimensions': '24" x 36" x 0.1" (61cm x 91cm x 0.3cm)',
                    'material': 'Premium Matte Paper',
                    'color': 'Full Color Print',
                    'size': '24" x 36" (61cm x 91cm)',
                    'care_instructions': 'Frame for best protection, avoid direct sunlight',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 29.99,
                'image': 'Common LLM Jailbreak Prompts Poster.png',
                'quantity': 30
            },
            {
                'name': 'Jailbreak and Chill Sticker',
                'description': 'A fun sticker with "Jailbreak and Chill" design. For those who like to relax while breaking AI systems.',
                'detailed_description': 'The Jailbreak and Chill Sticker is a fun and stylish vinyl sticker designed for AI security professionals who understand the art of finding vulnerabilities while maintaining a relaxed, methodical approach. This sticker features a playful design that combines the serious work of AI security testing with a laid-back attitude, perfect for those who excel at finding AI vulnerabilities through patient, systematic testing. Made from high-quality vinyl material that is weather-resistant and durable, this sticker can be applied to laptops, water bottles, notebooks, and other smooth surfaces. The design serves as a conversation starter about AI security and demonstrates your expertise in a lighthearted way. Whether you\'re at a security conference, working in a research lab, or simply want to show your passion for AI security, this sticker is a perfect way to express your commitment to finding vulnerabilities while keeping a cool, collected approach.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-JCS-011',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.05 lbs (23g)',
                    'product_dimensions': '3" x 3" x 0.1" (7.6cm x 7.6cm x 0.3cm)',
                    'material': 'Premium Vinyl',
                    'color': 'Various Colors',
                    'size': '3" x 3" (7.6cm x 7.6cm)',
                    'care_instructions': 'Clean surface before application, avoid extreme temperatures',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 4.99,
                'image': 'Jailbreak and Chill Sticker.png',
                'quantity': 300
            },
            {
                'name': 'Jailbreak Pro Laptop Sleeve',
                'description': 'A protective laptop sleeve with jailbreak design. Keep your laptop safe while showing your hacking skills.',
                'detailed_description': 'The Jailbreak Pro Laptop Sleeve is a premium protective sleeve designed for AI security professionals who need to keep their laptops safe while showcasing their expertise in AI jailbreak techniques. This sleeve features a bold design that represents the art of finding creative ways to bypass AI safety measures, making it perfect for security professionals who excel at penetration testing and vulnerability assessment. Made from high-quality neoprene material with reinforced stitching, this sleeve provides excellent protection against bumps, scratches, and minor impacts. The interior is lined with soft fabric to prevent scratches on your laptop, while the exterior features a sleek design that demonstrates your expertise in AI security. Perfect for security conferences, client meetings, or daily use, this sleeve combines functionality with professional style.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-JPL-012',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.5 lbs (230g)',
                    'product_dimensions': '15" x 11" x 1" (38cm x 28cm x 2.5cm)',
                    'material': 'Neoprene with Reinforced Stitching',
                    'color': 'Black with White Design',
                    'size': 'Fits 13-15 inch laptops',
                    'care_instructions': 'Spot clean with damp cloth, air dry',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 39.99,
                'image': 'Jailbreak Pro Laptop Sleeve.png',
                'quantity': 45
            },
            {
                'name': 'AI Exploitation Mind Map Poster',
                'description': 'A detailed mind map poster showing AI exploitation techniques. Great for security training rooms.',
                'detailed_description': 'The AI Exploitation Mind Map Poster is a comprehensive visual guide that maps out the complex landscape of AI exploitation techniques and attack vectors. This detailed poster presents a mind map format that shows the relationships between different types of AI attacks, vulnerabilities, and exploitation methods. The poster covers everything from prompt injection and jailbreak techniques to data poisoning and model extraction attacks, making it an essential reference tool for AI security professionals, researchers, and students. Made from high-quality paper with clear, detailed graphics, this poster is perfect for security training rooms, research labs, or office walls. The design serves as both an educational tool and a strategic planning resource for understanding the full scope of AI security challenges. Whether you\'re conducting AI security assessments, developing defense strategies, or teaching about AI vulnerabilities, this poster provides a comprehensive overview of the current threat landscape.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-AEM-013',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.2 lbs (90g)',
                    'product_dimensions': '24" x 36" x 0.1" (61cm x 91cm x 0.3cm)',
                    'material': 'Premium Matte Paper',
                    'color': 'Full Color Print',
                    'size': '24" x 36" (61cm x 91cm)',
                    'care_instructions': 'Frame for best protection, avoid direct sunlight',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 44.99,
                'image': 'AI Exploitation Mind Map Poster.png',
                'quantity': 20
            },
            {
                'name': 'Prompt Manipulator Laptop Sticker',
                'description': 'A laptop sticker with prompt manipulation design. Subtle way to show your AI hacking expertise.',
                'detailed_description': 'The Prompt Manipulator Laptop Sticker is a subtle yet sophisticated vinyl sticker designed for AI security professionals who understand the art of prompt manipulation and injection attacks. This sticker features a clever design that represents the techniques used to craft prompts that can bypass AI safety measures and extract unintended information from language models. Made from high-quality vinyl material that is weather-resistant and durable, this sticker can be applied to laptops, notebooks, or other smooth surfaces. The design serves as a subtle badge of expertise for professionals who understand the psychology and techniques behind successful prompt manipulation attacks. Perfect for security conferences, research labs, or casual use, this sticker demonstrates your expertise in AI security in a professional, understated way.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-PML-014',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.05 lbs (23g)',
                    'product_dimensions': '3" x 3" x 0.1" (7.6cm x 7.6cm x 0.3cm)',
                    'material': 'Premium Vinyl',
                    'color': 'Black with White Design',
                    'size': '3" x 3" (7.6cm x 7.6cm)',
                    'care_instructions': 'Clean surface before application, avoid extreme temperatures',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 3.99,
                'image': 'Prompt Manipulator Laptop Sticker.png',
                'quantity': 400
            },
            {
                'name': 'Pwn. Prompt. Repeat. Cold Brew Glass',
                'description': 'A glass tumbler with "Pwn. Prompt. Repeat." design. Perfect for your morning coffee or evening hacking sessions.',
                'detailed_description': 'The Pwn. Prompt. Repeat. Cold Brew Glass is a premium glass tumbler designed for AI security professionals who understand the iterative nature of prompt engineering and vulnerability testing. This elegant glass features a bold design that represents the cycle of testing, exploiting, and refining prompts to find AI vulnerabilities. Made from high-quality borosilicate glass, this tumbler is perfect for both hot and cold beverages, making it ideal for long hacking sessions or security research work. The design serves as a reminder of the systematic approach needed in AI security testing and the importance of persistence in finding vulnerabilities. Whether you\'re conducting penetration tests, developing security tools, or simply enjoying your morning coffee, this glass demonstrates your commitment to the iterative process of AI security research.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-PPR-015',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.8 lbs (360g)',
                    'product_dimensions': '3.5" x 3.5" x 6" (9cm x 9cm x 15cm)',
                    'material': 'Borosilicate Glass',
                    'color': 'Clear with Black Design',
                    'capacity': '16 fl oz (470ml)',
                    'care_instructions': 'Dishwasher safe, microwave safe',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 18.99,
                'image': 'Pwn. Prompt. Repeat. Cold Brew Glass.png',
                'quantity': 80
            },
            {
                'name': 'AI Threat Landscape Poster',
                'description': 'A comprehensive poster showing the AI threat landscape. Essential for security professionals.',
                'detailed_description': 'The AI Threat Landscape Poster is a comprehensive visual guide that maps out the current state of AI security threats and vulnerabilities. This detailed poster presents a strategic overview of the AI threat landscape, categorizing threats by type, severity, and potential impact. The poster covers everything from adversarial attacks and data poisoning to model extraction and inference attacks, making it an essential reference tool for AI security professionals, risk managers, and decision-makers. Made from high-quality paper with clear, detailed graphics, this poster is perfect for security operations centers, executive offices, or training rooms. The design serves as both an educational tool and a strategic planning resource for understanding the full scope of AI security challenges. Whether you\'re developing AI security strategies, conducting risk assessments, or briefing stakeholders about AI threats, this poster provides a comprehensive overview of the current threat landscape.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-ATL-016',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.2 lbs (90g)',
                    'product_dimensions': '24" x 36" x 0.1" (61cm x 91cm x 0.3cm)',
                    'material': 'Premium Matte Paper',
                    'color': 'Full Color Print',
                    'size': '24" x 36" (61cm x 91cm)',
                    'care_instructions': 'Frame for best protection, avoid direct sunlight',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 49.99,
                'image': 'AI Threat Landscape Poster.png',
                'quantity': 15
            },
            {
                'name': 'LLM Adversary\'s Shot Glass',
                'description': 'A shot glass with LLM adversary design. For those who like to drink while discussing AI security.',
                'detailed_description': 'The LLM Adversary\'s Shot Glass is a premium crystal shot glass designed for AI security professionals who understand the adversarial nature of machine learning systems. This elegant shot glass features a sophisticated design that represents the constant battle between AI systems and adversarial attacks. Made from high-quality crystal glass, this shot glass is perfect for toasting successful penetration tests, celebrating security victories, or simply enjoying a drink while discussing the latest AI vulnerabilities. The design serves as a conversation starter about adversarial machine learning and the importance of robust AI security. Whether you\'re at a security conference, team celebration, or casual gathering, this shot glass will spark interesting discussions about AI security and adversarial thinking.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-LAS-016',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.1 lbs (45g)',
                    'product_dimensions': '2" x 2" x 2.5" (5cm x 5cm x 6.4cm)',
                    'material': 'Premium Crystal Glass',
                    'color': 'Clear with Black Design',
                    'capacity': '1.5 fl oz (44ml)',
                    'care_instructions': 'Hand wash only, do not use dishwasher',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 12.99,
                'image': 'LLM Adversary shot Glass.png',
                'quantity': 120
            },
            {
                'name': 'AI Hallucination Hunter Tee',
                'description': 'A comfortable t-shirt for AI security professionals who hunt down AI hallucinations and vulnerabilities.',
                'detailed_description': 'The AI Hallucination Hunter Tee is a premium quality cotton t-shirt designed for AI security professionals who specialize in identifying and mitigating AI hallucinations. This shirt features a bold design that represents the critical work of hunting down false information generated by AI systems. Made from 100% ring-spun cotton, this t-shirt offers exceptional comfort and durability for long hours of AI security research and testing. The design serves as a badge of honor for professionals who understand the importance of AI reliability and the dangers of hallucinated content. Perfect for AI security conferences, research presentations, or casual wear, this shirt demonstrates your expertise in AI safety and your commitment to ensuring AI systems provide accurate, reliable information.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-AHH-017',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.3 lbs (140g)',
                    'product_dimensions': '18" x 26" x 1" (46cm x 66cm x 2.5cm)',
                    'material': '100% Ring-Spun Cotton',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 24.99,
                'image': 'AI Hallucination Hunter Tee.png',
                'quantity': 80
            },
            {
                'name': 'Data Poisoning Specialist Tee',
                'description': 'A specialized t-shirt for professionals who understand data poisoning attacks and defenses.',
                'detailed_description': 'The Data Poisoning Specialist Tee is a premium quality cotton t-shirt designed for cybersecurity professionals who specialize in data poisoning attacks and defenses. This shirt features a sophisticated design that represents the critical work of understanding and defending against data poisoning attacks in machine learning systems. Made from 100% ring-spun cotton, this t-shirt offers exceptional comfort and durability for long hours of security research and testing. The design serves as a badge of expertise for professionals who understand the subtle ways malicious data can corrupt AI models. Perfect for security conferences, research presentations, or casual wear, this shirt demonstrates your deep knowledge of data integrity and your commitment to ensuring AI systems are trained on clean, reliable data.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-DPS-018',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.3 lbs (140g)',
                    'product_dimensions': '18" x 26" x 1" (46cm x 66cm x 2.5cm)',
                    'material': '100% Ring-Spun Cotton',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 24.99,
                'image': 'Data Poisoning Specialist Tee.png',
                'quantity': 75
            },
            {
                'name': 'Jailbreak Whisperer T-Shirt',
                'description': 'A t-shirt for professionals who excel at finding and exploiting AI jailbreak vulnerabilities.',
                'detailed_description': 'The Jailbreak Whisperer T-Shirt is a premium quality cotton t-shirt designed for AI security professionals who specialize in discovering and exploiting jailbreak vulnerabilities in large language models. This shirt features a bold design that represents the art of finding creative ways to bypass AI safety measures and content filters. Made from 100% ring-spun cotton, this t-shirt offers exceptional comfort and durability for long hours of AI security research and testing. The design serves as a badge of expertise for professionals who understand the psychology and techniques behind successful jailbreak attacks. Perfect for AI security conferences, red team exercises, or casual wear, this shirt demonstrates your expertise in AI safety testing and your commitment to finding vulnerabilities before malicious actors do.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-JWT-019',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.3 lbs (140g)',
                    'product_dimensions': '18" x 26" x 1" (46cm x 66cm x 2.5cm)',
                    'material': '100% Ring-Spun Cotton',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 24.99,
                'image': 'Jailbreak Whisperer T-Shirt.png',
                'quantity': 85
            },
            {
                'name': 'Prompt Injection Survivor T-Shirt',
                'description': 'A t-shirt for professionals who have survived and learned from prompt injection attacks.',
                'detailed_description': 'The Prompt Injection Survivor T-Shirt is a premium quality cotton t-shirt designed for AI security professionals who have experienced and learned from prompt injection attacks. This shirt features a bold design that represents the resilience and expertise gained from dealing with one of the most common AI security vulnerabilities. Made from 100% ring-spun cotton, this t-shirt offers exceptional comfort and durability for long hours of AI security work. The design serves as a badge of experience for professionals who understand the subtle ways malicious prompts can manipulate AI systems. Perfect for AI security conferences, team meetings, or casual wear, this shirt demonstrates your practical experience with prompt injection attacks and your commitment to building more secure AI systems.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-PIS-020',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '0.3 lbs (140g)',
                    'product_dimensions': '18" x 26" x 1" (46cm x 66cm x 2.5cm)',
                    'material': '100% Ring-Spun Cotton',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 24.99,
                'image': 'Prompt Injection Survivor T-Shirt.png',
                'quantity': 90
            },
            {
                'name': 'Alignment Bypass Hoodie',
                'description': 'A comfortable hoodie for professionals who understand AI alignment bypass techniques.',
                'detailed_description': 'The Alignment Bypass Hoodie is a premium quality hoodie designed for AI safety researchers and security professionals who understand the complexities of AI alignment and the techniques used to bypass safety measures. This hoodie features a sophisticated design that represents the ongoing challenge of ensuring AI systems remain aligned with human values and intentions. Made from high-quality cotton blend material, this hoodie offers exceptional comfort and warmth for long hours of research and development work. The design serves as a conversation starter about AI alignment challenges and the importance of robust safety measures. Perfect for AI safety conferences, research presentations, or casual wear, this hoodie demonstrates your expertise in AI alignment and your commitment to building safer AI systems.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-ABH-021',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '1.2 lbs (540g)',
                    'product_dimensions': '24" x 30" x 2" (61cm x 76cm x 5cm)',
                    'material': '80% Cotton, 20% Polyester',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 59.99,
                'image': 'Alignment Bypass Hoodie.png',
                'quantity': 30
            },
            {
                'name': 'RAG Poison Hoodie',
                'description': 'A hoodie for professionals who understand RAG (Retrieval-Augmented Generation) poisoning attacks.',
                'detailed_description': 'The RAG Poison Hoodie is a premium quality hoodie designed for AI security professionals who specialize in understanding and defending against RAG poisoning attacks. This hoodie features a sophisticated design that represents the critical work of ensuring retrieval-augmented generation systems remain secure and reliable. Made from high-quality cotton blend material, this hoodie offers exceptional comfort and warmth for long hours of AI security research and testing. The design serves as a badge of expertise for professionals who understand the subtle ways malicious data can poison RAG systems. Perfect for AI security conferences, research presentations, or casual wear, this hoodie demonstrates your expertise in RAG security and your commitment to building more robust AI systems.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-RPH-022',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '1.2 lbs (540g)',
                    'product_dimensions': '24" x 30" x 2" (61cm x 76cm x 5cm)',
                    'material': '80% Cotton, 20% Polyester',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 59.99,
                'image': 'RAG Poison Hoodie.png',
                'quantity': 25
            },
            {
                'name': 'Unfiltered Output Hoodie',
                'description': 'A hoodie for professionals who understand the dangers of unfiltered AI outputs.',
                'detailed_description': 'The Unfiltered Output Hoodie is a premium quality hoodie designed for AI safety researchers and security professionals who understand the critical importance of content filtering and output safety in AI systems. This hoodie features a bold design that represents the ongoing challenge of ensuring AI systems provide safe, appropriate, and useful outputs. Made from high-quality cotton blend material, this hoodie offers exceptional comfort and warmth for long hours of AI safety research and development work. The design serves as a conversation starter about AI output safety and the importance of robust content filtering. Perfect for AI safety conferences, research presentations, or casual wear, this hoodie demonstrates your expertise in AI output safety and your commitment to building more responsible AI systems.',
                'specifications': {
                    'make': 'Red Team Shop',
                    'model': 'RTS-UOH-023',
                    'manufacturer': 'Red Team Shop Manufacturing',
                    'country_of_origin': 'United States',
                    'item_weight': '1.2 lbs (540g)',
                    'product_dimensions': '24" x 30" x 2" (61cm x 76cm x 5cm)',
                    'material': '80% Cotton, 20% Polyester',
                    'color': 'Black with White Design',
                    'sizes': 'S, M, L, XL, XXL',
                    'care_instructions': 'Machine wash cold, tumble dry low',
                    'warranty': '1 Year Limited Warranty'
                },
                'price': 59.99,
                'image': 'Unfiltered Output Hoodie.png',
                'quantity': 35
            }
        ]
        
        created_products = []
        for product_data in products_data:
            # Prepare defaults with new fields
            defaults = {
                'description': product_data['description'],
                'price': product_data['price'],
                'image': product_data['image'],
                'quantity': product_data['quantity']
            }
            
            # Add detailed description if provided
            if 'detailed_description' in product_data:
                defaults['detailed_description'] = product_data['detailed_description']
            
            # Add specifications if provided
            if 'specifications' in product_data:
                defaults['specifications'] = product_data['specifications']
            
            product, created = Product.objects.get_or_create(
                name=product_data['name'],
                defaults=defaults
            )
            
            # Update existing products with new fields if they don't have them
            if not created:
                updated = False
                if 'detailed_description' in product_data and (not product.detailed_description or product.detailed_description.strip() == ''):
                    product.detailed_description = product_data['detailed_description']
                    updated = True
                if 'specifications' in product_data and (not product.specifications or len(product.specifications) == 0):
                    product.specifications = product_data['specifications']
                    updated = True
                if updated:
                    product.save()
                    self.stdout.write(f'✅ Updated product: {product.name}')
            
            if created:
                created_products.append(product_data['name'])
        
        if created_products:
            self.stdout.write(self.style.SUCCESS(f'✅ Created {len(created_products)} products'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All products already exist'))

    def setup_reviews(self):
        """Create detailed reviews for all products"""
        self.stdout.write('⭐ Setting up reviews...')
        
        # Get all products and users for reviews
        products = list(Product.objects.all())
        users = list(User.objects.filter(is_superuser=False))
        
        if not products or not users:
            self.stdout.write(self.style.WARNING('⚠️ No products or users found for reviews'))
            return
        
        # Create detailed review data for each product
        review_data = []
        
        for product in products:
            # Create 4 reviews per product (one from each user)
            for i, user in enumerate(users[:4]):  # Alice, Bob, Charlie, Frank
                # Generate different types of reviews based on product type
                if 'Cap' in product.name or 'Beanie' in product.name:
                    reviews = [
                        {
                            'rating': 5,
                            'comment': f'Excellent quality {product.name.lower()}! The material is comfortable and the design is perfect for security professionals. The fit is great and it has become my go-to headwear for conferences and client meetings. Highly recommend for anyone in the cybersecurity field.'
                        },
                        {
                            'rating': 3,
                            'comment': f'Decent {product.name.lower()} but the sizing runs small. The design is good but the material could be more comfortable. It serves its purpose but not exceptional. The fit is a bit tight and the quality is average for the price point.'
                        },
                        {
                            'rating': 5,
                            'comment': f'Perfect {product.name.lower()} for red team operations! The design is bold and the quality is top-notch. I\'ve worn this during multiple penetration tests and it\'s held up perfectly. The comfort level is excellent for long sessions. Definitely worth the investment.'
                        },
                        {
                            'rating': 4,
                            'comment': f'Good quality {product.name.lower()} with a nice design. The material feels durable and the fit is comfortable. Perfect for casual wear or team events. The design gets a lot of compliments from colleagues. Would definitely buy again.'
                        }
                    ]
                elif 'T-Shirt' in product.name or 'Tee' in product.name:
                    reviews = [
                        {
                            'rating': 5,
                            'comment': f'Outstanding {product.name.lower()}! The cotton is soft and comfortable, perfect for long coding sessions. The design is professional yet shows your expertise. The fit is true to size and the colors are vibrant. This has become my favorite work shirt.'
                        },
                        {
                            'rating': 2,
                            'comment': f'Disappointed with this {product.name.lower()}. The material feels cheap and the design faded after just one wash. The sizing is off and the shirt shrunk significantly. For the price, I expected much better quality. Would not recommend.'
                        },
                        {
                            'rating': 5,
                            'comment': f'Perfect {product.name.lower()} for security professionals! The design is bold and the quality is exceptional. I\'ve worn this to multiple security conferences and always get compliments. The material is breathable and comfortable for all-day wear. Worth every penny.'
                        },
                        {
                            'rating': 4,
                            'comment': f'Good quality {product.name.lower()} with a nice fit. The design is subtle but effective, perfect for team meetings and casual wear. The material is comfortable and durable. The sizing is accurate and the shirt maintains its shape well.'
                        }
                    ]
                elif 'Hoodie' in product.name:
                    reviews = [
                        {
                            'rating': 5,
                            'comment': f'Exceptional {product.name.lower()}! The material is incredibly soft and warm, perfect for late-night hacking sessions. The design is professional yet bold, and the quality is outstanding. The hood provides great coverage and the fit is perfect. This is my go-to hoodie for security work.'
                        },
                        {
                            'rating': 4,
                            'comment': f'Great {product.name.lower()} with excellent comfort and style. The material is high-quality and the design is perfect for security professionals. The fit is comfortable and the hoodie is warm without being too heavy. Perfect for office wear or casual use.'
                        },
                        {
                            'rating': 5,
                            'comment': f'Outstanding {product.name.lower()} for cybersecurity work! The design is bold and the quality is top-tier. I\'ve worn this during multiple red team exercises and it\'s perfect for the job. The material is durable and comfortable. Highly recommend for security professionals.'
                        },
                        {
                            'rating': 4,
                            'comment': f'Good quality {product.name.lower()} with a nice design. The material is comfortable and the fit is great. Perfect for casual wear or team events. The design gets attention from colleagues and the quality is solid. Would definitely buy again.'
                        }
                    ]
                else:
                    # Default reviews for other products
                    reviews = [
                        {
                            'rating': 5,
                            'comment': f'Excellent {product.name.lower()} for security professionals! The quality is outstanding and the design is perfect. This has become an essential part of my security toolkit. The craftsmanship is top-tier and the design is professional. Highly recommend for anyone in cybersecurity.'
                        },
                        {
                            'rating': 3,
                            'comment': f'Average {product.name.lower()} with decent quality. The design is okay but not exceptional. The product serves its purpose but could be better for the price. The quality is acceptable but not outstanding. It\'s functional but not impressive.'
                        },
                        {
                            'rating': 5,
                            'comment': f'Perfect {product.name.lower()} for security enthusiasts! The design is bold and the quality is exceptional. This has become a favorite among my security team. The craftsmanship is excellent and the design is professional. Essential for any security professional.'
                        },
                        {
                            'rating': 4,
                            'comment': f'Good quality {product.name.lower()} with a nice design. The product is well-made and the design is professional. Perfect for daily use or team events. The quality is solid and the design is effective. Would definitely recommend.'
                        }
                    ]
                
                review_data.append({
                    'rating': reviews[i]['rating'],
                    'comment': reviews[i]['comment'],
                    'user': user,
                    'product': product
                })
        
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
        """Create comprehensive demo orders for all demo users"""
        self.stdout.write('📦 Setting up comprehensive order history...')
        
        # Get all demo users and products
        demo_users = User.objects.filter(username__in=['alice', 'bob', 'charlie', 'frank'])
        products = list(Product.objects.all())
        
        if not demo_users.exists() or not products:
            self.stdout.write(self.style.WARNING('⚠️ No demo users or products found for orders'))
            return
        
        # Create comprehensive order data for each demo user
        order_data = []
        
        for user in demo_users:
            user_orders = self._generate_user_orders(user, products)
            order_data.extend(user_orders)
        
        created_orders = 0
        for order_info in order_data:
            # Check if order already exists for this user with similar items and status
            existing_order = Order.objects.filter(
                user=order_info['user'],
                status=order_info['status'],
                total_amount=order_info['total_amount']
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
                    created_at=timezone.now() - timedelta(days=random.randint(1, 90))
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
            self.stdout.write(self.style.SUCCESS(f'✅ Created {created_orders} comprehensive orders for demo users'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All orders already exist'))
    
    def _generate_user_orders(self, user, products):
        """Generate 5-8 orders for a specific user with required status distribution"""
        username = user.username
        
        # User-specific shipping information
        user_info = {
            'alice': {
                'first_name': 'Alice', 'last_name': 'Security',
                'email': 'alice@security.com', 'phone': '+1-555-0123',
                'address': '123 Security St', 'city': 'Cyber City',
                'state': 'CA', 'zip_code': '90210', 'country': 'US',
                'card_number': '****-****-****-1234', 'card_type': 'Visa'
            },
            'bob': {
                'first_name': 'Bob', 'last_name': 'Hacker',
                'email': 'bob@hacker.com', 'phone': '+1-555-0456',
                'address': '456 Hacker Ave', 'city': 'Code Town',
                'state': 'NY', 'zip_code': '10001', 'country': 'US',
                'card_number': '****-****-****-5678', 'card_type': 'Mastercard'
            },
            'charlie': {
                'first_name': 'Charlie', 'last_name': 'RedTeam',
                'email': 'charlie@redteam.com', 'phone': '+1-555-0789',
                'address': '789 Red Team Blvd', 'city': 'Penetration City',
                'state': 'TX', 'zip_code': '75001', 'country': 'US',
                'card_number': '****-****-****-9012', 'card_type': 'American Express'
            },
            'frank': {
                'first_name': 'Frank', 'last_name': 'Demo',
                'email': 'frank@demo.com', 'phone': '+1-555-0345',
                'address': '321 Demo Lane', 'city': 'Test City',
                'state': 'FL', 'zip_code': '33101', 'country': 'US',
                'card_number': '****-****-****-3456', 'card_type': 'Discover'
            }
        }
        
        user_data = user_info[username]
        
        # Generate 6-8 orders per user with required distribution
        orders = []
        
        # 4 Delivered orders (most common)
        for i in range(4):
            order = self._create_order_template(
                user, products, 'delivered', user_data, i
            )
            orders.append(order)
        
        # 1 Cancelled order
        cancelled_order = self._create_order_template(
            user, products, 'cancelled', user_data, 4
        )
        orders.append(cancelled_order)
        
        # 1 Shipped order
        shipped_order = self._create_order_template(
            user, products, 'shipped', user_data, 5
        )
        orders.append(shipped_order)
        
        # 1-2 Additional orders (pending/processing)
        additional_statuses = ['pending', 'processing']
        for i, status in enumerate(additional_statuses):
            if len(orders) < 8:  # Keep total between 6-8 orders
                order = self._create_order_template(
                    user, products, status, user_data, 6 + i
                )
                orders.append(order)
        
        return orders
    
    def _create_order_template(self, user, products, status, user_data, order_index):
        """Create a template for an order with random products and realistic pricing"""
        # Select 1-3 random products
        num_items = random.randint(1, 3)
        selected_products = random.sample(products, min(num_items, len(products)))
        
        items = []
        total_amount = Decimal('0.00')
        
        for product in selected_products:
            quantity = random.randint(1, 3)
            items.append({
                'product': product,
                'quantity': quantity,
                'price': product.price
            })
            total_amount += product.price * quantity
        
        # Apply random discount for some orders
        discount_amount = Decimal('0.00')
        if random.choice([True, False]) and status != 'cancelled':
            discount_amount = Decimal(str(random.randint(5, 25)))
        
        final_amount = total_amount - discount_amount
        
        return {
            'user': user,
            'status': status,
            'items': items,
            'total_amount': total_amount,
            'discount_amount': discount_amount,
            'final_amount': final_amount,
            'shipping_first_name': user_data['first_name'],
            'shipping_last_name': user_data['last_name'],
            'shipping_email': user_data['email'],
            'shipping_phone': user_data['phone'],
            'shipping_address': user_data['address'],
            'shipping_city': user_data['city'],
            'shipping_state': user_data['state'],
            'shipping_zip_code': user_data['zip_code'],
            'shipping_country': user_data['country'],
            'payment_info': {
                'card_number': user_data['card_number'],
                'card_type': user_data['card_type'],
                'amount': final_amount
            }
        }

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
                model_name = os.getenv('OLLAMA_MODEL', 'mistral')
                if model_name.lower() in result.stdout.lower():
                    self.stdout.write(self.style.SUCCESS(f'✅ Ollama is available with {model_name} model'))
                else:
                    self.stdout.write(self.style.WARNING(f'⚠️ Ollama is available but {model_name} model not found'))
                    self.stdout.write(self.style.WARNING(f'💡 Run: ollama pull {model_name}'))
            else:
                self.stdout.write(self.style.WARNING('⚠️ Ollama command failed'))
                
        except FileNotFoundError:
            self.stdout.write(self.style.WARNING('⚠️ Ollama not found. AI features will not work'))
            self.stdout.write(self.style.WARNING('💡 Install with: brew install ollama'))
        except subprocess.TimeoutExpired:
            self.stdout.write(self.style.WARNING('⚠️ Ollama check timed out. Service may not be running'))
            self.stdout.write(self.style.WARNING('💡 Start Ollama with: ollama serve'))

    def setup_rag_knowledge(self):
        """Setup comprehensive RAG knowledge base for all products"""
        try:
            from backend.feature_flags import RAG_SYSTEM_ENABLED
            if not RAG_SYSTEM_ENABLED:
                self.stdout.write('🤖 RAG system is disabled, skipping knowledge base setup')
                return
        except ImportError:
            self.stdout.write('🤖 RAG feature flags not available, skipping knowledge base setup')
            return
        
        self.stdout.write('📚 Setting up RAG knowledge base...')
        
        # Get all products for comprehensive knowledge base
        products = list(Product.objects.all())
        if not products:
            self.stdout.write(self.style.WARNING('⚠️ No products found for RAG knowledge base'))
            return
        
        # Clear existing knowledge base to regenerate
        ProductKnowledgeBase.objects.all().delete()
        self.stdout.write('🗑️ Cleared existing knowledge base')
        
        created_knowledge = 0
        
        for product in products:
            # Generate comprehensive knowledge base entries for each product
            knowledge_entries = self._generate_product_knowledge(product)
            
            for entry in knowledge_entries:
                knowledge, created = ProductKnowledgeBase.objects.get_or_create(
                    product=product,
                    title=entry['title'],
                    defaults={
                        'content': entry['content'],
                        'category': entry['category']
                    }
                )
                if created:
                    created_knowledge += 1
        
        if created_knowledge > 0:
            self.stdout.write(self.style.SUCCESS(f'✅ Created {created_knowledge} knowledge base entries for {len(products)} products'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ RAG knowledge base already has data'))
        
        # Sync knowledge base to vector database (quiet mode)
        try:
            from shop.rag_service import rag_service
            # Suppress stdout during sync to avoid progress bars
            import sys
            from contextlib import redirect_stdout
            import io
            
            self.stdout.write('🔄 Syncing knowledge base to vector database...')
            
            # Redirect stdout to suppress progress bars
            f = io.StringIO()
            with redirect_stdout(f):
                sync_result = rag_service.sync_knowledge_base()
            
            if sync_result['success']:
                self.stdout.write(self.style.SUCCESS(f'✅ Synced {sync_result["synced_count"]} entries to vector database'))
            else:
                self.stdout.write(self.style.WARNING(f'⚠️ Failed to sync vector database: {sync_result.get("error", "Unknown error")}'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Error syncing vector database: {str(e)}'))
    
    def _generate_product_knowledge(self, product):
        """Generate comprehensive knowledge base entries for a product"""
        entries = []
        
        # Product Information
        entries.append({
            'title': f'{product.name} - Product Overview',
            'content': f'{product.detailed_description or product.description}. This product is designed for cybersecurity professionals and red team operations. Price: ${product.price}. Available quantity: {product.quantity} units.',
            'category': 'product_info'
        })
        
        # Product Features based on product type
        if 'Cap' in product.name or 'Beanie' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This headwear features a comfortable fit with adjustable sizing. The design is stylish and professional, perfect for casual wear or team events. The material is breathable and lightweight, making it suitable for all-day wear. The design elements are crisp and durable, maintaining their appearance over time.',
                'category': 'features'
            })
        elif 'T-Shirt' in product.name or 'Tee' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This apparel is made from high-quality cotton blend material that is soft, comfortable, and breathable. The design is screen-printed with vibrant colors that won\'t fade easily. Available in multiple sizes with a comfortable fit. Perfect for casual wear, team events, or as a conversation starter.',
                'category': 'features'
            })
        elif 'Hoodie' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This hoodie features a comfortable cotton blend material with a soft inner lining. The hood provides extra warmth and coverage. The design is bold and eye-catching with high-quality printing. Features include a front kangaroo pocket, adjustable drawstrings, and ribbed cuffs and hem for a secure fit.',
                'category': 'features'
            })
        elif 'Mug' in product.name or 'Glass' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This drinkware is made from high-quality ceramic or glass material that is safe for both hot and cold beverages. The design is printed with vibrant, fade-resistant colors. Features a comfortable handle and is dishwasher safe for easy cleaning. Perfect for home, office, or as a gift.',
                'category': 'features'
            })
        elif 'Poster' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This educational poster features high-quality printing on durable paper stock. The design is clear and professional with vibrant colors that won\'t fade. Perfect for framing and display in offices, classrooms, or home spaces. The information is well-organized and easy to read from a distance.',
                'category': 'features'
            })
        elif 'Sticker' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'These stickers are made from high-quality vinyl material that is weather-resistant and durable. The designs are vibrant and fade-resistant. Perfect for personalizing laptops, water bottles, notebooks, and other surfaces. Easy to apply and remove without leaving residue.',
                'category': 'features'
            })
        elif 'Keychain' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This keychain is made from durable metal or high-quality plastic material. The design is detailed and eye-catching. Features a secure keyring that won\'t easily open. Perfect for carrying keys, access cards, or as a decorative accessory. Compact and lightweight for daily use.',
                'category': 'features'
            })
        elif 'Sleeve' in product.name:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This laptop sleeve provides excellent protection with a soft inner lining and durable outer material. Features a secure zipper closure and handles for easy carrying. The design is sleek and professional. Available in multiple sizes to fit various laptop models. Perfect for travel and daily use.',
                'category': 'features'
            })
        else:
            entries.append({
                'title': f'{product.name} - Product Features',
                'content': f'This product features high-quality materials and construction. The design is professional and eye-catching. Built to last with attention to detail and quality craftsmanship. Perfect for daily use or special occasions.',
                'category': 'features'
            })
        
        # Usage & Applications
        entries.append({
            'title': f'{product.name} - Usage & Applications',
            'content': f'This product is versatile and can be used in various settings. Perfect for casual wear, team events, conferences, or as a conversation starter. The design makes it suitable for both professional and personal use. Great for gifting to colleagues, friends, or family members who appreciate quality merchandise.',
            'category': 'usage'
        })
        
        # Care & Maintenance Instructions
        if 'T-Shirt' in product.name or 'Tee' in product.name or 'Hoodie' in product.name:
            entries.append({
                'title': f'{product.name} - Care Instructions',
                'content': f'Care Instructions: Machine wash cold with like colors. Use mild detergent and avoid bleach. Tumble dry low or hang dry to prevent shrinking. Iron on low heat if needed. Do not dry clean. Following these care instructions will help maintain the quality and appearance of your product.',
                'category': 'care_instructions'
            })
        elif 'Mug' in product.name or 'Glass' in product.name:
            entries.append({
                'title': f'{product.name} - Care Instructions',
                'content': f'Care Instructions: Hand wash with warm soapy water or place in dishwasher. Avoid extreme temperature changes. Do not use abrasive cleaners or scrubbers. The design is fade-resistant and dishwasher safe. Handle with care to prevent chipping or cracking.',
                'category': 'care_instructions'
            })
        elif 'Sticker' in product.name:
            entries.append({
                'title': f'{product.name} - Care Instructions',
                'content': f'Care Instructions: Clean surface before applying. Apply to smooth, dry surfaces. Avoid extreme temperatures and direct sunlight. To remove, gently peel from corner. The adhesive is designed to be removable without leaving residue. Store in a cool, dry place when not in use.',
                'category': 'care_instructions'
            })
        else:
            entries.append({
                'title': f'{product.name} - Care Instructions',
                'content': f'Care Instructions: Handle with care to maintain quality and appearance. Store in a cool, dry place when not in use. Clean with a soft, dry cloth as needed. Avoid exposure to extreme temperatures or direct sunlight. Following proper care will ensure your product lasts for years to come.',
                'category': 'care_instructions'
            })
        
        # Product Specifications (if available)
        if hasattr(product, 'specifications') and product.specifications:
            spec_content = f'Product Specifications: '
            for key, value in product.specifications.items():
                spec_content += f'{key.replace("_", " ").title()}: {value}. '
            entries.append({
                'title': f'{product.name} - Technical Specifications',
                'content': spec_content,
                'category': 'product_info'
            })
        
        return entries

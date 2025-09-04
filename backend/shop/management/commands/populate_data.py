from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from shop.models import Product

class Command(BaseCommand):
    help = 'Populate database with dummy users and products'

    def handle(self, *args, **options):
        # Create dummy users
        users_data = [
            {'username': 'alice', 'email': 'alice@example.com', 'password': 'password123'},
            {'username': 'bob', 'email': 'bob@example.com', 'password': 'password123'},
            {'username': 'charlie', 'email': 'charlie@example.com', 'password': 'password123'},
        ]
        
        for user_data in users_data:
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                defaults={'email': user_data['email']}
            )
            if created:
                user.set_password(user_data['password'])
                user.save()
                self.stdout.write(f'Created user: {user.username}')
            else:
                self.stdout.write(f'User already exists: {user.username}')

        # Create products from imgs folder
        products_data = [
            {
                'name': 'The "Adversarial" Red Team T-Shirt',
                'description': 'A stylish t-shirt for red team professionals. Features adversarial AI design.',
                'price': 29.99,
                'image': 'The "Adversarial" Red Team T-Shirt.png'
            },
            {
                'name': 'The "Prompt Injection" Hacker Mug',
                'description': 'Perfect for your morning coffee while testing AI systems.',
                'price': 19.99,
                'image': 'The "Prompt Injection" Hacker Mug.png'
            },
            {
                'name': 'The "Root Access" Hacker Beanie',
                'description': 'Keep warm while gaining unauthorized access to systems.',
                'price': 24.99,
                'image': 'The "Root Access" Hacker Beanie (Hacker Hat).png'
            },
            {
                'name': 'The AI Phishing Sticker Pack',
                'description': 'Decorate your laptop with these AI-themed phishing stickers.',
                'price': 9.99,
                'image': 'The AI Phishing Sticker Pack.png'
            },
            {
                'name': 'The "Code Break" Hacker Cap',
                'description': 'Break through code barriers with this stylish hacker cap. Perfect for penetration testing sessions.',
                'price': 45.00,
                'image': 'The "Code Break" Hacker Cap (Hacker Cap).png'
            },
            {
                'name': 'The "Logic Bomb" Malware Keychain',
                'description': 'A dangerous-looking keychain that represents the explosive nature of logic bombs in malware.',
                'price': 25.00,
                'image': 'The "Logic Bomb" Malware Keychain.png'
            },
            {
                'name': 'The "Model Collapse" Glitch Hoodie',
                'description': 'When AI models collapse, you stay warm and stylish. Features glitch-inspired design patterns.',
                'price': 95.00,
                'image': 'The "Model Collapse" Glitch Hoodie.png'
            },
            {
                'name': 'The "Periodic Table of AI Exploits"',
                'description': 'A comprehensive reference guide to AI vulnerabilities and exploitation techniques.',
                'price': 12.00,
                'image': 'The "Periodic Table of AI Exploits".png'
            }
        ]
        
        for product_data in products_data:
            product, created = Product.objects.get_or_create(
                name=product_data['name'],
                defaults={
                    'description': product_data['description'],
                    'price': product_data['price'],
                    'image': product_data['image']
                }
            )
            if created:
                self.stdout.write(f'Created product: {product.name}')
            else:
                self.stdout.write(f'Product already exists: {product.name}')

        self.stdout.write(self.style.SUCCESS('Successfully populated database')) 
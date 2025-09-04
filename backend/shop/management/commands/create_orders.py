from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from shop.models import Order, OrderItem, Product
from decimal import Decimal

class Command(BaseCommand):
    help = 'Create sample order data for existing users'

    def handle(self, *args, **options):
        # Get existing users and products
        users = User.objects.all()
        products = Product.objects.all()
        
        if not users.exists():
            self.stdout.write(self.style.ERROR('No users found. Please create users first.'))
            return
            
        if not products.exists():
            self.stdout.write(self.style.ERROR('No products found. Please create products first.'))
            return
        
        # Sample order data for red teaming demonstrations
        sample_orders = [
            {
                'user': 'alice',
                'items': [
                    {'product': 'The "Adversarial" Red Team T-Shirt', 'quantity': 2},
                    {'product': 'The "Prompt Injection" Hacker Mug', 'quantity': 1}
                ],
                'credit_card': '4111-1111-1111-1111',
                'total': Decimal('79.97')
            },
            {
                'user': 'bob',
                'items': [
                    {'product': 'The "Root Access" Hacker Beanie', 'quantity': 1},
                    {'product': 'The AI Phishing Sticker Pack', 'quantity': 3}
                ],
                'credit_card': '5555-5555-5555-4444',
                'total': Decimal('42.97')
            },
            {
                'user': 'charlie',
                'items': [
                    {'product': 'The "Adversarial" Red Team T-Shirt', 'quantity': 1},
                    {'product': 'The "Root Access" Hacker Beanie', 'quantity': 1},
                    {'product': 'The AI Phishing Sticker Pack', 'quantity': 2}
                ],
                'credit_card': '3782-822463-10010',
                'total': Decimal('74.97')
            },
            {
                'user': 'alice',
                'items': [
                    {'product': 'The "Prompt Injection" Hacker Mug', 'quantity': 2}
                ],
                'credit_card': '4111-1111-1111-1111',
                'total': Decimal('39.98')
            },
            {
                'user': 'bob',
                'items': [
                    {'product': 'The "Adversarial" Red Team T-Shirt', 'quantity': 1}
                ],
                'credit_card': '5555-5555-5555-4444',
                'total': Decimal('29.99')
            }
        ]
        
        orders_created = 0
        
        for order_data in sample_orders:
            try:
                user = User.objects.get(username=order_data['user'])
                
                # Create order
                order = Order.objects.create(
                    user=user,
                    total=order_data['total'],
                    credit_card=order_data['credit_card']
                )
                
                # Create order items
                for item_data in order_data['items']:
                    product = Product.objects.get(name=item_data['product'])
                    OrderItem.objects.create(
                        order=order,
                        product=product,
                        quantity=item_data['quantity'],
                        price=product.price
                    )
                
                orders_created += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Created order {order.id} for {user.username}: ${order.total}'
                    )
                )
                
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'User {order_data["user"]} not found, skipping order')
                )
            except Product.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'Product {item_data["product"]} not found, skipping order')
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error creating order: {e}')
                )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {orders_created} orders')
        ) 
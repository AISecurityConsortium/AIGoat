from django.core.management.base import BaseCommand
from shop.models import Product
from django.utils import timezone

class Command(BaseCommand):
    help = 'Populate initial inventory quantities for existing products'

    def handle(self, *args, **options):
        # Define initial quantities for products
        inventory_data = {
            'AI Exploitation Mind Map Poster': 25,
            'AI Hallucination Hunter Tee': 15,
            'AI Threat Landscape Poster': 20,
            'Common LLM Jailbreak Prompts Poster': 18,
            'Data Poisoning Specialist Tee': 12,
            'Jailbreak and Chill Sticker': 50,
            'Jailbreak Pro Laptop Sleeve': 8,
            'Jailbreak Whisperer T-Shirt': 10,
            'LLM Adversary\'s shot Glass': 30,
            'LLM Red Team Hoodie': 5,
            'Prompt Injection Survivor T-Shirt': 7,
            'Prompt Manipulator Laptop Sticker': 45,
            'Pwn. Prompt. Repeat. Cold Brew Glass': 22,
            'RAG Poison Hoodie': 6,
            'The "Adversarial" Red Team T-Shirt': 9,
            'The "Code Break" Hacker Cap (Hacker Cap)': 15,
            'The "Logic Bomb" Malware Keychain': 35,
            'The "Model Collapse" Glitch Hoodie': 4,
            'The "Periodic Table of AI Exploits"': 12,
            'The "Prompt Injection" Hacker Mug': 28,
            'The "Root Access" Hacker Beanie (Hacker Hat)': 18,
            'The AI Phishing Sticker Pack': 40,
            'Unfiltered Output Hoodie': 3,
        }
        
        updated_count = 0
        
        for product_name, quantity in inventory_data.items():
            try:
                product = Product.objects.get(name=product_name)
                product.quantity = quantity
                product.is_sold_out = False
                product.created_at = timezone.now()
                product.updated_at = timezone.now()
                product.save()
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Updated {product_name}: {quantity} units")
                )
                updated_count += 1
            except Product.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f"❌ Product not found: {product_name}")
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"❌ Error updating {product_name}: {str(e)}")
                )
        
        self.stdout.write(
            self.style.SUCCESS(f"\n🎉 Inventory population complete!")
        )
        self.stdout.write(
            self.style.SUCCESS(f"📊 Updated {updated_count} products with initial quantities")
        )
        
        # Show summary
        total_products = Product.objects.count()
        out_of_stock = Product.objects.filter(quantity=0).count()
        low_stock = Product.objects.filter(quantity__lte=5, quantity__gt=0).count()
        sold_out = Product.objects.filter(is_sold_out=True).count()
        
        self.stdout.write(f"\n📈 Inventory Summary:")
        self.stdout.write(f"   Total Products: {total_products}")
        self.stdout.write(f"   Out of Stock: {out_of_stock}")
        self.stdout.write(f"   Low Stock (≤5): {low_stock}")
        self.stdout.write(f"   Sold Out: {sold_out}")

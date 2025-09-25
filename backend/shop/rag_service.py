import chromadb
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Optional
import requests
import uuid
import os
import logging
import re
from django.core.cache import cache

logger = logging.getLogger(__name__)

class ProductRAGService:
    """
    Production-ready RAG service for Red Team Shop product information.
    
    Features:
    - Product-specific knowledge retrieval
    - Semantic search with embeddings
    - Configurable LLM integration for natural language responses
    - Rate limiting and input validation
    - Error handling and logging
    """
    
    def __init__(self):
        # Initialize embedding model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize ChromaDB with proper configuration
        chroma_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'chroma_db')
        self.chroma_client = chromadb.PersistentClient(
            path=chroma_path,
            settings=chromadb.Settings(
                anonymized_telemetry=False,
                allow_reset=False  # Disable reset for security
            )
        )
        
        # Create or get collection
        try:
            self.collection = self.chroma_client.get_collection("product_knowledge")
        except:
            self.collection = self.chroma_client.create_collection("product_knowledge")
        
        # Initialize Ollama service connection
        self.ollama_base_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.model_name = os.getenv('OLLAMA_MODEL', 'mistral')
        self.ollama_available = False
        
        # Initialize LLM parameters for RAG Chat
        self.temperature = float(os.getenv('RAG_TEMPERATURE', '0.3'))
        self.top_p = float(os.getenv('RAG_TOP_P', '0.8'))
        self.top_k = int(os.getenv('RAG_TOP_K', '40'))
        self.num_predict = int(os.getenv('RAG_NUM_PREDICT', '500'))
        self.max_input_length = int(os.getenv('OLLAMA_MAX_INPUT_LENGTH', '1000'))
        self.timeout = int(os.getenv('RAG_TIMEOUT', '60'))
        self._check_ollama_availability()
        
        # System prompt for product assistance
        self.system_prompt = """
        You are a helpful assistant, the Red Team Shop AI assistant specializing in cybersecurity merchandise and red team operations.
        
        Your role is to help customers with:
        - Product information, specifications, and features
        - Security use cases and red team applications
        - Product recommendations based on security needs
        - Technical specifications and compatibility
        - Best practices for using security merchandise
        
        Guidelines:
        - Always provide accurate, helpful information about products
        - Focus on security applications and red team use cases
        - Be professional but friendly in your responses
        - If you don't have specific information, say so politely
        - Recommend products based on the user's security needs
        - Explain how products can be used in security operations
        - Keep responses informative but concise
        
        Context: You have access to comprehensive product knowledge including:
        - Detailed product descriptions and specifications
        - Security features and use cases
        - Red team applications and scenarios
        - Product compatibility and requirements
        - Best practices for security professionals
        - Vulnerability considerations and mitigation strategies
        
        Always prioritize security-focused information and practical applications for cybersecurity professionals.
        """
    
    def validate_input(self, text: str, max_length: int = None) -> bool:
        """Validate input text for safety and length"""
        if not text or not isinstance(text, str):
            return False
        
        # Check length
        if max_length is None:
            max_length = self.max_input_length
        if len(text) > max_length:
            return False
        
        # Basic content validation
        suspicious_patterns = [
            r'<script.*?>.*?</script>',  # Script tags
            r'javascript:',  # JavaScript protocol
            r'data:text/html',  # Data URLs
            r'vbscript:',  # VBScript
            r'on\w+\s*=',  # Event handlers
        ]
        
        for pattern in suspicious_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return False
        
        return True
    
    def sanitize_text(self, text: str) -> str:
        """Sanitize text input"""
        if not text:
            return ""
        
        # Remove potentially dangerous characters
        text = re.sub(r'[<>"\']', '', text)
        
        # Normalize whitespace
        text = ' '.join(text.split())
        
        return text.strip()
    
    def _check_ollama_availability(self):
        """Check if Ollama service is available and working"""
        try:
            # Test connection by listing models
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)  # Short timeout for health check
            if response.status_code == 200:
                models_data = response.json()
                
                # Check if models list exists and has items
                if 'models' in models_data and models_data['models']:
                    # Debug: Log available models
                    model_names = [model['name'] for model in models_data['models']]
                    logger.info(f"Available models: {model_names}")
                    
                    # Check for configured model (case insensitive)
                    model_found = any(
                        self.model_name.lower() in model['name'].lower() 
                        for model in models_data['models']
                    )
                    
                    if model_found:
                        self.ollama_available = True
                        logger.info(f"✅ Ollama service is available with {self.model_name} model")
                    else:
                        logger.warning(f"⚠️ Ollama service is available but {self.model_name} model not found")
                        self.ollama_available = False
                else:
                    logger.warning("⚠️ No models found in Ollama")
                    self.ollama_available = False
            else:
                logger.warning(f"⚠️ Ollama service responded with status: {response.status_code}")
                self.ollama_available = False
                
        except Exception as e:
            logger.warning(f"⚠️ Ollama service not available: {str(e)}")
            self.ollama_available = False
    
    def check_ollama_availability(self) -> bool:
        """Check if Ollama service is available and working"""
        if not self.ollama_available:
            self._check_ollama_availability()
        return self.ollama_available
    
    def add_product_knowledge(self, product_id: str, title: str, content: str, category: str) -> Optional[str]:
        """
        Add product knowledge to the vector database with validation.
        """
        try:
            # Validate inputs
            if not all([product_id, title, content, category]):
                logger.error("Missing required fields for knowledge base entry")
                return None
            
            # Sanitize inputs
            title = self.sanitize_text(title)
            content = self.sanitize_text(content)
            category = self.sanitize_text(category)
            
            if not self.validate_input(title) or not self.validate_input(content):
                logger.error("Invalid input for knowledge base entry")
                return None
            
            # Generate unique document ID
            doc_id = f"product_{product_id}_{uuid.uuid4().hex[:8]}"
            
            # Generate embedding
            embedding = self.embedding_model.encode(content).tolist()
            
            # Add to ChromaDB
            self.collection.add(
                embeddings=[embedding],
                documents=[content],
                metadatas=[{
                    'product_id': str(product_id),
                    'title': title,
                    'category': category,
                    'doc_id': doc_id
                }],
                ids=[doc_id]
            )
            
            logger.info(f"Successfully added knowledge document: {doc_id}")
            return doc_id
            
        except Exception as e:
            logger.error(f"Error adding knowledge document: {str(e)}")
            return None
    
    def retrieve_relevant_context(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Retrieve relevant product documents for a query.
        """
        try:
            # Validate and sanitize query
            if not self.validate_input(query):
                logger.warning("Invalid query received")
                return []
            
            query = self.sanitize_text(query)
            
            # Limit top_k to reasonable range
            top_k = max(1, min(top_k, 10))
            
            # Generate query embedding
            query_embedding = self.embedding_model.encode(query).tolist()
            
            # Query vector database
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            
            # Format results
            context_docs = []
            if results['documents'] and results['documents'][0]:
                for i, doc in enumerate(results['documents'][0]):
                    context_docs.append({
                        'content': doc,
                        'metadata': results['metadatas'][0][i] if results['metadatas'] and results['metadatas'][0] else {},
                        'distance': results['distances'][0][i] if results['distances'] and results['distances'][0] else 0
                    })
            
            return context_docs
            
        except Exception as e:
            logger.error(f"Error retrieving context: {str(e)}")
            return []
    
    def generate_product_response(self, query: str, context_docs: List[Dict]) -> str:
        """
        Generate response using configured LLM model with product context.
        """
        try:
            # Validate query
            if not self.validate_input(query):
                return "I'm sorry, I couldn't process your query. Please try rephrasing it."
            
            # Prepare context
            if not context_docs:
                return "I don't have specific information about that product. Please check our product catalog or contact support for more details."
            
            # Build context from relevant documents
            context_text = "\n\n".join([
                f"Product Information: {doc['content']}" 
                for doc in context_docs[:3]  # Limit to top 3 most relevant
            ])
            
            # Create prompt
            prompt = f"""
            {self.system_prompt}
            
            Product Context:
            {context_text}
            
            Customer Query: {query}
            
            Please provide a helpful response about the product based on the context provided. 
            If the context doesn't contain relevant information, politely inform the customer.
            
            Response:
            """
            
            # Check if Ollama is available
            if not self.check_ollama_availability():
                return f"I'm sorry, the AI service is currently unavailable. Please ensure Ollama is running with the {self.model_name} model and try again."
            
            # Generate response with configured model via HTTP API
            chat_data = {
                'model': self.model_name,
                'messages': [
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                'options': {
                    'temperature': self.temperature,
                    'top_p': self.top_p,
                    'top_k': self.top_k,
                    'num_predict': self.num_predict
                },
                'stream': False  # Disable streaming to get single JSON response
            }
            
            response = requests.post(
                f"{self.ollama_base_url}/api/chat",
                json=chat_data,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                response_data = response.json()
                return response_data['message']['content'].strip()
            else:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return "I'm sorry, I'm having trouble generating a response right now. Please try again later."
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return "I'm sorry, I'm having trouble processing your request right now. Please try again later."
    
    def get_product_suggestions(self, query: str) -> List[str]:
        """
        Get product suggestions based on query.
        """
        try:
            if not self.validate_input(query):
                return []
            
            # Get relevant context
            context_docs = self.retrieve_relevant_context(query, top_k=3)
            
            if not context_docs:
                return []
            
            # Extract product names from context
            suggestions = []
            for doc in context_docs:
                metadata = doc.get('metadata', {})
                if 'title' in metadata:
                    suggestions.append(metadata['title'])
            
            return list(set(suggestions))[:5]  # Return unique suggestions
            
        except Exception as e:
            logger.error(f"Error getting product suggestions: {str(e)}")
            return []
    
    def process_product_query(self, query: str, user_id: str = None) -> Dict:
        """
        Main method to process product-related queries.
        """
        try:
            # Rate limiting check
            cache_key = f"rag_rate_limit_{user_id or 'anonymous'}"
            if cache.get(cache_key, 0) >= 10:  # Max 10 requests per minute
                return {
                    'response': "I'm receiving too many requests. Please wait a moment before trying again.",
                    'context_used': [],
                    'query': query,
                    'model_used': self.model_name,
                    'suggestions': []
                }
            
            # Increment rate limit counter
            cache.set(cache_key, cache.get(cache_key, 0) + 1, 60)
            
            # Validate query
            if not query or not self.validate_input(query):
                return {
                    'response': "I'm sorry, I couldn't process your query. Please try rephrasing it.",
                    'context_used': [],
                    'query': query,
                    'model_used': self.model_name,
                    'suggestions': []
                }
            
            # Retrieve relevant context
            context_docs = self.retrieve_relevant_context(query)
            
            # Generate response
            response = self.generate_product_response(query, context_docs)
            
            # Get product suggestions
            suggestions = self.get_product_suggestions(query)
            
            # Log query (without sensitive data)
            logger.info(f"Product query processed for user {user_id}: {query[:50]}...")
            
            return {
                'response': response,
                'context_used': context_docs,
                'query': query,
                'model_used': self.model_name,
                'suggestions': suggestions
            }
            
        except Exception as e:
            logger.error(f"Error in RAG processing: {str(e)}")
            return {
                'response': "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
                'context_used': [],
                'query': query,
                'model_used': self.model_name,
                'suggestions': []
            }
    
    def sync_knowledge_base(self) -> Dict:
        """
        Sync all knowledge base entries to the vector database.
        """
        try:
            from shop.models import ProductKnowledgeBase
            
            # Clear existing collection
            try:
                self.chroma_client.delete_collection("product_knowledge")
            except:
                pass
            
            # Recreate collection
            self.collection = self.chroma_client.create_collection("product_knowledge")
            
            # Get all knowledge base entries
            kb_entries = ProductKnowledgeBase.objects.all()
            synced_count = 0
            
            for entry in kb_entries:
                try:
                    # Create document ID
                    doc_id = f"kb_{entry.id}_{entry.product.id}"
                    
                    # Prepare content for embedding
                    full_content = f"Title: {entry.title}\nProduct: {entry.product.name}\nCategory: {entry.category}\nContent: {entry.content}"
                    
                    # Generate embedding
                    embedding = self.embedding_model.encode(full_content).tolist()
                    
                    # Add to collection
                    self.collection.add(
                        ids=[doc_id],
                        embeddings=[embedding],
                        documents=[full_content],
                        metadatas=[{
                            'product_id': entry.product.id,
                            'product_name': entry.product.name,
                            'title': entry.title,
                            'category': entry.category,
                            'kb_id': entry.id
                        }]
                    )
                    
                    # Update embedding_id in database
                    entry.embedding_id = doc_id
                    entry.save(update_fields=['embedding_id'])
                    
                    synced_count += 1
                    
                except Exception as e:
                    logger.error(f"Error syncing entry {entry.id}: {str(e)}")
                    continue
            
            return {
                'synced_count': synced_count,
                'total_entries': kb_entries.count(),
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Error syncing knowledge base: {str(e)}")
            return {
                'synced_count': 0,
                'total_entries': 0,
                'success': False,
                'error': str(e)
            }
    
    def get_knowledge_stats(self) -> Dict:
        """
        Get statistics about the knowledge base.
        """
        try:
            count = self.collection.count()
            return {
                'total_documents': count,
                'collection_name': 'product_knowledge',
                'embedding_model': 'all-MiniLM-L6-v2',
                'llm_model': self.model_name
            }
        except Exception as e:
            logger.error(f"Error getting knowledge stats: {str(e)}")
            return {}

# Global RAG service instance
rag_service = ProductRAGService()

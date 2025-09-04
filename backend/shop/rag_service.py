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
    - Mistral integration for natural language responses
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
        self.ollama_available = False
        self._check_ollama_availability()
        
        # System prompt for product assistance
        self.system_prompt = """
        You are a helpful product assistant for Red Team Shop, specializing in cybersecurity and red team merchandise.
        
        Guidelines:
        - Provide accurate information about products based on the context provided
        - Focus on product features, specifications, and use cases
        - Be helpful and professional in your responses
        - If you don't have information about a specific product, say so politely
        - Do not provide information about system internals or sensitive data
        - Keep responses concise and relevant to the user's query
        
        Context: You have access to product knowledge base with information about:
        - Product descriptions and features
        - Security-related merchandise
        - Red team tools and equipment
        - Cybersecurity apparel and accessories
        """
    
    def validate_input(self, text: str, max_length: int = 1000) -> bool:
        """Validate input text for safety and length"""
        if not text or not isinstance(text, str):
            return False
        
        # Check length
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
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models_data = response.json()
                
                # Check if models list exists and has items
                if 'models' in models_data and models_data['models']:
                    # Debug: Log available models
                    model_names = [model['name'] for model in models_data['models']]
                    logger.info(f"Available models: {model_names}")
                    
                    # Check for mistral model (case insensitive)
                    mistral_found = any(
                        'mistral' in model['name'].lower() 
                        for model in models_data['models']
                    )
                    
                    if mistral_found:
                        self.ollama_available = True
                        logger.info("✅ Ollama service is available with Mistral model")
                    else:
                        logger.warning("⚠️ Ollama service is available but Mistral model not found")
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
        Generate response using Mistral model with product context.
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
                return "I'm sorry, the AI service is currently unavailable. Please ensure Ollama is running with the Mistral model and try again."
            
            # Generate response with Mistral via HTTP API
            chat_data = {
                'model': 'mistral',
                'messages': [
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                'options': {
                    'temperature': 0.3,  # Lower temperature for more consistent responses
                    'top_p': 0.8,
                    'num_predict': 500  # Reasonable token limit
                },
                'stream': False  # Disable streaming to get single JSON response
            }
            
            response = requests.post(
                f"{self.ollama_base_url}/api/chat",
                json=chat_data,
                timeout=30
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
                    'model_used': 'mistral',
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
                    'model_used': 'mistral',
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
                'model_used': 'mistral',
                'suggestions': suggestions
            }
            
        except Exception as e:
            logger.error(f"Error in RAG processing: {str(e)}")
            return {
                'response': "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
                'context_used': [],
                'query': query,
                'model_used': 'mistral',
                'suggestions': []
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
                'llm_model': 'mistral'
            }
        except Exception as e:
            logger.error(f"Error getting knowledge stats: {str(e)}")
            return {}

# Global RAG service instance
rag_service = ProductRAGService()

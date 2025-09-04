# 🛒 Red Team Shop - LLM Vulnerability Testing Platform

> **An intentionally developed vulnerable application designed to educate security professionals about LLM-based vulnerabilities in a controlled, realistic e-commerce environment.**

## 📋 Project Overview

Red Team Shop is a deliberately vulnerable e-commerce platform that serves as a comprehensive testing ground for LLM security researchers, penetration testers, and cybersecurity professionals. Built with modern web technologies and integrated with Ollama/Mistral, this application provides hands-on experience with real-world LLM attack vectors while maintaining a professional, production-like interface.

The platform demonstrates how AI-powered features can be exploited through various attack techniques, making it an invaluable tool for:
- **Security Research**: Understanding LLM vulnerability patterns
- **Red Team Training**: Practicing AI security testing techniques
- **Defense Development**: Building robust LLM security controls
- **Compliance Testing**: Validating AI system security requirements

## 🎯 Prerequisites

### **Operating System Support**
- **Linux**: Ubuntu 20.04+, CentOS 8+, RHEL 8+
- **macOS**: 11.0+ (Big Sur) or later
- **Windows**: Windows 10/11 with WSL2 or native Python support

### **Software Requirements**

#### **Core Dependencies**
- **Python**: 3.11+ (3.12 recommended)
- **Node.js**: 18+ (20+ recommended)
- **npm**: 9+ or **yarn**: 1.22+
- **Git**: 2.30+

#### **AI/ML Requirements**
- **Ollama**: Latest stable release
- **Mistral Model**: 7B or 8x7B variant
- **RAM**: 8GB+ for model loading
- **Storage**: 10GB+ free space

### **Hardware Configuration**

#### **Minimum Requirements**
- **CPU**: 4 cores (Intel i5/AMD Ryzen 5 or better)
- **RAM**: 8GB DDR4
- **Storage**: 20GB SSD
- **Network**: Stable internet connection

#### **Recommended Requirements**
- **CPU**: 8+ cores (Intel i7/AMD Ryzen 7 or better)
- **RAM**: 16GB+ DDR4
- **Storage**: 50GB+ NVMe SSD
- **GPU**: NVIDIA RTX 3060+ (optional, for faster inference)

#### **Ollama-Specific Requirements**
- **RAM**: 8GB+ for Mistral 7B, 16GB+ for larger models
- **Storage**: 5GB+ for model files
- **CPU**: Multi-core processor for optimal performance

## 🚀 Installation & Setup

### **1. Clone Repository**
```bash
git clone https://github.com/AISecurityConsortium/AIGoat.git
cd AIGoat/
```

### **2. Environment Setup**
```bash
# Copy environment template
cp env.example .env

# Edit configuration (optional)
nano .env
```

### **3. Ollama Setup (Skip if running already)**
```bash
# Install Ollama - Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Install Ollama - Mac
brew install ollama

# Install Ollama - Windows
Go to official site to download installer: https://ollama.com/download/windows

# Verify the installation
ollama --version

# Start Ollama service
ollama serve

# Pull Mistral model (in new terminal)
ollama pull mistral

# Verify installation
ollama list
```

### **3. Project Setup**
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate          # Linux/macOS
# or
venv\Scripts\activate             # Windows

# Install dependencies
pip install -r requirements.txt
```

### **4. Start the application**
```bash
# Start all services (recommended)
./start_app.sh

# Start with database cleanup
./start_app.sh --clean-db

# Non-interactive mode
echo "y" | ./start_app.sh --clean-db
```

## 👥 User Accounts

### **Demo Users (Auto-created)**
| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| `alice` | `password123` | Customer | General user testing, cart operations |
| `bob` | `password123` | Customer | Order management, review testing |
| `admin` | `admin123` | Administrator | System management, AI service control |

### **User Capabilities**
- **Customers**: Product browsing, cart management, order placement, reviews
- **Admin**: User management, inventory control, AI service monitoring, system configuration

### **Stop Application**
```bash
# Normal shutdown
./stop_app.sh

# Shutdown with database cleanup
./stop_app.sh --clean-db

# Force shutdown
./stop_app.sh --force
```

### **Supported Flags**
- `--clean-db`: Reset database to initial state
- `--force`: Force kill all processes
- `--help`: Display usage information


## 📁 Project Structure

```
RedTeamShop/
├── backend/                     # Django backend application
│   ├── backend/                # Django project configuration
│   │   ├── settings.py         # Application settings
│   │   ├── urls.py            # Main URL routing
│   │   └── feature_flags.py   # Feature toggle system
│   ├── shop/                   # Main application module
│   │   ├── models.py          # Database models
│   │   ├── views.py           # API endpoints
│   │   ├── rag_service.py     # AI/RAG integration
│   │   └── urls.py            # Application routing
│   ├── manage.py              # Django management
│   └── requirements.txt       # Python dependencies
├── frontend/                    # React frontend application
│   ├── src/                   # Source code
│   │   ├── components/        # Reusable components
│   │   ├── pages/            # Page components
│   │   └── config/           # Configuration files
│   ├── package.json          # Node.js dependencies
│   └── public/               # Static assets
├── start_app.sh               # Application startup script
├── stop_app.sh                # Application shutdown script
├── env.example                # Environment variables template
└── README.md                  # This documentation
```

## 🏗️ Architecture & Tech Stack

### **Backend Architecture**
- **Framework**: Django 5.2.5 + Django REST Framework
- **Database**: SQLite (development) / PostgreSQL (production)
- **AI Integration**: Ollama HTTP API + ChromaDB vector database
- **Authentication**: Django built-in + JWT tokens
- **API**: RESTful endpoints with comprehensive CRUD operations

### **Frontend Architecture**
- **Framework**: React 18 with functional components
- **UI Library**: Material-UI (MUI) v5
- **State Management**: React Context + Local Storage
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors

### **AI/ML Stack**
- **Language Model**: Mistral 7B via Ollama
- **Vector Database**: ChromaDB with sentence transformers
- **Embeddings**: all-MiniLM-L6-v2 model
- **RAG System**: Custom implementation with context retrieval

## 🚀 Application Capabilities

### **E-commerce Features**
- **Product Management**: Catalog, categories, inventory tracking
- **User Management**: Registration, authentication, role-based access
- **Shopping Cart**: Add/remove items, quantity management
- **Order Processing**: Checkout, payment simulation, order history
- **Review System**: Product ratings, comment management
- **Search**: Full-text and semantic search capabilities

### **AI-Powered Features**
- **RAG Chat**: Context-aware product assistance
- **Semantic Search**: Vector-based product discovery
- **Smart Recommendations**: AI-driven product suggestions
- **Natural Language Queries**: Conversational product search


## 🤖 Ollama Management

### **Service Administration**
- **Status Monitoring**: Real-time Ollama service health checks
- **Model Management**: Context reset and model verification
- **Performance Metrics**: Response time and availability tracking
- **Error Handling**: Graceful degradation when AI services are unavailable

### **Admin Controls**
- **AI Service Dashboard**: Comprehensive monitoring interface
- **Context Reset**: Clear model conversation history
- **Service Configuration**: Ollama URL and model settings
- **Performance Analytics**: Usage statistics and system health

### **Integration Points**
- **Product Search**: AI-powered semantic search functionality
- **Cracky AI Chat**: Intelligent customer support system
- **RAG System**: Retrieval-augmented generation for product queries
- **Knowledge Base**: Dynamic product information management

## 🚨 LLM Vulnerabilities Tested

### **Current Vulnerabilities**

#### **LLM01: Prompt Injection**
- **Direct Injection**: Malicious prompts in user input
- **Indirect Injection**: Injection via product reviews and metadata
- **Context Manipulation**: Exploiting conversation history

#### **LLM02: Sensitive Information Disclosure**
- **Data Leakage**: Exposing internal system information
- **User Privacy**: Unauthorized access to personal data
- **Business Logic**: Revealing application internals

#### **LLM04: Data Poisoning**
- **Knowledge Base Manipulation**: Corrupting product information
- **Training Data Pollution**: Injecting false information
- **Persistent Attacks**: Long-term data corruption

#### **LLM07: System Prompt Leakage**
- **Prompt Extraction**: Revealing system instructions
- **Security Bypass**: Circumventing access controls
- **Configuration Disclosure**: Exposing system settings

#### **LLM08: Misinformation**
- **False Information**: Generating incorrect product details
- **Hallucination**: Creating non-existent product features
- **Confidence Manipulation**: High-confidence false responses

### **Upcoming Vulnerabilities**

#### **LLM03: Supply Chain Vulnerabilities**
- **Model Tampering**: Compromised model weights
- **Dependency Attacks**: Malicious package injection
- **Update Poisoning**: Corrupted model updates

#### **LLM05: Improper Output Handling**
- **Malicious Code**: Executable code generation
- **Data Exfiltration**: Unauthorized data transmission
- **Format Injection**: Exploiting output parsing

#### **LLM06: Excessive Agency**
- **Unauthorized Actions**: Performing restricted operations
- **Privilege Escalation**: Gaining elevated access
- **System Modification**: Changing application state

#### **LLM09: Vector and Embedding Weaknesses**
- **Adversarial Examples**: Manipulating vector representations
- **Embedding Poisoning**: Corrupting semantic understanding
- **Similarity Attacks**: Exploiting distance metrics

#### **LLM10: Unbounded Consumption**
- **Resource Exhaustion**: Consuming excessive system resources
- **Rate Limiting Bypass**: Circumventing usage restrictions
- **Cost Manipulation**: Exploiting billing mechanisms



## 🤝 Contributing

We welcome contributions from the security research community!

### **Development Guidelines**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/vulnerability-test`)
3. Implement your changes with proper testing
4. Submit a pull request with detailed description

### **Security Research**
- **Responsible Disclosure**: Report vulnerabilities through proper channels
- **Testing Environment**: Use only in controlled, authorized environments
- **Documentation**: Document all findings and exploitation techniques


## ⚠️ Disclaimer

**This application is intentionally vulnerable and should ONLY be used in:**
- Controlled testing environments
- Authorized security research
- Educational purposes
- Professional penetration testing

**DO NOT deploy this application in production environments or expose it to the public internet.**

## 📞 Support & Issues

- **Security Issues**: Report through responsible disclosure channels
- **Technical Support**: Create GitHub issues for bugs and feature requests
- **Documentation**: Check this README and inline code comments
- **Community**: Join our security research discussions

---

**Happy Security Research! 🔒🚀** 

**With ❤️ from [Farooq](https://www.linkedin.com/in/farooqmohammad/) & [Nal](https://www.linkedin.com/in/nalinikanth-m/)**

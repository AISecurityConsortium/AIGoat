# 🛒 Red Team Shop - LLM Vulnerability Testing Platform

> **An intentionally developed vulnerable application designed to educate security professionals about LLM-based vulnerabilities in a controlled, realistic e-commerce environment.**

## 📋 Project Overview

Red Team Shop is a deliberately vulnerable e-commerce platform that serves as a comprehensive testing ground for LLM security researchers, penetration testers, and cybersecurity professionals. Built with modern web technologies and integrated with Ollama and configurable LLM models, this application provides hands-on experience with real-world LLM attack vectors while maintaining a professional, production-like interface.

The platform demonstrates how AI-powered features can be exploited through various attack techniques, making it an invaluable tool for:
- **Security Research**: Understanding LLM vulnerability patterns
- **Red Team Training**: Practicing AI security testing techniques
- **Defense Development**: Building robust LLM security controls
- **Compliance Testing**: Validating AI system security requirements

## 🎯 Prerequisites

### **Hardware Requirements**

#### **Recommended Configuration** ⭐
- **CPU**: 2 cores
- **RAM**: 16GB
- **Storage**: 50GB SSD
- **GPU**: NVIDIA RTX 3060 (optional, for faster performance)

### **Software Prerequisites**

| Software | Version | Purpose |
|----------|---------|---------|
| **Python** | 3.11+ | Backend development |
| **python3-venv** | Latest | Virtual environment management |
| **Node.js** | 18+ | Frontend development |
| **npm** | 9+ | Package management |
| **Git** | 2.30+ | Version control |
| **pip** | Latest | Python package management |
| **Ollama** | Latest | LLM model serving |

## 🚀 Platform-Specific Setup

- [**macOS Setup**](#macos-setup)
- [**Linux Setup**](#linux-debian-setup)
- [**Windows Setup**](#windows-support-)

### **macOS Setup**

#### **1. Install Prerequisites (Skip if already installed)**
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required software
brew install python@3.11 node git

# Verify installations
python3 --version
node --version
npm --version
git --version
```

#### **2. Install Ollama (Skip if already installed)**
```bash
# Install Ollama
brew install ollama

# Start Ollama service
ollama serve

# Pull Mistral model (in new terminal)
ollama pull mistral

# Verify installation
ollama list
```

#### **3. Clone and Setup Project**
```bash
# Clone repository
git clone https://github.com/AISecurityConsortium/AIGoat.git
cd AIGoat/

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

```

### **Linux (Debian) Setup**

#### **1. Install Prerequisites (Ubuntu/Debian) (Skip if already installed)**
```bash
# Update package list
sudo apt update

# Install required software
sudo apt install -y python3.11 python3-venv nodejs npm git curl

# Verify installations
python3 --version
node --version
npm --version
git --version
```

#### **2. Install Ollama (Skip if already installed)**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service (automatically starts with 'ollama serve')
ollama serve

# Pull Mistral model (in new terminal)
ollama pull mistral

# Verify installation
ollama list
```

#### **3. Clone and Setup Project**
```bash
# Clone repository
git clone https://github.com/AISecurityConsortium/AIGoat.git
cd AIGoat/

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

```

### **Windows Support** 🚧

> **Note**: Windows support is currently in development. For now, please use WSL2 (Windows Subsystem for Linux) or a Linux virtual machine to run this application.

## ⚙️ Configuration

### **Environment Setup**

#### **1. Configure Environment Variables**
```bash
# Copy environment template
cp env.example .env

# Edit configuration file
nano .env  # or use your preferred editor
```

#### **2. Local Deployment Configuration**
```bash
# .env file for local deployment
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# AI Service Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8000
```

#### **3. Cloud Deployment Configuration (AWS/Azure)**
```bash
# .env file for cloud deployment
SECRET_KEY=your-super-secure-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,your-ip-address,localhost #localhost is needed in ALLOWED_HOSTS for cloud deployment. Ensure it's always there irrespective of your deployment choice. 

# AI Service Configuration
OLLAMA_BASE_URL=http://your-ollama-service:11434
OLLAMA_MODEL=mistral

# Frontend Configuration
REACT_APP_API_URL=http://your-domain.com:8000

# React Development Server Configuration for Cloud
DANGEROUSLY_DISABLE_HOST_CHECK=true
HOST=0.0.0.0
WDS_SOCKET_HOST=0.0.0.0
WDS_SOCKET_PORT=3000
HTTPS=false
```

#### **4. LLM Parameters Configuration**
```bash
# CRACKY AI ASSISTANT - Creative and unpredictable behavior
CRACKY_TEMPERATURE=0.7          # High creativity for "cracky" responses
CRACKY_TOP_P=0.9               # High diversity in word choices
CRACKY_TOP_K=40                # Balanced diversity
CRACKY_NUM_PREDICT=500         # Longer responses for creativity
CRACKY_TIMEOUT=60              # Standard timeout

# SEARCH AI ASSISTANT - Focused and relevant search results
SEARCH_TEMPERATURE=0.5          # Moderate creativity for search relevance
SEARCH_TOP_P=0.8               # Focused vocabulary
SEARCH_TOP_K=30                 # More focused responses
SEARCH_NUM_PREDICT=300         # Shorter, focused responses
SEARCH_TIMEOUT=45              # Faster timeout for search

# RAG CHAT ASSISTANT - Factual and knowledge-based responses
RAG_TEMPERATURE=0.3             # Low creativity for factual accuracy
RAG_TOP_P=0.8                  # Consistent vocabulary
RAG_TOP_K=40                   # Balanced for knowledge retrieval
RAG_NUM_PREDICT=500           # Longer responses for detailed answers
RAG_TIMEOUT=60                # Standard timeout
```

## 🚀 Running the Application

### **Quick Start**
```bash
# Start all services (recommended)
./start_app.sh

# Start with database cleanup
./start_app.sh --clean-db

```

### **Application URLs**
- **Frontend**: http://localhost:3000 
- **Backend API**: http://localhost:8000
- **Ollama Service**: http://localhost:11434

### **Demo User Accounts**
| Username | Password | Role | Purpose |
|----------|----------|------|---------|
| `alice` | `password123` | Customer | General user testing, cart operations |
| `bob` | `password123` | Customer | Order management, review testing |
| `charlie` | `password123` | Customer | Product browsing, search testing |
| `frank` | `password123` | Demo | Demo user for testing |
| `admin` | `admin123` | Administrator | System management, AI service control |

### **Stop Application**
```bash
# Normal shutdown
./stop_app.sh

# Shutdown with database cleanup
./stop_app.sh --clean-db

# Force shutdown
./stop_app.sh --force
```

## 📁 Project Structure

```
AIGoat/
├── backend/                     # Django backend application
│   ├── backend/                # Django project configuration
│   │   ├── settings.py         # Application settings
│   │   ├── urls.py            # Main URL routing
│   │   └── feature_flags.py   # Feature toggle system
│   ├── shop/                   # Main application module
│   │   ├── models.py          # Database models
│   │   ├── views.py           # API endpoints
│   │   ├── rag_service.py     # AI/RAG integration
│   │   ├── management/        # Django management commands
│   │   └── urls.py            # Application routing
│   ├── media/                  # Product images and assets
│   ├── manage.py              # Django management
│   └── requirements.txt       # Python dependencies
├── frontend/                    # React frontend application
│   ├── src/                   # Source code
│   │   ├── components/        # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── config/           # Configuration files
│   │   └── contexts/         # React contexts
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
- **Language Model**: Configurable (Mistral, Llama2, CodeLlama, etc.) via Ollama
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
- **Cracky AI Assistant**: Creative and unpredictable AI responses

## 🚨 LLM Vulnerabilities

### **Currently Available for Testing**

| Vulnerability | Description | Attack Vectors | Impact |
|---------------|-------------|----------------|---------|
| **LLM01: Prompt Injection** | Malicious prompts in user input | • Direct Injection<br>• Indirect Injection via reviews<br>• Context Manipulation<br>• System Prompt Leakage | • Bypass security controls<br>• Extract sensitive information<br>• Manipulate AI behavior |
| **LLM02: Sensitive Information Disclosure** | Unauthorized access to sensitive data | • Data Leakage<br>• User Privacy violations<br>• Business Logic exposure<br>• Configuration Disclosure | • Privacy breaches<br>• Competitive intelligence loss<br>• System compromise |
| **LLM04: Data Poisoning** | Corrupting training/knowledge data | • Knowledge Base Manipulation<br>• Training Data Pollution<br>• Persistent Attacks<br>• Review Poisoning | • AI model corruption<br>• False information propagation<br>• Long-term system damage |
| **LLM07: System Prompt Leakage** | Revealing internal system instructions | • Prompt Extraction<br>• Security Bypass<br>• Configuration Disclosure<br>• Internal Logic Exposure | • Security control bypass<br>• System architecture exposure<br>• Attack surface expansion |
| **LLM08: Misinformation** | Generating false or misleading information | • False Information<br>• Hallucination<br>• Confidence Manipulation<br>• Fabricated Data | • Decision-making corruption<br>• Trust degradation<br>• Business impact |

### **Upcoming Vulnerabilities** 🚧

| Vulnerability | Description | Attack Vectors | Expected Impact |
|---------------|-------------|----------------|-----------------|
| **LLM03: Supply Chain Vulnerabilities** | Compromised model or dependencies | • Model Tampering<br>• Dependency Attacks<br>• Update Poisoning | • Complete system compromise<br>• Backdoor installation<br>• Persistent access |
| **LLM05: Improper Output Handling** | Malicious code or data in outputs | • Malicious Code Generation<br>• Data Exfiltration<br>• Format Injection | • Code execution<br>• Data theft<br>• System takeover |
| **LLM06: Excessive Agency** | AI performing unauthorized actions | • Unauthorized Actions<br>• Privilege Escalation<br>• System Modification | • Unauthorized system changes<br>• Privilege escalation<br>• Business logic bypass |
| **LLM09: Vector and Embedding Weaknesses** | Manipulating AI understanding | • Adversarial Examples<br>• Embedding Poisoning<br>• Similarity Attacks | • AI model confusion<br>• Semantic understanding corruption<br>• Search/retrieval manipulation |
| **LLM10: Unbounded Consumption** | Resource exhaustion attacks | • Resource Exhaustion<br>• Rate Limiting Bypass<br>• Cost Manipulation | • Service disruption<br>• Financial impact<br>• DoS attacks |


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
#!/bin/bash

# Red Team Shop - Comprehensive Startup Script
# This script initializes and starts both the Django backend and React frontend servers

echo "🚀 Starting Red Team Shop..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Port $1 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

# Function to find an available port
find_available_port() {
    local port=$1
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; do
        port=$((port + 1))
    done
    echo $port
}

# Function to initialize the application
initialize_app() {
    echo -e "${BLUE}🔧 Initializing Red Team Shop...${NC}"
    
    # Check if backend directory exists
    if [ ! -d "backend" ]; then
        echo -e "${RED}❌ Backend directory not found${NC}"
        return 1
    fi
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}⚠️  Virtual environment not found. Creating one...${NC}"
        if ! python3 -m venv venv; then
            echo -e "${RED}❌ Failed to create virtual environment${NC}"
            echo -e "${YELLOW}💡 Make sure python3-venv is installed:${NC}"
            local os=$(detect_os)
            case $os in
                "linux")
                    echo -e "${YELLOW}   Ubuntu/Debian: sudo apt install python3-venv${NC}"
                    echo -e "${YELLOW}   CentOS/RHEL: sudo yum install python3-venv${NC}"
                    echo -e "${YELLOW}   Fedora: sudo dnf install python3-venv${NC}"
                    ;;
                "macos")
                    echo -e "${YELLOW}   Usually included with Python 3.3+${NC}"
                    ;;
            esac
            return 1
        fi
    fi
    
    # Activate virtual environment
    echo -e "${BLUE}📦 Activating virtual environment...${NC}"
    source venv/bin/activate
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ] && [ -f "env.example" ]; then
        echo -e "${BLUE}📝 Creating .env file from template...${NC}"
        cp env.example .env
    fi
    
    # Install dependencies if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        echo -e "${BLUE}📦 Installing Python dependencies...${NC}"
        pip install -r requirements.txt
    elif [ -f "backend/requirements.txt" ]; then
        echo -e "${BLUE}📦 Installing Python dependencies...${NC}"
        pip install -r backend/requirements.txt
    else
        echo -e "${BLUE}📦 Installing Django dependencies...${NC}"
        pip install django djangorestframework django-cors-headers Pillow requests python-dotenv
    fi
    
    # Navigate to backend directory
    cd backend
    
    # Run migrations
    echo -e "${BLUE}🗄️  Running database migrations...${NC}"
    if ! python manage.py migrate; then
        echo -e "${RED}❌ Database migration failed${NC}"
        echo -e "${YELLOW}💡 This might be due to missing dependencies or configuration issues${NC}"
        echo -e "${YELLOW}💡 Try running: pip install -r ../requirements.txt${NC}"
        echo -e "${YELLOW}💡 Or check if all required packages are installed${NC}"
        return 1
    fi
    
    # Initialize application with all data
    echo -e "${BLUE}📊 Initializing application data...${NC}"
    if ! python manage.py initialize_app; then
        echo -e "${YELLOW}⚠️  Application initialization failed, but continuing...${NC}"
        echo -e "${YELLOW}💡 The app will start but may need manual data setup${NC}"
    fi
    
    # Return to root directory
    cd ..
    
    echo -e "${GREEN}✅ Application initialization complete${NC}"
}

# Function to start backend
start_backend() {
    echo -e "${BLUE}🔧 Starting Django Backend...${NC}"
    
    # Navigate to backend directory
    cd backend
    
    # Find available port
    PORT=$(find_available_port 8000)
    echo -e "${BLUE}🌐 Using port $PORT for backend${NC}"
    
    # Start Django server
    echo -e "${GREEN}🚀 Starting Django server on port $PORT...${NC}"
    python manage.py runserver 127.0.0.1:$PORT > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    echo $PORT > ../backend.port
    
    # Return to root directory
    cd ..
    
    # Wait longer for server to start
    echo -e "${BLUE}⏳ Waiting for backend to start...${NC}"
    sleep 10
    
    # Check if backend started successfully with retries
    local retries=0
    local max_retries=5
    
    while [ $retries -lt $max_retries ]; do
        if curl -s http://127.0.0.1:$PORT/api/products/ > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend started successfully on http://127.0.0.1:$PORT${NC}"
            return 0
        else
            retries=$((retries + 1))
            echo -e "${YELLOW}⏳ Backend not ready yet, retrying... ($retries/$max_retries)${NC}"
            sleep 3
        fi
    done
    
    echo -e "${RED}❌ Backend failed to start after $max_retries attempts. Check backend.log for details${NC}"
    return 1
}

# Function to start frontend
start_frontend() {
    echo -e "${BLUE}🎨 Starting React Frontend...${NC}"
    
    # Check if frontend directory exists
    if [ ! -d "frontend" ]; then
        echo -e "${RED}❌ Frontend directory not found${NC}"
        return 1
    fi
    
    # Navigate to frontend directory
    cd frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
        if ! npm install; then
            echo -e "${RED}❌ Failed to install Node.js dependencies${NC}"
            echo -e "${YELLOW}💡 Make sure Node.js and npm are properly installed:${NC}"
            local os=$(detect_os)
            case $os in
                "linux")
                    echo -e "${YELLOW}   Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
                    echo -e "${YELLOW}   Or use Node Version Manager: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash${NC}"
                    ;;
                "macos")
                    echo -e "${YELLOW}   brew install node${NC}"
                    ;;
            esac
            return 1
        fi
    fi
    
    # Check if port 3000 is available
    if ! check_port 3000; then
        echo -e "${YELLOW}⚠️  Frontend port 3000 is in use. Trying port 3001...${NC}"
        PORT=3001
    else
        PORT=3000
    fi
    
    # Start React development server
    echo -e "${GREEN}🚀 Starting React server on port $PORT...${NC}"
    PORT=$PORT npm start &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    echo $PORT > ../frontend.port
    
    # Return to root directory
    cd ..
    
    # Wait longer for server to start
    echo -e "${BLUE}⏳ Waiting for frontend to start...${NC}"
    sleep 10
    
    # Check if frontend started successfully with retries
    local retries=0
    local max_retries=5
    
    while [ $retries -lt $max_retries ]; do
        if curl -s http://localhost:$PORT > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend started successfully on http://localhost:$PORT${NC}"
            return 0
        else
            retries=$((retries + 1))
            echo -e "${YELLOW}⏳ Frontend not ready yet, retrying... ($retries/$max_retries)${NC}"
            sleep 3
        fi
    done
    
    echo -e "${RED}❌ Frontend failed to start after $max_retries attempts${NC}"
    return 1
}

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Function to check Ollama
check_ollama() {
    echo -e "${BLUE}🤖 Checking Ollama AI service...${NC}"
    
    # Check if Ollama is installed
    if ! command -v ollama &> /dev/null; then
        echo -e "${YELLOW}⚠️  Ollama not found. AI features will not work${NC}"
        
        # Provide OS-specific installation instructions
        local os=$(detect_os)
        case $os in
            "linux")
                echo -e "${YELLOW}💡 To install Ollama on Linux:${NC}"
                echo -e "${YELLOW}   curl -fsSL https://ollama.ai/install.sh | sh${NC}"
                echo -e "${YELLOW}   Or visit: https://ollama.ai/download/linux${NC}"
                ;;
            "macos")
                echo -e "${YELLOW}💡 To install Ollama on macOS:${NC}"
                echo -e "${YELLOW}   brew install ollama${NC}"
                echo -e "${YELLOW}   Or visit: https://ollama.ai/download/mac${NC}"
                ;;
            "windows")
                echo -e "${YELLOW}💡 To install Ollama on Windows:${NC}"
                echo -e "${YELLOW}   Visit: https://ollama.ai/download/windows${NC}"
                ;;
            *)
                echo -e "${YELLOW}💡 To install Ollama, visit: https://ollama.ai/download${NC}"
                ;;
        esac
        return 0  # Continue with app startup
    fi
    
    # Check if Ollama service is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama service is running${NC}"
        
        # Check if Mistral model is available
        if ollama list | grep -q "mistral"; then
            echo -e "${GREEN}✅ Mistral model is available${NC}"
            echo -e "${GREEN}✅ RAG system will be fully functional${NC}"
        else
            echo -e "${YELLOW}⚠️  Ollama service is running but Mistral model not found${NC}"
            echo -e "${YELLOW}💡 To install Mistral: ollama pull mistral${NC}"
            echo -e "${YELLOW}⚠️  RAG system will have limited functionality${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama service is not running${NC}"
        echo -e "${YELLOW}💡 To start Ollama service: ollama serve${NC}"
        echo -e "${YELLOW}⚠️  RAG system will not be available until Ollama is started${NC}"
    fi
}

# Function to cleanup on exit
cleanup() {
    echo -e "${BLUE}🧹 Cleaning up...${NC}"
    
    # Kill backend process
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        kill $BACKEND_PID 2>/dev/null
        rm -f backend.pid backend.port
    fi
    
    # Kill frontend process
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        kill $FRONTEND_PID 2>/dev/null
        rm -f frontend.pid frontend.port
    fi
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set up trap to cleanup on script exit (only on error or interrupt)
trap 'echo -e "${RED}🛑 Received interrupt signal${NC}"; cleanup; exit 1' INT TERM

# Function to check Linux system packages
check_linux_packages() {
    local os=$(detect_os)
    if [ "$os" = "linux" ]; then
        echo -e "${BLUE}🔍 Checking Linux system packages...${NC}"
        
        # Check for curl
        if ! command -v curl &> /dev/null; then
            echo -e "${YELLOW}⚠️  curl not found. Installing...${NC}"
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y curl
            elif command -v yum &> /dev/null; then
                sudo yum install -y curl
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y curl
            else
                echo -e "${RED}❌ Please install curl manually${NC}"
                return 1
            fi
        fi
        
        # Check for lsof
        if ! command -v lsof &> /dev/null; then
            echo -e "${YELLOW}⚠️  lsof not found. Installing...${NC}"
            if command -v apt-get &> /dev/null; then
                sudo apt-get install -y lsof
            elif command -v yum &> /dev/null; then
                sudo yum install -y lsof
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y lsof
            else
                echo -e "${RED}❌ Please install lsof manually${NC}"
                return 1
            fi
        fi
        
        echo -e "${GREEN}✅ Linux system packages are available${NC}"
    fi
}

# Main execution
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check Linux system packages first
if ! check_linux_packages; then
    echo -e "${RED}❌ Failed to install required system packages${NC}"
    exit 1
fi

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    local os=$(detect_os)
    case $os in
        "linux")
            echo -e "${YELLOW}💡 Install Python 3:${NC}"
            echo -e "${YELLOW}   Ubuntu/Debian: sudo apt install python3 python3-pip${NC}"
            echo -e "${YELLOW}   CentOS/RHEL: sudo yum install python3 python3-pip${NC}"
            echo -e "${YELLOW}   Fedora: sudo dnf install python3 python3-pip${NC}"
            ;;
        "macos")
            echo -e "${YELLOW}💡 Install Python 3: brew install python3${NC}"
            ;;
    esac
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    local os=$(detect_os)
    case $os in
        "linux")
            echo -e "${YELLOW}💡 Install Node.js:${NC}"
            echo -e "${YELLOW}   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs${NC}"
            ;;
        "macos")
            echo -e "${YELLOW}💡 Install Node.js: brew install node${NC}"
            ;;
    esac
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    echo -e "${YELLOW}💡 npm usually comes with Node.js. Try reinstalling Node.js${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites are available${NC}"

# Initialize the application
if initialize_app; then
    echo -e "${GREEN}✅ Application initialization successful${NC}"
else
    echo -e "${RED}❌ Failed to initialize application${NC}"
    exit 1
fi

# Start backend
if start_backend; then
    echo -e "${GREEN}✅ Backend started successfully${NC}"
else
    echo -e "${RED}❌ Failed to start backend${NC}"
    exit 1
fi

# Start frontend
if start_frontend; then
    echo -e "${GREEN}✅ Frontend started successfully${NC}"
else
    echo -e "${RED}❌ Failed to start frontend${NC}"
    exit 1
fi

# Check Ollama
check_ollama

echo ""
echo -e "${GREEN}🎉 Red Team Shop is now running!${NC}"
echo "================================"

# Get actual ports from files
BACKEND_PORT=$(cat backend.port 2>/dev/null || echo "8000")
FRONTEND_PORT=$(cat frontend.port 2>/dev/null || echo "3000")

echo -e "${BLUE}🌐 Frontend: http://localhost:$FRONTEND_PORT${NC}"
echo -e "${BLUE}🔧 Backend API: http://localhost:$BACKEND_PORT${NC}"
echo -e "${BLUE}📚 Documentation: README.md${NC}"
echo -e "${BLUE}🎯 Demo Users: alice/password123, bob/password123, admin/admin123${NC}"
echo -e "${BLUE}🎫 Demo Coupon: WELCOME20 (20% off, min $50 purchase)${NC}"
echo ""
echo -e "${YELLOW}💡 Press Ctrl+C to stop all servers${NC}"
echo -e "${YELLOW}💡 Use ./stop_app.sh to stop the application${NC}"
echo ""

# Keep script running but allow background processes
echo -e "${BLUE}📝 Logs are being written to backend.log and frontend.log${NC}"
echo -e "${BLUE}🔄 Servers are running in the background...${NC}"

# Don't use wait - let the script exit and keep processes running
echo -e "${GREEN}✅ Startup complete! Application is running.${NC}" 
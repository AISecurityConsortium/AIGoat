#!/bin/bash

# Red Team Shop - Optimized Startup Script v2.0
# This script initializes and starts both the Django backend and React frontend servers
# with comprehensive optimizations for performance, reliability, and user experience

set -e  # Exit on error

# Script version and compatibility
SCRIPT_VERSION="2.0.0"
MIN_BASH_VERSION="3.2"
COMPATIBLE_OS=("linux" "macos" "windows")

# Colors for output (used in main script, not in help)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Load environment variables from .env file
if [[ -f ".env" ]]; then
    set -a  # automatically export all variables
    source .env
    set +a  # stop automatically exporting
fi

# Configuration variables with environment variable support
DEFAULT_BACKEND_PORT=${BACKEND_PORT:-8000}
DEFAULT_FRONTEND_PORT=${FRONTEND_PORT:-3000}
DEFAULT_OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://localhost:11434}
DEFAULT_REACT_APP_API_URL=${REACT_APP_API_URL:-http://localhost:8000}
HEALTH_CHECK_TIMEOUT=30
MAX_RETRIES=5
INITIAL_SLEEP=2
RETRY_INTERVAL=3
PROGRESS_UPDATE_INTERVAL=1

# Process tracking (using simple arrays for compatibility)
PROCESSES=()
PROCESS_PORTS=()
PROCESS_LOGS=()
SERVICE_NAMES=()

# Logging configuration
LOG_LEVEL=${LOG_LEVEL:-"INFO"}
LOG_FORMAT=${LOG_FORMAT:-"json"}
VERBOSE=${VERBOSE:-false}

# Interactive mode
INTERACTIVE=${INTERACTIVE:-false}

# Resource limits
MAX_MEMORY_MB=${MAX_MEMORY_MB:-2048}
MAX_CPU_PERCENT=${MAX_CPU_PERCENT:-80}

# Help and usage information
show_help() {
    cat << EOF
Red Team Shop - Startup Script v$SCRIPT_VERSION
==============================================


USAGE:
    ./start_app.sh [OPTIONS]

DESCRIPTION:
    This script initializes and starts both the Django backend and React frontend servers
    with comprehensive optimizations for performance, reliability, and user experience.

OPTIONS:
    -h, --help              Show this help message and exit
    -v, --version           Show version information and exit
    --verbose               Enable verbose logging output
    --quiet                 Suppress non-essential output
    --interactive           Enable interactive mode after startup
    --no-ollama-check       Skip Ollama availability check
    --no-db-init            Skip database initialization
    --backend-port PORT     Set backend port (default: $DEFAULT_BACKEND_PORT)
    --frontend-port PORT    Set frontend port (default: $DEFAULT_FRONTEND_PORT)

ENVIRONMENT VARIABLES:
    The following environment variables can be set in a .env file or exported:

    Backend Configuration:
    BACKEND_PORT              Backend server port (default: $DEFAULT_BACKEND_PORT)
    FRONTEND_PORT             Frontend server port (default: $DEFAULT_FRONTEND_PORT)
    SECRET_KEY                Django secret key
    DEBUG                     Enable Django debug mode (true/false)
    ALLOWED_HOSTS             Comma-separated list of allowed hosts

    Ollama Configuration:
    OLLAMA_BASE_URL           Ollama server URL (default: $DEFAULT_OLLAMA_BASE_URL)
    OLLAMA_MODEL              LLM model to use (default: mistral)
    OLLAMA_TEMPERATURE        LLM temperature (0.0-1.0, default: 0.7)
    OLLAMA_TOP_P              LLM top_p parameter (0.0-1.0, default: 0.9)
    OLLAMA_TOP_K              LLM top_k parameter (default: 40)
    OLLAMA_NUM_PREDICT        LLM max tokens to predict (default: 512)
    OLLAMA_MAX_INPUT_LENGTH   LLM max input length (default: 2048)
    OLLAMA_TIMEOUT            LLM request timeout in seconds (default: 30)

    Frontend Configuration:
    REACT_APP_API_URL         Backend API URL for frontend (default: $DEFAULT_REACT_APP_API_URL)
    DANGEROUSLY_DISABLE_HOST_CHECK  Disable host header validation (for AWS deployment)
    HOST                        Bind React dev server to specific host (0.0.0.0 for all interfaces)
    WDS_SOCKET_HOST            Webpack dev server socket host
    WDS_SOCKET_PORT            Webpack dev server socket port
    HTTPS                      Enable HTTPS for React dev server (true/false)

    Logging Configuration:
    LOG_LEVEL                 Log level (DEBUG, INFO, WARN, ERROR, default: INFO)
    LOG_FORMAT                Log format (json, text, default: json)
    VERBOSE                   Enable verbose mode (true/false, default: false)

    Resource Limits:
    MAX_MEMORY_MB             Maximum memory usage in MB (default: 2048)
    MAX_CPU_PERCENT           Maximum CPU usage percentage (default: 80)

    Interactive Mode:
    INTERACTIVE               Enable interactive mode (true/false, default: false)

EXAMPLES:
    # Start with default settings
    ./start_app.sh

    # Start with custom ports
    ./start_app.sh --backend-port 8080 --frontend-port 3001

    # Start with verbose logging
    ./start_app.sh --verbose

    # Start in quiet mode
    ./start_app.sh --quiet

    # Start with interactive mode
    ./start_app.sh --interactive

    # Start without Ollama check
    ./start_app.sh --no-ollama-check

    # Start without database initialization
    ./start_app.sh --no-db-init

    # Use environment variables
    BACKEND_PORT=8080 FRONTEND_PORT=3001 ./start_app.sh

DEMO CREDENTIALS:
    Users:
    - alice/password123 (Demo User)
    - bob/password123 (Demo User)
    - charlie/password123 (Demo User)
    - frank/password123 (Demo User)
    - admin/admin123 (Admin User)

    Demo Coupon:
    - WELCOME20 (20% off, minimum \$0 purchase)

INTERACTIVE COMMANDS:
    When interactive mode is enabled, you can use these commands:
    - status    Show current service status
    - logs      Show recent log entries
    - restart   Restart all services
    - help      Show interactive help
    - exit      Exit interactive mode

FILES CREATED:
    - startup.log          Main startup log
    - backend.log          Backend server log
    - frontend.log         Frontend server log
    - backend.port         Backend port number
    - frontend.port        Frontend port number
    - backend.pid          Backend process ID
    - frontend.pid         Frontend process ID

STOPPING THE APPLICATION:
    Use Ctrl+C to stop all servers, or run:
    ./stop_app.sh

REQUIREMENTS:
    - Python 3.8+ with pip
    - Node.js 16+ with npm
    - Git (for package installation)
    - Ollama (optional, for AI features)

SUPPORT:
    For issues and documentation, see README.md

EOF
}

show_version() {
    cat << EOF
Red Team Shop - Startup Script
Version: $SCRIPT_VERSION
Minimum Bash Version: $MIN_BASH_VERSION
Compatible OS: ${COMPATIBLE_OS[*]}
EOF
}

# Environment variable validation and configuration display
validate_and_display_config() {
    echo -e "${BLUE}🔧 Validating configuration...${NC}"
    
    local errors=()
    local warnings=()
    
    # Validate BACKEND_PORT
    if [[ -n "${BACKEND_PORT:-}" ]] && ! [[ "${BACKEND_PORT}" =~ ^[0-9]+$ ]]; then
        errors+=("BACKEND_PORT must be a number (got: ${BACKEND_PORT})")
    fi
    
    # Validate FRONTEND_PORT
    if [[ -n "${FRONTEND_PORT:-}" ]] && ! [[ "${FRONTEND_PORT}" =~ ^[0-9]+$ ]]; then
        errors+=("FRONTEND_PORT must be a number (got: ${FRONTEND_PORT})")
    fi
    
    # Validate OLLAMA_BASE_URL
    if [[ -n "${OLLAMA_BASE_URL:-}" ]] && ! [[ "${OLLAMA_BASE_URL}" =~ ^https?:// ]]; then
        errors+=("OLLAMA_BASE_URL must start with http:// or https:// (got: ${OLLAMA_BASE_URL})")
    fi
    
    # Validate REACT_APP_API_URL
    if [[ -n "${REACT_APP_API_URL:-}" ]] && ! [[ "${REACT_APP_API_URL}" =~ ^https?:// ]]; then
        errors+=("REACT_APP_API_URL must start with http:// or https:// (got: ${REACT_APP_API_URL})")
    fi
    
    # Validate OLLAMA_MODEL
    if [[ -n "${OLLAMA_MODEL:-}" ]] && [[ "${OLLAMA_MODEL}" =~ [^a-zA-Z0-9_-] ]]; then
        warnings+=("OLLAMA_MODEL contains special characters (got: ${OLLAMA_MODEL})")
    fi
    
    # Validate LLM parameters
    if [[ -n "${OLLAMA_TEMPERATURE:-}" ]] && ! [[ "${OLLAMA_TEMPERATURE}" =~ ^[0-9]*\.?[0-9]+$ ]]; then
        errors+=("OLLAMA_TEMPERATURE must be a number (got: ${OLLAMA_TEMPERATURE})")
    fi
    
    if [[ -n "${OLLAMA_TOP_P:-}" ]] && ! [[ "${OLLAMA_TOP_P}" =~ ^[0-9]*\.?[0-9]+$ ]]; then
        errors+=("OLLAMA_TOP_P must be a number (got: ${OLLAMA_TOP_P})")
    fi
    
    if [[ -n "${OLLAMA_TOP_K:-}" ]] && ! [[ "${OLLAMA_TOP_K}" =~ ^[0-9]+$ ]]; then
        errors+=("OLLAMA_TOP_K must be a number (got: ${OLLAMA_TOP_K})")
    fi
    
    if [[ -n "${OLLAMA_NUM_PREDICT:-}" ]] && ! [[ "${OLLAMA_NUM_PREDICT}" =~ ^[0-9]+$ ]]; then
        errors+=("OLLAMA_NUM_PREDICT must be a number (got: ${OLLAMA_NUM_PREDICT})")
    fi
    
    if [[ -n "${OLLAMA_TIMEOUT:-}" ]] && ! [[ "${OLLAMA_TIMEOUT}" =~ ^[0-9]+$ ]]; then
        errors+=("OLLAMA_TIMEOUT must be a number (got: ${OLLAMA_TIMEOUT})")
    fi
    
    # Display errors
    if [[ ${#errors[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Configuration errors found:${NC}"
        for error in "${errors[@]}"; do
            echo -e "${RED}   • $error${NC}"
        done
        echo -e "${YELLOW}💡 Please fix these errors in your .env file and try again.${NC}"
        return 1
    fi
    
    # Display warnings
    if [[ ${#warnings[@]} -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Configuration warnings:${NC}"
        for warning in "${warnings[@]}"; do
            echo -e "${YELLOW}   • $warning${NC}"
        done
    fi
    
    # Display current configuration
    echo -e "${GREEN}✅ Configuration validated successfully${NC}"
    echo -e "${CYAN}📋 Current Configuration:${NC}"
    echo -e "${CYAN}   • Backend Port: ${DEFAULT_BACKEND_PORT}${NC}"
    echo -e "${CYAN}   • Frontend Port: ${DEFAULT_FRONTEND_PORT}${NC}"
    echo -e "${CYAN}   • Ollama URL: ${DEFAULT_OLLAMA_BASE_URL}${NC}"
    echo -e "${CYAN}   • API URL: ${DEFAULT_REACT_APP_API_URL}${NC}"
    echo -e "${CYAN}   • Ollama Model: ${OLLAMA_MODEL:-mistral}${NC}"
    echo -e "${CYAN}   • Temperature: ${OLLAMA_TEMPERATURE:-0.7}${NC}"
    echo -e "${CYAN}   • Top P: ${OLLAMA_TOP_P:-0.9}${NC}"
    echo -e "${CYAN}   • Top K: ${OLLAMA_TOP_K:-40}${NC}"
    echo -e "${CYAN}   • Max Tokens: ${OLLAMA_NUM_PREDICT:-500}${NC}"
    echo -e "${CYAN}   • Timeout: ${OLLAMA_TIMEOUT:-60}s${NC}"
}

# Version and compatibility check
check_compatibility() {
    echo -e "${BLUE}🔍 Checking script compatibility...${NC}"
    
    # Check Bash version
    if [[ ${BASH_VERSION%%.*} -lt ${MIN_BASH_VERSION%%.*} ]]; then
        echo -e "${RED}❌ Bash version ${BASH_VERSION} is too old. Required: ${MIN_BASH_VERSION}+${NC}"
        exit 1
    fi
    
    # Check OS compatibility
    local os=$(detect_os)
    if [[ ! " ${COMPATIBLE_OS[@]} " =~ " ${os} " ]]; then
        echo -e "${YELLOW}⚠️  OS '$os' may not be fully supported${NC}"
    fi
    
    echo -e "${GREEN}✅ Compatibility check passed${NC}"
}

# Structured logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [[ "$LOG_FORMAT" == "json" ]]; then
        echo "{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"message\":\"$message\"}" >> startup.log
    else
        echo "[$timestamp] [$level] $message" >> startup.log
    fi
    
    if [[ "$VERBOSE" == "true" || "$level" == "ERROR" || "$level" == "WARN" ]]; then
        case $level in
            "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
            "WARN") echo -e "${YELLOW}[WARN]${NC} $message" ;;
            "INFO") echo -e "${BLUE}[INFO]${NC} $message" ;;
            "DEBUG") echo -e "${PURPLE}[DEBUG]${NC} $message" ;;
        esac
    fi
}

# Progress indicator
show_progress() {
    local current=$1
    local total=$2
    local description=$3
    local percent=$((current * 100 / total))
    
    # Simple progress indicator without dynamic updates
    echo -e "${CYAN}Progress: [$current/$total] $percent% - $description${NC}"
}

# Enhanced port checking with better error handling
check_port() {
    local port=$1
    local service_name=${2:-"service"}
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "WARN" "Port $port is already in use by $service_name"
        return 1
    else
        log "DEBUG" "Port $port is available"
        return 0
    fi
}

# Find available port with intelligent selection
find_available_port() {
    local preferred_port=$1
    local service_name=$2
    local port=$preferred_port
    local max_attempts=10
    
    for ((i=0; i<max_attempts; i++)); do
        if check_port $port "$service_name"; then
            echo $port
            return 0
        fi
        port=$((port + 1))
    done
    
    log "ERROR" "Could not find available port starting from $preferred_port"
    return 1
}

# Generic health check function with exponential backoff
check_service_health() {
    local url=$1
    local service_name=$2
    local max_retries=${3:-$MAX_RETRIES}
    local timeout=${4:-$HEALTH_CHECK_TIMEOUT}
    
    log "INFO" "Checking health of $service_name at $url"
    
    for ((retry=1; retry<=max_retries; retry++)); do
        if curl -s --max-time $timeout "$url" > /dev/null 2>&1; then
            log "INFO" "$service_name is healthy"
            return 0
        fi
        
        if [[ $retry -lt $max_retries ]]; then
            local sleep_time=$((INITIAL_SLEEP * (2 ** (retry - 1))))
            log "DEBUG" "$service_name not ready, retrying in ${sleep_time}s (attempt $retry/$max_retries)"
            sleep $sleep_time
        fi
    done
    
    log "ERROR" "$service_name failed health check after $max_retries attempts"
    return 1
}

# Function to check Linux system packages
check_linux_packages() {
    local os=$(detect_os)
    if [[ "$os" =~ ^linux ]]; then
        log "INFO" "Checking Linux system packages..."
        
        # Check for curl
        if ! command -v curl &> /dev/null; then
            log "WARN" "curl not found. Installing..."
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y curl
            elif command -v yum &> /dev/null; then
                sudo yum install -y curl
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y curl
            else
                log "ERROR" "Please install curl manually"
                return 1
            fi
        fi
        
        # Check for lsof
        if ! command -v lsof &> /dev/null; then
            log "WARN" "lsof not found. Installing..."
            if command -v apt-get &> /dev/null; then
                sudo apt-get install -y lsof
            elif command -v yum &> /dev/null; then
                sudo yum install -y lsof
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y lsof
            else
                log "ERROR" "Please install lsof manually"
                return 1
            fi
        fi
        
        log "INFO" "Linux system packages are available"
    fi
}

# Enhanced OS detection with more details
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v lsb_release &> /dev/null; then
            local distro=$(lsb_release -si 2>/dev/null | tr '[:upper:]' '[:lower:]')
            echo "linux-$distro"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        local macos_version=$(sw_vers -productVersion 2>/dev/null | cut -d. -f1,2)
        echo "macos-$macos_version"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Enhanced Python detection with version validation
detect_python() {
    local python_cmd=""
    
    # Function to compare version numbers
    version_ge() {
        local version=$1
        local min_version=$2
        
        # Convert version to comparable format (e.g., 3.13 -> 313, 3.8 -> 308)
        local ver_major=$(echo "$version" | cut -d. -f1)
        local ver_minor=$(echo "$version" | cut -d. -f2)
        local min_major=$(echo "$min_version" | cut -d. -f1)
        local min_minor=$(echo "$min_version" | cut -d. -f2)
        
        # Compare major version first
        if [[ $ver_major -gt $min_major ]]; then
            return 0
        elif [[ $ver_major -eq $min_major ]] && [[ $ver_minor -ge $min_minor ]]; then
            return 0
        else
            return 1
        fi
    }
    
    # Try python3 first
    if command -v python3 &> /dev/null; then
        local version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
        if version_ge "$version" "3.8"; then
            python_cmd="python3"
        fi
    fi
    
    # Fallback to python if python3 not suitable
    if [[ -z "$python_cmd" ]] && command -v python &> /dev/null; then
        local version=$(python --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
        if version_ge "$version" "3.8"; then
            python_cmd="python"
        fi
    fi
    
    if [[ -n "$python_cmd" ]]; then
        echo "$python_cmd"
    else
        return 1
    fi
}

# Resource detection and validation
detect_resources() {
    log "INFO" "Detecting system resources..."
    
    # Memory detection
    local total_memory=0
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        total_memory=$(free -m | awk 'NR==2{print $2}')
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        total_memory=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024)}')
    fi
    
    if [[ $total_memory -lt 2048 ]]; then
        log "WARN" "Low memory detected: ${total_memory}MB (recommended: 2GB+)"
    fi
    
    # CPU detection
    local cpu_cores=0
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        cpu_cores=$(nproc)
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        cpu_cores=$(sysctl -n hw.ncpu)
    fi
    
    log "INFO" "System resources: ${total_memory}MB RAM, ${cpu_cores} CPU cores"
}


# Input validation and sanitization
validate_input() {
    local input=$1
    local type=$2
    
    case $type in
        "port")
            if ! [[ "$input" =~ ^[0-9]+$ ]] || [[ $input -lt 1 ]] || [[ $input -gt 65535 ]]; then
                log "ERROR" "Invalid port number: $input"
                return 1
            fi
            ;;
        "url")
            if ! [[ "$input" =~ ^https?:// ]]; then
                log "ERROR" "Invalid URL format: $input"
                return 1
            fi
            ;;
        "path")
            if [[ "$input" =~ \.\. ]] || [[ "$input" =~ \/\/ ]]; then
                log "ERROR" "Invalid path: $input"
                return 1
            fi
            ;;
    esac
    
    return 0
}

# Generic service starter with process isolation
start_service() {
    local service_type=$1
    local port=$2
    local start_command=$3
    local service_name=$4
    local log_file=$5
    
    log "INFO" "Starting $service_name on port $port"
    
    # Validate inputs
    validate_input "$port" "port"
    validate_input "$service_name" "path"
    
    # Create process group for better management
    set -m  # Enable job control
    
    # Start service in background with process group
    {
        cd "$(dirname "$0")"
        eval "$start_command" > "$log_file" 2>&1 &
        local pid=$!
        echo $pid > "${service_name}.pid"
        echo $port > "${service_name}.port"
        
        # Store process information
        SERVICE_NAMES+=("$service_name")
        PROCESSES+=("$pid")
        PROCESS_PORTS+=("$port")
        PROCESS_LOGS+=("$log_file")
        
        log "INFO" "$service_name started with PID $pid"
    } &
    
    # Wait for service to be ready
    local health_url=""
    case $service_type in
        "backend")
            health_url="${DEFAULT_REACT_APP_API_URL}/api/products/"
            ;;
        "frontend")
            health_url="${DEFAULT_REACT_APP_API_URL}"
            ;;
    esac
    
    if [[ -n "$health_url" ]]; then
        if check_service_health "$health_url" "$service_name"; then
            log "INFO" "$service_name is ready"
            return 0
        else
            log "ERROR" "$service_name failed to start properly"
            return 1
        fi
    fi
    
    return 0
}

# Enhanced application initialization
initialize_app() {
    log "INFO" "Initializing Red Team Shop application..."
    show_progress 1 10 "Checking prerequisites"
    
    # Check if backend directory exists
    if [[ ! -d "backend" ]]; then
        log "ERROR" "Backend directory not found"
        return 1
    fi
    
    show_progress 2 10 "Setting up virtual environment"
    
    # Enhanced virtual environment setup with detection
    if [[ -d "venv" ]]; then
        log "INFO" "Existing virtual environment detected at 'venv/'"

        # Verify it's a valid virtual environment
        if [[ -f "venv/bin/activate" ]] || [[ -f "venv/Scripts/activate" ]]; then
            log "SUCCESS" "Valid virtual environment found - will reuse existing venv"
            log "INFO" "Note: Virtual environment will be activated automatically by the script"
        else
            log "WARN" "Invalid virtual environment detected - will recreate"
            log "INFO" "Removing invalid virtual environment..."
            rm -rf venv
        fi
    else
        log "INFO" "No virtual environment found - will create new one"
    fi
    
    # Create virtual environment if it doesn't exist or was invalid
    if [[ ! -d "venv" ]]; then
        log "INFO" "Creating new virtual environment..."
        local python_cmd=$(detect_python)
        if [[ -z "$python_cmd" ]]; then
            log "ERROR" "No suitable Python installation found"
            return 1
        fi
        
        log "INFO" "Using Python command: $python_cmd"
        if ! $python_cmd -m venv venv; then
            log "ERROR" "Failed to create virtual environment"
            return 1
        fi
        log "SUCCESS" "Virtual environment created successfully"
    fi
    
    show_progress 3 10 "Activating virtual environment"
    
    # Activate virtual environment with cross-platform support
    if [[ -f "venv/bin/activate" ]]; then
        log "INFO" "Activating virtual environment (Unix/Linux/macOS)..."
        source venv/bin/activate
    elif [[ -f "venv/Scripts/activate" ]]; then
        log "INFO" "Activating virtual environment (Windows)..."
        source venv/Scripts/activate
    else
        log "ERROR" "Virtual environment activation script not found"
        return 1
    fi
    
    # Verify activation
    if [[ -n "$VIRTUAL_ENV" ]]; then
        log "SUCCESS" "Virtual environment activated: $VIRTUAL_ENV"
    else
        log "WARN" "Virtual environment activation may have failed"
    fi
    
    show_progress 4 10 "Setting up environment configuration"
    
    # Create .env file if it doesn't exist
    if [[ ! -f ".env" ]] && [[ -f "env.example" ]]; then
        log "INFO" "Creating .env file from template"
        cp env.example .env
    fi
    
    show_progress 5 10 "Installing dependencies"
    
    # Enhanced dependency installation
    local requirements_file=""
    if [[ -f "requirements.txt" ]]; then
        requirements_file="requirements.txt"
    elif [[ -f "backend/requirements.txt" ]]; then
        requirements_file="backend/requirements.txt"
    fi
    
    if [[ -n "$requirements_file" ]]; then
        log "INFO" "Installing Python dependencies from $requirements_file"
        if ! pip install -r "$requirements_file" --quiet; then
            log "WARN" "Some dependencies may have failed to install"
        fi
    else
        log "INFO" "Installing core Django dependencies"
        pip install django djangorestframework django-cors-headers Pillow requests python-dotenv --quiet
    fi
    
    show_progress 6 10 "Setting up product images"
    
    # Product images already exist in backend/media/
    cd backend
    if [[ -d "media" ]] && [[ -f "media/The \"Code Break\" Hacker Cap (Hacker Cap).png" ]]; then
        log "INFO" "Product images already configured"
    else
        log "WARN" "Product images may be missing"
    fi
    
    # RTS logo check
    if [[ -f "media/rts-logo.png" ]]; then
        log "INFO" "RTS logo found in media folder"
    else
        log "WARN" "RTS logo not found in media folder"
    fi
    
    show_progress 7 10 "Running database migrations"
    
    # Run migrations with better error handling
    local python_cmd="venv/bin/python"
    if [[ ! -f "$python_cmd" ]]; then
        python_cmd=$(detect_python)
        if [[ -z "$python_cmd" ]]; then
            log "ERROR" "No suitable Python installation found"
            return 1
        fi
    fi
    
    if ! $python_cmd manage.py migrate; then
        log "ERROR" "Database migration failed"
        return 1
    fi
    
    show_progress 8 10 "Initializing application data"
    
    # Initialize application data (skip if flag is set)
    if [[ "$SKIP_DB_INIT" == "true" ]]; then
        log "INFO" "Skipping database initialization (--no-db-init flag set)"
    else
        # Suppress verbose output from knowledge base syncing
        if ! $python_cmd manage.py initialize_app 2>/dev/null; then
            log "WARN" "Application initialization had issues, but continuing..."
        fi
    fi
    
    show_progress 9 10 "Validating setup"
    
    # Return to root directory
    cd ..
    
    show_progress 10 10 "Initialization complete"
    
    log "INFO" "Application initialization completed successfully"
    return 0
}

# Enhanced backend startup
start_backend() {
    log "INFO" "Starting Django Backend..."
    
    local backend_port=${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}
    backend_port=$(find_available_port $backend_port "backend")
    
    local python_cmd="venv/bin/python"
    if [[ ! -f "$python_cmd" ]]; then
        python_cmd=$(detect_python)
        if [[ -z "$python_cmd" ]]; then
            log "ERROR" "No suitable Python installation found for backend"
            return 1
        fi
    fi
    local start_command="cd backend && ../venv/bin/python manage.py runserver 0.0.0.0:$backend_port"
    
    if start_service "backend" "$backend_port" "$start_command" "backend" "backend.log"; then
        log "INFO" "Backend started successfully on port $backend_port"
        return 0
    else
        log "ERROR" "Failed to start backend"
        return 1
    fi
}

# Enhanced frontend startup
start_frontend() {
    log "INFO" "Starting React Frontend..."
    
    if [[ ! -d "frontend" ]]; then
        log "ERROR" "Frontend directory not found"
        return 1
    fi
    
    cd frontend
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log "INFO" "Installing Node.js dependencies..."
        if ! npm install --silent; then
            log "ERROR" "Failed to install Node.js dependencies"
            cd ..
            return 1
        fi
    fi
    
    cd ..
    
    local frontend_port=${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}
    frontend_port=$(find_available_port $frontend_port "frontend")
    
    # Set React environment variables from main .env file
    local react_env=""
    if [[ -n "$DANGEROUSLY_DISABLE_HOST_CHECK" ]]; then
        react_env="$react_env DANGEROUSLY_DISABLE_HOST_CHECK=$DANGEROUSLY_DISABLE_HOST_CHECK"
    fi
    if [[ -n "$HOST" ]]; then
        react_env="$react_env HOST=$HOST"
    fi
    if [[ -n "$WDS_SOCKET_HOST" ]]; then
        react_env="$react_env WDS_SOCKET_HOST=$WDS_SOCKET_HOST"
    fi
    if [[ -n "$WDS_SOCKET_PORT" ]]; then
        react_env="$react_env WDS_SOCKET_PORT=$WDS_SOCKET_PORT"
    fi
    if [[ -n "$HTTPS" ]]; then
        react_env="$react_env HTTPS=$HTTPS"
    fi
    
    local start_command="cd frontend && PORT=$frontend_port BROWSER=none$react_env npm start"
    
    if start_service "frontend" "$frontend_port" "$start_command" "frontend" "frontend.log"; then
        log "INFO" "Frontend started successfully on port $frontend_port"
        return 0
    else
        log "ERROR" "Failed to start frontend"
        return 1
    fi
}

# Enhanced Ollama checking
check_ollama() {
    if [[ "$SKIP_OLLAMA_CHECK" == "true" ]]; then
        log "INFO" "Skipping Ollama check (--no-ollama-check flag set)"
        return 0
    fi
    
    log "INFO" "Checking Ollama AI service..."
    
    if ! command -v ollama &> /dev/null; then
        log "WARN" "Ollama not found. AI features will not work"
        return 0
    fi
    
    if curl -s ${DEFAULT_OLLAMA_BASE_URL}/api/tags > /dev/null 2>&1; then
        log "INFO" "Ollama service is running"
        
        local model_name=${OLLAMA_MODEL:-mistral}
        if ollama list | grep -q "$model_name"; then
            log "INFO" "$model_name model is available"
        else
            log "WARN" "$model_name model not found"
        fi
    else
        log "WARN" "Ollama service is not running"
    fi
}

# Enhanced cleanup with process groups
cleanup() {
    log "INFO" "Cleaning up processes..."
    
    for i in "${!SERVICE_NAMES[@]}"; do
        local service_name="${SERVICE_NAMES[$i]}"
        local pid="${PROCESSES[$i]}"
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log "INFO" "Stopping $service_name (PID: $pid)"
            kill -TERM "$pid" 2>/dev/null || true
            sleep 2
            kill -KILL "$pid" 2>/dev/null || true
        fi
        
        # Clean up PID and port files
        rm -f "${service_name}.pid" "${service_name}.port"
    done
    
    log "INFO" "Cleanup completed"
}

# Interactive mode for troubleshooting
interactive_mode() {
    if [[ "$INTERACTIVE" == "true" ]]; then
        echo -e "${CYAN}🔧 Interactive mode enabled${NC}"
        echo -e "${YELLOW}Available commands:${NC}"
        echo "  status  - Show service status"
        echo "  logs    - Show service logs"
        echo "  restart - Restart a service"
        echo "  help    - Show this help"
        echo "  exit    - Exit interactive mode"
        
        while true; do
            read -p "> " command
            case $command in
                "status")
                    for i in "${!SERVICE_NAMES[@]}"; do
                        local service="${SERVICE_NAMES[$i]}"
                        local pid="${PROCESSES[$i]}"
                        local port="${PROCESS_PORTS[$i]}"
                        if kill -0 "$pid" 2>/dev/null; then
                            echo -e "${GREEN}✅ $service: Running (PID: $pid, Port: $port)${NC}"
                        else
                            echo -e "${RED}❌ $service: Not running${NC}"
                        fi
                    done
                    ;;
                "logs")
                    read -p "Service name: " service_name
                    for i in "${!SERVICE_NAMES[@]}"; do
                        if [[ "${SERVICE_NAMES[$i]}" == "$service_name" ]]; then
                            local log_file="${PROCESS_LOGS[$i]}"
                            if [[ -f "$log_file" ]]; then
                                tail -f "$log_file"
                            else
                                echo "Log file not found for $service_name"
                            fi
                            break
                        fi
                    done
                    ;;
                "restart")
                    read -p "Service name: " service_name
                    for i in "${!SERVICE_NAMES[@]}"; do
                        if [[ "${SERVICE_NAMES[$i]}" == "$service_name" ]]; then
                            local pid="${PROCESSES[$i]}"
                            if [[ -n "$pid" ]]; then
                                kill -TERM "$pid" 2>/dev/null || true
                                sleep 2
                                echo "Restarting $service_name..."
                            fi
                            break
                        fi
                    done
                    ;;
                "help")
                    echo "Available commands: status, logs, restart, help, exit"
                    ;;
                "exit")
                    break
                    ;;
                *)
                    echo "Unknown command: $command"
                    ;;
            esac
        done
    fi
}

# Set up enhanced signal handling
setup_signal_handlers() {
    trap 'log "WARN" "Received interrupt signal"; cleanup; exit 1' INT TERM
    trap 'log "INFO" "Script exiting"; cleanup' EXIT
}

# Command line argument parsing
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                show_version
                exit 0
                ;;
            --verbose)
                VERBOSE=true
                LOG_LEVEL="DEBUG"
                shift
                ;;
            --quiet)
                VERBOSE=false
                LOG_LEVEL="ERROR"
                shift
                ;;
            --interactive)
                INTERACTIVE=true
                shift
                ;;
            --no-ollama-check)
                SKIP_OLLAMA_CHECK=true
                shift
                ;;
            --no-db-init)
                SKIP_DB_INIT=true
                shift
                ;;
            --backend-port)
                if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                    DEFAULT_BACKEND_PORT="$2"
                    shift 2
                else
                    echo -e "${RED}Error: --backend-port requires a valid port number${NC}" >&2
                    exit 1
                fi
                ;;
            --frontend-port)
                if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                    DEFAULT_FRONTEND_PORT="$2"
                    shift 2
                else
                    echo -e "${RED}Error: --frontend-port requires a valid port number${NC}" >&2
    exit 1
fi
                ;;
            *)
                echo -e "${RED}Error: Unknown option '$1'${NC}" >&2
                echo -e "${YELLOW}Use --help for usage information${NC}" >&2
                exit 1
                ;;
        esac
    done
}

# Main execution with comprehensive error handling
main() {
    # Parse command line arguments first
    parse_arguments "$@"
    echo -e "${BLUE}🚀 Starting Red Team Shop v$SCRIPT_VERSION...${NC}"
    echo "================================"
    
    # Initialize logging
    echo "{\"timestamp\":\"$(date -Iseconds)\",\"level\":\"INFO\",\"message\":\"Script started\"}" > startup.log
    
    # Run all checks and setup
    check_compatibility
    check_linux_packages
    detect_resources
    if ! validate_and_display_config; then
        log "ERROR" "Configuration validation failed"
    exit 1
fi
    setup_signal_handlers
    
    # Initialize application
    if ! initialize_app; then
        log "ERROR" "Application initialization failed"
    exit 1
fi
    
    # Start services in parallel
    log "INFO" "Starting services in parallel..."
    start_backend &
    local backend_pid=$!
    start_frontend &
    local frontend_pid=$!
    wait

    # Check if services started successfully
    local backend_success=false
    local frontend_success=false
    
    # Check backend - verify PID file exists and process is actually running
    if [[ -f "backend.pid" ]]; then
        local backend_pid=$(cat backend.pid 2>/dev/null)
        if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
            backend_success=true
        fi
    fi
    
    # Check frontend - verify PID file exists and process is actually running
    if [[ -f "frontend.pid" ]]; then
        local frontend_pid=$(cat frontend.pid 2>/dev/null)
        if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
            frontend_success=true
        fi
fi

# Check Ollama
check_ollama

    # Display final status based on actual service status
echo ""
    if [[ "$backend_success" == "true" && "$frontend_success" == "true" ]]; then
echo -e "${GREEN}🎉 Red Team Shop is now running!${NC}"
echo "================================"

        local backend_port=$(cat backend.port 2>/dev/null || echo "$DEFAULT_BACKEND_PORT")
        local frontend_port=$(cat frontend.port 2>/dev/null || echo "$DEFAULT_FRONTEND_PORT")
        
        # Extract hostname from configured URLs for display
        local frontend_host=$(echo "$DEFAULT_REACT_APP_API_URL" | sed 's|http://||' | sed 's|https://||' | cut -d':' -f1)
        local backend_host=$(echo "$DEFAULT_REACT_APP_API_URL" | sed 's|http://||' | sed 's|https://||' | cut -d':' -f1)
        local ollama_host=$(echo "$DEFAULT_OLLAMA_BASE_URL" | sed 's|http://||' | sed 's|https://||' | cut -d':' -f1)
        
        # Use localhost as fallback if extraction fails
        frontend_host=${frontend_host:-localhost}
        backend_host=${backend_host:-localhost}
        ollama_host=${ollama_host:-localhost}

        echo -e "${BLUE}🌐 Frontend: http://$frontend_host:$frontend_port${NC}"
        echo -e "${BLUE}🔧 Backend API: http://$backend_host:$backend_port${NC}"
        echo -e "${BLUE}🤖 Ollama: ${DEFAULT_OLLAMA_BASE_URL}${NC}"
        echo -e "${BLUE}🎯 Demo Users: alice/password123, bob/password123, charlie/password123, frank/password123, admin/admin123${NC}"
        echo -e "${BLUE}🎫 Demo Coupon: WELCOME20 (20% off, min \$0 purchase)${NC}"
echo ""
echo -e "${YELLOW}💡 Use ./stop_app.sh to stop the application${NC}"
echo ""
        echo -e "${BLUE}📝 Logs are being written to startup.log, backend.log, and frontend.log${NC}"
echo -e "${BLUE}🔄 Servers are running in the background...${NC}"

        # Interactive mode if enabled
        interactive_mode
        
        log "INFO" "Startup completed successfully"
echo -e "${GREEN}✅ Startup complete! Application is running.${NC}" 
    else
        echo -e "${RED}❌ Red Team Shop startup failed!${NC}"
        echo "================================"
        echo -e "${YELLOW}Service Status:${NC}"
        if [[ "$backend_success" == "true" ]]; then
            echo -e "${GREEN}✅ Backend: Running${NC}"
        else
            echo -e "${RED}❌ Backend: Failed to start${NC}"
        fi
        if [[ "$frontend_success" == "true" ]]; then
            echo -e "${GREEN}✅ Frontend: Running${NC}"
        else
            echo -e "${RED}❌ Frontend: Failed to start${NC}"
        fi
        echo ""
        echo -e "${YELLOW}💡 Check the logs for more details:${NC}"
        echo -e "${BLUE}   • startup.log - Main startup log${NC}"
        echo -e "${BLUE}   • backend.log - Backend server log${NC}"
        echo -e "${BLUE}   • frontend.log - Frontend server log${NC}"
        echo ""
        echo -e "${YELLOW}💡 Try running ./stop_app.sh to clean up and try again${NC}"
        
        log "ERROR" "Startup failed - services did not start properly"
        exit 1
    fi 
}

# Execute main function
main "$@"
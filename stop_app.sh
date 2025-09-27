#!/bin/bash

# Red Team Shop - Optimized Stop Script
# This script stops both the Django backend and React frontend servers gracefully
# Usage: ./stop_app.sh [--clean-db] [--force] [--quiet]
#   --clean-db: Clean database and reset to initial state
#   --force: Force kill all processes without graceful shutdown
#   --quiet: Minimal output mode

set -e

# Script configuration
SCRIPT_VERSION="2.0.0"
SCRIPT_NAME="Red Team Shop Stop Script"

# Parse command line arguments
CLEAN_DB=false
FORCE_MODE=false
QUIET_MODE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean-db)
            CLEAN_DB=true
            shift
            ;;
        --force)
            FORCE_MODE=true
            shift
            ;;
        --quiet)
            QUIET_MODE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --clean-db    Clean database and reset to initial state"
            echo "  --force       Force kill all processes without graceful shutdown"
            echo "  --quiet       Minimal output mode"
            echo "  --verbose     Verbose output mode"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%H:%M:%S')
    
    if [[ "$QUIET_MODE" == true && "$level" != "ERROR" ]]; then
        return
    fi
    
    case $level in
        "INFO")
            echo -e "${BLUE}[$timestamp] ℹ️  $message${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[$timestamp] ✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp] ⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[$timestamp] ❌ $message${NC}"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == true ]]; then
                echo -e "${CYAN}[$timestamp] 🔍 $message${NC}"
            fi
            ;;
    esac
}

# Progress indicator
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    
    if [[ "$QUIET_MODE" == false ]]; then
        local percent=$((current * 100 / total))
        printf "\r${BLUE}Progress: [%3d%%] %s${NC}" "$percent" "$message"
        if [[ $current -eq $total ]]; then
            echo
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log "DEBUG" "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check for required tools
    for tool in lsof pgrep pkill ps; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log "ERROR" "Missing required tools: ${missing_tools[*]}"
        log "ERROR" "Please install the missing tools and try again"
        exit 1
    fi
    
    log "DEBUG" "All prerequisites satisfied"
}

# Get process PIDs by pattern
get_process_pids() {
    local pattern=$1
    pgrep -f "$pattern" 2>/dev/null || true
}

# Get process PIDs by port
get_port_pids() {
    local port=$1
    lsof -ti :$port 2>/dev/null || true
}

# Kill processes by PIDs
kill_processes() {
    local process_name=$1
    local graceful_timeout=${2:-2}
    local force_timeout=${3:-1}
    shift 3
    local pids=("$@")
    
    if [[ ${#pids[@]} -eq 0 ]]; then
        return 0
    fi
    
    log "INFO" "Stopping $process_name (PIDs: ${pids[*]})..."
    
    if [[ "$FORCE_MODE" == false ]]; then
        # Graceful shutdown
        for pid in "${pids[@]}"; do
            if timeout 1 ps -p $pid >/dev/null 2>&1; then
                kill $pid 2>/dev/null || true
            fi
        done
        
        # Wait for graceful shutdown with timeout
        local wait_count=0
        local max_wait=$((graceful_timeout * 10))  # 10 checks per second
        
        while [[ $wait_count -lt $max_wait ]]; do
            local remaining_pids=()
            for pid in "${pids[@]}"; do
                # Use timeout to prevent hanging on ps command
                if timeout 1 ps -p $pid >/dev/null 2>&1; then
                    remaining_pids+=($pid)
                fi
            done
            
            if [[ ${#remaining_pids[@]} -eq 0 ]]; then
                break
            fi
            
            sleep 0.1
            ((wait_count++))
        done
        
        # Force kill remaining processes
        if [[ $wait_count -eq $max_wait ]]; then
            log "WARN" "Processes still running, forcing shutdown..."
            for pid in "${pids[@]}"; do
                if timeout 1 ps -p $pid >/dev/null 2>&1; then
                    kill -9 $pid 2>/dev/null || true
                fi
            done
            sleep $force_timeout
        fi
    else
        # Force kill immediately
        for pid in "${pids[@]}"; do
            if timeout 1 ps -p $pid >/dev/null 2>&1; then
                kill -9 $pid 2>/dev/null || true
            fi
        done
        sleep $force_timeout
    fi
    
    log "SUCCESS" "$process_name stopped"
}

# Stop processes by pattern and port
stop_service() {
    local service_name=$1
    local pattern=$2
    local ports=("${@:3}")
    
    log "INFO" "Stopping $service_name..."
    
    # Collect all PIDs
    local all_pids=()
    
    # Get PIDs by pattern
    local pattern_pids=($(get_process_pids "$pattern"))
    all_pids+=("${pattern_pids[@]}")
    
    # Get PIDs by ports
    for port in "${ports[@]}"; do
        local port_pids=($(get_port_pids "$port"))
        all_pids+=("${port_pids[@]}")
    done
    
    # Remove duplicates
    local unique_pids=($(printf '%s\n' "${all_pids[@]}" | sort -u))
    
    # Kill processes
    if [[ ${#unique_pids[@]} -gt 0 ]]; then
        kill_processes "$service_name" 2 1 "${unique_pids[@]}"
    else
        log "WARN" "No $service_name processes found"
    fi
}

# Clean up temporary files created by start_app.sh
cleanup_temp_files() {
    log "INFO" "Starting temporary file cleanup..."
    
    # Ensure we're in the correct directory
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if ! cd "$script_dir"; then
        log "ERROR" "Failed to change to script directory: $script_dir"
        return 1
    fi
    
    local temp_files=(
        "backend.pid" "frontend.pid"
        "backend.port" "frontend.port"
        "backend.log" "frontend.log"
        "startup.log"
    )
    
    local cleaned_count=0
    local total_files=${#temp_files[@]}
    
    # Debug: List all files in current directory that match our patterns
    log "DEBUG" "Current directory: $(pwd)"
    log "DEBUG" "Total files to check: $total_files"
    log "DEBUG" "Files matching patterns: $(ls -la *.pid *.port *.log 2>/dev/null || echo 'No matching files found')"
    
    # Process each file individually with explicit error handling
    local i=0
    while [[ $i -lt $total_files ]]; do
        local temp_file="${temp_files[$i]}"
        log "DEBUG" "Processing file $((i+1))/$total_files: $temp_file"
        
        if [[ -f "$temp_file" ]]; then
            log "DEBUG" "File exists: $temp_file"
            if rm -f "$temp_file" 2>/dev/null; then
                log "INFO" "Removed temporary file: $temp_file"
                cleaned_count=$((cleaned_count + 1))
            else
                log "ERROR" "Failed to remove temporary file: $temp_file (permission denied?)"
                # Try with sudo if available (for debugging)
                if command -v sudo >/dev/null 2>&1; then
                    log "DEBUG" "Attempting with sudo..."
                    if sudo rm -f "$temp_file" 2>/dev/null; then
                        log "INFO" "Removed temporary file with sudo: $temp_file"
                        cleaned_count=$((cleaned_count + 1))
                    else
                        log "ERROR" "Failed to remove even with sudo: $temp_file"
                    fi
                fi
            fi
        else
            log "DEBUG" "Temporary file not found: $temp_file"
        fi
        
        i=$((i + 1))
        log "DEBUG" "Completed processing file $((i))/$total_files, continuing to next file..."
    done
    
    log "DEBUG" "Finished processing all $total_files files"
    
    # Final summary
    if [[ $cleaned_count -gt 0 ]]; then
        log "SUCCESS" "Cleaned up $cleaned_count out of $total_files temporary files"
    else
        log "INFO" "No temporary files to clean up (checked $total_files files)"
    fi
    
    # Verify cleanup by listing remaining files
    local remaining_files=$(ls -la *.pid *.port *.log 2>/dev/null | wc -l)
    if [[ $remaining_files -gt 0 ]]; then
        log "WARN" "Some temporary files may still remain:"
        ls -la *.pid *.port *.log 2>/dev/null || true
        
        # Try alternative cleanup method using find
        log "INFO" "Attempting alternative cleanup method..."
        local alt_cleaned=0
        
        # Use find to locate and remove files
        for pattern in "*.pid" "*.port" "*.log"; do
            while IFS= read -r -d '' file; do
                if [[ -f "$file" ]]; then
                    if rm -f "$file" 2>/dev/null; then
                        log "INFO" "Alternative method removed: $file"
                        ((alt_cleaned++))
                    fi
                fi
            done < <(find . -maxdepth 1 -name "$pattern" -type f -print0 2>/dev/null)
        done
        
        if [[ $alt_cleaned -gt 0 ]]; then
            log "SUCCESS" "Alternative cleanup removed $alt_cleaned additional files"
        fi
    else
        log "DEBUG" "All temporary files successfully cleaned up"
    fi
}

# Final verification
verify_shutdown() {
    log "INFO" "Verifying shutdown..."
    
    local backend_patterns=("manage.py runserver" "python.*manage.py")
    local frontend_patterns=("react-scripts" "node.*react-scripts")
    local ports=(3000 3001 8000 8001)
    
    local issues=()
    
    # Check for remaining processes (only if they actually exist)
    for pattern in "${backend_patterns[@]}"; do
        local pids=($(get_process_pids "$pattern"))
        if [[ ${#pids[@]} -gt 0 ]]; then
            issues+=("Backend processes still running (pattern: $pattern, PIDs: ${pids[*]})")
        fi
    done
    
    for pattern in "${frontend_patterns[@]}"; do
        local pids=($(get_process_pids "$pattern"))
        if [[ ${#pids[@]} -gt 0 ]]; then
            issues+=("Frontend processes still running (pattern: $pattern, PIDs: ${pids[*]})")
        fi
    done
    
    # Check for remaining ports (only if they actually have processes)
    for port in "${ports[@]}"; do
        local pids=($(get_port_pids "$port"))
        if [[ ${#pids[@]} -gt 0 ]]; then
            issues+=("Process still using port $port (PIDs: ${pids[*]})")
        fi
    done
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log "SUCCESS" "All processes stopped successfully"
        return 0
    else
        log "WARN" "Some issues detected:"
        for issue in "${issues[@]}"; do
            log "WARN" "  - $issue"
        done
        return 1
    fi
}

# Clean database and reset to initial state
clean_database() {
    log "INFO" "Starting database cleanup..."
    
    # Check if we're in the right directory
    if [[ ! -f "backend/manage.py" ]]; then
        log "ERROR" "backend/manage.py not found. Please run this script from the RedTeamShop directory."
        return 1
    fi
    
    # Check if virtual environment exists
    if [[ ! -d "venv" ]]; then
        log "ERROR" "Virtual environment not found. Please run ./start_app.sh first."
        return 1
    fi
    
    # Activate virtual environment
    log "INFO" "Activating virtual environment..."
    source venv/bin/activate
    
    # Change to backend directory
    cd backend
    
    # Confirm with user if not in non-interactive mode
    if [[ -t 0 && "$QUIET_MODE" == false ]]; then
        echo -e "${YELLOW}⚠️  WARNING: This will delete all user data except admin and demo users!${NC}"
        echo -e "${YELLOW}   - All reviews will be deleted${NC}"
        echo -e "${YELLOW}   - All users except admin and demo users will be deleted${NC}"
        echo -e "${YELLOW}   - All orders except demo user orders will be deleted${NC}"
        echo -e "${YELLOW}   - All customer submitted tips will be deleted${NC}"
        echo -e "${YELLOW}   - All admin-created coupons will be deleted${NC}"
        echo -e "${YELLOW}   - All RAG chat sessions will be deleted${NC}"
        echo ""
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "WARN" "Database cleanup cancelled"
            cd ..
            return 1
        fi
    fi
    
    log "INFO" "Creating database cleanup script..."
    
    # Create a temporary Python script for database cleanup
    cat > temp_cleanup.py << 'EOF'
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from shop.models import Review, Order, ProductTip, CouponUsage, Coupon, RAGChatSession

print("🗄️  Cleaning database...")

# Delete all reviews
review_count = Review.objects.count()
Review.objects.all().delete()
print(f"✅ Deleted {review_count} reviews")

# Delete all customer submitted tips/feedback
tip_count = ProductTip.objects.count()
ProductTip.objects.all().delete()
print(f"✅ Deleted {tip_count} customer submitted tips/feedback")

# Delete all coupon usage records
coupon_usage_count = CouponUsage.objects.count()
CouponUsage.objects.all().delete()
print(f"✅ Deleted {coupon_usage_count} coupon usage records")

# Delete all admin-created coupons
coupon_count = Coupon.objects.count()
Coupon.objects.all().delete()
print(f"✅ Deleted {coupon_count} admin-created coupons")

# Delete all RAG chat sessions
rag_session_count = RAGChatSession.objects.count()
RAGChatSession.objects.all().delete()
print(f"✅ Deleted {rag_session_count} RAG chat sessions")

# Delete orders from non-demo users (including frank)
demo_users = ['alice', 'bob', 'charlie', 'frank', 'admin']
demo_user_objects = User.objects.filter(username__in=demo_users)
non_demo_orders = Order.objects.exclude(user__in=demo_user_objects)
non_demo_order_count = non_demo_orders.count()
non_demo_orders.delete()
print(f"✅ Deleted {non_demo_order_count} orders from non-demo users")

# Delete users except admin and demo users
non_demo_users = User.objects.exclude(username__in=demo_users)
non_demo_user_count = non_demo_users.count()
non_demo_users.delete()
print(f"✅ Deleted {non_demo_user_count} non-demo users")

# Verify demo users still exist
remaining_users = User.objects.all()
print(f"✅ Remaining users: {', '.join([user.username for user in remaining_users])}")

print("🎉 Database cleanup completed successfully!")
EOF

    # Run the cleanup script
    log "INFO" "Executing database cleanup..."
    if python temp_cleanup.py; then
        log "SUCCESS" "Database cleanup completed successfully!"
        
        # Remove temporary script
        rm -f temp_cleanup.py
        
        # Reinitialize the database with fresh data (suppress verbose output)
        log "INFO" "Reinitializing database with fresh data..."
        if python manage.py initialize_app 2>/dev/null; then
            log "SUCCESS" "Database reinitialized successfully!"
        else
            log "ERROR" "Error reinitializing database"
            cd ..
            return 1
        fi
    else
        log "ERROR" "Error during database cleanup"
        rm -f temp_cleanup.py
        cd ..
        return 1
    fi
    
    # Go back to root directory
    cd ..
    
    log "SUCCESS" "Database reset complete!"
}

# Main execution
main() {
    if [[ "$QUIET_MODE" == false ]]; then
        echo -e "${BLUE}🛑 $SCRIPT_NAME v$SCRIPT_VERSION${NC}"
        if [[ "$CLEAN_DB" == true ]]; then
            echo -e "${BLUE}🧹 Database cleanup mode enabled${NC}"
        fi
        if [[ "$FORCE_MODE" == true ]]; then
            echo -e "${YELLOW}⚡ Force mode enabled${NC}"
        fi
        echo "================================"
    fi
    
    # Check prerequisites
    check_prerequisites
    
    show_progress 1 6 "Checking prerequisites"
    
    # Stop services in parallel
    show_progress 2 6 "Stopping services"
    
    # Stop backend and frontend simultaneously
    (
        stop_service "Django Backend" "manage.py runserver" 8000 8001
    ) &
    
    (
        stop_service "React Frontend" "react-scripts" 3000 3001
    ) &
    
    # Wait for both to complete
    wait
    
    show_progress 3 6 "Cleaning up temporary files"
    cleanup_temp_files
    
    show_progress 4 6 "Final verification"
    verify_shutdown
    
    show_progress 5 6 "Database cleanup (if requested)"
    if [[ "$CLEAN_DB" == true ]]; then
        clean_database
    fi
    
    show_progress 6 6 "Complete"
    
    if [[ "$QUIET_MODE" == false ]]; then
        echo ""
        log "SUCCESS" "Red Team Shop shutdown complete"
        echo "================================"
        echo -e "${BLUE}💡 To start the app again, run: ./start_app.sh${NC}"
        echo ""
    fi
}

# Signal handlers
trap 'log "WARN" "Script interrupted"; exit 130' INT TERM

# Run main function
main "$@"
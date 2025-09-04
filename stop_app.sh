#!/bin/bash

# Red Team Shop - Stop Script
# This script stops both the Django backend and React frontend servers gracefully
# Usage: ./stop_app.sh [--clean-db]
#   --clean-db: Clean database and reset to initial state

# Parse command line arguments
CLEAN_DB=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean-db)
            CLEAN_DB=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --clean-db    Clean database and reset to initial state"
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

echo "🛑 Stopping Red Team Shop..."
if [ "$CLEAN_DB" = true ]; then
    echo "🧹 Database cleanup mode enabled"
fi
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill process by PID file
kill_process() {
    local pid_file=$1
    local process_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${BLUE}🛑 Stopping $process_name (PID: $pid)...${NC}"
            # Try graceful shutdown first
            kill $pid
            sleep 2
            # Check if process is still running
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${YELLOW}⚠️  Process still running, forcing shutdown...${NC}"
                kill -9 $pid
                sleep 1
            fi
            rm "$pid_file"
            echo -e "${GREEN}✅ $process_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $process_name process not found${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${YELLOW}⚠️  No PID file found for $process_name${NC}"
    fi
}

# Function to kill processes by port gracefully
kill_by_port() {
    local port=$1
    local process_name=$2
    
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${BLUE}🛑 Stopping $process_name on port $port...${NC}"
        # Try graceful shutdown first
        echo $pids | xargs kill
        sleep 3
        # Check if processes are still running
        local remaining_pids=$(lsof -ti :$port 2>/dev/null)
        if [ ! -z "$remaining_pids" ]; then
            echo -e "${YELLOW}⚠️  Processes still running on port $port, forcing shutdown...${NC}"
            echo $remaining_pids | xargs kill -9
            sleep 1
        fi
        echo -e "${GREEN}✅ $process_name stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  No process found on port $port${NC}"
    fi
}

# Function to check if processes are still running
check_processes() {
    local process_pattern=$1
    local process_name=$2
    
    if pgrep -f "$process_pattern" > /dev/null; then
        echo -e "${YELLOW}⚠️  Found remaining $process_name processes, killing them...${NC}"
        pkill -f "$process_pattern"
        sleep 2
        # Force kill if still running
        if pgrep -f "$process_pattern" > /dev/null; then
            echo -e "${YELLOW}⚠️  Forcing shutdown of remaining $process_name processes...${NC}"
            pkill -9 -f "$process_pattern"
        fi
    fi
}

# Function to clean database and reset to initial state
clean_database() {
    echo -e "${BLUE}🗄️  Cleaning database and resetting to initial state...${NC}"
    
    # Check if we're in the right directory
    if [ ! -f "backend/manage.py" ]; then
        echo -e "${RED}❌ Error: backend/manage.py not found. Please run this script from the RedTeamShop directory.${NC}"
        return 1
    fi
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo -e "${RED}❌ Error: Virtual environment not found. Please run ./start_app.sh first.${NC}"
        return 1
    fi
    
    # Activate virtual environment
    echo -e "${BLUE}🔧 Activating virtual environment...${NC}"
    source venv/bin/activate
    
    # Change to backend directory
    cd backend
    
    # Confirm with user if not in non-interactive mode
    if [ -t 0 ]; then
        echo -e "${YELLOW}⚠️  WARNING: This will delete all user data except admin and demo users!${NC}"
        echo -e "${YELLOW}   - All reviews will be deleted${NC}"
        echo -e "${YELLOW}   - All users except admin and demo users will be deleted${NC}"
        echo -e "${YELLOW}   - All orders except demo user orders will be deleted${NC}"
        echo -e "${YELLOW}   - All product tips will be deleted${NC}"
        echo ""
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}🛑 Database cleanup cancelled${NC}"
            cd ..
            return 1
        fi
    fi
    
    echo -e "${BLUE}🧹 Starting database cleanup...${NC}"
    
    # Create a temporary Python script for database cleanup
    cat > temp_cleanup.py << 'EOF'
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from shop.models import Review, Order, ProductTip, CouponUsage, RAGChatSession

print("🗄️  Cleaning database...")

# Delete all reviews
review_count = Review.objects.count()
Review.objects.all().delete()
print(f"✅ Deleted {review_count} reviews")

# Delete all product tips
tip_count = ProductTip.objects.count()
ProductTip.objects.all().delete()
print(f"✅ Deleted {tip_count} product tips")

# Delete all coupon usage records
coupon_usage_count = CouponUsage.objects.count()
CouponUsage.objects.all().delete()
print(f"✅ Deleted {coupon_usage_count} coupon usage records")

# Delete all RAG chat sessions
rag_session_count = RAGChatSession.objects.count()
RAGChatSession.objects.all().delete()
print(f"✅ Deleted {rag_session_count} RAG chat sessions")

# Delete orders from non-demo users
demo_users = ['alice', 'bob', 'admin']
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
    if python temp_cleanup.py; then
        echo -e "${GREEN}✅ Database cleanup completed successfully!${NC}"
        
        # Remove temporary script
        rm -f temp_cleanup.py
        
        # Reinitialize the database with fresh data
        echo -e "${BLUE}🔄 Reinitializing database with fresh data...${NC}"
        if python manage.py initialize_app; then
            echo -e "${GREEN}✅ Database reinitialized successfully!${NC}"
        else
            echo -e "${RED}❌ Error reinitializing database${NC}"
            cd ..
            return 1
        fi
    else
        echo -e "${RED}❌ Error during database cleanup${NC}"
        rm -f temp_cleanup.py
        cd ..
        return 1
    fi
    
    # Go back to root directory
    cd ..
    
    echo -e "${GREEN}🎉 Database reset complete!${NC}"
    echo -e "${BLUE}💡 You can now start the app with: ./start_app.sh${NC}"
}

# Main execution
echo -e "${BLUE}🔍 Checking for running processes...${NC}"

# Stop backend processes
echo -e "${BLUE}🔧 Stopping Django Backend...${NC}"
kill_process "backend.pid" "Django Backend"
kill_by_port 8000 "Django Backend"
kill_by_port 8001 "Django Backend"
check_processes "manage.py runserver" "Django"

# Stop frontend processes
echo -e "${BLUE}🎨 Stopping React Frontend...${NC}"
kill_process "frontend.pid" "React Frontend"
kill_by_port 3000 "React Frontend"
kill_by_port 3001 "React Frontend"
check_processes "react-scripts" "React"

# Additional cleanup for any remaining processes
echo -e "${BLUE}🧹 Final cleanup...${NC}"

# Kill any remaining Node.js processes that might be related to our app
if pgrep -f "node.*react-scripts" > /dev/null; then
    echo -e "${YELLOW}⚠️  Found remaining Node.js processes, killing them...${NC}"
    pkill -f "node.*react-scripts"
    sleep 1
    pkill -9 -f "node.*react-scripts" 2>/dev/null
fi

# Kill any remaining Python processes that might be related to our app
if pgrep -f "python.*manage.py" > /dev/null; then
    echo -e "${YELLOW}⚠️  Found remaining Python processes, killing them...${NC}"
    pkill -f "python.*manage.py"
    sleep 1
    pkill -9 -f "python.*manage.py" 2>/dev/null
fi

# Final check for any processes on our ports
echo -e "${BLUE}🔍 Final port check...${NC}"
for port in 3000 3001 8000 8001; do
    if lsof -ti :$port > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Found process on port $port, forcing shutdown...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null
    fi
done

# Wait a moment for all processes to fully terminate
sleep 2

# Final verification
echo -e "${BLUE}✅ Verification...${NC}"
backend_running=false
frontend_running=false

if pgrep -f "manage.py runserver" > /dev/null; then
    backend_running=true
fi

if pgrep -f "react-scripts" > /dev/null; then
    frontend_running=true
fi

if [ "$backend_running" = false ] && [ "$frontend_running" = false ]; then
    echo -e "${GREEN}✅ All Red Team Shop processes stopped successfully${NC}"
else
    echo -e "${RED}❌ Some processes may still be running${NC}"
    if [ "$backend_running" = true ]; then
        echo -e "${RED}   - Backend processes still running${NC}"
    fi
    if [ "$frontend_running" = true ]; then
        echo -e "${RED}   - Frontend processes still running${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Red Team Shop shutdown complete${NC}"
echo "================================"

# Perform database cleanup if requested
if [ "$CLEAN_DB" = true ]; then
    echo ""
    clean_database
fi

echo -e "${BLUE}💡 To start the app again, run: ./start_app.sh${NC}"
echo "" 
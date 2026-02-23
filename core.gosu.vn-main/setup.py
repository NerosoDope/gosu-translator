#!/usr/bin/env python3
"""
GOSU Core Platform - Automated Setup Script

Script này tự động setup toàn bộ hệ thống Core Platform:
- Tạo môi trường và cài đặt dependencies
- Cấu hình database, JWT, và các secrets
- Tạo admin user và role với full permissions
- Khởi động services và chạy migrations

Usage:
    python setup.py                    # Setup toàn bộ hệ thống
    python setup.py --migrate          # Chỉ chạy migrations (cập nhật database schema)
    python setup.py --migrate-only     # Tương tự --migrate
    python setup.py -m                 # Tương tự --migrate

Author: GOSU Development Team
Version: 1.0.0
"""

import os
import sys
import subprocess
import secrets
import string
import time
import re
import getpass
import socket
from pathlib import Path
from typing import Optional, Dict, Any
from urllib.parse import quote, quote_plus

# Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text: str):
    """Print header with styling"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def print_success(text: str):
    """Print success message"""
    print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")

def print_error(text: str):
    """Print error message"""
    print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")

def print_warning(text: str):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")

def print_info(text: str):
    """Print info message"""
    print(f"{Colors.OKCYAN}ℹ {text}{Colors.ENDC}")

def print_step(step: int, total: int, text: str):
    """Print step information"""
    print(f"\n{Colors.OKBLUE}[{step}/{total}] {text}{Colors.ENDC}")

def generate_secret(length: int = 64) -> str:
    """Generate random secret string"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def get_input(prompt: str, default: Optional[str] = None, validator=None, required: bool = True, password: bool = False) -> str:
    """Get user input with validation"""
    while True:
        if default:
            full_prompt = f"{prompt} [{default}]: "
        else:
            full_prompt = f"{prompt}: "
        
        if password:
            value = getpass.getpass(full_prompt).strip()
        else:
            value = input(full_prompt).strip()
        
        if not value:
            if default:
                return default
            if required:
                print_error("Giá trị này là bắt buộc!")
                continue
            return ""
        
        if validator and not validator(value):
            continue
        
        return value

def check_dependencies() -> bool:
    """Check if required dependencies are installed"""
    print_step(1, 8, "Kiểm tra dependencies")
    
    dependencies = {
        'docker': 'Docker',
        'docker-compose': 'Docker Compose',
        'node': 'Node.js',
    }
    
    # Check Python - try python3 first, then python (Windows compatibility)
    python_cmd = None
    try:
        subprocess.run(['python3', '--version'], capture_output=True, check=True)
        python_cmd = 'python3'
        print_success("Python 3 đã được cài đặt (python3)")
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            subprocess.run(['python', '--version'], capture_output=True, check=True)
            python_cmd = 'python'
            print_success("Python 3 đã được cài đặt (python)")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print_error("Python 3 chưa được cài đặt")
            dependencies['python'] = 'Python 3'  # Add to missing list
    
    missing = []
    for cmd, name in dependencies.items():
        try:
            subprocess.run([cmd, '--version'], capture_output=True, check=True)
            print_success(f"{name} đã được cài đặt")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print_error(f"{name} chưa được cài đặt")
            missing.append(name)
    
    if missing:
        print_error(f"Vui lòng cài đặt các dependencies sau: {', '.join(missing)}")
        return False
    
    return True

def get_env_config() -> Dict[str, Any]:
    """Get environment configuration from user input (passwords, secrets)"""
    print_step(2, 9, "Nhập thông tin cấu hình môi trường (.env)")
    print_info("Các giá trị khác sẽ được lấy từ .env.example")
    
    config = {}
    
    print_info("\n🔐 Thông tin Database (bắt buộc):")
    config['db_password'] = get_input("Database Password", generate_secret(32), required=True, password=True)
    print_success("✓ Database password đã được nhập")
    
    print_info("\n🔐 Thông tin JWT (bắt buộc):")
    config['jwt_secret'] = get_input("JWT Secret Key", generate_secret(64), required=True)
    
    print_info("\n🔐 Thông tin GOSU API (bắt buộc):")
    config['gosu_secret'] = get_input("GOSU API Secret", generate_secret(32), required=True, password=True)
    print_success("✓ GOSU API secret đã được nhập")
    
    return config

def get_admin_config() -> Dict[str, Any]:
    """Get admin user configuration from user input"""
    print_step(3, 9, "Nhập thông tin Admin")
    
    config = {}
    
    print_info("\n👤 Thông tin Admin (bắt buộc):")
    while True:
        admin_email = get_input("Admin Email", required=True)
        if validate_email(admin_email):
            config['admin_email'] = admin_email
            break
        print_error("Email không hợp lệ! Vui lòng nhập lại.")
    
    config['admin_full_name'] = get_input("Admin Full Name", "Administrator")
    
    return config

def escape_env_value(value: str) -> str:
    """Escape value for .env file - quote if contains special characters or spaces"""
    # Docker Compose treats $ as variable expansion, need to escape it as $$
    # Also need to escape backslashes and quotes
    escaped = value.replace('\\', '\\\\').replace('$', '$$').replace('"', '\\"')
    
    # If value contains special characters, spaces, or starts with number, quote it
    if any(c in value for c in ' !@#$%^&*()[]{}|\\;"\'<>?`~') or value.startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')):
        return f'"{escaped}"'
    # Even if no special chars, still escape $ to prevent variable expansion
    if '$' in value:
        return f'"{escaped}"'
    return value

def create_env_file(env_config: Dict[str, Any], env_path: Path, example_path: Path):
    """Create .env file from .env.example and update with user-provided values"""
    print_step(4, 9, "Tạo file .env từ template")
    
    # Check if .env.example exists
    if not example_path.exists():
        print_error(f"File .env.example không tồn tại tại {example_path}")
        print_info("Tạo file .env mới với cấu hình mặc định...")
        # Fallback to creating from scratch
        return create_env_file_from_scratch(env_config, env_path)
    
    # Read .env.example
    env_content = example_path.read_text()
    
    # Generate MinIO credentials
    minio_access_key = generate_secret(16)
    minio_secret_key = generate_secret(32)
    
    # Build DATABASE_URL - need to URL-encode password properly
    # Use quote_plus (same as alembic/env.py uses) to properly encode special chars like %
    db_password_encoded = quote_plus(env_config['db_password'], safe='')
    db_url = f"postgresql+asyncpg://core_user:{db_password_encoded}@postgres:5432/core_db"
    
    # Replace placeholder values - order matters for DATABASE_URL
    # First replace DATABASE_URL (contains password placeholder)
    db_url_placeholder = 'postgresql+asyncpg://core_user:CHANGE_ME_STRONG_PASSWORD_32_CHARS_MIN@postgres:5432/core_db'
    env_content = env_content.replace(db_url_placeholder, escape_env_value(db_url))
    
    # Then replace individual values
    replacements = {
        'CHANGE_ME_STRONG_PASSWORD_32_CHARS_MIN': escape_env_value(env_config['db_password']),
        'CHANGE_ME_JWT_SECRET_64_CHARS_MIN': escape_env_value(env_config['jwt_secret']),
        'CHANGE_ME_GOSU_API_SECRET': escape_env_value(env_config['gosu_secret']),
        'CHANGE_ME_MINIO_ACCESS_KEY': escape_env_value(minio_access_key),
        'CHANGE_ME_MINIO_SECRET_KEY': escape_env_value(minio_secret_key),
    }
    
    # Apply replacements
    for old_value, new_value in replacements.items():
        env_content = env_content.replace(old_value, new_value)
    
    # Write .env file
    env_path.write_text(env_content)
    print_success(f"Đã tạo file .env tại {env_path}")
    print_info(f"MinIO Access Key: {minio_access_key}")
    print_info(f"MinIO Secret Key: {minio_secret_key}")

def create_env_file_from_scratch(env_config: Dict[str, Any], env_path: Path):
    """Fallback: Create .env file from scratch if .env.example doesn't exist"""
    # Build DATABASE_URL - need to URL-encode password properly
    # Use quote_plus (same as alembic/env.py uses) to properly encode special chars like %
    db_password_encoded = quote_plus(env_config['db_password'], safe='')
    db_url = f"postgresql+asyncpg://core_user:{db_password_encoded}@postgres:5432/core_db"
    
    # Generate MinIO credentials
    minio_access_key = generate_secret(16)
    minio_secret_key = generate_secret(32)
    
    env_content = f"""# Database Configuration
POSTGRES_PASSWORD={escape_env_value(env_config['db_password'])}
DATABASE_URL={escape_env_value(db_url)}

# JWT Configuration
JWT_SECRET_KEY={escape_env_value(env_config['jwt_secret'])}
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=7

# GOSU API Configuration
GOSU_API_URL=https://apis.gosu.vn
GOSU_APP_ID=UA
GOSU_SECRET={escape_env_value(env_config['gosu_secret'])}

# Application Configuration
APP_NAME=GOSU Core Platform
APP_VERSION=1.0.0
DEBUG=false
ENVIRONMENT=production
API_PORT=8000

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# MinIO Configuration
MINIO_ENDPOINT=http://minio:9000
MINIO_ROOT_USER={escape_env_value(minio_access_key)}
MINIO_ROOT_PASSWORD={escape_env_value(minio_secret_key)}
MINIO_ACCESS_KEY={escape_env_value(minio_access_key)}
MINIO_SECRET_KEY={escape_env_value(minio_secret_key)}
MINIO_BUCKET_NAME=core-files
MINIO_SECURE=false

# SSL Configuration
SSL_VERIFY=true
"""
    
    env_path.write_text(env_content)
    print_success(f"Đã tạo file .env tại {env_path}")
    print_info(f"MinIO Access Key: {minio_access_key}")
    print_info(f"MinIO Secret Key: {minio_secret_key}")

def check_port_available(port: int) -> bool:
    """Check if a port is available"""
    try:
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex(('localhost', port))
            return result != 0  # Port is available if connection fails
    except:
        # If check fails, assume port is available
        return True

def find_available_port(start_port: int, max_attempts: int = 10) -> int:
    """Find an available port starting from start_port"""
    for i in range(max_attempts):
        port = start_port + i
        if check_port_available(port):
            return port
    return None

def handle_minio_port_conflict(compose_path: Path) -> Optional[int]:
    """Handle MinIO port 9000 conflict - return new port or None to skip"""
    if check_port_available(9000):
        return 9000  # Port is available, use default
    
    print_warning("Port 9000 đang được sử dụng bởi service khác")
    print_info("Các lựa chọn:")
    print_info("  1. Đổi sang port khác (9002, 9003...)")
    print_info("  2. Bỏ qua MinIO (không expose port ra ngoài)")
    print_info("  3. Dừng container đang dùng port 9000")
    
    while True:
        choice = input(f"\n{Colors.OKCYAN}Chọn (1/2/3) [1]: {Colors.ENDC}").strip() or "1"
        
        if choice == "1":
            # Find available port
            new_port = find_available_port(9002, 10)
            if new_port:
                print_success(f"Sẽ sử dụng port {new_port} cho MinIO")
                return new_port
            else:
                print_error("Không tìm thấy port trống trong khoảng 9002-9012")
                continue
        elif choice == "2":
            print_info("Sẽ bỏ qua expose port MinIO (chỉ dùng trong Docker network)")
            return None
        elif choice == "3":
            # Try to stop container using port 9000
            print_info("Đang tìm và dừng container đang dùng port 9000...")
            try:
                # Find container using port 9000
                result = subprocess.run(
                    ['docker', 'ps', '--format', '{{.ID}}\t{{.Names}}\t{{.Ports}}'],
                    capture_output=True,
                    text=True,
                    check=True
                )
                for line in result.stdout.split('\n'):
                    if '9000' in line:
                        parts = line.split('\t')
                        if len(parts) >= 2:
                            container_id = parts[0]
                            container_name = parts[1]
                            print_info(f"Tìm thấy container: {container_name} ({container_id})")
                            response = input(f"Dừng container {container_name}? (y/N): ").strip().lower()
                            if response == 'y':
                                subprocess.run(['docker', 'stop', container_id], check=True)
                                print_success(f"Đã dừng container {container_name}")
                                time.sleep(2)  # Wait a bit for port to be released
                                if check_port_available(9000):
                                    return 9000
                print_warning("Không tìm thấy container Docker đang dùng port 9000")
                print_warning("Có thể là process khác đang dùng port này")
            except Exception as e:
                print_error(f"Lỗi khi dừng container: {e}")
            continue
        else:
            print_error("Lựa chọn không hợp lệ. Vui lòng chọn 1, 2, hoặc 3.")

def setup_docker_compose(compose_path: Path) -> Path:
    """Setup Docker Compose services. Returns the compose file path to use."""
    print_step(5, 9, "Khởi động Docker services")
    
    try:
        # Stop existing containers first to avoid port conflicts
        print_info("Đang dừng các container cũ (nếu có)...")
        subprocess.run(
            ['docker-compose', '-f', str(compose_path), 'down'],
            cwd=compose_path.parent,
            capture_output=True,
            text=True
        )
        
        # Check if postgres volume exists and warn about password change
        # PostgreSQL only sets password on first initialization
        # If volume exists with old password, need to recreate
        postgres_volume = f"{compose_path.parent.name}_postgres_data"
        result = subprocess.run(
            ['docker', 'volume', 'ls', '--format', '{{.Name}}'],
            capture_output=True,
            text=True,
            check=True
        )
        if postgres_volume in result.stdout:
            print_warning(f"PostgreSQL volume '{postgres_volume}' đã tồn tại.")
            print_warning("Nếu password đã thay đổi, cần recreate container để áp dụng password mới.")
            response = input(f"{Colors.WARNING}Bạn có muốn xóa volume cũ và tạo lại? (y/N): {Colors.ENDC}").strip().lower()
            if response == 'y':
                print_info("Đang xóa PostgreSQL volume...")
                subprocess.run(
                    ['docker', 'volume', 'rm', postgres_volume],
                    capture_output=True,
                    text=True
                )
                print_success("Đã xóa PostgreSQL volume. Container sẽ được tạo lại với password mới.")
            else:
                print_info("Giữ nguyên volume cũ. Đảm bảo password trong .env khớp với password cũ.")
        
        # Check and handle MinIO port conflict
        minio_port = handle_minio_port_conflict(compose_path)
        compose_file_to_use = compose_path
        
        if minio_port != 9000 and minio_port is not None:
            # Need to modify docker-compose.yml temporarily
            print_info(f"Tạm thời đổi MinIO port sang {minio_port}...")
            # Read docker-compose.yml
            compose_content = compose_path.read_text()
            # Replace port mapping
            compose_content = compose_content.replace('"9000:9000"', f'"{minio_port}:9000"')
            # Write to temp file
            temp_compose = compose_path.parent / "docker-compose.temp.yml"
            temp_compose.write_text(compose_content)
            compose_file_to_use = temp_compose
        elif minio_port is None:
            # Remove port mapping for MinIO
            print_info("Bỏ qua expose port MinIO...")
            compose_content = compose_path.read_text()
            # Remove MinIO ports section - more robust regex
            import re
            # Match the ports section for minio service
            pattern = r'(minio:.*?ports:\s*\n\s*- "9000:9000"\s*\n\s*- "9001:9001")'
            compose_content = re.sub(pattern, lambda m: m.group(1).split('ports:')[0], compose_content, flags=re.DOTALL)
            temp_compose = compose_path.parent / "docker-compose.temp.yml"
            temp_compose.write_text(compose_content)
            compose_file_to_use = temp_compose
        
        # Build and start services
        print_info("Đang build và khởi động Docker services...")
        result = subprocess.run(
            ['docker-compose', '-f', str(compose_file_to_use), 'up', '-d', '--build'],
            check=True,
            cwd=compose_path.parent,
            capture_output=True,
            text=True
        )
        print_success("Docker services đã được khởi động")
        
        # Wait for database to be ready
        print_info("Đang chờ database sẵn sàng...")
        max_retries = 30
        for i in range(max_retries):
            try:
                result = subprocess.run(
                    ['docker-compose', '-f', str(compose_file_to_use), 'exec', '-T', 'postgres', 
                     'pg_isready', '-U', 'core_user'],
                    capture_output=True,
                    check=True,
                    timeout=5,
                    cwd=compose_path.parent
                )
                print_success("Database đã sẵn sàng")
                break
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                if i < max_retries - 1:
                    time.sleep(2)
                    print_info(f"  Đang chờ... ({i+1}/{max_retries})")
                else:
                    print_error("Database không sẵn sàng sau 60 giây")
                    return None
        
        # Wait a bit more for backend to be ready
        print_info("Đang chờ backend service sẵn sàng...")
        time.sleep(5)
        
        return compose_file_to_use
    except subprocess.CalledProcessError as e:
        print_error(f"Lỗi khi khởi động Docker services: {e}")
        if e.stderr:
            print_error(f"Error details: {e.stderr}")
        return None

def wait_for_container(compose_path: Path, service: str = "backend", max_retries: int = 30, delay: int = 2):
    """Wait for container to be ready"""
    print_info(f"Đang chờ container {service} sẵn sàng...")
    for i in range(max_retries):
        try:
            result = subprocess.run(
                ['docker-compose', '-f', str(compose_path), 'exec', '-T', service, 'echo', 'ready'],
                capture_output=True,
                text=True,
                cwd=compose_path.parent,
                timeout=5
            )
            if result.returncode == 0:
                print_success(f"Container {service} đã sẵn sàng")
                return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass
        
        if i < max_retries - 1:
            time.sleep(delay)
    
    print_warning(f"Container {service} chưa sẵn sàng sau {max_retries * delay} giây, tiếp tục thử...")
    return False

def check_migration_status(compose_path: Path):
    """Check current migration status"""
    try:
        result = subprocess.run(
            ['docker-compose', '-f', str(compose_path), 'exec', '-T', 'backend', 
             'alembic', 'current'],
            capture_output=True,
            text=True,
            cwd=compose_path.parent,
            timeout=30
        )
        if result.returncode == 0:
            print_info(f"Migration hiện tại:\n{result.stdout}")
            return result.stdout
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        print_warning(f"Không thể kiểm tra migration status: {e}")
    return None

def run_migrations(compose_path: Path, show_status: bool = True):
    """Run database migrations với retry logic và kiểm tra container"""
    print_step(6, 9, "Chạy database migrations")
    
    # Đợi container sẵn sàng
    wait_for_container(compose_path, "backend", max_retries=30, delay=2)
    
    # Kiểm tra migration status trước khi chạy
    if show_status:
        print_info("Kiểm tra migration status hiện tại...")
        check_migration_status(compose_path)
    
    # Chạy migrations với retry logic
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            print_info(f"Đang chạy migrations (lần thử {attempt}/{max_retries})...")
            result = subprocess.run(
                ['docker-compose', '-f', str(compose_path), 'exec', '-T', 'backend', 
                 'alembic', 'upgrade', 'head'],
                check=True,
                cwd=compose_path.parent,
                timeout=300,  # 5 minutes timeout
                capture_output=True,
                text=True
            )
            
            # Hiển thị output
            if result.stdout:
                print_info(result.stdout)
            
            print_success("Migrations đã được chạy thành công")
            
            # Kiểm tra lại status sau khi chạy
            if show_status:
                print_info("Kiểm tra migration status sau khi chạy...")
                check_migration_status(compose_path)
            
            return True
            
        except subprocess.TimeoutExpired:
            print_error(f"Migration timeout sau 5 phút (lần thử {attempt}/{max_retries})")
            if attempt < max_retries:
                print_info("Đang thử lại...")
                time.sleep(5)
            else:
                print_error("Không thể chạy migrations sau nhiều lần thử")
                return False
                
        except subprocess.CalledProcessError as e:
            error_msg = e.stderr if hasattr(e, 'stderr') and e.stderr else str(e)
            print_error(f"Lỗi khi chạy migrations (lần thử {attempt}/{max_retries}): {error_msg}")
            
            # Nếu là lỗi connection, đợi thêm và thử lại
            if "connection" in error_msg.lower() or "refused" in error_msg.lower():
                if attempt < max_retries:
                    print_info("Đang đợi database sẵn sàng...")
                    time.sleep(10)
                    continue
            
            if attempt < max_retries:
                print_info("Đang thử lại...")
                time.sleep(5)
            else:
                print_error("Không thể chạy migrations sau nhiều lần thử")
                return False
    
    return False

def create_admin_role_and_user(admin_config: Dict[str, Any], compose_path: Path):
    """Create admin role with full permissions and assign to admin user"""
    print_step(8, 9, "Tạo Admin Role và User")
    
    # Get container name from docker-compose
    container_name = None
    try:
        result = subprocess.run(
            ['docker-compose', '-f', str(compose_path), 'ps', '-q', 'backend'],
            capture_output=True,
            text=True,
            check=True,
            cwd=compose_path.parent
        )
        container_id = result.stdout.strip()
        if container_id:
            # Get container name from ID
            result = subprocess.run(
                ['docker', 'inspect', '--format', '{{.Name}}', container_id],
                capture_output=True,
                text=True,
                check=True
            )
            container_name = result.stdout.strip().lstrip('/')
    except:
        # Fallback to default naming
        container_name = "deploy-backend-1"
    
    # Create Python script to run in backend container
    script_content = f"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import sys
import os

# Add app to path
sys.path.insert(0, '/app')

from app.core.config import settings
from app.modules.users.models import User
from app.modules.rbac.models import Role, Permission, UserRole
from app.modules.rbac.service import RBACService

async def setup_admin():
    # Create database connection - ensure asyncpg driver
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgresql+psycopg://", "postgresql+asyncpg://")
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Check if admin role exists
        result = await db.execute(select(Role).where(Role.code == "ADMIN"))
        admin_role = result.scalar_one_or_none()
        
        if not admin_role:
            # Create admin role
            admin_role = Role(
                code="ADMIN",
                name="Administrator",
                description="Full system administrator with all permissions",
                is_system=True,
                is_active=True
            )
            db.add(admin_role)
            await db.flush()
            print("✓ Created ADMIN role")
        else:
            print("✓ ADMIN role already exists")
        
        # Get all permissions and assign to admin role
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Role).where(Role.id == admin_role.id).options(selectinload(Role.permissions))
        )
        admin_role = result.scalar_one_or_none()
        
        result = await db.execute(select(Permission).where(Permission.is_active == True))
        all_permissions = result.scalars().all()
        
        if all_permissions:
            # Get current permission IDs
            current_perm_ids = set(p.id for p in admin_role.permissions)
            # Add missing permissions
            new_permissions = [p for p in all_permissions if p.id not in current_perm_ids]
            if new_permissions:
                admin_role.permissions.extend(new_permissions)
                await db.flush()
                print(f"✓ Assigned {{len(new_permissions)}} permissions to ADMIN role")
            else:
                print(f"✓ ADMIN role already has all {{len(all_permissions)}} permissions")
        else:
            print("⚠ No permissions found. You may need to seed permissions first.")
        
        # Check if admin user exists
        admin_email = "{admin_config['admin_email']}"
        result = await db.execute(select(User).where(User.email == admin_email))
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            # Create admin user (ID will be from apis.gosu.vn, but for setup we use a placeholder)
            # In production, user should be synced from apis.gosu.vn after login
            print(f"⚠ Admin user with email {{admin_email}} not found.")
            print("  Note: Users are typically synced from apis.gosu.vn after login.")
            print("  Please login with admin email first, then assign ADMIN role manually.")
            print(f"  After login, run this command to assign ADMIN role:")
            print(f"    docker exec {container_name} python /tmp/assign_admin_role.py")
        else:
            # Assign admin role to user
            rbac = RBACService(db)
            
            # Check if role already assigned
            result = await db.execute(
                select(UserRole).where(
                    UserRole.user_id == admin_user.id,
                    UserRole.role_id == admin_role.id
                )
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                await rbac.assign_role(
                    user_id=admin_user.id,
                    role_id=admin_role.id,
                    assigned_by=admin_user.id
                )
                await db.commit()
                print(f"✓ Assigned ADMIN role to user {{admin_email}}")
            else:
                print(f"✓ ADMIN role already assigned to user {{admin_email}}")
        
        await db.commit()
        print("✓ Setup completed successfully")

if __name__ == "__main__":
    asyncio.run(setup_admin())
"""
    
    # Write script to temporary file
    script_path = compose_path.parent / "setup_admin_temp.py"
    script_path.write_text(script_content, encoding="utf-8")
    
    try:
        # Copy script to backend container and run it
        subprocess.run(
            ['docker', 'cp', str(script_path), f'{container_name}:/tmp/setup_admin.py'],
            check=True
        )
        
        result = subprocess.run(
            ['docker', 'exec', container_name, 'python', '/tmp/setup_admin.py'],
            check=True,
            capture_output=True,
            text=True,
            cwd=compose_path.parent
        )
        
        # Print output
        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    if '✓' in line:
                        print_success(line.replace('✓', '').strip())
                    elif '⚠' in line:
                        print_warning(line.replace('⚠', '').strip())
                    else:
                        print_info(line.strip())
        if result.stderr:
            print_warning(result.stderr)
        
        # Cleanup
        script_path.unlink()
        
        print_success("Admin role đã được tạo thành công")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Lỗi khi tạo admin role/user: {e}")
        if e.stderr:
            print_error(f"Error details: {e.stderr}")
        if script_path.exists():
            script_path.unlink()
        return False

def seed_permissions(compose_path: Path):
    """Seed default permissions"""
    print_step(7, 9, "Tạo default permissions")
    
    # Get container name
    container_name = None
    try:
        result = subprocess.run(
            ['docker-compose', '-f', str(compose_path), 'ps', '-q', 'backend'],
            capture_output=True,
            text=True,
            check=True,
            cwd=compose_path.parent
        )
        container_id = result.stdout.strip()
        if container_id:
            result = subprocess.run(
                ['docker', 'inspect', '--format', '{{.Name}}', container_id],
                capture_output=True,
                text=True,
                check=True
            )
            container_name = result.stdout.strip().lstrip('/')
    except:
        container_name = "deploy-backend-1"
    
    # Create Python script to seed permissions
    script_content = """
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
import sys

sys.path.insert(0, '/app')

from app.core.config import settings
from app.modules.rbac.models import Permission, Role
from app.core.startup import DEFAULT_PERMISSIONS

async def seed():
    # Create database connection - ensure asyncpg driver
    db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://").replace("postgresql+psycopg://", "postgresql+asyncpg://")
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Tìm ADMIN role để gán permissions
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.code == "ADMIN")
        )
        admin_role = result.scalar_one_or_none()
        
        created = 0
        all_permissions = []
        
        # Tạo từng permission nếu chưa tồn tại
        for perm_data in DEFAULT_PERMISSIONS:
            result = await db.execute(select(Permission).where(Permission.code == perm_data["code"]))
            existing = result.scalar_one_or_none()
            
            if existing:
                all_permissions.append(existing)
            else:
                permission = Permission(**perm_data, is_active=True)
                db.add(permission)
                await db.flush()
                await db.refresh(permission)
                all_permissions.append(permission)
                created += 1
        
        await db.flush()
        
        # Gán tất cả permissions cho ADMIN role nếu role tồn tại
        if admin_role and all_permissions:
            current_permission_ids = {p.id for p in admin_role.permissions} if admin_role.permissions else set()
            permissions_to_add = [p for p in all_permissions if p.id not in current_permission_ids]
            
            if permissions_to_add:
                if admin_role.permissions:
                    admin_role.permissions.extend(permissions_to_add)
                else:
                    admin_role.permissions = permissions_to_add
                await db.flush()
                print(f"✓ Assigned {len(permissions_to_add)} permissions to ADMIN role")
        
        await db.commit()
        print(f"✓ Created {created} new permissions")
        print(f"✓ Total permissions: {len(DEFAULT_PERMISSIONS)}")

if __name__ == "__main__":
    asyncio.run(seed())
"""
    
    script_path = compose_path.parent / "seed_permissions_temp.py"
    script_path.write_text(script_content, encoding="utf-8")
    
    try:
        subprocess.run(
            ['docker', 'cp', str(script_path), f'{container_name}:/tmp/seed_permissions.py'],
            check=True
        )
        
        result = subprocess.run(
            ['docker', 'exec', container_name, 'python', '/tmp/seed_permissions.py'],
            check=True,
            capture_output=True,
            text=True
        )
        
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print_warning(result.stderr)
        
        script_path.unlink()
        print_success("Default permissions đã được tạo")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Lỗi khi tạo permissions: {e}")
        if e.stderr:
            print_error(f"Error details: {e.stderr}")
        if script_path.exists():
            script_path.unlink()
        return False

def print_summary(admin_config: Dict[str, Any], compose_path: Path):
    """Print setup summary"""
    print_step(9, 9, "Hoàn tất setup")
    
    print_header("Setup Hoàn Tất!")
    
    print(f"\n{Colors.BOLD}Thông tin Admin:{Colors.ENDC}")
    print(f"  Email: {Colors.OKGREEN}{admin_config['admin_email']}{Colors.ENDC}")
    print(f"  Tên: {admin_config['admin_full_name']}")
    print(f"  Role: {Colors.OKGREEN}ADMIN{Colors.ENDC} (Full permissions)")
    
    print(f"\n{Colors.BOLD}Bước tiếp theo:{Colors.ENDC}")
    print(f"  1. Login với email {Colors.OKGREEN}{admin_config['admin_email']}{Colors.ENDC} tại http://localhost:3000/login")
    print(f"  2. Sau khi login, user sẽ được sync từ apis.gosu.vn")
    print(f"  3. Nếu ADMIN role chưa được gán, chạy lệnh:")
    print(f"     {Colors.OKCYAN}docker-compose -f {compose_path} exec backend python /app/scripts/assign_admin_role.py {admin_config['admin_email']}{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}Services:{Colors.ENDC}")
    print(f"  Backend API: {Colors.OKCYAN}http://localhost:8000{Colors.ENDC}")
    print(f"  Frontend: {Colors.OKCYAN}http://localhost:3000{Colors.ENDC}")
    print(f"  API Docs: {Colors.OKCYAN}http://localhost:8000/docs{Colors.ENDC}")
    print(f"  PostgreSQL: {Colors.OKCYAN}localhost:5432{Colors.ENDC}")
    print(f"  Redis: {Colors.OKCYAN}localhost:6379{Colors.ENDC}")
    print(f"  MinIO Console: {Colors.OKCYAN}http://localhost:9001{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}Các lệnh hữu ích:{Colors.ENDC}")
    print(f"  Xem logs: {Colors.OKCYAN}docker-compose -f {compose_path} logs -f{Colors.ENDC}")
    print(f"  Dừng services: {Colors.OKCYAN}docker-compose -f {compose_path} down{Colors.ENDC}")
    print(f"  Khởi động lại: {Colors.OKCYAN}docker-compose -f {compose_path} restart{Colors.ENDC}")
    print(f"  Xem status: {Colors.OKCYAN}docker-compose -f {compose_path} ps{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}File cấu hình:{Colors.ENDC}")
    print(f"  .env file: {Colors.OKCYAN}{compose_path.parent / '.env'}{Colors.ENDC}")
    print(f"  {Colors.WARNING}⚠ Lưu ý: File .env chứa secrets, không commit vào Git!{Colors.ENDC}")
    
    print(f"\n{Colors.OKGREEN}{Colors.BOLD}Chúc mừng! Hệ thống đã sẵn sàng sử dụng.{Colors.ENDC}\n")

def run_migrations_only():
    """Chỉ chạy migrations mà không setup lại toàn bộ hệ thống"""
    print_header("GOSU Core Platform - Run Migrations Only")
    
    # Get project root
    project_root = Path(__file__).parent.resolve()
    deploy_dir = project_root / "deploy"
    compose_file = deploy_dir / "docker-compose.yml"
    
    # Kiểm tra docker-compose file
    if not compose_file.exists():
        print_error(f"Không tìm thấy file docker-compose.yml tại {compose_file}")
        print_info("Vui lòng chạy 'python setup.py' để setup hệ thống lần đầu.")
        sys.exit(1)
    
    # Kiểm tra services đang chạy
    try:
        result = subprocess.run(
            ['docker-compose', '-f', str(compose_file), 'ps', '-q', 'backend'],
            capture_output=True,
            text=True,
            cwd=deploy_dir,
            timeout=10
        )
        if not result.stdout.strip():
            print_warning("Backend container chưa chạy. Đang khởi động services...")
            subprocess.run(
                ['docker-compose', '-f', str(compose_file), 'up', '-d'],
                cwd=deploy_dir,
                check=True
            )
            print_info("Đang chờ services khởi động...")
            time.sleep(5)
    except subprocess.CalledProcessError:
        print_error("Không thể kiểm tra hoặc khởi động Docker services.")
        sys.exit(1)
    
    # Chạy migrations
    if not run_migrations(compose_file, show_status=True):
        print_error("Không thể chạy migrations. Vui lòng kiểm tra lại.")
        sys.exit(1)
    
    print_success("Migrations đã được cập nhật thành công!")
    print_info("\nBạn có thể kiểm tra migration status bằng lệnh:")
    print_info(f"  docker-compose -f {compose_file} exec backend alembic current")

def main():
    """Main setup function"""
    # Kiểm tra argument để chỉ chạy migrations
    if len(sys.argv) > 1 and sys.argv[1] in ['--migrate', '--migrate-only', '-m']:
        run_migrations_only()
        return
    
    print_header("GOSU Core Platform - Automated Setup")
    
    # Get project root
    project_root = Path(__file__).parent.resolve()
    deploy_dir = project_root / "deploy"
    compose_file = deploy_dir / "docker-compose.yml"
    env_file = deploy_dir / ".env"
    
    # Step 1: Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Step 2: Setup .env file (có thể bỏ qua nếu đã có)
    skip_env_creation = False
    env_config = None
    
    if env_file.exists():
        response = input(f"\n{Colors.WARNING}File .env đã tồn tại. Bạn có muốn tạo lại? (y/N): {Colors.ENDC}")
        if response.lower() != 'y':
            print_info("Bỏ qua tạo file .env, sử dụng file hiện có.")
            skip_env_creation = True
        else:
            # User wants to create new .env
            env_example_file = deploy_dir / ".env.example"
            env_config = get_env_config()
            create_env_file(env_config, env_file, env_example_file)
    else:
        # .env doesn't exist, must create it
        env_example_file = deploy_dir / ".env.example"
        env_config = get_env_config()
        create_env_file(env_config, env_file, env_example_file)
    
    # Step 3: Get admin configuration (luôn cần)
    admin_config = get_admin_config()
    
    # Step 4: Setup Docker services
    compose_file_to_use = setup_docker_compose(compose_file)
    if not compose_file_to_use:
        print_error("Không thể khởi động Docker services. Vui lòng kiểm tra lại.")
        sys.exit(1)
    
    # Wait a bit for services to fully start
    print_info("Đang chờ services khởi động hoàn toàn...")
    time.sleep(5)
    
    # Step 5: Run migrations
    if not run_migrations(compose_file_to_use):
        print_error("Không thể chạy migrations. Vui lòng kiểm tra lại.")
        sys.exit(1)
    
    # Step 6: Seed permissions (must be before creating admin role)
    if not seed_permissions(compose_file_to_use):
        print_warning("Không thể tạo permissions. Bạn có thể tạo thủ công sau.")
        print_warning("Admin role sẽ không có permissions nếu bước này thất bại.")
    
    # Step 7: Create admin role and user (luôn cần)
    if not create_admin_role_and_user(admin_config, compose_file_to_use):
        print_warning("Không thể tạo admin role/user. Bạn có thể tạo thủ công sau.")
        print_info("Sau khi user login, chạy lệnh sau để gán ADMIN role:")
        print_info(f"  docker-compose -f {compose_file} exec backend python /app/scripts/assign_admin_role.py {admin_config['admin_email']}")
    
    # Step 8: Print summary
    print_summary(admin_config, compose_file)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}Setup đã bị hủy bởi người dùng.{Colors.ENDC}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Lỗi không mong đợi: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


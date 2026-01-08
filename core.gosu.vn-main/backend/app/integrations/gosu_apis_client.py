"""
GOSU APIs Client - Integration với apis.gosu.vn

Module này cung cấp client để kết nối với GOSU APIs (apis.gosu.vn).

Mục đích:
    - Xử lý authentication với GOSU API
    - Gọi các API endpoints của GOSU (employee profile, etc.)
    - Tạo signature cho authentication headers

Ngữ cảnh:
    - Sử dụng signature-based authentication (MD5 hash)
    - SSL verification có thể tắt trong development mode
    - Timeout mặc định 30 giây

Được sử dụng bởi:
    - Auth module để authenticate users
    - Users service để sync user profiles

Xem thêm:
    - docs/architecture.md cho integration flow

Author: GOSU Development Team
Version: 1.0.0
"""

import httpx
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class GOSUAPIClient:
    """
    GOSU API Client - Client để kết nối với GOSU APIs (apis.gosu.vn)
    
    Class này cung cấp các methods để:
    - Authenticate users với GOSU API
    - Lấy employee profiles từ GOSU API
    - Tạo authentication headers với signature
    """
    
    def __init__(self):
        self.base_url = settings.GOSU_API_URL
        self.app_id = settings.GOSU_APP_ID
        self.secret = settings.GOSU_SECRET
        self.timeout = 30.0
        
        logger.info(f"GOSU API Client initialized: base_url={self.base_url}, app_id={self.app_id}")
    
    def _generate_signature(self, timestamp: str, token: Optional[str] = None) -> str:
        """
        Tạo signature cho GOSU API authentication
        
        Signature được tạo bằng MD5 hash của chuỗi: secret + "GsS" + app_id + token + timestamp + secret
        """
        if token:
            signature_string = self.secret + "GsS" + self.app_id + token + timestamp + self.secret
        else:
            signature_string = self.secret + "GsS" + self.app_id + self.secret + timestamp
        return hashlib.md5(signature_string.encode('utf-8')).hexdigest()
    
    def _get_timestamp(self) -> str:
        """
        Tạo timestamp theo format YmdHis
        
        Returns:
            str: Timestamp string (ví dụ: "20240101120000")
        """
        return datetime.now().strftime("%Y%m%d%H%M%S")
    
    def _get_auth_headers(self, token: Optional[str] = None) -> dict:
        """
        Tạo headers cho GOSU API request
        
        Headers bao gồm:
        - gss-application: App ID
        - gss-time: Timestamp
        - gss-signature: MD5 signature
        - gss-token: Token (nếu có)
        """
        timestamp = self._get_timestamp()
        signature = self._generate_signature(timestamp, token)
        
        headers = {
            "Content-Type": "application/json",
            "gss-application": self.app_id,
            "gss-time": timestamp,
            "gss-signature": signature
        }
        
        if token:
            headers["gss-token"] = token
        
        return headers
    
    async def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Xác thực user với GOSU API
        
        Args:
            email: Email đăng nhập
            password: Password
            
        Returns:
            dict: Response từ GOSU API hoặc None nếu lỗi
        """
        try:
            normalized_email = email
            if email and "@" not in email:
                normalized_email = f"{email}@gosu.vn"
            
            ssl_verify = settings.SSL_VERIFY
            if settings.DEBUG and settings.ENVIRONMENT == "development":
                ssl_verify = False
                logger.warning("SSL verification disabled (DEVELOPMENT ONLY)")
            
            async with httpx.AsyncClient(timeout=self.timeout, verify=ssl_verify) as client:
                headers = self._get_auth_headers()
                payload = {
                    "Email": normalized_email,
                    "Password": password
                }
                
                logger.info(f"Calling GOSU API for authentication: {normalized_email}")
                
                response = await client.post(
                    f"{self.base_url}/v1/account/authorize",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("Code") == 1:
                        logger.info(f"Authentication successful for: {normalized_email}")
                        return {
                            "success": True,
                            "data": data.get("Data", {}),
                            "token": data.get("Data", {}).get("Token"),
                            "message": "Đăng nhập thành công"
                        }
                    else:
                        error_message = data.get("Msg", "Đăng nhập thất bại")
                        logger.warning(f"Authentication failed: {error_message}")
                        return {
                            "success": False,
                            "message": error_message
                        }
                else:
                    logger.error(f"GOSU API error {response.status_code}")
                    return {
                        "success": False,
                        "message": f"Lỗi kết nối: HTTP {response.status_code}"
                    }
        except Exception as e:
            logger.error(f"Error connecting to GOSU API: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Lỗi kết nối: {str(e)}"
            }
    
    async def get_employee_profile(self, token: str) -> Optional[Dict[str, Any]]:
        """Lấy thông tin nhân sự từ GOSU API"""
        try:
            ssl_verify = settings.SSL_VERIFY
            if settings.DEBUG and settings.ENVIRONMENT == "development":
                ssl_verify = False
            
            async with httpx.AsyncClient(timeout=self.timeout, verify=ssl_verify) as client:
                headers = self._get_auth_headers(token=token)
                
                response = await client.get(
                    f"{self.base_url}/v1/hrm/employee/profile",
                    headers=headers
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"GOSU API GET error {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error calling GOSU API: {str(e)}", exc_info=True)
            return None


# Global instance - Instance toàn cục của GOSU API client
# Được sử dụng bởi các modules khác để gọi GOSU APIs
gosu_api_client = GOSUAPIClient()


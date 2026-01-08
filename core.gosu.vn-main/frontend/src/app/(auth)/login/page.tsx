/**
 * Login Page Component - Core Platform
 * 
 * Component này render trang đăng nhập cho Core Platform.
 * 
 * Chức năng:
 * - Form đăng nhập với username và password
 * - Tự động thêm @gosu.vn nếu username không có domain
 * - Toggle show/hide password
 * - Loading state khi đang xử lý login
 * - Error handling và hiển thị error message
 * - Redirect về trang trước đó sau khi login thành công
 * - Tự động redirect nếu đã đăng nhập
 * 
 * Flow:
 * 1. User nhập username và password
 * 2. Click Login button
 * 3. Gọi authStore.login()
 * 4. Nếu thành công: Redirect về redirect URL hoặc /dashboard
 * 5. Nếu thất bại: Hiển thị error message
 * 
 * See also:
 * - docs/architecture.md for authentication flow
 * - @/lib/auth for authStore implementation
 * 
 * Author: GOSU Development Team
 * Version: 1.0.0
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authStore } from '@/lib/auth';

/**
 * LoginPage Component
 * 
 * Main component cho trang đăng nhập.
 * 
 * @returns JSX element cho login page
 */
export default function LoginPage() {
  // Next.js hooks
  const router = useRouter();                    // Router để navigate
  const searchParams = useSearchParams();       // URL search params (để lấy redirect URL)

  // Form state
  const [username, setUsername] = useState('');      // Username/email input
  const [password, setPassword] = useState('');      // Password input
  const [showPassword, setShowPassword] = useState(false);  // Toggle show/hide password
  const [error, setError] = useState('');           // Error message
  const [loading, setLoading] = useState(false);     // Loading state

  /**
   * useEffect - Check authentication status và redirect
   * 
   * Nếu user đã đăng nhập (có token), tự động redirect về:
   * - redirect URL từ query params (nếu có)
   * - /dashboard (default)
   * 
   * Chạy khi component mount và khi router/searchParams thay đổi.
   */
  useEffect(() => {
    // Nếu đã đăng nhập, redirect
    if (authStore.getToken()) {
      const redirect = searchParams?.get('redirect') || '/dashboard';
      router.push(redirect);
    }
  }, [router, searchParams]);

  /**
   * handleUsernameBlur - Tự động thêm @gosu.vn nếu username không có domain
   * 
   * Function này được gọi khi user blur khỏi username input.
   * Nếu username không có @, tự động thêm @gosu.vn.
   * 
   * Example:
   *   Input: "user" -> Auto-complete: "user@gosu.vn"
   *   Input: "user@gosu.vn" -> No change
   *   Input: "user@gmail.com" -> No change (đã có domain)
   */
  const handleUsernameBlur = () => {
    if (username && !username.includes('@')) {
      setUsername(`${username}@gosu.vn`);
    }
  };

  /**
   * handleSubmit - Xử lý form submission
   * 
   * Function này được gọi khi user submit login form.
   * 
   * Flow:
   * 1. Prevent default form submission
   * 2. Clear error message
   * 3. Set loading = true
   * 4. Gọi authStore.login() với username và password
   * 5. Nếu thành công: Redirect về redirect URL hoặc /dashboard
   * 6. Nếu thất bại: Hiển thị error message
   * 7. Set loading = false
   * 
   * @param e - Form event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authStore.login(username.trim(), password);
      const redirect = searchParams?.get('redirect') || '/dashboard';
      router.push(redirect);
    } catch (err: any) {
      console.error('Login error:', err);
      // Lấy error message từ API response hoặc dùng message mặc định
      const errorMessage = err.response?.data?.detail || 'Tài khoản hoặc mật khẩu không đúng.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-page">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <div className="gosu-logo">
                <img
                  src="https://tool.gosu.vn/build/assets/backend/admin/assets/images/gosu-14.a7cffa45.png"
                  alt="GOSU Logo"
                  className="logo-image"
                />
                <div className="login-title">CORE PLATFORM</div>
              </div>
              <div className="sub-title">Sign In to Core Portal</div>
            </div>

            {error && (
              <div className="alert alert-danger" role="alert">
                <svg className="alert-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form method="POST" id="loginForm" onSubmit={handleSubmit}>
              <div className="form-group">
                <div className="input-group">
                  <span className="input-group-text">
                    <svg className="input-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    id="username"
                    name="username"
                    placeholder="Email hoặc tên người dùng"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={handleUsernameBlur}
                    disabled={loading}
                    autoFocus
                    title="Vui lòng nhập email hoặc tên người dùng (tự động thêm @gosu.vn)"
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="input-group">
                  <span className="input-group-text">
                    <svg className="input-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    id="password"
                    name="password"
                    placeholder="Mật khẩu"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="toggle-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    ) : (
                      <svg className="toggle-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`btn-login ${loading ? 'loading' : ''}`}
                id="loginBtn"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading">
                    <span className="spinner"></span>
                    Đang xử lý...
                  </span>
                ) : (
                  <span className="btn-text">
                    <svg className="btn-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Login
                  </span>
                )}
              </button>
            </form>

            <div className="info-text">
              <svg className="info-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Hệ thống xác thực GOSU - Core Platform
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


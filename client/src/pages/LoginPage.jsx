import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect to authorized dashboard immediately
  useEffect(() => {
    if (isAuthenticated && user) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await login(username.trim(), password);
      showToast(`Welcome back, ${res.user.name}!`, 'success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      let displayMsg = 'Invalid username or password. Please check your credentials and try again.';

      if (serverMsg) {
        displayMsg = serverMsg;
      } else if (err.response?.status === 500 || err.message?.includes('500')) {
        displayMsg = 'Server is currently initializing or busy. Please try again in a few seconds.';
      } else if (err.response?.status === 503) {
        displayMsg = 'Database service is connecting. Please wait a moment and try again.';
      } else if (err.message && !err.message.includes('object') && !err.message.includes('status code')) {
        displayMsg = err.message;
      }
      setError(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div
      className="min-vh-100 w-100 d-flex align-items-center justify-content-center p-3"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        minHeight: '100vh'
      }}
    >
      <div
        className="card glass-card border-0 shadow-lg"
        style={{
          maxWidth: '440px',
          width: '100%',
          borderRadius: '16px',
          background: 'rgba(30, 41, 59, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#f8fafc'
        }}
      >
        <div className="card-body p-4 p-sm-5">
          {/* Header & Logo */}
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow"
              style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#fff',
                fontSize: '1.75rem'
              }}
            >
              <i className="fa-solid fa-wallet"></i>
            </div>
            <h3
              className="fw-bold mb-1 tracking-tight"
              style={{
                letterSpacing: '-0.025em',
                fontSize: '1.35rem',
                color: '#f8fafc',
                textTransform: 'uppercase'
              }}
            >
              Smart Personal Expense
            </h3>
            <p
              className="text-uppercase fw-semibold mb-0"
              style={{
                fontSize: '0.85rem',
                letterSpacing: '0.12em',
                color: '#94a3b8'
              }}
            >
              Management System
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              className="alert alert-danger py-2 px-3 mb-4 d-flex align-items-center gap-2 border-0"
              style={{
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.875rem'
              }}
              role="alert"
            >
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label
                htmlFor="username"
                className="form-label fw-semibold"
                style={{ fontSize: '0.875rem', color: '#cbd5e1' }}
              >
                Username / Login ID
              </label>
              <div className="input-group">
                <span
                  className="input-group-text border-0"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#94a3b8',
                    borderTopLeftRadius: '8px',
                    borderBottomLeftRadius: '8px'
                  }}
                >
                  <i className="fa-solid fa-user"></i>
                </span>
                <input
                  id="username"
                  type="text"
                  className="form-control border-0"
                  placeholder="Enter your username or ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                  required
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px',
                    padding: '0.65rem 0.85rem'
                  }}
                />
              </div>
            </div>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="form-label fw-semibold"
                style={{ fontSize: '0.875rem', color: '#cbd5e1' }}
              >
                Password
              </label>
              <div className="input-group">
                <span
                  className="input-group-text border-0"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#94a3b8',
                    borderTopLeftRadius: '8px',
                    borderBottomLeftRadius: '8px'
                  }}
                >
                  <i className="fa-solid fa-lock"></i>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control border-0"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#f8fafc',
                    padding: '0.65rem 0.85rem'
                  }}
                />
                <button
                  type="button"
                  className="btn border-0"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#94a3b8',
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px'
                  }}
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button
              id="loginSubmitBtn"
              type="submit"
              className="btn w-100 py-2 fw-semibold shadow-sm d-flex align-items-center justify-content-center gap-2"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
                borderRadius: '8px',
                border: 'none',
                minHeight: '44px',
                fontSize: '0.95rem'
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Account Selector */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Quick Login / Demo Accounts
              </span>
              <span className="badge bg-primary-subtle text-primary" style={{ fontSize: '0.68rem' }}>4 Active</span>
            </div>
            <div className="row g-2">
              <div className="col-6">
                <button
                  type="button"
                  onClick={() => handleQuickFill('bhavik', 'bhavik123')}
                  className="btn btn-sm w-100 text-start d-flex align-items-center justify-content-between p-2"
                  style={{
                    backgroundColor: 'rgba(79, 70, 229, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.78rem'
                  }}
                >
                  <span><strong>bhavik</strong> (Admin)</span>
                  <i className="fa-solid fa-arrow-turn-up text-primary" style={{ fontSize: '0.7rem' }}></i>
                </button>
              </div>
              <div className="col-6">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin', 'admin123')}
                  className="btn btn-sm w-100 text-start d-flex align-items-center justify-content-between p-2"
                  style={{
                    backgroundColor: 'rgba(79, 70, 229, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.78rem'
                  }}
                >
                  <span><strong>admin</strong> (Admin)</span>
                  <i className="fa-solid fa-arrow-turn-up text-primary" style={{ fontSize: '0.7rem' }}></i>
                </button>
              </div>
              <div className="col-6">
                <button
                  type="button"
                  onClick={() => handleQuickFill('meet', 'meet123')}
                  className="btn btn-sm w-100 text-start d-flex align-items-center justify-content-between p-2"
                  style={{
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.78rem'
                  }}
                >
                  <span><strong>meet</strong> (User)</span>
                  <i className="fa-solid fa-arrow-turn-up text-info" style={{ fontSize: '0.7rem' }}></i>
                </button>
              </div>
              <div className="col-6">
                <button
                  type="button"
                  onClick={() => handleQuickFill('harsh', 'harsh123')}
                  className="btn btn-sm w-100 text-start d-flex align-items-center justify-content-between p-2"
                  style={{
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.78rem'
                  }}
                >
                  <span><strong>harsh</strong> (User)</span>
                  <i className="fa-solid fa-arrow-turn-up text-info" style={{ fontSize: '0.7rem' }}></i>
                </button>
              </div>
            </div>
          </div>

          {/* Secure System Footer */}
          <div className="mt-3 pt-2 text-center">
            <p className="mb-0 text-muted" style={{ fontSize: '0.75rem', color: '#64748b' }}>
              <i className="fa-solid fa-shield-halved me-1 text-primary"></i>
              Secure Encrypted Authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

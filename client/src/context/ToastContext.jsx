import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const iconMap = {
    success: 'fa-circle-check text-success',
    error: 'fa-circle-xmark text-danger',
    warning: 'fa-triangle-exclamation text-warning',
    info: 'fa-circle-info text-primary'
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1090 }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="toast align-items-center show glass-card border-0 mb-2 shadow"
            role="alert"
          >
            <div className="d-flex p-2">
              <div className="toast-body d-flex align-items-center gap-2">
                <i className={`fa-solid ${iconMap[toast.type] || iconMap.info} fs-5`}></i>
                <span className="fw-semibold">{toast.message}</span>
              </div>
              <button
                type="button"
                className="btn-close me-2 m-auto"
                onClick={() => removeToast(toast.id)}
                aria-label="Close"
              ></button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

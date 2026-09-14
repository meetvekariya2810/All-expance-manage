import React from 'react';

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  progress
}) {
  return (
    <div className="glass-card stat-card">
      <div className="stat-info">
        <span>{title}</span>
        <h3>{value}</h3>
        {progress !== undefined && (
          <div className="progress-glass mt-1" style={{ height: '6px' }}>
            <div
              className={`progress-glass-bar bg-${color}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
        {subtitle && <small className="text-muted">{subtitle}</small>}
      </div>
      <div className={`stat-icon ${color}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
    </div>
  );
}

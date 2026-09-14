import React from 'react';
import { Navigate } from 'react-router-dom';

export default function LoginModal({ isOpen }) {
  if (!isOpen) return null;
  return <Navigate to="/login" replace />;
}

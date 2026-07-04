import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'

let isRedirectingToLogin = false;

const isSessionExpiredResponse = (status, message = '') => {
  if (status === 401 || status === 403) return true;

  const normalizedMessage = (message || '').toLowerCase();
  return [
    'session expired',
    'token expired',
    'unauthorized',
    'not authenticated',
    'authentication failed',
    'invalid token',
  ].some((entry) => normalizedMessage.includes(entry));
};

const handleSessionExpired = () => {
  if (isRedirectingToLogin) return;
  isRedirectingToLogin = true;

  localStorage.removeItem('token');
  localStorage.removeItem('deviceId');

  if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
    window.location.assign('/');
  }
};

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const response = await originalFetch(input, init);

  if (!response || ![401, 403].includes(response.status)) {
    return response;
  }

  try {
    const clone = response.clone();
    let payload = null;

    try {
      payload = await clone.json();
    } catch {
      payload = await clone.text();
    }

    const message = typeof payload === 'string' ? payload : payload?.message || '';
    if (isSessionExpiredResponse(response.status, message)) {
      handleSessionExpired();
    }
  } catch {
    handleSessionExpired();
  }

  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

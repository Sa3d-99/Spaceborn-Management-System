import React from 'react';
import LoginSystem from '../Login/LoginSystem';

export default function Login({ onLogin }) {
  return <LoginSystem onLoginSuccess={onLogin} />;
}

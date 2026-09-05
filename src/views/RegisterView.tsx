import React from 'react';
import { LoginView } from './LoginView';

interface RegisterViewProps {
  onNavigate: (view: 'login' | 'register' | 'recover' | string) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onNavigate }) => {
  return <LoginView onNavigate={onNavigate} initialMode="register" />;
};

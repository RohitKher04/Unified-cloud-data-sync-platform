import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { AuthProvider } from '@/context/AuthContext';
import { AppRouter } from '@/app/router';

export const App: React.FC = () => {
  return (
    <AppProviders>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </AppProviders>
  );
};

export default App;

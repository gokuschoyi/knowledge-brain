import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { Provider } from './components/ui/provider';
import { ActiveBrainProvider } from './context/ActiveBrainContext';
import './styles.css';
import { router } from './routes';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider attribute='class' disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ActiveBrainProvider>
          <RouterProvider router={router} />
        </ActiveBrainProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
);

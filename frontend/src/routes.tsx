import { createBrowserRouter } from 'react-router-dom';

import { App } from './App';
import { BrainsPage } from './pages/Brains';
import { ChatPage } from './pages/Chat';
import { DashboardPage } from './pages/Dashboard';
import { DocumentDetailPage } from './pages/DocumentDetail';
import { DocumentsPage } from './pages/Documents';
import { IngestPage } from './pages/Ingest';
import { KnowledgeGraphPage } from './pages/KnowledgeGraph';
import { SelfHealingPage } from './pages/SelfHealing';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'brains', element: <BrainsPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/:id', element: <DocumentDetailPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'ingest', element: <IngestPage /> },
      { path: 'graph', element: <KnowledgeGraphPage /> },
      { path: 'self-healing', element: <SelfHealingPage /> },
    ],
  },
]);

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
      {
        index: true,
        element: <DashboardPage />,
        handle: { title: 'Dashboard' },
      },
      {
        path: 'brains',
        element: <BrainsPage />,
        handle: {
          title: 'Knowledge Brains',
          subtitle: 'Manage your isolated knowledge containers',
        },
      },
      {
        path: 'documents',
        element: <DocumentsPage />,
        handle: { title: 'Documents' },
      },
      {
        path: 'documents/:id',
        element: <DocumentDetailPage />,
        handle: { title: 'Document Detail' },
      },
      {
        path: 'chat',
        element: <ChatPage />,
        handle: { title: 'Chat' },
      },
      {
        path: 'ingest',
        element: <IngestPage />,
        handle: { title: 'Ingest Data' },
      },
      {
        path: 'graph',
        element: <KnowledgeGraphPage />,
        handle: { title: 'Knowledge Graph' },
      },
      {
        path: 'self-healing',
        element: <SelfHealingPage />,
        handle: { title: 'Self Healing' },
      },
    ],
  },
]);

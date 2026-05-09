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
        handle: {
          title: 'System Overview',
          subtitle:
            'Live telemetry across ingestion, retrieval, structure, and repair.',
        },
      },
      {
        path: 'brains',
        element: <BrainsPage />,
        handle: {
          title: 'Knowledge Brains',
          subtitle:
            'Curate isolated knowledge domains, repair policy, and intelligence scope.',
        },
      },
      {
        path: 'documents',
        element: <DocumentsPage />,
        handle: {
          title: 'Documents',
          subtitle:
            'Inspect stored documents, extraction state, and model provenance.',
        },
      },
      {
        path: 'documents/:id',
        element: <DocumentDetailPage />,
        handle: {
          title: 'Document Intelligence',
          subtitle:
            'Review chunk extraction, entities, relationships, and document health.',
        },
      },
      {
        path: 'chat',
        element: <ChatPage />,
        handle: {
          title: 'Research Chat',
          subtitle:
            'Source-grounded conversation with live retrieval and repair-aware reasoning.',
        },
      },
      {
        path: 'ingest',
        element: <IngestPage />,
        handle: {
          title: 'Ingest Docs',
          subtitle:
            'Configure intake, extraction models, and recent knowledge feed.',
        },
      },
      {
        path: 'graph',
        element: <KnowledgeGraphPage />,
        handle: {
          title: 'Knowledge Graph',
          subtitle:
            'Navigate entities, relationships, and isolated nodes inside the active brain.',
        },
      },
      {
        path: 'self-healing',
        element: <SelfHealingPage />,
        handle: {
          title: 'Diagnostic Console',
          subtitle:
            'Monitor repair tasks, auto-repair policy, and intervention outcomes.',
        },
      },
    ],
  },
]);

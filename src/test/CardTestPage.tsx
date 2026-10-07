import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { MemoryRouter } from 'react-router-dom';
import { ContactCard } from '@/components/crm/ContactCard';

const contactId = 'test-contact-1';

const score = {
  contact_id: contactId,
  organization_id: 'org-1',
  total_checkins_90d: 4,
  total_checkins_30d: 1,
  weeks_attended_last_12: 5,
  last_checkin_at: '2026-10-01',
  engagement_level: 'at_risk',
  streak_weeks: 0,
  volunteer_checkins_90d: 0,
  score: 19,
  updated_at: '2026-10-01',
};

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
});
qc.setQueryData(['engagement-score', contactId], score);

const App = () => (
  <AuthProvider><MemoryRouter>
    <QueryClientProvider client={qc}>
      <div style={{ width: 280, padding: 8 }}>
        <ContactCard
          contact={{
            id: contactId,
            name: 'Kelly Stanley',
            date: '2026-09-18',
            tags: ['Volunteer'],
            assignedTo: { name: 'Alex Yashchenko' },
            status: 'active',
            email: 'kelly@example.com',
            phone: '+15551234567',
            stageEnteredAt: '2026-09-18',
            campusId: 'c1',
            campusName: 'Santa Rosa',
          }}
        />
      </div>
    </QueryClientProvider>
  </MemoryRouter></AuthProvider>
);

createRoot(document.getElementById('root')!).render(<App />);

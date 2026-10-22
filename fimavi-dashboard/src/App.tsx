import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaintenancePage from './pages/MaintenancePage';
import { AuthGate } from './auth/AuthGate';
import { SessionWatchdog } from './components/SessionWatchdog';

const queryClient = new QueryClient();

export default function App() {
  return (
    <AuthGate>
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
        <SessionWatchdog />
      </QueryClientProvider>
    </AuthGate>
  );
}

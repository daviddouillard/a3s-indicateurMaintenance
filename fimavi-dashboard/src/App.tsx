import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaintenancePage from './pages/MaintenancePage';
import { AuthGate } from './auth/AuthGate';

const queryClient = new QueryClient();

export default function App() {
  return (
    <AuthGate>
      <QueryClientProvider client={queryClient}>
        <MaintenancePage />
      </QueryClientProvider>
    </AuthGate>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import StoresList from './pages/StoresList';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stores" element={<StoresList />} />
            <Route path="/analytics" element={<div className="text-center py-12 text-gray-500">Analytics coming soon</div>} />
            <Route path="/settings" element={<div className="text-center py-12 text-gray-500">Settings coming soon</div>} />
            <Route path="/help" element={<div className="text-center py-12 text-gray-500">Help documentation coming soon</div>} />
            <Route path="/docs" element={<div className="text-center py-12 text-gray-500">Documentation coming soon</div>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/Layout'
import { ResourceListPage } from '@/pages/ResourceListPage'
import { ServiceDetailPage } from '@/pages/ServiceDetailPage'
import { ConfigPage } from '@/pages/ConfigPage'
import { MetricsPage } from '@/pages/MetricsPage'
import { LogsPage } from '@/pages/LogsPage'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/r/services" replace />} />
            <Route path="/r/services/:name" element={<ServiceDetailPage />} />
            <Route path="/r/:key" element={<ResourceListPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="*" element={<Navigate to="/r/services" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" closeButton richColors />
    </QueryClientProvider>
  )
}

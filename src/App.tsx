import { lazy, Suspense, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ResourceListPage } from '@/pages/ResourceListPage'
import { ServiceDetailPage } from '@/pages/ServiceDetailPage'
import { LogsPage } from '@/pages/LogsPage'
import { WelcomePage } from '@/pages/WelcomePage'
import { bootstrapFromEnv, useProfilesState } from '@/lib/profiles'

// 重资源页面按需加载：MetricsPage 拽着 recharts，ConfigPage 拽着 codemirror，
// Cookbook 拽着一大堆静态配方文案，进首屏没必要全塞进 index.js。
const MetricsPage = lazy(() =>
  import('@/pages/MetricsPage').then((m) => ({ default: m.MetricsPage })),
)
const ConfigPage = lazy(() =>
  import('@/pages/ConfigPage').then((m) => ({ default: m.ConfigPage })),
)
const CookbookPage = lazy(() =>
  import('@/pages/CookbookPage').then((m) => ({ default: m.CookbookPage })),
)

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

function PageSkeleton() {
  return (
    <div className="h-64 border border-[var(--color-border)] rounded-lg animate-pulse bg-[var(--color-surface)]/40" />
  )
}

export default function App() {
  useEffect(() => {
    // One-time: seed a profile from VITE_GOST_* env if user has nothing saved.
    // Lets the legacy single-host setup keep working without extra clicks.
    bootstrapFromEnv()
  }, [])

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </BrowserRouter>
      <Toaster position="bottom-right" closeButton richColors />
    </QueryClientProvider>
  )
}

function Shell() {
  const { profiles } = useProfilesState()
  if (profiles.length === 0) {
    return (
      <Routes>
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/r/services" replace />} />
        <Route path="/r/services/:name" element={<ServiceDetailPage />} />
        <Route path="/r/:key" element={<ResourceListPage />} />
        <Route
          path="/config"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <ConfigPage />
            </Suspense>
          }
        />
        <Route
          path="/metrics"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <MetricsPage />
            </Suspense>
          }
        />
        <Route path="/logs" element={<LogsPage />} />
        <Route
          path="/cookbook"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <CookbookPage />
            </Suspense>
          }
        />
        <Route path="/welcome" element={<Navigate to="/r/services" replace />} />
        <Route path="*" element={<Navigate to="/r/services" replace />} />
      </Route>
    </Routes>
  )
}

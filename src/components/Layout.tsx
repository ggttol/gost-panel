import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  Boxes,
  CircleSlash2,
  Disc,
  DoorOpen,
  Eye,
  ChefHat,
  FileJson,
  Gauge,
  ScrollText,
  Globe2,
  Key,
  Link2,
  MapPin,
  Menu,
  Radar,
  Route,
  ServerCog,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { RESOURCES, type ResourceDef, type ResourceKey } from '@/lib/resources'
import { GROUP_LABEL_ZH, RESOURCE_LABEL_ZH, T } from '@/lib/i18n'
import { api } from '@/lib/api'
import { useProfilesState } from '@/lib/profiles'
import { cn } from '@/lib/utils'
import { HostSwitcher } from '@/components/HostSwitcher'

const groupOrder = ['Core', 'Policy', 'Routing', 'Resolve', 'Telemetry', 'Limit']

const resourceIcons: Record<ResourceKey, LucideIcon> = {
  services:   Globe2,
  chains:     Link2,
  hops:       Boxes,
  authers:    Key,
  admissions: ShieldCheck,
  bypasses:   CircleSlash2,
  resolvers:  ServerCog,
  hosts:      MapPin,
  ingresses:  DoorOpen,
  routers:    Route,
  observers:  Eye,
  recorders:  Disc,
  sds:        Radar,
  limiters:   Gauge,
  climiters:  Activity,
  rlimiters:  Timer,
}

const groups = RESOURCES.reduce<Record<string, ResourceDef[]>>((acc, r) => {
  ;(acc[r.group] ||= []).push(r)
  return acc
}, {})

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  // 路由变化时自动收起抽屉（NavItem 点击也会主动关一次，这是冗余兜底——
  // 比如用户用浏览器后退/前进按钮切路由时也能正确关上）。
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-full min-h-screen text-[14px]">
      <span aria-hidden className="live-wire" />
      <Sidebar drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-4 md:px-10 py-8 max-w-[1180px]">
          {/* 移动端汉堡按钮：只在 <md 显示 */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开侧栏"
            className="md:hidden mb-4 inline-flex items-center justify-center h-9 w-9 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)] transition-colors"
          >
            <Menu size={16} strokeWidth={1.75} />
          </button>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function Sidebar({
  drawerOpen,
  onCloseDrawer,
}: {
  drawerOpen: boolean
  onCloseDrawer: () => void
}) {
  return (
    <>
      {/* 移动端蒙层背景，仅在抽屉打开时显示 */}
      <div
        aria-hidden
        onClick={onCloseDrawer}
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200',
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside
        className={cn(
          // 基础布局
          'w-[248px] shrink-0 border-r border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface)_70%,transparent)] backdrop-blur-sm flex flex-col',
          // 移动端：固定定位 + 滑出动画
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
          // 桌面端：恢复静态布局
          'md:static md:translate-x-0 md:z-auto',
        )}
      >
        <HostSwitcher />
        <HealthStrip />

        <nav className="px-3 pb-6 overflow-y-auto flex-1">
          <NavSection seq="00" title={T.nav.global}>
            <NavItem to="/cookbook" icon={ChefHat}    label="场景菜谱" onNavigate={onCloseDrawer} />
            <NavItem to="/config"   icon={FileJson}   label={T.nav.rawConfig} onNavigate={onCloseDrawer} />
            <NavItem to="/metrics"  icon={BarChart3}  label={T.metrics.title} onNavigate={onCloseDrawer} />
            <NavItem to="/logs"     icon={ScrollText} label="日志" onNavigate={onCloseDrawer} />
          </NavSection>

          {groupOrder.map((g, i) => (
            <NavSection key={g} seq={String(i + 1).padStart(2, '0')} title={GROUP_LABEL_ZH[g] ?? g}>
              {groups[g]?.map((r) => (
                <NavItem
                  key={r.key}
                  to={`/r/${r.key}`}
                  icon={resourceIcons[r.key]}
                  label={RESOURCE_LABEL_ZH[r.key]}
                  onNavigate={onCloseDrawer}
                />
              ))}
            </NavSection>
          ))}
        </nav>

        <SidebarFooter />
      </aside>
    </>
  )
}

function HealthStrip() {
  const { activeId } = useProfilesState()
  // queryKey 含 profile id，切主机时不会复用上一个主机的缓存结果
  const ping = useQuery({
    queryKey: ['health', activeId],
    queryFn: async () => {
      await api.get('/config/services')
      return Date.now()
    },
    enabled: !!activeId,
    refetchInterval: (q) => (q.state.error ? 30_000 : 8_000),
    refetchIntervalInBackground: false,
    retry: 0,
    staleTime: 5_000,
  })
  const online = ping.isSuccess && !ping.isError

  return (
    <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center gap-2 text-[10px] font-mono text-[var(--color-muted)]">
      <span
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full',
          online
            ? 'bg-[var(--color-accent)] pulse-dot'
            : ping.isPending
              ? 'bg-[var(--color-warn)]'
              : 'bg-[var(--color-danger)]',
        )}
      />
      <span
        className={cn(
          'uppercase tracking-[0.12em]',
          online ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]',
        )}
      >
        {online ? 'online' : ping.isPending ? 'probing' : 'offline'}
      </span>
    </div>
  )
}

function NavSection({
  seq,
  title,
  children,
}: {
  seq: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-5 first:mt-4">
      <div className="px-2 mb-1.5 flex items-baseline gap-2">
        <span className="eyebrow">{seq}</span>
        <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--color-fg-2)]">
          {title}
        </span>
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string
  label: string
  icon: LucideIcon
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md',
          'text-[13px] transition-colors duration-100',
          isActive
            ? 'bg-[var(--color-surface-2)] text-[var(--color-fg)]'
            : 'text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              'absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r',
              isActive ? 'bg-[var(--color-accent)]' : 'bg-transparent group-hover:bg-[var(--color-border-strong)]',
            )}
          />
          <Icon size={14} className={isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)] group-hover:text-[var(--color-fg-2)]'} strokeWidth={1.75} />
          <span className="flex-1 tracking-tight">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SidebarFooter() {
  return (
    <div className="border-t border-[var(--color-border)] px-4 py-3 flex items-center justify-end text-[10px] font-mono text-[var(--color-muted)] tracking-wider uppercase">
      <a
        href="https://gost.run"
        target="_blank"
        rel="noreferrer"
        className="hover:text-[var(--color-accent)] transition-colors"
      >
        docs ↗
      </a>
    </div>
  )
}

import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
  info: ErrorInfo | null
}

/**
 * 顶层错误边界。组件树里任何渲染期 / 生命周期里抛出的同步异常都会被它接住，
 * 防止 React 把整个根节点卸掉变白屏。事件回调里的异步错误它管不到，那种走 toast。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info })
    // 控制台留一份，方便用户截图反馈。
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const err = this.state.error
    const stack = this.state.info?.componentStack ?? err.stack ?? ''

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <span aria-hidden className="live-wire" />
        <div className="relative max-w-md w-full overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[var(--color-danger-soft)] p-5">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-danger)] to-transparent opacity-70"
          />
          <div className="eyebrow mb-2 text-[var(--color-danger)]">界面崩溃</div>
          <h1 className="text-[18px] font-semibold tracking-tight mb-2 text-[var(--color-fg)]">
            出了点状况
          </h1>
          <p className="text-[12px] text-[var(--color-fg-2)] leading-relaxed mb-3">
            页面在渲染时抛出了未捕获的异常，已被错误边界拦住。重新加载通常就能恢复；
            如果反复出现，请把下方堆栈复制给开发者。
          </p>
          <code className="font-mono block text-[12px] text-[var(--color-danger)] bg-[var(--color-surface)]/40 border border-[var(--color-border)] rounded-md px-2.5 py-1.5 break-all">
            {err.message || String(err)}
          </code>
          {stack ? (
            <details className="mt-3 text-[11px] text-[var(--color-muted)]">
              <summary className="cursor-pointer select-none hover:text-[var(--color-fg-2)]">
                查看堆栈
              </summary>
              <pre className="mt-2 font-mono whitespace-pre-wrap break-all bg-[var(--color-surface)]/40 border border-[var(--color-border)] rounded-md p-2 max-h-64 overflow-auto">
                {stack}
              </pre>
            </details>
          ) : null}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center h-8 px-3 text-[13px] rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:opacity-90 transition-opacity"
            >
              重新加载
            </button>
            <a
              href="/"
              className="inline-flex items-center h-8 px-3 text-[13px] rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)] transition-colors"
            >
              返回首页
            </a>
          </div>
        </div>
      </div>
    )
  }
}

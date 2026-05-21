import { useState } from 'react'
import { ChefHat } from 'lucide-react'
import { RECIPE_CATEGORIES, RECIPES, type Recipe, type RecipeCategory } from '@/lib/cookbook'
import { RecipeDialog } from '@/components/RecipeDialog'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { RESOURCE_LABEL_ZH } from '@/lib/i18n'

export function CookbookPage() {
  const [category, setCategory] = useState<RecipeCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Recipe | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = RECIPES.filter(
    (r) =>
      (category === 'all' || r.category === category) &&
      (!q ||
        r.label.toLowerCase().includes(q) ||
        r.scene.toLowerCase().includes(q) ||
        r.describe.toLowerCase().includes(q)),
  )

  return (
    <div>
      <header className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">/cookbook</div>
          <h1 className="text-[28px] leading-none font-semibold tracking-tight flex items-center gap-3">
            <ChefHat size={22} strokeWidth={1.75} className="text-[var(--color-accent)]" />
            场景菜谱
          </h1>
          <p className="text-[13px] text-[var(--color-fg-2)] mt-2 max-w-2xl leading-relaxed">
            每条配方 = 一组多资源的完整配置。点开看场景说明 / 微调参数 / 一键应用，自动创建涉及的 service、chain、hop、bypass 等。
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Pill active={category === 'all'} onClick={() => setCategory('all')}>
          全部 · {RECIPES.length}
        </Pill>
        {RECIPE_CATEGORIES.map((c) => {
          const n = RECIPES.filter((r) => r.category === c.key).length
          return (
            <Pill
              key={c.key}
              active={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.label} · {n}
            </Pill>
          )
        })}
        <div className="flex-1" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜场景 / 关键词"
          className="w-64 max-w-full"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-[var(--color-border)] rounded-lg p-12 text-center">
          <div className="eyebrow mb-2">无匹配</div>
          <div className="text-[14px] text-[var(--color-fg-2)]">
            没找到合适的菜谱，换个关键词或类别看看。
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((r) => (
            <RecipeCard key={r.key} recipe={r} onPick={() => setPicked(r)} />
          ))}
        </div>
      )}

      <RecipeDialog
        open={!!picked}
        onOpenChange={(v) => { if (!v) setPicked(null) }}
        recipe={picked}
      />
    </div>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 px-2.5 text-[12px] rounded-md border transition-colors',
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] border-[var(--color-accent)]'
          : 'bg-[var(--color-surface)] text-[var(--color-fg-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]',
      )}
    >
      {children}
    </button>
  )
}

function RecipeCard({ recipe, onPick }: { recipe: Recipe; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="group text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[color-mix(in_oklab,var(--color-accent-soft)_40%,var(--color-surface))] transition-colors p-4 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[14px] font-semibold tracking-tight text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">
          {recipe.label}
        </div>
        <span className="eyebrow shrink-0">
          {RECIPE_CATEGORIES.find((c) => c.key === recipe.category)?.label}
        </span>
      </div>
      <div className="text-[12.5px] text-[var(--color-fg-2)] leading-relaxed">
        {recipe.scene}
      </div>
      <div className="text-[10px] font-mono tracking-wide text-[var(--color-muted)] truncate">
        {recipe.resources.map((r) => `${RESOURCE_LABEL_ZH[r.kind]}`).join(' · ')}
      </div>
    </button>
  )
}

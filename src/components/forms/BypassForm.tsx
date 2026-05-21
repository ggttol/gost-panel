import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextareaField, Switch } from '@/components/ui/Form'

function matchersToText(v: unknown): string {
  if (!Array.isArray(v)) return ''
  return (v as unknown[]).map((s) => String(s)).join('\n')
}

function textToMatchers(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

export function MatcherListSection({
  value,
  onChange,
  disabled,
  switchHint,
  matchersHint,
  placeholder,
}: ResourceFormProps & {
  switchHint: string
  matchersHint: string
  placeholder: string
}) {
  const whitelist = Boolean(value.whitelist)
  const text = matchersToText(value.matchers)

  return (
    <FormSection title="匹配规则">
      <FieldRow label="白名单模式" inline>
        <Switch
          checked={whitelist}
          onChange={(v) => onChange({ ...value, whitelist: v })}
          hint={switchHint}
        />
      </FieldRow>
      <FieldRow label="规则列表">
        <TextareaField
          value={text}
          rows={6}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange({ ...value, matchers: textToMatchers(e.target.value) })}
        />
        <div className="text-[10px] text-[var(--color-muted)] mt-1 whitespace-pre-line leading-relaxed">
          {matchersHint}
        </div>
      </FieldRow>
    </FormSection>
  )
}

export function BypassForm(props: ResourceFormProps) {
  return (
    <MatcherListSection
      {...props}
      switchHint="关闭=黑名单（命中则跳过链路、直连）；开启=白名单（仅命中才走链路，其它直连）"
      matchersHint={
        '每行一条规则，留空忽略。支持三种写法：\n· IP 或 CIDR：127.0.0.1、192.168.0.0/16\n· 通配域名：*.example.com（含子域名）\n· 后缀域名：.example.org'
      }
      placeholder={'*.example.com\n.example.org\n0.0.0.0/8'}
    />
  )
}

export default BypassForm

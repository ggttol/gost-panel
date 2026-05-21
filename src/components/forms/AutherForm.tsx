import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, RowList } from '@/components/ui/Form'

type AuthEntry = { username?: string; password?: string }

export function AutherForm({ value, onChange, disabled }: ResourceFormProps) {
  const auths: AuthEntry[] = Array.isArray(value.auths) ? (value.auths as AuthEntry[]) : []

  const update = (next: AuthEntry[]) => {
    onChange({ ...value, auths: next })
  }

  return (
    <FormSection
      title="账号列表"
      hint="用于鉴权的用户名 / 密码组合；每点一次「添加账号」= 多一个可登录账号"
    >
      <RowList<AuthEntry>
        items={auths}
        addLabel="＋ 添加账号"
        empty="暂无账号"
        onAdd={() => update([...auths, { username: '', password: '' }])}
        onRemove={(i) => update(auths.filter((_, idx) => idx !== i))}
        render={(item, i) => (
          <div className="flex flex-col gap-2">
            <FieldRow label="用户名" inline hint="登录用户名（任意字符串，会原样校验）">
              <TextField
                value={item.username ?? ''}
                disabled={disabled}
                placeholder="user"
                onChange={(e) => {
                  const next = auths.slice()
                  next[i] = { ...item, username: e.target.value }
                  update(next)
                }}
              />
            </FieldRow>
            <FieldRow
              label="密码"
              inline
              hint="登录密码（明文存储；建议给 gost 单独建账号，别复用主密码）"
            >
              <TextField
                value={item.password ?? ''}
                disabled={disabled}
                placeholder="pass"
                type="text"
                autoComplete="off"
                onChange={(e) => {
                  const next = auths.slice()
                  next[i] = { ...item, password: e.target.value }
                  update(next)
                }}
              />
            </FieldRow>
          </div>
        )}
      />
    </FormSection>
  )
}

export default AutherForm

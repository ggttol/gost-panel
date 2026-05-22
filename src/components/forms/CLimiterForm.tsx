import type { ResourceFormProps } from '@/components/forms/types'
import { LimitsEditor } from '@/components/forms/LimitsEditor'

export function CLimiterForm(props: ResourceFormProps) {
  return (
    <LimitsEditor
      {...props}
      kind="count"
      title="并发连接限制"
      hint={
        '每条规则 = 一个适用对象 + 最大并发连接数。\n例：$ 1000 表示整个服务最多 1000 并发；$$ 100 表示每客户端最多 100 并发。'
      }
      v1Label="并发上限"
      v1Placeholder="1000"
    />
  )
}

export default CLimiterForm

import type { ResourceFormProps } from '@/components/forms/types'
import { LimitsEditor } from '@/components/forms/LimitsEditor'

export function RLimiterForm(props: ResourceFormProps) {
  return (
    <LimitsEditor
      {...props}
      kind="count"
      title="速率限制 (QPS)"
      hint={
        '每条规则 = 一个适用对象 + 每秒请求数上限。\n例：$ 100 表示整个服务最多 100 QPS；$$ 10 表示每客户端最多 10 QPS。'
      }
      v1Label="QPS 上限"
      v1Placeholder="100"
    />
  )
}

export default RLimiterForm

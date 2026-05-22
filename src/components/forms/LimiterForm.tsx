import type { ResourceFormProps } from '@/components/forms/types'
import { LimitsEditor } from '@/components/forms/LimitsEditor'

export function LimiterForm(props: ResourceFormProps) {
  return (
    <LimitsEditor
      {...props}
      kind="bandwidth"
      title="带宽限速规则"
      hint={
        '每条规则 = 一个适用对象 + 入向 / 出向速率上限。\n单位支持 KB、MB、GB（每秒），例如 1MB = 1MB/s。'
      }
      v1Label="入向 in"
      v1Placeholder="1MB"
      v2Label="出向 out"
      v2Placeholder="2MB"
    />
  )
}

export default LimiterForm

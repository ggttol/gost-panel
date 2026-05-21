import type { ResourceFormProps } from '@/components/forms/types'
import { MatcherListSection } from '@/components/forms/BypassForm'

export function AdmissionForm(props: ResourceFormProps) {
  return (
    <MatcherListSection
      {...props}
      switchHint="关闭=黑名单（命中则拒绝）；开启=白名单（仅命中才允许，其它一律拒绝）"
      matchersHint={
        '每行一条规则，留空忽略。准入规则一般写 IP/CIDR：\n· 单 IP：203.0.113.10\n· 整段：192.168.0.0/16\n· 内网放行示例：10.0.0.0/8 / 172.16.0.0/12 / 192.168.0.0/16'
      }
      placeholder={'127.0.0.1\n192.168.0.0/16'}
    />
  )
}

export default AdmissionForm

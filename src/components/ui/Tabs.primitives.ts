import * as TabsPrimitive from '@radix-ui/react-tabs'

// Radix 原始 re-export，不是组件本身。
// 拆到独立文件，避免 react-refresh 触发 only-export-components 警告。
export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

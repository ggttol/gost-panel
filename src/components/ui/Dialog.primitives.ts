import * as DialogPrimitive from '@radix-ui/react-dialog'

// 这些是 Radix 原始 re-export，不是组件本身。
// 拆到独立文件，避免 react-refresh 触发 only-export-components 警告。
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

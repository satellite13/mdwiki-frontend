export type ToolbarAction = {
  key: string
  title: string
  ariaLabel: string
  icon: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

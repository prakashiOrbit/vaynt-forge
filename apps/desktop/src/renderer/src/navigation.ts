import {
  Activity,
  BookOpen,
  FileJson,
  FlaskConical,
  FolderOpen,
  History,
  Home,
  Keyboard,
  Layers,
  Radio,
  Send,
  Server,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  section: 'main' | 'bottom'
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, section: 'main' },
  { id: 'requests', label: 'Requests', icon: Send, section: 'main' },
  { id: 'collections', label: 'Collections', icon: FolderOpen, section: 'main' },
  { id: 'tests', label: 'Tests', icon: FlaskConical, section: 'main' },
  { id: 'mock-servers', label: 'Mock Servers', icon: Server, section: 'main' },
  { id: 'openapi', label: 'OpenAPI', icon: FileJson, section: 'main' },
  { id: 'history', label: 'History', icon: History, section: 'main' },
  { id: 'performance', label: 'Performance', icon: Activity, section: 'main' },
  { id: 'websockets', label: 'WebSockets', icon: Radio, section: 'main' },
  { id: 'environments', label: 'Environments', icon: Layers, section: 'main' },
  { id: 'documentation', label: 'Documentation', icon: BookOpen, section: 'main' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, section: 'bottom' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'bottom' },
]

export function navLabel(id: string): string {
  return NAV_ITEMS.find((n) => n.id === id)?.label ?? 'Vaynt Forge'
}
import { useEffect, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import TabBar from './TabBar'
import TerminalPane from './TerminalPane'
import { newTab, resetTabCounter, type TabInfo } from './tabs'

export default function DevServerPanel() {
  const project = useAppStore(s => s.project)
  const devServerCommand = useAppStore(s => s.devServerCommand)

  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [activeId, setActiveId] = useState<string>('')

  // create initial tab when project opens
  useEffect(() => {
    if (!project) return
    resetTabCounter()
    const first = newTab(devServerCommand?.name ?? 'terminal')
    setTabs([first])
    setActiveId(first.id)
  }, [project?.path])

  const addTab = () => {
    const tab = newTab('terminal')
    setTabs(prev => [...prev, tab])
    setActiveId(tab.id)
  }

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeId === id) setActiveId(next[next.length - 1]?.id ?? '')
      return next
    })
  }

  /** Swap the active tab for a fresh one — a new key forces a remount. */
  const replaceActiveTab = (command: string | null) => {
    const index = tabs.findIndex(t => t.id === activeId)
    if (index < 0) return
    const fresh = newTab(tabs[index].label, command)
    setTabs(prev => {
      const next = [...prev]
      next[index] = fresh
      return next
    })
    setActiveId(fresh.id)
  }

  if (!project || tabs.length === 0) return null

  return (
    <div className="panel h-full">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        devServerScript={devServerCommand?.script ?? null}
        onSelect={setActiveId}
        onClose={closeTab}
        onAdd={addTab}
        onRunScript={() => devServerCommand && replaceActiveTab(devServerCommand.script)}
        onRestart={() => replaceActiveTab(null)}
      />

      <div className="panel-body">
        {tabs.map(tab => (
          <TerminalPane
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            projectPath={project.path}
            autoCommand={tab.command}
          />
        ))}
      </div>
    </div>
  )
}

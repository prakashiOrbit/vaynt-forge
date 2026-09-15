import { useEffect } from 'react'
import { useData } from '../stores/data'
import { useSession } from '../stores/session'

/**
 * Loads the workspace list once, reconciles the persisted active workspace id
 * with reality, and lazily hydrates the active workspace bucket — including on
 * every workspace switch.
 */
export function DataBootstrapper() {
  const inited = useData((s) => s.inited)
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)

  useEffect(() => {
    const boot = async () => {
      await useData.getState().init()
      const workspaces = useData.getState().workspaces
      if (workspaces.length === 0) return
      const session = useSession.getState()
      if (!workspaces.some((w) => w.id === session.activeWorkspaceId)) {
        session.setActiveWorkspace(workspaces[0]!.id)
      }
      void useData.getState().ensureLoaded(useSession.getState().activeWorkspaceId)
    }
    void boot()
  }, [])

  useEffect(() => {
    if (inited && activeWorkspaceId) void useData.getState().ensureLoaded(activeWorkspaceId)
  }, [inited, activeWorkspaceId])

  return null
}
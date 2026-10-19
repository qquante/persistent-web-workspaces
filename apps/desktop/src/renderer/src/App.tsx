import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type {
  DashboardSnapshot,
  Profile,
  ProfilePriority,
  SessionSnapshot,
  ViewBounds,
} from '@multi-idle/contracts'

const stateLabel: Record<SessionSnapshot['state'], string> = {
  stopped: 'Parado',
  starting: 'Iniciando',
  online: 'Online',
  hidden: 'Oculto',
  error: 'Erro',
  crashed: 'Falhou',
}

const stateTone: Record<SessionSnapshot['state'], string> = {
  stopped: 'neutral',
  starting: 'warning',
  online: 'success',
  hidden: 'info',
  error: 'danger',
  crashed: 'danger',
}

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null)
  const [showCreateProfile, setShowCreateProfile] = useState(false)

  useEffect(() => {
    const unsubscribe = window.multiIdle.onSnapshot(setSnapshot)
    window.multiIdle.bootstrap().then(setSnapshot).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Falha ao iniciar o aplicativo.')
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    window.multiIdle.setShellOverlay(showCreateProfile)
    return () => window.multiIdle.setShellOverlay(false)
  }, [showCreateProfile])

  const sessionsByProfile = useMemo(
    () => new Map(snapshot?.sessions.map((session) => [session.profileId, session]) ?? []),
    [snapshot],
  )
  const visibleProfiles = useMemo(
    () =>
      snapshot?.profiles.filter((profile) => {
        const state = sessionsByProfile.get(profile.id)?.state
        return state !== undefined && state !== 'stopped' && state !== 'hidden'
      }) ?? [],
    [sessionsByProfile, snapshot],
  )

  async function runProfileAction(
    profileId: string,
    action: () => Promise<DashboardSnapshot>,
  ): Promise<void> {
    setBusyProfileId(profileId)
    setError(null)
    try {
      setSnapshot(await action())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'A operação não pôde ser concluída.')
    } finally {
      setBusyProfileId(null)
    }
  }

  if (!snapshot) {
    return (
      <main className="boot-screen">
        <div className="brand-mark">M</div>
        <p>{error ?? 'Preparando o Multi Idle…'}</p>
      </main>
    )
  }

  const totalMemory = snapshot.sessions.reduce((sum, session) => sum + session.memoryMb, 0)
  const totalCpu = snapshot.sessions.reduce((sum, session) => sum + session.cpuPercent, 0)
  const activeCount = snapshot.sessions.filter((session) => session.state !== 'stopped').length
  const hiddenCount = snapshot.sessions.filter((session) => session.state === 'hidden').length

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Navegação principal">
        <div className="brand-mark compact">M</div>
        <button className="rail-button active" title="Sessões" aria-label="Sessões">
          ▦
        </button>
        <button className="rail-button" title="Perfis" aria-label="Perfis">
          ◉
        </button>
        <button className="rail-button" title="Proxies" aria-label="Proxies" disabled>
          ⌁
        </button>
        <span className="rail-spacer" />
        <button className="rail-button" title="Configurações" aria-label="Configurações" disabled>
          ⚙
        </button>
      </aside>

      <aside className="roster">
        <header className="roster-header">
          <span className="eyebrow">WORKSPACE</span>
          <strong>{snapshot.workspaces[0]?.name ?? 'Principal'}</strong>
          <span className="roster-summary">{snapshot.profiles.length} perfis cadastrados</span>
        </header>

        <div className="search-box" aria-hidden="true">⌕ Buscar perfil</div>

        <div className="profile-list">
          {snapshot.profiles.length === 0 ? (
            <div className="empty-roster">
              <span>Nenhum perfil</span>
              <small>Crie o primeiro para abrir uma sessão isolada.</small>
            </div>
          ) : null}
          {snapshot.profiles.map((profile) => {
            const session = sessionsByProfile.get(profile.id)
            if (!session) return null
            const isBusy = busyProfileId === profile.id
            return (
              <article className="profile-row" key={profile.id}>
                <span className={`status-dot ${stateTone[session.state]}`} />
                <div className="profile-copy">
                  <strong>{profile.name}</strong>
                  <small>
                    {stateLabel[session.state]}
                    {session.state !== 'stopped'
                      ? ` · ${session.memoryMb.toFixed(0)} MB`
                      : ''}
                  </small>
                </div>
                {session.state === 'stopped' ? (
                  <button
                    className="row-action"
                    disabled={isBusy}
                    onClick={() =>
                      void runProfileAction(profile.id, () =>
                        window.multiIdle.startSession(profile.id),
                      )
                    }
                    title="Iniciar sessão"
                  >
                    ▶
                  </button>
                ) : session.state === 'hidden' ? (
                  <button
                    className="row-action"
                    disabled={isBusy}
                    onClick={() =>
                      void runProfileAction(profile.id, () =>
                        window.multiIdle.showSession(profile.id),
                      )
                    }
                    title="Mostrar sessão"
                  >
                    ◫
                  </button>
                ) : (
                  <button
                    className="row-action"
                    disabled={isBusy}
                    onClick={() =>
                      void runProfileAction(profile.id, () =>
                        window.multiIdle.hideSession(profile.id),
                      )
                    }
                    title="Ocultar sessão"
                  >
                    —
                  </button>
                )}
              </article>
            )
          })}
        </div>

        <button className="primary-button roster-create" onClick={() => setShowCreateProfile(true)}>
          + Novo perfil
        </button>
      </aside>

      <main className="control-room">
        <header className="topbar">
          <div>
            <span className="eyebrow">CONTROL ROOM</span>
            <h1>Sessões operacionais</h1>
          </div>
          <div className="topbar-stats">
            <span><b>{activeCount}</b> ativas</span>
            <span><b>{hiddenCount}</b> ocultas</span>
            <button className="primary-button" onClick={() => setShowCreateProfile(true)}>
              + Criar perfil
            </button>
          </div>
        </header>

        {error ? (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => setError(null)}>Fechar</button>
          </div>
        ) : null}

        <section
          className={`session-grid count-${Math.min(visibleProfiles.length, 12)}`}
          aria-label="Sessões visíveis"
        >
          {visibleProfiles.length === 0 ? (
            <div className="empty-stage">
              <div className="empty-visual">▦</div>
              <h2>Seu espaço está pronto</h2>
              <p>Crie um perfil e inicie a primeira sessão isolada.</p>
              <button className="primary-button" onClick={() => setShowCreateProfile(true)}>
                Criar primeiro perfil
              </button>
            </div>
          ) : null}

          {visibleProfiles.map((profile) => {
            const session = sessionsByProfile.get(profile.id)
            if (!session) return null
            return (
              <SessionTile
                key={profile.id}
                profile={profile}
                session={session}
                busy={busyProfileId === profile.id}
                run={(action) => runProfileAction(profile.id, action)}
              />
            )
          })}
        </section>

        <footer className="statusbar">
          <span className="healthy">● Núcleo local saudável</span>
          <span>CPU {totalCpu.toFixed(1)}%</span>
          <span>RAM {totalMemory.toFixed(0)} MB</span>
          <span>GPU · {snapshot.gpu.status}</span>
          <span className="version">v0.1.0</span>
        </footer>
      </main>

      {showCreateProfile ? (
        <CreateProfileDialog
          workspaceId={snapshot.workspaces[0]?.id}
          onClose={() => setShowCreateProfile(false)}
          onCreated={(nextSnapshot) => {
            setSnapshot(nextSnapshot)
            setShowCreateProfile(false)
          }}
        />
      ) : null}
    </div>
  )
}

function SessionTile({
  profile,
  session,
  busy,
  run,
}: {
  profile: Profile
  session: SessionSnapshot
  busy: boolean
  run(action: () => Promise<DashboardSnapshot>): Promise<void>
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [address, setAddress] = useState(session.url)

  useEffect(() => setAddress(session.url), [session.url])

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const updateBounds = () => {
      const rect = element.getBoundingClientRect()
      const left = Math.max(0, rect.left)
      const top = Math.max(0, rect.top)
      const right = Math.min(window.innerWidth, rect.right)
      const bottom = Math.min(window.innerHeight, rect.bottom)
      const bounds: ViewBounds = {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.max(0, Math.round(right - left)),
        height: Math.max(0, Math.round(bottom - top)),
      }
      window.multiIdle.setViewBounds(profile.id, bounds)
    }

    const observer = new ResizeObserver(updateBounds)
    observer.observe(element)
    window.addEventListener('resize', updateBounds)
    window.addEventListener('scroll', updateBounds, true)
    updateBounds()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds, true)
      window.multiIdle.setViewBounds(profile.id, null)
    }
  }, [profile.id])

  function submitNavigation(event: FormEvent): void {
    event.preventDefault()
    void run(() => window.multiIdle.navigate(profile.id, address))
  }

  return (
    <article className="session-tile">
      <header className="session-titlebar">
        <span className={`status-dot ${stateTone[session.state]}`} />
        <strong>{profile.name}</strong>
        <span className="session-metric">CPU {session.cpuPercent.toFixed(1)}%</span>
        <span className="session-metric">RAM {session.memoryMb.toFixed(0)} MB</span>
        <button
          disabled={busy || !session.canGoBack}
          onClick={() => void run(() => window.multiIdle.goBack(profile.id))}
          title="Voltar"
        >
          ←
        </button>
        <button
          disabled={busy || !session.canGoForward}
          onClick={() => void run(() => window.multiIdle.goForward(profile.id))}
          title="Avançar"
        >
          →
        </button>
        <button
          disabled={busy}
          onClick={() => void run(() => window.multiIdle.reload(profile.id))}
          title="Recarregar"
        >
          ↻
        </button>
        <button
          disabled={busy}
          onClick={() => void run(() => window.multiIdle.hideSession(profile.id))}
          title="Ocultar"
        >
          —
        </button>
        <button
          disabled={busy}
          onClick={() => void run(() => window.multiIdle.stopSession(profile.id))}
          title="Parar"
        >
          ■
        </button>
      </header>
      <form className="addressbar" onSubmit={submitNavigation}>
        <span>⌕</span>
        <input
          aria-label={`Endereço de ${profile.name}`}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          spellCheck={false}
        />
      </form>
      <div className="session-viewport" ref={viewportRef}>
        <span>{stateLabel[session.state]}…</span>
      </div>
    </article>
  )
}

function CreateProfileDialog({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string | undefined
  onClose(): void
  onCreated(snapshot: DashboardSnapshot): void
}) {
  const [name, setName] = useState('')
  const [startUrl, setStartUrl] = useState('https://example.com')
  const [priority, setPriority] = useState<ProfilePriority>('normal')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!workspaceId) return
    setSaving(true)
    setError(null)
    try {
      onCreated(
        await window.multiIdle.createProfile({ workspaceId, name, startUrl, priority }),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="dialog" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">NOVO PERFIL</span>
            <h2>Criar sessão isolada</h2>
          </div>
          <button type="button" className="dialog-close" onClick={onClose}>×</button>
        </header>
        <label>
          Nome do perfil
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </label>
        <label>
          Endereço inicial
          <input value={startUrl} onChange={(event) => setStartUrl(event.target.value)} spellCheck={false} />
        </label>
        <label>
          Prioridade de recursos
          <select value={priority} onChange={(event) => setPriority(event.target.value as ProfilePriority)}>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="economy">Econômica</option>
          </select>
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={saving || name.trim().length === 0}>
            {saving ? 'Criando…' : 'Criar perfil'}
          </button>
        </footer>
      </form>
    </div>
  )
}

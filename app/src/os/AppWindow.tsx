import React, { useRef, useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import WindowTitleBar from './components/WindowTitleBar';
import { useOSStore, type WindowState } from './store/useOSStore';

const MINIMIZE_ANIM_MS = 220;
const RESIZE_ANIM_MS = 280;

interface AppWindowProps {
  window: WindowState;
  children: React.ReactNode;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WindowErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Window application crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ fontWeight: 600, color: '#f87171', marginBottom: 8 }}>
            This application encountered an unexpected error.
          </p>
          <p style={{ fontSize: 12 }}>{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWindow({ window: win, children }: AppWindowProps) {
  const { focusWindow, updatePosition, updateSize, maximizeWindow, unmaximizeWindow } = useOSStore();
  const rndRef = useRef<Rnd>(null);

  // Keep the window mounted for a beat after it's minimized so the
  // scale-down-into-the-dock animation can actually play before it vanishes.
  const [isPlayingMinimize, setIsPlayingMinimize] = useState(false);
  const [reallyHidden, setReallyHidden] = useState(false);
  const wasMinimized = useRef(win.isMinimized);

  useEffect(() => {
    if (win.isMinimized && !wasMinimized.current) {
      setIsPlayingMinimize(true);
      const t = setTimeout(() => {
        setIsPlayingMinimize(false);
        setReallyHidden(true);
      }, MINIMIZE_ANIM_MS);
      wasMinimized.current = true;
      return () => clearTimeout(t);
    }
    if (!win.isMinimized) {
      wasMinimized.current = false;
      setReallyHidden(false);
    }
  }, [win.isMinimized]);

  // Briefly enable a CSS transition on size/position around a maximize /
  // unmaximize toggle only — never during a manual drag or resize, where a
  // transition would fight the mouse and feel laggy.
  const [isAnimatingResize, setIsAnimatingResize] = useState(false);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsAnimatingResize(true);
    const t = setTimeout(() => setIsAnimatingResize(false), RESIZE_ANIM_MS);
    return () => clearTimeout(t);
  }, [win.isMaximized]);

  if (win.isMinimized && reallyHidden) {
    return null;
  }

  return (
    <Rnd
      ref={rndRef}
      size={{ width: win.size.width, height: win.size.height }}
      position={{ x: win.position.x, y: win.position.y }}
      onDragStart={() => { setIsAnimatingResize(false); focusWindow(win.id); }}
      onDragStop={(_, d) => updatePosition(win.id, { x: d.x, y: d.y })}
      onResizeStart={() => { setIsAnimatingResize(false); focusWindow(win.id); }}
      onResizeStop={(_, __, ref, ___, position) => {
        updateSize(win.id, {
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
        });
        updatePosition(win.id, position);
      }}
      minWidth={360}
      minHeight={260}
      bounds="parent"
      dragHandleClassName="window-titlebar"
      enableResizing={!win.isMaximized}
      disableDragging={win.isMaximized}
      style={{ zIndex: win.zIndex }}
      className={`window-container${isAnimatingResize ? ' window-resizing-animated' : ''}${isPlayingMinimize ? ' window-minimizing' : ''}`}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* The scale/fade entrance animation lives on this inner wrapper, never
          on the Rnd root above — that element's `transform` is what react-rnd
          rewrites on every drag frame, and a CSS animation there would fight it. */}
      <div className="window-pop-inner">
        <WindowTitleBar
          windowId={win.id}
          title={win.title}
          isMaximized={win.isMaximized}
          onDoubleClick={() => {
            if (win.isMaximized) unmaximizeWindow(win.id);
            else maximizeWindow(win.id);
          }}
        />
        <div
          className={`window-content custom-scrollbar window-content-${win.appType}`}
          style={{
            color: 'var(--text-primary)',
            ...(win.appType === 'code-lab' || win.appType === 'learn'
              ? { padding: '10px 12px', overflow: 'hidden' }
              : {}),
          }}
        >
          <WindowErrorBoundary>
            {children}
          </WindowErrorBoundary>
        </div>
      </div>
    </Rnd>
  );
}

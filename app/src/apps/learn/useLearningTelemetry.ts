import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useOSStore } from '../../os/store/useOSStore';
import { useAuth } from '../../context/AuthContext';

interface UseLearningTelemetryProps {
  subjectId: string;
  subjectName: string;
  moduleId: string;
  moduleTitle: string;
  readTimeStr?: string;
  containerRef: React.RefObject<HTMLElement>;
}

/**
 * Parse strings like "12 min read" into integer seconds (e.g. 720)
 */
function parseReadTimeToSeconds(readTimeStr?: string): number {
  if (!readTimeStr) return 600;
  const match = readTimeStr.match(/(\d+)/);
  if (match) {
    const mins = parseInt(match[1], 10);
    return mins * 60;
  }
  return 600;
}

export function useLearningTelemetry({
  subjectId,
  subjectName,
  moduleId,
  moduleTitle,
  readTimeStr,
  containerRef,
}: UseLearningTelemetryProps) {
  const { user } = useAuth();
  const windows = useOSStore((state) => state.windows);
  const focusedWindowId = useOSStore((state) => state.focusedWindowId);

  // Determine if the 'learn' window is currently the focused window in the OS
  const isLearnWindowFocused = (() => {
    if (!focusedWindowId) return true; // If only one window, or desktop focus
    const focusedWin = windows.find((w) => w.id === focusedWindowId);
    return !focusedWin || focusedWin.appType === 'learn';
  })();

  // Delta buffers to send on next heartbeat
  const bufferRef = useRef({
    activeSeconds: 0,
    totalSeconds: 0,
    idleSeconds: 0,
    scrollDistance: 0,
    scrollEventsCount: 0,
    scrollReversalsCount: 0,
    currentScrollDepthPct: 0,
    isRapidScroll: false,
  });

  const stateRef = useRef({
    lastInteractionTime: Date.now(),
    isWindowFocused: typeof document !== 'undefined' ? document.hasFocus() : true,
    isTabVisible: typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
    prevScrollTop: 0,
    lastScrollTime: Date.now(),
    lastScrollDirection: null as 'up' | 'down' | null,
    rapidScrollBurstCount: 0,
  });

  const propsRef = useRef({
    subjectId,
    subjectName,
    moduleId,
    moduleTitle,
    readTimeStr,
    user,
    isLearnWindowFocused,
  });

  // Keep refs up-to-date
  propsRef.current = {
    subjectId,
    subjectName,
    moduleId,
    moduleTitle,
    readTimeStr,
    user,
    isLearnWindowFocused,
  };

  // Helper to flush accumulated deltas to the backend
  const flushTelemetry = async () => {
    const { user: currentUser, subjectId: sId, subjectName: sName, moduleId: mId, moduleTitle: mTitle, readTimeStr: rTime } = propsRef.current;
    if (!currentUser || currentUser.role !== 'student') return;

    const b = bufferRef.current;
    if (b.activeSeconds === 0 && b.scrollDistance === 0 && b.idleSeconds === 0) {
      return; // Nothing new to report
    }

    const payload = {
      subject_id: sId,
      subject_name: sName,
      topic_id: mId,
      topic_title: mTitle,
      active_seconds_delta: b.activeSeconds,
      total_seconds_delta: b.totalSeconds,
      idle_seconds_delta: b.idleSeconds,
      scroll_distance_delta: b.scrollDistance,
      scroll_events_count_delta: b.scrollEventsCount,
      scroll_reversals_count_delta: b.scrollReversalsCount,
      current_scroll_depth_pct: b.currentScrollDepthPct,
      is_rapid_scroll: b.isRapidScroll,
      expected_read_time_seconds: parseReadTimeToSeconds(rTime),
    };

    // Reset buffer before async call to avoid losing events during request
    bufferRef.current = {
      activeSeconds: 0,
      totalSeconds: 0,
      idleSeconds: 0,
      scrollDistance: 0,
      scrollEventsCount: 0,
      scrollReversalsCount: 0,
      currentScrollDepthPct: b.currentScrollDepthPct,
      isRapidScroll: false,
    };

    try {
      await axios.post('/api/activity/heartbeat', payload);
    } catch (err) {
      console.error('Failed to send learning telemetry heartbeat:', err);
    }
  };

  // Flush when switching modules / topics
  useEffect(() => {
    return () => {
      flushTelemetry();
    };
  }, [moduleId]);

  // Main tracking effect: listeners and heartbeat tick interval
  useEffect(() => {
    if (!user || user.role !== 'student') return;

    const handleFocus = () => {
      stateRef.current.isWindowFocused = true;
      stateRef.current.lastInteractionTime = Date.now();
    };

    const handleBlur = () => {
      stateRef.current.isWindowFocused = false;
      flushTelemetry();
    };

    const handleVisibilityChange = () => {
      stateRef.current.isTabVisible = document.visibilityState === 'visible';
      if (stateRef.current.isTabVisible) {
        stateRef.current.lastInteractionTime = Date.now();
      } else {
        flushTelemetry();
      }
    };

    const handleUserInteraction = () => {
      stateRef.current.lastInteractionTime = Date.now();
    };

    // Scroll listener on reader container
    const container = containerRef.current;
    const handleScroll = () => {
      if (!container) return;
      const now = Date.now();
      stateRef.current.lastInteractionTime = now;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      const deltaY = Math.abs(scrollTop - stateRef.current.prevScrollTop);
      const timeDelta = Math.max(16, now - stateRef.current.lastScrollTime);
      const velocity = (deltaY / timeDelta) * 1000; // px / sec

      // Track direction & reversals
      const currentDir: 'up' | 'down' = scrollTop >= stateRef.current.prevScrollTop ? 'down' : 'up';
      if (stateRef.current.lastScrollDirection && stateRef.current.lastScrollDirection !== currentDir && deltaY > 30) {
        bufferRef.current.scrollReversalsCount += 1;
      }
      stateRef.current.lastScrollDirection = currentDir;

      // Speed scrolling detection: rapid bursts of high-velocity scrolling
      if (velocity > 1400 && deltaY > 200) {
        stateRef.current.rapidScrollBurstCount += 1;
        if (stateRef.current.rapidScrollBurstCount >= 2) {
          bufferRef.current.isRapidScroll = true;
        }
      }

      // Calculate scroll depth %
      const scrollable = scrollHeight - clientHeight;
      const depthPct = scrollable > 0 ? Math.min(100, Math.round((scrollTop / scrollable) * 100)) : 100;

      bufferRef.current.scrollDistance += Math.round(deltaY);
      bufferRef.current.scrollEventsCount += 1;
      bufferRef.current.currentScrollDepthPct = Math.max(bufferRef.current.currentScrollDepthPct, depthPct);

      stateRef.current.prevScrollTop = scrollTop;
      stateRef.current.lastScrollTime = now;
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('mousemove', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });

    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    // 1-second cadence timer for active vs idle tracking
    let secondsSinceLastHeartbeat = 0;
    const interval = setInterval(() => {
      const now = Date.now();
      const isIdle = now - stateRef.current.lastInteractionTime > 45000; // 45 seconds idle cutoff
      const isActivelyEngaged =
        stateRef.current.isWindowFocused &&
        stateRef.current.isTabVisible &&
        propsRef.current.isLearnWindowFocused &&
        !isIdle;

      bufferRef.current.totalSeconds += 1;

      if (isActivelyEngaged) {
        bufferRef.current.activeSeconds += 1;
      } else {
        bufferRef.current.idleSeconds += 1;
      }

      secondsSinceLastHeartbeat += 1;

      // Send batched heartbeat every 8 seconds of active time or every 20 seconds
      if (
        (bufferRef.current.activeSeconds >= 8) ||
        (secondsSinceLastHeartbeat >= 20 && bufferRef.current.activeSeconds > 0)
      ) {
        secondsSinceLastHeartbeat = 0;
        flushTelemetry();
      }
    }, 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
      clearInterval(interval);
      flushTelemetry();
    };
  }, [user, moduleId]);
}

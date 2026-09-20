import React from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { useOSStore } from '../store/useOSStore';

interface TrafficLightsProps {
  windowId: string;
  isMaximized: boolean;
}

export default function TrafficLights({ windowId, isMaximized }: TrafficLightsProps) {
  const { closeWindow, minimizeWindow, maximizeWindow, unmaximizeWindow } = useOSStore();

  return (
    <div
      className="window-controls-container"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 1. Minimize [-] */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          minimizeWindow(windowId);
        }}
        title="Minimize"
        className="window-control-btn window-control-minimize"
        aria-label="Minimize Window"
      >
        <Minus size={14} strokeWidth={2} />
      </button>

      {/* 2. Maximize / Restore [o] */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isMaximized) unmaximizeWindow(windowId);
          else maximizeWindow(windowId);
        }}
        title={isMaximized ? 'Restore' : 'Maximize'}
        className="window-control-btn window-control-maximize"
        aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
      >
        {isMaximized ? (
          <Copy size={11} strokeWidth={2} />
        ) : (
          <Square size={12} strokeWidth={2} />
        )}
      </button>

      {/* 3. Close [x] */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          closeWindow(windowId);
        }}
        title="Close"
        className="window-control-btn window-control-close"
        aria-label="Close Window"
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

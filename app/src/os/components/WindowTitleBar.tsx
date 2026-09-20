import React from 'react';
import TrafficLights from './TrafficLights';

interface WindowTitleBarProps {
  windowId: string;
  title: string;
  isMaximized: boolean;
  onDoubleClick: () => void;
}

export default function WindowTitleBar({ windowId, title, isMaximized, onDoubleClick }: WindowTitleBarProps) {
  return (
    <div
      onDoubleClick={onDoubleClick}
      className="window-titlebar"
    >
      <div className="window-title">
        {title}
      </div>
      <TrafficLights windowId={windowId} isMaximized={isMaximized} />
    </div>
  );
}

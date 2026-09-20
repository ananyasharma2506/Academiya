import React, { useRef, useState } from 'react';
import { motion, useTransform, useSpring, AnimatePresence, type MotionValue } from 'framer-motion';
import type { AppDefinition } from '../apps/registry';

interface DockIconProps {
  app: AppDefinition;
  isOpen: boolean;
  isActive: boolean;
  onClick: () => void;
  mouseX: MotionValue<number>;
}

const BASE_SIZE = 50;
const MAX_SIZE = 76;
const MAGNIFY_RADIUS = 130;
const SPRING = { mass: 0.12, stiffness: 260, damping: 18 };

export default function DockIcon({ app, isOpen, isActive, onClick, mouseX }: DockIconProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [justClicked, setJustClicked] = useState(false);

  // Distance from the cursor to this icon's own center, recomputed live —
  // the classic macOS dock "magnification wave" driven by cursor proximity.
  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return Infinity;
    return val - (bounds.x + bounds.width / 2);
  });

  const sizeTransform = useTransform(distance, [-MAGNIFY_RADIUS, 0, MAGNIFY_RADIUS], [BASE_SIZE, MAX_SIZE, BASE_SIZE]);
  const size = useSpring(sizeTransform, SPRING);
  const liftTransform = useTransform(distance, [-MAGNIFY_RADIUS, 0, MAGNIFY_RADIUS], [0, -12, 0]);
  const lift = useSpring(liftTransform, SPRING);

  const handleClick = () => {
    setJustClicked(true);
    setTimeout(() => setJustClicked(false), 260);
    onClick();
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.92 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 16px)',
              left: '50%',
              translateX: '-50%',
              background: 'rgba(15, 23, 42, 0.9)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.15)',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            {app.name}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tile */}
      <motion.button
        ref={ref}
        onClick={handleClick}
        animate={justClicked ? { y: [0, -14, 0] } : {}}
        transition={justClicked ? { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] } : undefined}
        style={{
          width: size,
          height: size,
          y: lift,
          borderRadius: 14,
          background: isActive
            ? 'rgba(255, 255, 255, 0.25)'
            : hovered
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(255, 255, 255, 0.08)',
          border: isActive
            ? '1px solid rgba(var(--accent), 0.8)'
            : '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          outline: 'none',
          boxShadow: isActive
            ? '0 0 14px rgba(var(--accent), 0.5)'
            : hovered
            ? '0 10px 22px rgba(0,0,0,0.35)'
            : 'none',
          transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        }}
      >
        {app.icon}
      </motion.button>

      {/* Active Dot */}
      <motion.div
        animate={{
          scale: isOpen ? 1 : 0,
          backgroundColor: isOpen ? (isActive ? 'rgb(var(--accent))' : 'rgba(255, 255, 255, 0.6)') : 'transparent',
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          marginTop: 4,
        }}
      />
    </div>
  );
}

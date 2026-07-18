import React, { useRef, useState, useCallback } from 'react';

const JOYSTICK_RADIUS = 58; 

export default function TouchControls({ game, doorPrompt, crouchOn, onCrouchChange }) {
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const stickBaseRef = useRef(null);
  const stickPointerId = useRef(null);

  const lookPointerId = useRef(null);
  const lookLast = useRef({ x: 0, y: 0 });

  const updateStick = useCallback(
    (clientX, clientY) => {
      const base = stickBaseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
      }
      setStickPos({ x: dx, y: dy });
      game?.setJoystickVector(dx / JOYSTICK_RADIUS, dy / JOYSTICK_RADIUS);
    },
    [game],
  );

  const onStickDown = useCallback(
    (e) => {
      e.target.setPointerCapture(e.pointerId);
      stickPointerId.current = e.pointerId;
      updateStick(e.clientX, e.clientY);
    },
    [updateStick],
  );

  const onStickMove = useCallback(
    (e) => {
      if (stickPointerId.current !== e.pointerId) return;
      updateStick(e.clientX, e.clientY);
    },
    [updateStick],
  );

  const onStickUp = useCallback((e) => {
    if (stickPointerId.current !== e.pointerId) return;
    stickPointerId.current = null;
    setStickPos({ x: 0, y: 0 });
    game?.clearJoystick();
  }, [game]);

  

  const onLookDown = useCallback((e) => {
    if (lookPointerId.current !== null) return;
    lookPointerId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onLookMove = useCallback(
    (e) => {
      if (lookPointerId.current !== e.pointerId) return;
      const dx = e.clientX - lookLast.current.x;
      const dy = e.clientY - lookLast.current.y;
      lookLast.current = { x: e.clientX, y: e.clientY };
      game?.lookDelta(dx, dy);
    },
    [game],
  );

  const onLookUp = useCallback((e) => {
    if (lookPointerId.current !== e.pointerId) return;
    lookPointerId.current = null;
  }, []);

  

  const onJumpDown = useCallback(
    (e) => {
      e.preventDefault();
      game?.tryJump();
    },
    [game],
  );

  const onCrouchDown = useCallback(
    (e) => {
      e.preventDefault();
      const next = !crouchOn;
      onCrouchChange(next);
      game?.setCrouch(next);
    },
    [game, crouchOn, onCrouchChange],
  );

  const onInteractDown = useCallback(
    (e) => {
      e.preventDefault();
      game?.interact();
    },
    [game],
  );

  return (
    <>
      <div
        className="touch-look-surface"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      <div
        className="touch-joystick-base"
        ref={stickBaseRef}
        onPointerDown={onStickDown}
        onPointerMove={onStickMove}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div
          className="touch-joystick-thumb"
          style={{ transform: `translate(${stickPos.x}px, ${stickPos.y}px)` }}
        />
      </div>

      <div className="touch-action-buttons">
        {doorPrompt && (
          <button
            type="button"
            className="touch-btn touch-btn-interact"
            onPointerDown={onInteractDown}
          >
            OPEN
          </button>
        )}
        <button
          type="button"
          className={`touch-btn touch-btn-crouch ${crouchOn ? 'active' : ''}`}
          onPointerDown={onCrouchDown}
        >
          CROUCH
        </button>
        <button type="button" className="touch-btn touch-btn-jump" onPointerDown={onJumpDown}>
          JUMP
        </button>
      </div>
    </>
  );
}
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MazeGame } from './game/MazeGame.js';
import TouchControls from './TouchControls.jsx';
import './index.css';

function detectTouchDevice() {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return hasTouch && coarsePointer;
}

function isPortrait() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia
    ? window.matchMedia('(orientation: portrait)').matches
    : window.innerHeight > window.innerWidth;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function loadMusicPref() {
  try {
    return localStorage.getItem('deepwalk_music') !== 'off';
  } catch {
    return true;
  }
}

export default function App() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  const [phase, setPhase] = useState('menu'); 
  const [paused, setPaused] = useState(false);
  const [floorLabel, setFloorLabel] = useState('1');
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);
  const [flash, setFlash] = useState(false);
  const [musicOn, setMusicOn] = useState(loadMusicPref);
  const [seedMode, setSeedMode] = useState('random'); 
  const [customSeed, setCustomSeed] = useState('');
  const [activeSeed, setActiveSeed] = useState(null);
  const [discoveredExits, setDiscoveredExits] = useState([]); 
  const [exitToast, setExitToast] = useState(null); 
  const [doorPrompt, setDoorPrompt] = useState(null);
  const [crouchOn, setCrouchOn] = useState(false);

  const [isTouchDevice] = useState(detectTouchDevice);
  const [portrait, setPortrait] = useState(isPortrait);

  useEffect(() => {
    if (!isTouchDevice) return;
    const update = () => setPortrait(isPortrait());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isTouchDevice]);

  
  useEffect(() => {
    const game = new MazeGame(containerRef.current, {
      musicEnabled: musicOn,
      onProgress: (p) => setProgress(p),
      onTime: (t) => setTime(t),
      onAutoPause: () => setPaused(true),
      onDoorLookAt: (info) => setDoorPrompt(info),
      
      
      onExitFound: (letter, info) => {
        setDiscoveredExits((prev) => (
          prev.some((e) => e.letter === letter) ? prev : [...prev, { letter, nextLabel: info.nextLabel }]
        ));
        setExitToast(info.nextLabel);
        setTimeout(() => setExitToast((cur) => (cur === info.nextLabel ? null : cur)), 2200);
      },
      onDescend: (newLevel, letter, fromLevel, newFloorLabel) => {
        
        
        
        
        
        setDoorPrompt(null);
        setFlash(true);
        setTimeout(() => setFlash(false), 400);
        setFloorLabel(newFloorLabel);
        setDiscoveredExits([]);
        setExitToast(null);
      },
    });
    gameRef.current = game;
    return () => game.dispose();
    
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('deepwalk_music', next ? 'on' : 'off');
      } catch {
        /* ignore storage failures (private mode, etc.) */
      }
      const game = gameRef.current;
      if (game) game.setMusicEnabled(next);
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    const chosen = seedMode === 'custom' && customSeed.trim() !== '' ? customSeed.trim() : undefined;
    const resolved = game.setSeed(chosen);
    setActiveSeed(resolved);
    game.loadLevel(1, null);
    setFloorLabel('1');
    setTime(0);
    setProgress(0);
    setPaused(false);
    setCrouchOn(false);
    setDiscoveredExits([]);
    setExitToast(null);
    setDoorPrompt(null);
    game.start();
    setPhase('playing');
    game.requestPointerLock();

    
    
    
    if (isTouchDevice && screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }, [seedMode, customSeed, isTouchDevice]);

  const pauseGame = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.pause();
    setPaused(true);
  }, []);

  const resumeGame = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.resume();
    setPaused(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Escape' || phase !== 'playing') return;
      if (paused) { resumeGame(); return; }
      
      
      
      
      
      
      
      const canvas = gameRef.current?.renderer?.domElement;
      if (document.pointerLockElement !== canvas) pauseGame();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, paused, pauseGame, resumeGame]);

  const progressPct = Math.round(progress * 100);

  return (
    <div className="app-root">
      <div ref={containerRef} className="canvas-wrap" />
      <div className="vignette" />

      {phase === 'playing' && (
        <>
          <div className="crosshair" />
          <div className="hud">
            <div className="top-bar">
              <div className="stat">LEVEL <b>{floorLabel}</b></div>
              <div className="stat">TIME <b>{formatTime(time)}</b></div>
              {isTouchDevice && (
                <button type="button" className="pause-btn" onClick={pauseGame}>
                  ⏸
                </button>
              )}
            </div>
          </div>
          <div className="progress-corner">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {discoveredExits.length > 0 && (
            <div className="exits-corner">
              <span className="exits-corner-label">FOUND</span>
              {discoveredExits.map((e) => (
                <b key={e.letter}>{e.nextLabel}</b>
              ))}
            </div>
          )}
          {exitToast && (
            <div className="exit-toast">EXIT {exitToast} FOUND</div>
          )}
          {doorPrompt && !paused && !isTouchDevice && (
            <div className="door-prompt">
              <span className="door-prompt-key">E</span>
              {doorPrompt.kind === 'exit'
                ? `open the door to ${doorPrompt.nextLabel}`
                : doorPrompt.label === 'CLOSE'
                ? 'close the door'
                : 'open the door'}
            </div>
          )}

          {isTouchDevice && !paused && (
            <TouchControls
              game={gameRef.current}
              crouchOn={crouchOn}
              onCrouchChange={setCrouchOn}
            />
          )}
        </>
      )}

      {isTouchDevice && portrait && (
        <div className="rotate-overlay">
          <div className="rotate-icon" />
          <div className="rotate-text">Rotate your device to play</div>
        </div>
      )}

      {phase === 'playing' && paused && (
        <div className="pause-overlay">
          <div className="pause-panel">
            <h2>Game Paused</h2>
            {activeSeed && (
              <div className="seed-readout">
                SEED &nbsp;<b>{activeSeed}</b>
              </div>
            )}
            {discoveredExits.length > 0 && (
              <div className="descend-block">
                <div className="descend-hint">doors opened so far</div>
                {discoveredExits.map((e) => (
                  <div key={e.letter} className="found-door-readout">
                    {e.nextLabel}
                  </div>
                ))}
              </div>
            )}
            <div className="toggle-row">
              <span>Music</span>
              <button
                type="button"
                className={`toggle-switch ${musicOn ? 'on' : ''}`}
                onClick={toggleMusic}
                aria-pressed={musicOn}
                aria-label="Toggle music"
              >
                <span className="knob" />
              </button>
              <span>{musicOn ? 'On' : 'Off'}</span>
            </div>
            <button onClick={resumeGame}>Resume</button>
          </div>
        </div>
      )}

      <div className="win-flash" style={{ opacity: flash ? 1 : 0 }} />

      {phase === 'menu' && (
        <div className="overlay">
          <div className="panel">
            <h1>DEEPWALK</h1>

            <div className="seed-block">
              <div className="seed-tabs">
                <button
                  type="button"
                  className={`seed-tab ${seedMode === 'random' ? 'active' : ''}`}
                  onClick={() => setSeedMode('random')}
                >
                  Random World
                </button>
                <button
                  type="button"
                  className={`seed-tab ${seedMode === 'custom' ? 'active' : ''}`}
                  onClick={() => setSeedMode('custom')}
                >
                  Custom World
                </button>
              </div>
              {seedMode === 'custom' && (
                <input
                  type="text"
                  className="seed-input"
                  placeholder="type a seed…"
                  value={customSeed}
                  onChange={(e) => setCustomSeed(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') startGame(); }}
                />
              )}
            </div>

            <div className="toggle-row">
              <span>Music</span>
              <button
                type="button"
                className={`toggle-switch ${musicOn ? 'on' : ''}`}
                onClick={toggleMusic}
                aria-pressed={musicOn}
                aria-label="Toggle music"
              >
                <span className="knob" />
              </button>
              <span>{musicOn ? 'On' : 'Off'}</span>
            </div>
            <button onClick={startGame}>Play Now</button>
            {isTouchDevice ? (
              <div className="keys">
                <b>Left stick</b> move &nbsp;&middot;&nbsp; <b>drag</b> look &nbsp;&middot;&nbsp;{' '}
                <b>JUMP / CROUCH</b> buttons &nbsp;&middot;&nbsp; <b>tap a door</b> to open/close &nbsp;&middot;&nbsp; ⏸ pause
              </div>
            ) : (
              <div className="keys">
                <b>W A S D</b> move &nbsp;&middot;&nbsp; <b>SPACE</b> jump &nbsp;&middot;&nbsp; <b>CTRL</b> crouch &nbsp;&middot;&nbsp; <b>ESC</b> pause
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
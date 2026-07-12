import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MazeGame } from './game/MazeGame.js';
import './index.css';

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
        // MazeGame.descend() no longer touches running/pointer-lock/audio —
        // it just rebuilds the next floor in place and keeps playing, so
        // there's nothing to resume here. See the comment on descend()
        // itself for why (it used to call stop(), which caused a spurious
        // auto-pause right after every descent).
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
    setDiscoveredExits([]);
    setExitToast(null);
    setDoorPrompt(null);
    game.start();
    setPhase('playing');
    game.requestPointerLock();
  }, [seedMode, customSeed]);

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
          {doorPrompt && !paused && (
            <div className="door-prompt">
              <span className="door-prompt-key">E</span>
              open the door to {doorPrompt.nextLabel}
            </div>
          )}
          <div className="hint">
            wasd + mouse &middot; e to open doors &middot; esc to pause
          </div>
        </>
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
            <h1>DEEPWALK<span>.</span></h1>

            <div className="seed-block">
              <div className="seed-tabs">
                <button
                  type="button"
                  className={`seed-tab ${seedMode === 'random' ? 'active' : ''}`}
                  onClick={() => setSeedMode('random')}
                >
                  Random Seed
                </button>
                <button
                  type="button"
                  className={`seed-tab ${seedMode === 'custom' ? 'active' : ''}`}
                  onClick={() => setSeedMode('custom')}
                >
                  Custom Seed
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
            <button onClick={startGame}>Strike the torch</button>
            <div className="keys">
              <b>W A S D</b> move &nbsp;&middot;&nbsp; <b>SPACE</b> jump &nbsp;&middot;&nbsp; <b>CTRL</b> crouch &nbsp;&middot;&nbsp; <b>E</b> open door &nbsp;&middot;&nbsp; <b>ESC</b> pause
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
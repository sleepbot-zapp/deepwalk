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
  const [pendingLevel, setPendingLevel] = useState(1);
  const [pendingEntryLetter, setPendingEntryLetter] = useState(null);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);
  const [flash, setFlash] = useState(false);
  const [musicOn, setMusicOn] = useState(loadMusicPref);
  const [seedMode, setSeedMode] = useState('random'); 
  const [customSeed, setCustomSeed] = useState('');
  const [activeSeed, setActiveSeed] = useState(null);
  const [discoveredExits, setDiscoveredExits] = useState([]); 
  const [exitToast, setExitToast] = useState(null); 

  
  useEffect(() => {
    const game = new MazeGame(containerRef.current, {
      musicEnabled: musicOn,
      onProgress: (p) => setProgress(p),
      onTime: (t) => setTime(t),
      onAutoPause: () => setPaused(true),
      
      
      onExitFound: (letter, info) => {
        setDiscoveredExits((prev) => (
          prev.some((e) => e.letter === letter) ? prev : [...prev, { letter, nextLabel: info.nextLabel }]
        ));
        setExitToast(info.nextLabel);
        setTimeout(() => setExitToast((cur) => (cur === info.nextLabel ? null : cur)), 2200);
      },
      onDescend: (finishedLevel, letter) => {
        setPaused(false);
        setFlash(true);
        setTimeout(() => setFlash(false), 400);
        setTimeout(() => {
          setPendingLevel(finishedLevel + 1);
          setPendingEntryLetter(letter);
          setDiscoveredExits([]);
          setPhase('menu');
        }, 550);
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
    
    
    
    
    if (pendingLevel === 1) {
      const chosen = seedMode === 'custom' && customSeed.trim() !== '' ? customSeed.trim() : undefined;
      const resolved = game.setSeed(chosen);
      setActiveSeed(resolved);
    }
    game.loadLevel(pendingLevel, pendingEntryLetter);
    setLevel(pendingLevel);
    setTime(0);
    setProgress(0);
    setPaused(false);
    setDiscoveredExits([]);
    setExitToast(null);
    game.start();
    setPhase('playing');
    game.requestPointerLock();
  }, [pendingLevel, pendingEntryLetter, seedMode, customSeed]);

  
  
  const descendVia = useCallback((letter) => {
    const game = gameRef.current;
    if (!game) return;
    game.descend(letter);
  }, []);

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
              <div className="stat">LEVEL <b>{String(level).padStart(2, '0')}</b></div>
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
          <div className={`hint ${discoveredExits.length > 0 ? 'hint-active' : ''}`}>
            {discoveredExits.length > 0
              ? 'esc to descend or keep exploring'
              : <>wasd + mouse &middot;  esc to pause</>}
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
                <div className="descend-hint">an exit found</div>
                {discoveredExits.map((e) => (
                  <button
                    key={e.letter}
                    className="descend-btn"
                    onClick={() => descendVia(e.letter)}
                  >
                    Descend into {e.nextLabel}
                  </button>
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
            <button onClick={resumeGame}>
              {discoveredExits.length > 0 ? 'Keep Exploring' : 'Resume'}
            </button>
          </div>
        </div>
      )}

      <div className="win-flash" style={{ opacity: flash ? 1 : 0 }} />

      {phase === 'menu' && (
        <div className="overlay">
          <div className="panel">
            <h1>DEEPWALK<span>.</span></h1>
            <div className="lvl-readout">
              NEXT DESCENT &nbsp;&middot;&nbsp; LEVEL <b>{String(pendingLevel).padStart(2, '0')}</b>
            </div>
            {pendingEntryLetter && (
              <div className="entry-readout">
                ARRIVING VIA &nbsp;<b>{pendingLevel}{pendingEntryLetter}</b>
              </div>
            )}

            {pendingLevel === 1 ? (
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
            ) : (
              activeSeed && (
                <div className="seed-readout">
                  SEED &nbsp;<b>{activeSeed}</b>
                </div>
              )
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
            <button onClick={startGame}>
              {pendingLevel === 1 ? 'Strike the torch' : 'Descend further'}
            </button>
            <div className="keys">
              <b>W A S D</b> move &nbsp;&middot;&nbsp; <b>SPACE</b> jump &nbsp;&middot;&nbsp; <b>CTRL</b> crouch &nbsp;&middot;&nbsp; <b>ESC</b> pause
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
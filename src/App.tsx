import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, RefreshCw } from 'lucide-react';

// --- Types ---
type Point = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string };

// --- Constants ---
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const INITIAL_SNAKE: Point[] = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION: Point = { x: 0, y: -1 };
const GAME_SPEED = 120;

const TRACKS = [
  {
    title: "Neon Dreams",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    artist: "AI Generator Alpha"
  },
  {
    title: "Cybernetic Pulse",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    artist: "AI Generator Beta"
  },
  {
    title: "Digital Horizon",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    artist: "AI Generator Gamma"
  }
];

// --- Helper Functions ---
const generateFood = (snake: Point[]): Point => {
  let newFood: Point;
  while (true) {
    newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    if (!snake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
      break;
    }
  }
  return newFood;
};

export default function App() {
  // --- Game State ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isGamePaused, setIsGamePaused] = useState<boolean>(false);

  const gameOverRef = useRef(gameOver);
  const isGamePausedRef = useRef(isGamePaused);
  
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isGamePausedRef.current = isGamePaused; }, [isGamePaused]);

  const gameState = useRef({
    snake: INITIAL_SNAKE,
    direction: INITIAL_DIRECTION,
    nextDirection: INITIAL_DIRECTION,
    food: generateFood(INITIAL_SNAKE),
    lastMoveTime: 0,
    particles: [] as Particle[],
    screenShake: 0,
  });

  const requestRef = useRef<number | null>(null);

  // --- Music Player State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- Game Logic ---
  const resetGame = () => {
    gameState.current = {
      snake: INITIAL_SNAKE,
      direction: INITIAL_DIRECTION,
      nextDirection: INITIAL_DIRECTION,
      food: generateFood(INITIAL_SNAKE),
      lastMoveTime: performance.now(),
      particles: [],
      screenShake: 0,
    };
    setScore(0);
    setGameOver(false);
    setIsGamePaused(false);
  };

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameState.current;

    // Clear
    ctx.fillStyle = 'rgba(10, 15, 20, 1)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    
    // Apply screen shake
    if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * state.screenShake;
        const dy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(dx, dy);
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CANVAS_SIZE; i += CELL_SIZE) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_SIZE, i); ctx.stroke();
    }

    // Draw food
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ec4899';
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(state.food.x * CELL_SIZE + 2, state.food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

    // Draw snake
    state.snake.forEach((segment, index) => {
      if (index === 0) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#67e8f9';
        ctx.fillStyle = '#67e8f9';
      } else {
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#06b6d4';
        ctx.fillStyle = `rgba(6, 182, 212, ${1 - (index / state.snake.length) * 0.5})`;
      }
      ctx.fillRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });

    // Draw particles
    ctx.shadowBlur = 10;
    state.particles.forEach(p => {
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }, []);

  const updateGame = useCallback((time: number) => {
    const state = gameState.current;

    // Update particles
    state.particles = state.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      return p.life > 0;
    });

    // Screen shake decay
    if (state.screenShake > 0) {
      state.screenShake *= 0.9;
      if (state.screenShake < 0.5) state.screenShake = 0;
    }

    if (gameOverRef.current || isGamePausedRef.current) {
        drawGame();
        requestRef.current = requestAnimationFrame(updateGame);
        return;
    }

    if (time - state.lastMoveTime > GAME_SPEED) {
      state.lastMoveTime = time;
      
      const head = state.snake[0];
      state.direction = state.nextDirection;
      const newHead = {
        x: head.x + state.direction.x,
        y: head.y + state.direction.y,
      };

      // Collisions
      if (
        newHead.x < 0 || newHead.x >= GRID_SIZE ||
        newHead.y < 0 || newHead.y >= GRID_SIZE ||
        state.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)
      ) {
        setGameOver(true);
        state.screenShake = 20; // Big shake on death
        
        // Death particles
        for(let i=0; i<30; i++) {
             state.particles.push({
                 x: head.x * CELL_SIZE + CELL_SIZE/2,
                 y: head.y * CELL_SIZE + CELL_SIZE/2,
                 vx: (Math.random() - 0.5) * 15,
                 vy: (Math.random() - 0.5) * 15,
                 life: 30 + Math.random() * 30,
                 maxLife: 60,
                 color: '#67e8f9'
             });
        }
      } else {
        const newSnake = [newHead, ...state.snake];
        
        // Food
        if (newHead.x === state.food.x && newHead.y === state.food.y) {
          setScore(s => {
            const newScore = s + 10;
            if (newScore > highScore) setHighScore(newScore);
            return newScore;
          });
          state.food = generateFood(newSnake);
          state.screenShake = 5; // Small shake on eat
          
          // Spawn particles
          for(let i=0; i<15; i++) {
             state.particles.push({
                 x: newHead.x * CELL_SIZE + CELL_SIZE/2,
                 y: newHead.y * CELL_SIZE + CELL_SIZE/2,
                 vx: (Math.random() - 0.5) * 10,
                 vy: (Math.random() - 0.5) * 10,
                 life: 20 + Math.random() * 20,
                 maxLife: 40,
                 color: '#ec4899'
             });
          }
        } else {
          newSnake.pop();
        }
        state.snake = newSnake;
      }
    }

    drawGame();
    requestRef.current = requestAnimationFrame(updateGame);
  }, [drawGame, highScore]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updateGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }

      if (gameOverRef.current) {
        if (e.key === 'Enter' || e.key === ' ') resetGame();
        return;
      }

      const state = gameState.current;
      const currentDir = state.direction;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (currentDir.y !== 1) state.nextDirection = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (currentDir.y !== -1) state.nextDirection = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (currentDir.x !== 1) state.nextDirection = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (currentDir.x !== -1) state.nextDirection = { x: 1, y: 0 };
          break;
        case ' ':
        case 'Escape':
          setIsGamePaused(p => !p);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Music Player Logic ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
    } else if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrackIndex]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  const handleTrackEnd = () => {
    nextTrack();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-between font-sans overflow-hidden selection:bg-cyan-500/30">
      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={TRACKS[currentTrackIndex].url}
        onEnded={handleTrackEnd}
      />

      {/* Header */}
      <header className="w-full p-6 flex justify-between items-center max-w-4xl mx-auto z-10">
        <div className="flex flex-col">
          <h1 
            className="text-5xl md:text-6xl font-mono font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] glitch-text"
            data-text="Neon Snake"
          >
            Neon Snake
          </h1>
          <p className="text-cyan-400/60 text-sm tracking-widest uppercase font-mono mt-1">Cybernetic Edition</p>
        </div>
        <div className="flex gap-8 font-mono text-xl">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 uppercase tracking-widest">Score</span>
            <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] font-bold">{score.toString().padStart(4, '0')}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 uppercase tracking-widest">High</span>
            <span className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] font-bold">{highScore.toString().padStart(4, '0')}</span>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 flex items-center justify-center w-full p-4 relative z-10">
        {/* Background Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
          <div className="w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[80px] absolute mix-blend-screen"></div>
        </div>

        <div className="relative group w-full max-w-[500px] aspect-square">
          {/* Game Board Border Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
          
          {/* Game Board Canvas */}
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="relative w-full h-full bg-gray-950/80 backdrop-blur-sm border border-cyan-500/30 rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.15)] block"
          />

          {/* Overlays */}
          {gameOver && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-20">
              <h2 className="text-4xl font-black text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)] mb-2 uppercase tracking-widest text-center">System<br/>Failure</h2>
              <p className="text-gray-400 font-mono mb-6">Final Score: {score}</p>
              <button
                onClick={resetGame}
                className="flex items-center gap-2 px-6 py-3 bg-transparent border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all duration-300 font-mono uppercase tracking-widest text-sm shadow-[0_0_10px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] cursor-pointer"
              >
                <RefreshCw size={16} />
                Reboot
              </button>
            </div>
          )}
          
          {isGamePaused && !gameOver && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-20">
              <h2 className="text-3xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] mb-2 uppercase tracking-widest">Paused</h2>
              <p className="text-gray-400 font-mono text-sm">Press SPACE to resume</p>
            </div>
          )}
        </div>
        
        {/* Controls Hint */}
        <div className="absolute bottom-4 text-gray-600 font-mono text-xs tracking-widest uppercase hidden md:block">
          Use WASD or Arrows to move &bull; Space to pause
        </div>
      </main>

      {/* Footer / Music Player */}
      <footer className="w-full bg-gray-950/90 backdrop-blur-md border-t border-cyan-900/50 p-4 relative z-30">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Track Info */}
          <div className="flex items-center gap-4 w-full md:w-1/3">
            <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)] relative overflow-hidden shrink-0">
              {isPlaying && (
                <div className="absolute inset-0 flex items-end justify-around p-2 opacity-50">
                  <div className="w-1 bg-white animate-[bounce_1s_infinite] origin-bottom h-full"></div>
                  <div className="w-1 bg-white animate-[bounce_1.2s_infinite] origin-bottom h-3/4"></div>
                  <div className="w-1 bg-white animate-[bounce_0.8s_infinite] origin-bottom h-5/6"></div>
                </div>
              )}
              <div className="w-4 h-4 rounded-full bg-black/50 backdrop-blur-sm z-10"></div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold text-white truncate drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]">
                {TRACKS[currentTrackIndex].title}
              </span>
              <span className="text-xs text-cyan-400/70 font-mono truncate">
                {TRACKS[currentTrackIndex].artist}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6 w-full md:w-1/3 justify-center">
            <button 
              onClick={prevTrack}
              className="text-gray-400 hover:text-cyan-400 transition-colors hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] cursor-pointer"
            >
              <SkipBack size={24} />
            </button>
            <button 
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-400 text-cyan-400 flex items-center justify-center hover:bg-cyan-400 hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)] shrink-0 cursor-pointer"
            >
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
            <button 
              onClick={nextTrack}
              className="text-gray-400 hover:text-cyan-400 transition-colors hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] cursor-pointer"
            >
              <SkipForward size={24} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-3 w-full md:w-1/3 justify-end hidden md:flex">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-24 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

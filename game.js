/* Trumpet Trainer — B♭ Trumpet note ID game
   Keys: Left=Valve1, Down=Valve2, Right=Valve3, Enter=Open (0)
   Space=start/pause, R=reset
*/

(() => {
  // Check if user is logged in
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  const overlay = document.getElementById('overlay');
  const cta = document.getElementById('cta');
  const vfDiv = document.getElementById('vf');
  const boardEl = document.getElementById('board');
  const statsEl = document.getElementById('stats');
  const valvesEl = document.getElementById('valves');
  const themeToggle = document.getElementById('themeToggle');
  const logoutBtn = document.getElementById('logoutBtn');

  // Game constants
  const ROUND_SECONDS = 60;
  const NOTE_TIME_LIMIT_MS = 4000; // max time to answer a note before it counts as miss
  
  // Difficulty settings
  const DIFFICULTY_RANGES = {
    easy: { min: noteMidi('F#3'), max: noteMidi('C6') },
    medium: { min: noteMidi('F#3'), max: noteMidi('G6') },
    hard: { min: noteMidi('F#3'), max: noteMidi('G6') }
  };
  
  let currentDifficulty = 'easy';
  // Initialize VexFlow (supports v4 global Vex.Flow and fallback variants)
  const VF = (window.Vex && window.Vex.Flow) || (window.VexFlow && window.VexFlow.Flow) || window.VexFlow || null;
  if (!VF) {
    console.error('VexFlow failed to load');
  }
  const renderer = new VF.Renderer(vfDiv, VF.Renderer.Backends.SVG);
  renderer.resize(900, 300);
  const context = renderer.getContext();
  let stave;

  // Audio feedback
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playBeep(frequency, durationMs, type = 'sine', volume = 0.2) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain).connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  }
  function playCorrectSound() { playBeep(880, 120, 'triangle', 0.25); }
  function playErrorSound() { playBeep(220, 220, 'sawtooth', 0.2); }

  // Written pitch set (treble clef) for B♭ trumpet training (concert up a major 2nd)
  // We include common staff range: written F#3 (below staff) to C6 (above staff)
  // Represent notes as diatonic index relative to middle C (C4 = 0), with accidental
  const CLEF_OFFSET_Y = 0; // visual tweaks

  // Mapping written notes to standard valve combinations for B♭ trumpet.
  // For simplicity, one fingering per pitch class in this range.
  // Notation: 0=open, 1,2,3 are valves; combinations as array sorted ascending
  // Data: array of objects with midi and valves.

  // Utility: note name -> MIDI
  function noteMidi(note) {
    const pitch = note.slice(0, -1);
    const octave = parseInt(note.slice(-1), 10);
    const base = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 }[pitch];
    return 12 * (octave + 1) + base; // MIDI 0 at C-1
  }

  // Build midi -> valves mapping using canonical primary fingerings across F#3..G6
  const BASE_FINGERINGS = [
    ['F#3', [1,2,3]], ['G3', [1,3]], ['G#3', [2,3]], ['A3', [1,2]], ['Bb3', [1]], ['B3', [2]],
    ['C4', []], ['C#4', [1,2,3]], ['D4', [1,3]], ['Eb4', [2,3]], ['E4', [1,2]], ['F4', [1]], ['F#4', [2]],
    ['G4', []], ['Ab4', [2,3]], ['A4', [1,2]], ['Bb4', [1]], ['B4', [2]], ['C5', []], ['C#5', [1,2]],
    ['D5', [1]], ['Eb5', [2]], ['E5', []], ['F5', [1]], ['F#5', [2]], ['G5', []],
    ['Ab5', [2,3]], ['A5', [1,2]], ['Bb5', [1]], ['B5', [2]], ['C6', []],
    ['C#6', [1,2]], ['D6', [1]], ['Eb6', [2]], ['E6', []], ['F6', [1]], ['F#6', [2]], ['G6', []]
  ];
  const midiToValves = new Map();
  BASE_FINGERINGS.forEach(([name, valves]) => { midiToValves.set(noteMidi(name), valves); });

  const MIDI_MIN = noteMidi('F#3');
  const MIDI_MAX = noteMidi('G6');

  function namesForMidi(midi) {
    // Ensure top boundary C6 shows only C6 (no B#5 alias)
    if (midi === MIDI_MAX) return ['C6'];
    const pc = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const natNames = { 0:'C', 2:'D', 4:'E', 5:'F', 7:'G', 9:'A', 11:'B' };
    const names = [];
    if (pc in natNames) {
      names.push(`${natNames[pc]}${octave}`);
      
      // Include single-accidental enharmonics for certain naturals
      if (pc === 0) names.push(`B#${octave-1}`);    // Cn == B#(n-1)
      if (pc === 4) names.push(`Fb${octave}`);      // En == Fbn
      if (pc === 5) names.push(`E#${octave}`);      // Fn == E#n
      if (pc === 11) names.push(`Cb${octave+1}`);   // Bn == Cb(n+1)
      
      // Add double accidentals for hard mode
      if (currentDifficulty === 'hard') {
        if (pc === 0) names.push(`B##${octave-1}`); // C == B##
        if (pc === 2) names.push(`Cbb${octave+1}`); // D == Cbb
        if (pc === 4) names.push(`Fbb${octave}`);   // E == Fbb
        if (pc === 5) names.push(`E##${octave}`);   // F == E##
        if (pc === 7) names.push(`F##${octave}`);   // G == F##
        if (pc === 9) names.push(`Gbb${octave+1}`); // A == Gbb
        if (pc === 11) names.push(`Abb${octave+1}`); // B == Abb
      }
      
      return names;
    }
    // Black keys: provide both sharp and flat spellings
    const sharpMap = {1:'C#',3:'D#',6:'F#',8:'G#',10:'A#'};
    const flatMap  = {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};
    const s = sharpMap[pc]; const f = flatMap[pc];
    if (s) names.push(`${s}${octave}`);
    if (f) names.push(`${f}${octave}`);
    return names;
  }

  // Pick spelling with controlled randomness
  function pickSpelling(midi) {
    const names = namesForMidi(midi);
    if (names.length === 1) return names[0];
    
    // For black keys: 50/50 sharp/flat split
    const pc = ((midi % 12) + 12) % 12;
    const isBlackKey = [1,3,6,8,10].includes(pc);
    
    if (isBlackKey && names.length === 2) {
      // 50/50 split for black keys
      return Math.random() < 0.5 ? names[0] : names[1];
    }
    
    // For naturals with enharmonics: ~20% rare spellings
    if (names.length === 2) {
      const hasRare = names.some(n => n.includes('B#') || n.includes('Cb') || n.includes('E#') || n.includes('Fb'));
      if (hasRare) {
        return Math.random() < 0.2 ? names[1] : names[0];
      }
    }
    
    return names[0]; // Default to first spelling
  }

  function randNote() {
    const range = DIFFICULTY_RANGES[currentDifficulty];
    const midi = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    const name = pickSpelling(midi);
    const valves = midiToValves.get(midi) || [];
    return { midi, name, valves };
  }

  // Game state
  let isRunning = false;
  let remainingMs = ROUND_SECONDS * 1000;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  let multiplier = 1;
  const MULTIPLIER_BASE = 1.15;
  let currentNote = null;
  let currentNoteStart = 0;
  let pressed = new Set();
  let numCorrect = 0;
  let numMistakes = 0;
  let totalResponseMs = 0;
  let bestScore = parseInt(localStorage.getItem('bestScore') || '0');

  function resetRound() {
    isRunning = false;
    remainingMs = ROUND_SECONDS * 1000;
    score = 0;
    streak = 0;
    bestStreak = 0;
    multiplier = 1;
    currentNote = null;
    pressed.clear();
    numCorrect = 0;
    numMistakes = 0;
    totalResponseMs = 0;
    if (overlay) overlay.classList.remove('hidden');
    if (cta) cta.textContent = 'Press Space to start';
  }

  function startRound() {
    if (isRunning) return;
    isRunning = true;
    if (overlay) overlay.classList.add('hidden');
    nextNote();
  }

  function pauseRound() {
    isRunning = false;
    if (overlay) overlay.classList.remove('hidden');
    if (cta) cta.textContent = 'Press Space to resume';
  }

  function finishRound() {
    isRunning = false;
    if (overlay) overlay.classList.remove('hidden');
    
    const avgResponse = numCorrect > 0 ? Math.round(totalResponseMs / numCorrect) : 0;
    const accuracy = numCorrect + numMistakes > 0 ? Math.round(100 * numCorrect / (numCorrect + numMistakes)) : 0;
    
    if (cta) {
      cta.innerHTML = `
        <div style="text-align: left; margin-bottom: 16px;">
          <div><strong>Final Score:</strong> ${score}</div>
          <div><strong>Best Score:</strong> ${bestScore}</div>
          <div><strong>Correct:</strong> ${numCorrect}</div>
          <div><strong>Mistakes:</strong> ${numMistakes}</div>
          <div><strong>Best Streak:</strong> ${bestStreak}</div>
          <div><strong>Avg Response:</strong> ${avgResponse}ms</div>
          <div><strong>Accuracy:</strong> ${accuracy}%</div>
        </div>
        Press R to reset or Space to start new round
      `;
    }
    
    // Save high score locally
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestScore', bestScore.toString());
    }
    
    // Save score to backend
    saveScoreToBackend(score, numCorrect, numMistakes, bestStreak, avgResponse, accuracy);
  }
  
  async function saveScoreToBackend(score, correct, mistakes, bestStreak, avgResponse, accuracy) {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    try {
      const response = await fetch('http://localhost:3000/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          score,
          correct,
          mistakes,
          bestStreak,
          avgResponse,
          accuracy
        })
      });
      
      if (response.ok) {
        console.log('Score saved successfully');
      } else {
        console.error('Failed to save score');
      }
    } catch (error) {
      console.error('Error saving score:', error);
    }
  }

  function layoutForNote(midi) {
    // Simple layout: staff position based on midi
    const staffPos = (midi - MIDI_MIN) / (MIDI_MAX - MIDI_MIN);
    return Math.max(0.1, Math.min(0.9, staffPos));
  }

  function renderBoard() {
    context.clear();
    stave = new VF.Stave(40, 80, 820);
    stave.addClef('treble');
    // Dark mode: render staff and notes in light color for contrast
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark && context.setFillStyle) {
      context.setFillStyle('#e8eefc');
      context.setStrokeStyle('#e8eefc');
    } else if (context.setFillStyle) {
      context.setFillStyle('#000');
      context.setStrokeStyle('#000');
    }
    stave.setContext(context).draw();

    if (!currentNote) return;
    const note = currentNote.name;
    const vfNote = new VF.StaveNote({ keys: [toVfKey(note)], duration: 'q' });
    const acc = toAccidental(note);
    if (acc) vfNote.addModifier(new VF.Accidental(acc), 0);
    VF.Formatter.FormatAndDraw(context, stave, [vfNote]);

    // HUD text
    const secs = Math.max(0, Math.ceil(remainingMs / 1000));
    if (statsEl) {
      statsEl.innerHTML = '';
      const rows = [
        `Time: ${secs}s`,
        `Score: ${score}`,
        `Streak: ${streak}`,
        `Mult: x${multiplier.toFixed(2)}`,
        `Best: ${bestScore}`,
      ];
      rows.forEach(t => {
        const r = document.createElement('div'); r.className = 'stat-row'; r.textContent = t; statsEl.appendChild(r);
      });
    }

    // Valve indicators: only reflect what user is pressing (no correct hints)
    if (valvesEl) {
      valvesEl.innerHTML = '';
      const items = [
        { label: '0', v: 0 },
        { label: '1', v: 1 },
        { label: '2', v: 2 },
        { label: '3', v: 3 },
      ];
      items.forEach(({label, v}) => {
        const el = document.createElement('div');
        el.className = 'valve';
        if (pressed.has(v)) el.classList.add('active');
        el.textContent = label;
        valvesEl.appendChild(el);
      });
    }
  }

  function toVfKey(name) {
    const pitch = name.slice(0, -1);
    const octave = name.slice(-1);
    return `${pitch}/${octave}`;
  }

  function toAccidental(name) {
    if (name.includes('##')) return '##';
    if (name.includes('bb')) return 'bb';
    if (name.includes('#')) return '#';
    if (name.includes('b')) return 'b';
    return '';
  }

  function draw() { renderBoard(); }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function flashError() {
    if (!boardEl) return;
    boardEl.classList.add('error');
    setTimeout(() => boardEl.classList.remove('error'), 400);
  }

  function flashCorrect() {
    if (!boardEl) return;
    boardEl.classList.add('correct');
    setTimeout(() => boardEl.classList.remove('correct'), 400);
  }

  function evaluateAnswer() {
    if (!currentNote) return;
    const attempt = pressed.has(0) ? [] : Array.from(pressed).sort((x, y) => x - y);
    const correct = arraysEqual(attempt, currentNote.valves);
    const now = performance.now();
    const elapsed = now - currentNoteStart;

    if (correct) {
      // Score: base 100; time bonus; multiplier by streak
      const timeFactor = Math.max(0.3, 1 - elapsed / NOTE_TIME_LIMIT_MS);
      const base = 100;
      const gained = Math.round(base * timeFactor * multiplier);
      score += gained;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      multiplier = Math.pow(MULTIPLIER_BASE, streak);
      numCorrect += 1;
      totalResponseMs += elapsed;
      flashCorrect();
      playCorrectSound();
      nextNote();
    } else if (pressed.size > 0) {
      // Wrong input: reset streak & multiplier, brief error flash
      streak = 0;
      multiplier = 1;
      numMistakes += 1;
      score = Math.max(0, score - 150);
      flashError();
      playErrorSound();
    }
  }

  function nextNote() {
    currentNote = randNote();
    currentNoteStart = performance.now();
    pressed.clear();
  }

  function update(deltaMs) {
    if (!isRunning) return;
    remainingMs -= deltaMs;
    if (remainingMs <= 0) {
      remainingMs = 0;
      finishRound();
      draw();
      return;
    }
  }

  let lastTs = performance.now();
  function tick(ts) {
    const dt = ts - lastTs; lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(tick);
  }

  // Input handling
  const KEY_TO_VALVE = new Map([
    ['ArrowLeft', 1],
    ['ArrowDown', 2],
    ['ArrowRight', 3],
  ]);

  // Debounced evaluation so combos can be pressed together
  let evalTimer = 0;
  const EVAL_DELAY_MS = 60;
  
  // Theme toggle
  function applyThemeButtonLabel() {
    if (!themeToggle) return;
    const dark = document.documentElement.classList.contains('dark');
    themeToggle.textContent = dark ? 'Light' : 'Dark';
  }
  
  function updateLogo() {
    const logo = document.getElementById('brandLogo');
    if (!logo) return;
    const dark = document.documentElement.classList.contains('dark');
    logo.src = dark ? 'Untitled design dark.svg' : 'Untitled design.svg';
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      applyThemeButtonLabel();
      updateLogo();
    });
    applyThemeButtonLabel();
    updateLogo();
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      isRunning ? pauseRound() : startRound();
      return;
    }
    if (!isRunning && e.key.toLowerCase() === 's') { startRound(); return; }
    if (e.key.toLowerCase() === 'r') { resetRound(); return; }
    if (!isRunning) return;

    if (e.key === 'Enter' || e.key === 'ArrowUp') {
      pressed.clear();
      pressed.add(0);
      clearTimeout(evalTimer);
      evalTimer = setTimeout(evaluateAnswer, EVAL_DELAY_MS);
      return;
    }

    const v = KEY_TO_VALVE.get(e.key);
    if (v) {
      if (pressed.has(0)) pressed.delete(0);
      pressed.add(v);
      clearTimeout(evalTimer);
      evalTimer = setTimeout(evaluateAnswer, EVAL_DELAY_MS);
    }
  });

  window.addEventListener('keyup', (e) => {
    const v = KEY_TO_VALVE.get(e.key);
    if (v) pressed.delete(v);
    if (e.key === 'Enter') pressed.delete(0);
  });

  // Mouse support: click circles at bottom
  // No mouse valve hints/clicks — user must identify and input via keys only

  // Navigation functionality
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      window.location.href = 'login.html';
    });
  }

  // Add leaderboard and profile buttons (bottom right, next to theme toggle)
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'position: absolute; bottom: 10px; right: 80px; display: flex; gap: 12px; align-items: center;';
  document.getElementById('board').appendChild(buttonContainer);

  const profileBtn = document.createElement('button');
  profileBtn.textContent = 'Profile';
  profileBtn.style.cssText = 'border: 1px solid rgba(0,0,0,0.15); background: var(--panel); color: var(--ink); padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; min-width: 60px; height: 28px; display: flex; align-items: center; justify-content: center;';
  profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
  buttonContainer.appendChild(profileBtn);

  const leaderboardBtn = document.createElement('button');
  leaderboardBtn.textContent = 'Leaderboard';
  leaderboardBtn.style.cssText = 'border: 1px solid rgba(0,0,0,0.15); background: var(--panel); color: var(--ink); padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; min-width: 80px; height: 28px; display: flex; align-items: center; justify-content: center;';
  leaderboardBtn.addEventListener('click', () => {
    window.location.href = 'leaderboard.html';
  });
  buttonContainer.appendChild(leaderboardBtn);

  // Difficulty selector
  const difficultySelect = document.getElementById('difficulty');
  if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
      currentDifficulty = e.target.value;
      console.log('Difficulty changed to:', currentDifficulty);
    });
  }

  // Boot
  resetRound();
  const startBtn = document.getElementById('startBtn');
  if (startBtn) startBtn.addEventListener('click', startRound);
  requestAnimationFrame(tick);
})();


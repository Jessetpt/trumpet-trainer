/* Trumpet Trainer — B♭ Trumpet note ID game
   Keys: Left=Valve1, Down=Valve2, Right=Valve3, Enter=Open (0)
   Space=start/pause/play-again
*/

(() => {
  // Just start the game
  initializeGame();

  function initializeGame() {
    const overlay = document.getElementById('overlay');
    const cta = document.getElementById('cta');
    const vfDiv = document.getElementById('vf');
    const boardEl = document.getElementById('board');
    const statsEl = document.getElementById('stats');
    const valvesEl = document.getElementById('valves');
    const quickResetBtn = document.getElementById('quickResetBtn');
    const themeToggle = document.getElementById('themeToggle');
    const overlayThemeToggle = document.getElementById('overlayThemeToggle');
    const startBtn = document.getElementById('startBtn');
    const timeModeSelect = document.getElementById('timeMode');
    const learningModeSelect = document.getElementById('learningMode');
    const learningHintEl = document.getElementById('learningHint');
    const navEl = document.querySelector('.nav');
    const overlayCard = document.querySelector('#overlay .card');
    let selectedTimeMode = (timeModeSelect && timeModeSelect.value) || '60s';
    let learningMode = (learningModeSelect && learningModeSelect.value) || 'off';
    const ENDLESS_MAX_MISTAKES = 5;

  function secondsForTimeMode(tm) {
    if (tm === '30s') return 30;
    if (tm === '120s') return 120;
    // future: increment/infinite modes can map here
    return 60;
  }

  function isEndlessMode(tm = selectedTimeMode) {
    return tm === 'endless';
  }

  function formatDuration(ms) {
    const safeMs = Math.max(0, Math.round(ms || 0));
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // Round state machine
  // idle → running → finished
  let roundState = 'idle';

  function setStartButtonLabel() {
    if (!startBtn) return;
    if (roundState === 'idle') {
      startBtn.textContent = isEndlessMode()
        ? `Start Endless (${ENDLESS_MAX_MISTAKES} Lives)`
        : `Start ${secondsForTimeMode(selectedTimeMode)}s Round`;
    }
    else if (roundState === 'running') startBtn.textContent = isRunning ? 'Pause' : 'Resume';
    else startBtn.textContent = 'Play Again';
    if (quickResetBtn) {
      const showQuickReset = roundState === 'running';
      quickResetBtn.classList.toggle('hidden', !showQuickReset);
    }
  }

  // Game constants
  let ROUND_SECONDS = secondsForTimeMode(selectedTimeMode);
  const NOTE_TIME_LIMIT_MS = 4000; // max time to answer a note before it counts as miss
  
  // Difficulty settings
  const DIFFICULTY_RANGES = {
    normal: { min: noteMidi('F#3'), max: noteMidi('C6') },
    lead: { min: noteMidi('F#3'), max: noteMidi('G6') },
    hard: { min: noteMidi('F#3'), max: noteMidi('G6') },
    doublec: { min: noteMidi('F#3'), max: noteMidi('C7') },
    ultra: { min: noteMidi('F#3'), max: noteMidi('C7') }
  };
  
  let currentDifficulty = 'normal';
  // Initialize VexFlow (supports v4 global Vex.Flow and fallback variants)
  const VF = (window.Vex && window.Vex.Flow) || (window.VexFlow && window.VexFlow.Flow) || window.VexFlow || null;
  if (!VF) {
    console.error('VexFlow failed to load');
  }
  const renderer = new VF.Renderer(vfDiv, VF.Renderer.Backends.SVG);
  renderer.resize(900, 300);
  const context = renderer.getContext();
  let stave;
  let lastBoardWidth = 0;
  const rendererLayout = {
    width: 760,
    height: 250,
    staveWidth: 420,
    staveX: 170,
    staveY: 102,
    lineSpacing: 16,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyRendererLayout(force = false) {
    if (!boardEl || !vfDiv) return;
    const boardWidth = Math.round(boardEl.clientWidth || 0);
    if (!force && Math.abs(boardWidth - lastBoardWidth) < 4) return;
    lastBoardWidth = boardWidth;

    const width = clamp(Math.round((boardWidth || 900) - 72), 520, 780);
    const height = clamp(Math.round(width * 0.4), 220, 300);
    const staveWidth = clamp(Math.round(width * 0.52), 320, 460);
    const staveX = Math.round((width - staveWidth) / 2);
    const lineSpacing = clamp(Math.round(height * 0.072), 14, 17);
    const staveHeight = lineSpacing * 4;
    const staveY = Math.round((height - staveHeight) / 2);

    rendererLayout.width = width;
    rendererLayout.height = height;
    rendererLayout.staveWidth = staveWidth;
    rendererLayout.staveX = staveX;
    rendererLayout.staveY = staveY;
    rendererLayout.lineSpacing = lineSpacing;

    renderer.resize(width, height);
    vfDiv.style.width = `${width}px`;
  }

  function syncViewportLayoutVars() {
    if (!navEl) return;
    const navHeight = Math.max(0, Math.round(navEl.getBoundingClientRect().height));
    document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
  }

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
  const MIDI_MAX_C7 = noteMidi('C7');

  // Parse spelled name (supports ## and bb) into MIDI number with octave carry
  function spelledNameToMidi(name) {
    const match = name.match(/^([A-Ga-g])(#{1,2}|b{1,2})?(\d)$/);
    if (!match) return null;
    const letter = match[1].toUpperCase();
    const acc = match[2] || '';
    let octave = parseInt(match[3], 10);
    const basePcMap = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
    let pc = basePcMap[letter];
    for (const ch of acc) {
      if (ch === '#') pc += 1; else if (ch === 'b') pc -= 1;
    }
    // Carry octave if pc stepped out of [0..11]
    while (pc < 0) { pc += 12; octave -= 1; }
    while (pc > 11) { pc -= 12; octave += 1; }
    return 12 * (octave + 1) + pc;
  }

  // Hard-mode enharmonic spellings (including doubles) mapped to the correct fingerings by name.
  // Source: user-provided authoritative chart.
  const NAME_TO_VALVES = new Map([
    ['F#3', [1,2,3]], ['Gb3', [1,2,3]], ['E##3', [1,2,3]],
    ['G3', [1,3]], ['F##3', [1,3]], ['Abb3', [1,3]],
    ['G#3', [2,3]], ['Ab3', [2,3]],
    ['A3', [1,2]], ['G##3', [1,2]], ['Bbb3', [1,2]],
    ['A#3', [1]], ['Bb3', [1]], ['Cbb3', [1]],
    ['B3', [2]], ['Cb4', [2]], ['A##3', [2]],
    ['C4', []], ['B#3', []], ['Dbb4', []],
    ['C#4', [1,2,3]], ['Db4', [1,2,3]], ['B##3', [1,2,3]],
    ['D4', [1,3]], ['C##4', [1,3]], ['Ebb4', [1,3]],
    ['D#4', [2,3]], ['Eb4', [2,3]], ['Fbb4', [2,3]],
    ['E4', [1,2]], ['Fb4', [1,2]], ['D##4', [1,2]],
    ['F4', [1]], ['E#4', [1]], ['Gbb4', [1]],
    ['F#4', [2]], ['Gb4', [2]], ['E##4', [2]],
    ['G4', []], ['F##4', []], ['Abb4', []],
    ['G#4', [2,3]], ['Ab4', [2,3]],
    ['A4', [1,2]], ['G##4', [1,2]], ['Bbb4', [1,2]],
    ['A#4', [1]], ['Bb4', [1]], ['Cbb5', [1]],
    ['B4', [2]], ['Cb5', [2]], ['A##4', [2]],
    ['C5', []], ['B#4', []], ['Dbb5', []],
    ['C#5', [1,2]], ['Db5', [1,2]], ['B##4', [1,2]],
    ['D5', [1]], ['C##5', [1]], ['Ebb5', [1]],
    ['D#5', [2]], ['Eb5', [2]], ['Fbb5', [2]],
    ['E5', []], ['Fb5', []], ['D##5', []],
    ['F5', [1]], ['E#5', [1]], ['Gbb5', [1]],
    ['F#5', [2]], ['Gb5', [2]], ['E##5', [2]],
    ['G5', []], ['F##5', []], ['Abb5', []],
    ['G#5', [2,3]], ['Ab5', [2,3]],
    ['A5', [1,2]], ['G##5', [1,2]], ['Bbb5', [1,2]],
    ['A#5', [1]], ['Bb5', [1]], ['Cbb6', [1]],
    ['B5', [2]], ['Cb6', [2]], ['A##5', [2]],
    ['C6', []], ['B#5', []], ['Dbb6', []],
    ['C#6', [1,2]], ['Db6', [1,2]], ['B##5', [1,2]],
    ['D6', [1]], ['C##6', [1]], ['Ebb6', [1]],
    ['D#6', [2]], ['Eb6', [2]], ['Fbb6', [2]],
    ['E6', []], ['Fb6', []], ['D##6', []],
    ['F6', [1]], ['E#6', [1]], ['Gbb6', [1]],
    ['F#6', [2]], ['Gb6', [2]], ['E##6', [2]],
    ['G6', []], ['F##6', []], ['Abb6', []]
  ]);

  // Add missing 6th-octave chromatic spellings up to C7
  const extraTop = [
    ['G#6', [2,3]], ['Ab6', [2,3]],
    ['A6', [1,2]], ['G##6', [1,2]], ['Bbb6', [1,2]],
    ['A#6', [1]], ['Bb6', [1]], ['Cbb7', [1]],
    ['B6', [2]], ['Cb7', [2]], ['A##6', [2]],
    ['B#6', []], ['Dbb7', []]
  ];
  for (const [n,v] of extraTop) NAME_TO_VALVES.set(n,v);

  // Extend to C7 by mirroring fingerings one octave above C6
  (function extendToC7() {
    const topNames = [
      ['C6','C7'], ['C#6','C#7'], ['Db6','Db7'], ['D6','D7'], ['D#6','D#7'], ['Eb6','Eb7'],
      ['E6','E7'], ['F6','F7'], ['F#6','F#7'], ['Gb6','Gb7'], ['G6','G7'], ['Ab6','Ab7'], ['G#6','G#7'],
      ['A6','A7'], ['Bb6','Bb7'], ['A#6','A#7'], ['B6','B7'], ['Cb7','Cb8'], ['B#6','B#7']
    ];
    // We only need up to C7; mirror C6-octave shapes
    const mirrorPairs = [
      ['C6','C7'], ['C#6','C#7'], ['Db6','Db7'], ['D6','D7'], ['D#6','D#7'], ['Eb6','Eb7'],
      ['E6','E7'], ['F6','F7'], ['F#6','F#7'], ['Gb6','Gb7'], ['G6','G7'],
      ['Ab6','Ab7'], ['G#6','G#7'], ['A6','A7'], ['Bb6','Bb7'], ['A#6','A#7'], ['B6','B7'], ['Cb6','Cb7'], ['B#6','B#7']
    ];
    const seen = new Set(NAME_TO_VALVES.keys());
    function copyName(src, dst) {
      if (!seen.has(src)) return;
      const v = NAME_TO_VALVES.get(src);
      NAME_TO_VALVES.set(dst, v);
      seen.add(dst);
    }
    // Mirror core naturals and accidentals
    const basePairs = [
      ['C6','C7'], ['B#5','B#6'], ['Dbb6','Dbb7'],
      ['C#6','C#7'], ['Db6','Db7'], ['B##5','B##6'],
      ['D6','D7'], ['C##6','C##7'], ['Ebb6','Ebb7'],
      ['D#6','D#7'], ['Eb6','Eb7'], ['Fbb6','Fbb7'],
      ['E6','E7'], ['Fb6','Fb7'], ['D##6','D##7'],
      ['F6','F7'], ['E#6','E#7'], ['Gbb6','Gbb7'],
      ['F#6','F#7'], ['Gb6','Gb7'], ['E##6','E##7'],
      ['G6','G7'], ['F##6','F##7'], ['Abb6','Abb7']
    ];
    basePairs.forEach(([src,dst]) => copyName(src,dst));
  })();

  // Build midi -> available spellings (normal/lead exclude doubles; hard includes doubles; doublec extends to C7 without doubles; ultra extends and includes doubles)
  const midiToSpellings = new Map();
  for (const name of NAME_TO_VALVES.keys()) {
    const midi = spelledNameToMidi(name);
    if (midi == null || midi < MIDI_MIN || midi > MIDI_MAX_C7) continue;
    if (!midiToSpellings.has(midi)) midiToSpellings.set(midi, new Set());
    midiToSpellings.get(midi).add(name);
  }

  function isDoubleAccidental(name) { return name.includes('##') || name.includes('bb'); }
  function isSingleAccidental(name) { return name.includes('#') || name.includes('b'); }

  function pickSpellingForMidi(midi) {
    const all = Array.from(midiToSpellings.get(midi) || []);
    if (all.length === 0) return null;
    let pool = all;
    const allowDoubles = (currentDifficulty === 'hard') || (currentDifficulty === 'ultra');
    if (!allowDoubles) pool = all.filter(n => !isDoubleAccidental(n));

    // Strict octave cap per difficulty for displayed spelling
    let maxSpelledOctave = 6;
    if (currentDifficulty === 'doublec' || currentDifficulty === 'ultra') maxSpelledOctave = 7;
    pool = pool.filter(n => {
      const m = n.match(/(\d)$/); return m ? parseInt(m[1], 10) <= maxSpelledOctave : true;
    });

    if (currentDifficulty === 'hard' || currentDifficulty === 'ultra') {
      const doubles = pool.filter(isDoubleAccidental);
      if (doubles.length && Math.random() < 0.4) pool = doubles;
    }
    if (pool.length === 0) pool = all.filter(n => {
      const m = n.match(/(\d)$/); return m ? parseInt(m[1], 10) <= maxSpelledOctave : true;
    });
    if (pool.length === 0) pool = all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function randNote() {
    const range = DIFFICULTY_RANGES[currentDifficulty];
    let midi;
    for (let tries = 0; tries < 50; tries++) {
      const candidate = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      // Extra safety: in Normal, never exceed C6; in Lead/Hard never exceed G6
      const hardMax = (currentDifficulty === 'doublec' || currentDifficulty === 'ultra') ? MIDI_MAX_C7 : (currentDifficulty === 'normal' ? noteMidi('C6') : MIDI_MAX);
      if (candidate > hardMax) continue;
      if (candidate < MIDI_MIN) continue;
      if (midiToSpellings.has(candidate)) { midi = candidate; break; }
    }
    if (!midi) midi = range.min;
    let name = pickSpellingForMidi(midi) || 'C4';
    // Final guard: ensure displayed octave within cap
    let maxSpelledOctave = 6;
    if (currentDifficulty === 'doublec' || currentDifficulty === 'ultra') maxSpelledOctave = 7;
    const octMatch = name.match(/(\d)$/);
    if (octMatch && parseInt(octMatch[1], 10) > maxSpelledOctave) {
      const allowed = Array.from(midiToSpellings.get(midi) || []).filter(n => {
        const m = n.match(/(\d)$/); return m ? parseInt(m[1], 10) <= maxSpelledOctave : true;
      });
      if (allowed.length) name = allowed[0];
    }
    const valves = NAME_TO_VALVES.get(name) || midiToValves.get(midi) || [];
    return { midi, name, valves };
  }

  // Game state
  let isRunning = false;
  let remainingMs = ROUND_SECONDS * 1000;
  let elapsedMs = 0;
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
  let bestScore = 0;
  function bestScoreKey() {
    return `bestScore:${currentDifficulty}:${selectedTimeMode}`;
  }
  function refreshBestForCurrentSelection() {
    const scopedBest = parseInt(localStorage.getItem(bestScoreKey()) || '0', 10);
    const legacyBest = parseInt(localStorage.getItem('bestScore') || '0', 10);
    bestScore = Math.max(scopedBest || 0, legacyBest || 0);
  }

  function resetRound() {
    isRunning = false;
    ROUND_SECONDS = secondsForTimeMode(selectedTimeMode);
    remainingMs = isEndlessMode() ? 0 : ROUND_SECONDS * 1000;
    elapsedMs = 0;
    score = 0;
    streak = 0;
    bestStreak = 0;
    multiplier = 1;
    currentNote = null;
    pressed.clear();
    numCorrect = 0;
    numMistakes = 0;
    totalResponseMs = 0;
    roundState = 'idle';
    if (overlay) overlay.classList.remove('hidden');
    if (overlayCard) overlayCard.classList.remove('results-mode');
    if (cta) cta.textContent = 'Press Space to start';
    if (learningHintEl) {
      learningHintEl.textContent = '';
      learningHintEl.classList.add('hidden');
    }
    if (startBtn) { startBtn.style.display = ''; }
    setStartButtonLabel();
    refreshBestForCurrentSelection();
  }

  function startRound() {
    if (isRunning) return;
    isRunning = true;
    roundState = 'running';
    if (overlay) overlay.classList.add('hidden');
    nextNote();
    setStartButtonLabel();
  }

  function pauseRound() {
    if (!isRunning) return;
    isRunning = false;
    if (overlay) overlay.classList.remove('hidden');
    if (cta) cta.textContent = 'Press Space to resume';
    setStartButtonLabel();
  }

  function resumeRound() {
    if (isRunning) return;
    isRunning = true;
    if (overlay) overlay.classList.add('hidden');
    setStartButtonLabel();
  }

  function finishRound() {
    isRunning = false;
    roundState = 'finished';
    if (overlay) overlay.classList.remove('hidden');
    if (overlayCard) overlayCard.classList.add('results-mode');
    if (startBtn) { startBtn.style.display = 'none'; }
    

    const accuracy = numCorrect + numMistakes > 0 ? Math.round(100 * numCorrect / (numCorrect + numMistakes)) : 0;
    const summaryTimeLabel = isEndlessMode() ? 'Survival' : 'Round Time';
    const summaryTimeValue = isEndlessMode() ? formatDuration(elapsedMs) : `${ROUND_SECONDS}s`;
    const livesRemaining = Math.max(0, ENDLESS_MAX_MISTAKES - numMistakes);
    
    if (cta) {
      cta.innerHTML = `
        <div class="results-panel">
          <div class="results-grid">
            <div class="result-item">
              <span class="result-label">Final Score</span>
              <strong class="result-value teal">${score.toLocaleString()}</strong>
            </div>
            <div class="result-item">
              <span class="result-label">Best Score</span>
              <strong class="result-value orange">${bestScore.toLocaleString()}</strong>
            </div>
            <div class="result-item">
              <span class="result-label">Correct</span>
              <strong class="result-value teal">${numCorrect.toLocaleString()}</strong>
            </div>
            <div class="result-item">
              <span class="result-label">Mistakes</span>
              <strong class="result-value orange">${numMistakes.toLocaleString()}</strong>
            </div>
            <div class="result-item">
              <span class="result-label">Best Streak</span>
              <strong class="result-value teal">${bestStreak.toLocaleString()}</strong>
            </div>
            <div class="result-item">
              <span class="result-label">Accuracy</span>
              <strong class="result-value orange">${accuracy}%</strong>
            </div>
            <div class="result-item">
              <span class="result-label">${summaryTimeLabel}</span>
              <strong class="result-value teal">${summaryTimeValue}</strong>
            </div>
            ${isEndlessMode() ? `
              <div class="result-item">
                <span class="result-label">Lives Left</span>
                <strong class="result-value orange">${livesRemaining}/${ENDLESS_MAX_MISTAKES}</strong>
              </div>
            ` : ''}
          </div>
          <button id="playAgainBtn" class="cta">Play Again</button>
        </div>
      `;
      const playAgain = document.getElementById('playAgainBtn');
      if (playAgain) playAgain.addEventListener('click', () => { resetRound(); startRound(); });
    }
    
    // Save high score locally
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(bestScoreKey(), String(bestScore));
      localStorage.setItem('bestScore', String(bestScore));
    }
    setStartButtonLabel();
  }

  function formatNoteLabel(name) {
    return name
      .replace(/##/g, '♯♯')
      .replace(/bb/g, '♭♭')
      .replace(/#/g, '♯')
      .replace(/b/g, '♭');
  }

  function formatFingeringLabel(valves) {
    if (!Array.isArray(valves) || valves.length === 0) return 'Open (0)';
    return `Valves ${valves.join('+')}`;
  }

  function renderLearningHint(noteObj) {
    if (!learningHintEl) return;
    if (learningMode === 'off' || !noteObj || !isRunning) {
      learningHintEl.textContent = '';
      learningHintEl.classList.add('hidden');
      return;
    }

    const noteLabel = formatNoteLabel(noteObj.name);
    if (learningMode === 'name+fingering') {
      learningHintEl.innerHTML = `
        <span class="note-token">${noteLabel}</span>
        <span class="divider">•</span>
        <span class="finger-token">${formatFingeringLabel(noteObj.valves)}</span>
      `;
    } else {
      learningHintEl.innerHTML = `<span class="note-token">${noteLabel}</span>`;
    }
    learningHintEl.classList.remove('hidden');
  }
  
  function renderBoard() {
    applyRendererLayout();
    context.clear();
    stave = new VF.Stave(rendererLayout.staveX, rendererLayout.staveY, rendererLayout.staveWidth);
    if (typeof stave.setOptions === 'function') {
      stave.setOptions({ spacing_between_lines_px: rendererLayout.lineSpacing });
    }
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

    if (!currentNote) {
      renderLearningHint(null);
      return;
    }
    const note = currentNote.name;
    const vfNote = new VF.StaveNote({ keys: [toVfKey(note)], duration: 'q' });
    const acc = toAccidental(note);
    if (acc) vfNote.addModifier(new VF.Accidental(acc), 0);
    if (typeof VF.GhostNote === 'function') {
      const voice = new VF.Voice({ num_beats: 3, beat_value: 4 }).setStrict(false);
      voice.addTickables([new VF.GhostNote('q'), vfNote, new VF.GhostNote('q')]);
      new VF.Formatter().joinVoices([voice]).format([voice], rendererLayout.staveWidth - 30);
      voice.draw(context, stave);
    } else {
      vfNote.setXShift(Math.round(rendererLayout.staveWidth * 0.28));
      VF.Formatter.FormatAndDraw(context, stave, [vfNote]);
    }

    renderLearningHint(currentNote);

    // HUD text
    const secs = Math.max(0, Math.ceil(remainingMs / 1000));
    const livesLeft = Math.max(0, ENDLESS_MAX_MISTAKES - numMistakes);
    if (statsEl) {
      statsEl.innerHTML = '';
      const rows = isEndlessMode()
        ? [
            `Time ${formatDuration(elapsedMs)}`,
            `Lives ${livesLeft}/${ENDLESS_MAX_MISTAKES}`,
            `Score ${score.toLocaleString()}`,
            `Streak ${streak.toLocaleString()}`,
            `Best ${bestScore.toLocaleString()}`,
          ]
        : [
            `Time ${secs}s`,
            `Score ${score.toLocaleString()}`,
            `Streak ${streak.toLocaleString()}`,
            `Best ${bestScore.toLocaleString()}`,
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
      if (isEndlessMode() && numMistakes >= ENDLESS_MAX_MISTAKES) {
        finishRound();
        draw();
      }
    }
  }

  function nextNote() {
    currentNote = randNote();
    currentNoteStart = performance.now();
    pressed.clear();
  }

  function update(deltaMs) {
    if (!isRunning) return;
    if (isEndlessMode()) {
      elapsedMs += deltaMs;
      return;
    }
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
    const dark = document.documentElement.classList.contains('dark');
    const icon = dark ? '☀️' : '🌙';
    
    if (themeToggle) {
      themeToggle.textContent = icon;
    }
    if (overlayThemeToggle) {
      overlayThemeToggle.textContent = icon;
    }
  }
  
  function updateLogo() {
    const logos = document.querySelectorAll('.brand-logo, #nav-logo');
    if (!logos.length) return;
    logos.forEach(logo => {
      logo.src = 'Untitled design.svg';
    });
  }
  
  // Initialize theme from localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }

  // Function to toggle theme
  function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyThemeButtonLabel();
    updateLogo();
  }

  // Add event listeners to both theme toggle buttons
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  if (overlayThemeToggle) {
    overlayThemeToggle.addEventListener('click', toggleTheme);
  }
  
  // Initialize theme buttons and logo
  applyThemeButtonLabel();
  updateLogo();

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    
    // Prevent scrolling for all arrow keys
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
    }
    
    if (e.code === 'Space') {
      e.preventDefault();
      if (roundState === 'idle') {
        startRound();
      } else if (roundState === 'running') {
        if (isRunning) pauseRound(); else resumeRound();
      } else if (roundState === 'finished') {
        resetRound();
        startRound();
      }
      return;
    }
    if (!isRunning && e.key.toLowerCase() === 's') { startRound(); return; }
    if (e.key.toLowerCase() === 'r') { resetRound(); return; }
    if (!isRunning) return;

    if (e.key === 'Enter' || e.key === 'ArrowUp') {
      e.preventDefault(); // Prevent page scrolling
      pressed.clear();
      pressed.add(0);
      clearTimeout(evalTimer);
      evalTimer = setTimeout(evaluateAnswer, EVAL_DELAY_MS);
      return;
    }

    const v = KEY_TO_VALVE.get(e.key);
    if (v) {
      e.preventDefault(); // Prevent page scrolling for arrow keys
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

  // Difficulty selector
  const difficultySelect = document.getElementById('difficulty');
  if (difficultySelect) {
    // Ensure default matches label changes
    currentDifficulty = difficultySelect.value;
    difficultySelect.addEventListener('change', (e) => {
      currentDifficulty = e.target.value;
      console.log('Difficulty changed to:', currentDifficulty);
      refreshBestForCurrentSelection();
    });
  }

  if (timeModeSelect) {
    selectedTimeMode = timeModeSelect.value;
    timeModeSelect.addEventListener('change', (e) => {
      selectedTimeMode = e.target.value;
      setStartButtonLabel();
      if (roundState === 'idle') {
        ROUND_SECONDS = secondsForTimeMode(selectedTimeMode);
        remainingMs = isEndlessMode() ? 0 : ROUND_SECONDS * 1000;
        elapsedMs = 0;
      }
      refreshBestForCurrentSelection();
    });
  }

  if (learningModeSelect) {
    learningMode = learningModeSelect.value;
    learningModeSelect.addEventListener('change', (e) => {
      learningMode = e.target.value;
      draw();
    });
  }

  if (quickResetBtn) {
    quickResetBtn.addEventListener('click', () => {
      if (roundState !== 'running') return;
      resetRound();
      startRound();
    });
  }

  window.addEventListener('resize', () => {
    syncViewportLayoutVars();
    applyRendererLayout(true);
    draw();
  });
  window.addEventListener('load', () => {
    syncViewportLayoutVars();
    applyRendererLayout(true);
    draw();
  });

    // Boot
    syncViewportLayoutVars();
    applyRendererLayout(true);
    resetRound();
    setStartButtonLabel();
    if (startBtn) startBtn.addEventListener('click', () => {
      if (roundState === 'idle') startRound();
      else if (roundState === 'running') { if (isRunning) pauseRound(); else resumeRound(); }
      else if (roundState === 'finished') { resetRound(); startRound(); }
    });
    requestAnimationFrame(tick);
  }
})();

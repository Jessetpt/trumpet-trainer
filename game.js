/* Trumpet Trainer — B♭ Trumpet note ID game
   Keys: Left=Valve1, Down=Valve2, Right=Valve3, Enter=Open (0)
   Space=start/pause/play-again
*/

(() => {
  // Wait for authentication to be ready before checking login status
  async function waitForAuth() {
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    const currentUser = localStorage.getItem('currentUser');
    
    if (!token && !currentUser) {
      // Try to restore session from Supabase
      if (window.supabaseClient && window.supabaseClient.get) {
        const supabase = window.supabaseClient.get();
        if (supabase) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session && session.user) {
              // Session exists, restore user data
              const userData = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email,
                phone: session.user.user_metadata?.phone || ''
              };
              localStorage.setItem('currentUser', JSON.stringify(userData));
              localStorage.setItem('authToken', session.access_token);
              console.log('✅ Session restored in game.js:', userData);
              return; // User is now logged in
            }
          } catch (error) {
            console.error('Error restoring session:', error);
          }
        }
      }
      
      // No valid session, redirect to login
      console.log('🔐 No valid session found, redirecting to login');
      window.location.href = 'login.html';
      return;
    }
    
    console.log('✅ User already authenticated, proceeding with game');
  }
  
  // Initialize authentication check and game
  waitForAuth().then(() => {
    // Only initialize game if authentication was successful
    if (localStorage.getItem('authToken')) {
      console.log('🎮 Initializing game after successful authentication');
      initializeGame();
    }
  });

  function initializeGame() {
    const overlay = document.getElementById('overlay');
    const cta = document.getElementById('cta');
    const vfDiv = document.getElementById('vf');
    const boardEl = document.getElementById('board');
    const statsEl = document.getElementById('stats');
    const valvesEl = document.getElementById('valves');
    const themeToggle = document.getElementById('themeToggle');
    const overlayThemeToggle = document.getElementById('overlayThemeToggle');
    const logoutBtn = document.getElementById('logoutBtn');
    const startBtn = document.getElementById('startBtn');
    const timeModeSelect = document.getElementById('timeMode');
    let selectedTimeMode = (timeModeSelect && timeModeSelect.value) || '60s';

  function secondsForTimeMode(tm) {
    if (tm === '30s') return 30;
    if (tm === '120s') return 120;
    // future: increment/infinite modes can map here
    return 60;
  }

  // Round state machine
  // idle → running → finished
  let roundState = 'idle';
  let hasPostedScore = false;

  function setStartButtonLabel() {
    if (!startBtn) return;
    if (roundState === 'idle') startBtn.textContent = `Start ${secondsForTimeMode(selectedTimeMode)}s Round`;
    else if (roundState === 'running') startBtn.textContent = isRunning ? 'Pause' : 'Resume';
    else startBtn.textContent = 'Play Again';
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
  let currentRunId = null;
  function newRunId() {
    return 'run_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function updateBestForCurrentSelection() {
    try {
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) return;
      
      const user = JSON.parse(currentUser);
      if (!user || !user.id) return;

      // Wait for Supabase client to be ready
      const supabase = await waitForSupabase();
      if (!supabase) return;

      // Get best score from Supabase
      const { data, error } = await supabase
        .from('scores')
        .select('score')
        .eq('user_id', user.id)
        .eq('game_mode', currentDifficulty)
        .eq('time_mode', selectedTimeMode)
        .order('score', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        bestScore = Number(data.score || 0);
      }
    } catch {}
  }

  function resetRound() {
    isRunning = false;
    ROUND_SECONDS = secondsForTimeMode(selectedTimeMode);
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
    roundState = 'idle';
    hasPostedScore = false;
    if (overlay) overlay.classList.remove('hidden');
    if (cta) cta.textContent = 'Press Space to start';
    if (startBtn) { startBtn.style.display = ''; }
    setStartButtonLabel();
    updateBestForCurrentSelection();
  }

  function startRound() {
    if (isRunning) return;
    isRunning = true;
    roundState = 'running';
    hasPostedScore = false;
    currentRunId = newRunId();
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

  async function finishRound() {
    isRunning = false;
    roundState = 'finished';
    if (overlay) overlay.classList.remove('hidden');
    if (startBtn) { startBtn.style.display = 'none'; }
    

    
    const avgResponse = numCorrect > 0 ? Math.round(totalResponseMs / numCorrect) : 0;
    const accuracy = numCorrect + numMistakes > 0 ? Math.round(100 * numCorrect / (numCorrect + numMistakes)) : 0;
    
    if (cta) {
      cta.innerHTML = `
        <div style="
          text-align: center; 
          margin: 5px auto 16px auto;
          padding: 12px;
          background: linear-gradient(135deg, rgba(32, 156, 189, 0.1), rgba(246, 131, 24, 0.1));
          border-radius: 10px;
          border: 1px solid rgba(32, 156, 189, 0.2);
          backdrop-filter: blur(10px);
          max-width: 360px;
        ">
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin: 0 auto;
          ">
            <div class="stat-blue" style="text-align: center; padding: 6px; background: linear-gradient(135deg, rgba(32, 156, 189, 0.15), rgba(32, 156, 189, 0.05)); border-radius: 5px; border: 1px solid rgba(32, 156, 189, 0.3); font-size: 0.85em;">
              <strong>Final Score:</strong><br>
              <span style="font-size: 1em; color: var(--primary-teal);">${score.toLocaleString()}</span>
            </div>
            <div class="stat-orange" style="text-align: center; padding: 6px; background: linear-gradient(135deg, rgba(246, 131, 24, 0.15), rgba(246, 131, 24, 0.05)); border-radius: 5px; border: 1px solid rgba(246, 131, 24, 0.3); font-size: 0.85em;">
              <strong>Best Score:</strong><br>
              <span style="font-size: 1em; color: var(--primary-orange);">${bestScore.toLocaleString()}</span>
            </div>
            <div class="stat-blue" style="text-align: center; padding: 6px; background: linear-gradient(135deg, rgba(32, 156, 189, 0.15), rgba(32, 156, 189, 0.05)); border-radius: 5px; border: 1px solid rgba(32, 156, 189, 0.3); font-size: 0.85em;">
              <strong>Correct:</strong><br>
              <span style="font-size: 1em; color: var(--primary-teal);">${numCorrect.toLocaleString()}</span>
            </div>
            <div class="stat-orange" style="text-align: center; padding: 6px; background: linear-gradient(135deg, rgba(246, 131, 24, 0.15), rgba(246, 131, 24, 0.05)); border-radius: 5px; border: 1px solid rgba(246, 131, 24, 0.3); font-size: 0.85em;">
              <strong>Mistakes:</strong><br>
              <span style="font-size: 1em; color: var(--primary-orange);">${numMistakes.toLocaleString()}</span>
            </div>
            <div class="stat-blue" style="text-align: center; padding: 6px; background: linear-gradient(135deg, rgba(32, 156, 189, 0.15), rgba(32, 156, 189, 0.05)); border-radius: 5px; border: 1px solid rgba(32, 156, 189, 0.3); font-size: 0.85em;">
              <strong>Best Streak:</strong><br>
              <span style="font-size: 1em; color: var(--primary-teal);">${bestStreak.toLocaleString()}</span>
            </div>
            <div class="stat-orange" style="text-align: center; padding: 6px; background: linear-gradient(135deg, rgba(246, 131, 24, 0.15), rgba(246, 131, 24, 0.05)); border-radius: 5px; border: 1px solid rgba(246, 131, 24, 0.3); font-size: 0.85em;">
              <strong>Accuracy:</strong><br>
              <span style="font-size: 1em; color: var(--primary-orange);">${accuracy}%</span>
            </div>
          </div>
        </div>
        <div style="
          display: flex; 
          justify-content: center; 
          margin-top: 12px;
        ">
          <button id="playAgainBtn" class="cta btn-orange" style="
            background: linear-gradient(135deg, var(--primary-orange), var(--primary-teal));
            border: none;
            padding: 12px 24px;
            font-size: 1em;
            font-weight: 600;
            border-radius: 10px;
            box-shadow: 0 6px 20px rgba(246, 131, 24, 0.3);
            transition: all 0.3s ease;
            min-width: 140px;
          ">Play Again</button>
        </div>
      `;
      const playAgain = document.getElementById('playAgainBtn');
      if (playAgain) playAgain.addEventListener('click', () => { resetRound(); startRound(); });
    }
    
    // Save high score locally
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bestScore', bestScore.toString());
    }
    
    if (!hasPostedScore) {
      hasPostedScore = true;
      // Save score to backend (leaderboard placement will be handled by saveScoreToBackend)
      saveScoreToBackend(score, numCorrect, numMistakes, bestStreak, avgResponse, accuracy)
        .catch(() => {});
    }
    setStartButtonLabel();
  }
  
  // Wait for Supabase client to be ready
  async function waitForSupabase() {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (!window.supabaseClient || !window.supabaseClient.isReady()) {
      if (attempts >= maxAttempts) {
        console.error('Supabase client not ready after 5 seconds');
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    return window.supabaseClient.get();
  }

  async function saveScoreToBackend(score, correct, mistakes, bestStreak, avgResponse, accuracy) {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.error('No auth token found');
      return;
    }
    
    try {
      // Get current user ID from localStorage (more reliable)
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) {
        console.error('No current user found');
        return;
      }

      const user = JSON.parse(currentUser);
      if (!user || !user.id) {
        console.error('Invalid user data');
        return;
      }

      // Wait for Supabase client to be ready
      const supabase = await waitForSupabase();
      if (!supabase) {
        console.error('Supabase not available');
        return;
      }

      // Get the current time mode from the selector to ensure we have the right value
      const currentTimeMode = timeModeSelect ? timeModeSelect.value : selectedTimeMode;
      console.log('🔍 Using time mode for score saving:', currentTimeMode);

      // Save score directly to Supabase
      const { data, error } = await supabase
        .from('scores')
        .insert({
          score,
          correct,
          mistakes,
          best_streak: bestStreak,
          avg_response: avgResponse,
          accuracy,
          game_mode: currentDifficulty,
          time_mode: currentTimeMode,
          run_id: currentRunId || newRunId(),
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to save score:', error);
        return;
      }

      console.log('Score saved successfully:', data);
      
      // Store last score info for leaderboard highlighting
      if (data) {
        localStorage.setItem('lastScore', JSON.stringify({
          score: data.score,
          game_mode: currentDifficulty,
          time_mode: currentTimeMode,
          created_at: data.created_at,
          user_id: user.id
        }));
      }

      // Show leaderboard placement after successful save
      await maybeShowLeaderboardPlacement(score);
      
    } catch (error) {
      console.error('Error saving score:', error);
    }
  }

  async function maybeShowLeaderboardPlacement(finalScore) {
    try {
      // Get current user ID from localStorage
      const currentUser = localStorage.getItem('currentUser');
      if (!currentUser) {
        console.error('No current user found for leaderboard placement');
        return;
      }

      const user = JSON.parse(currentUser);
      if (!user || !user.id) {
        console.error('Invalid user data for leaderboard placement');
        return;
      }

      // Wait for Supabase client to be ready
      const supabase = await waitForSupabase();
      if (!supabase) {
        console.error('Supabase not available for leaderboard placement');
        return;
      }

      // Get the current time mode from the selector to ensure we have the right value
      const currentTimeMode = timeModeSelect ? timeModeSelect.value : selectedTimeMode;
      console.log('🔍 Using time mode for leaderboard query:', currentTimeMode);

      // Get leaderboard from Supabase including the current user's score
      const { data, error } = await supabase
        .from('scores')
        .select('score, user_id')
        .eq('game_mode', currentDifficulty)
        .eq('time_mode', currentTimeMode)
        .order('score', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching leaderboard for placement:', error);
        return;
      }
      
      const list = data || [];
      console.log('🔍 Raw leaderboard data received:', list);
      console.log('🔍 Total scores in leaderboard:', list.length);
      console.log('🔍 Current user ID:', user.id);
      
      // Find the current user's score in the leaderboard
      // We need to find the score that matches the finalScore we're ranking
      const userScore = list.find(s => s.user_id === user.id && s.score === finalScore);
      console.log('🔍 User score found in leaderboard:', userScore);
      
      // If we can't find the exact score, log all user scores to debug
      if (!userScore) {
        const allUserScores = list.filter(s => s.user_id === user.id);
        console.log('🔍 All user scores in leaderboard:', allUserScores);
        console.log('🔍 Looking for score:', finalScore);
      }
      
      if (userScore && cta) {
        console.log('🔍 Final score to rank:', finalScore);
        console.log('🔍 User score from leaderboard:', userScore.score);
        
        // Calculate the actual rank by counting how many scores are higher than the user's score
        let rank = 1;
        for (const score of list) {
          if (score.score > userScore.score) {
            rank++;
          }
        }
        console.log('🔍 Calculated rank:', rank);
        
        const niceMode = ({normal:'Normal', lead:'Lead Trumpet', hard:'Hard Mode', doublec:'Double C', ultra:'Ultra Hard'})[currentDifficulty] || currentDifficulty;
        
        // Create placement message
        const note = document.createElement('div');
        note.style.marginTop = '10px';
        note.style.padding = '8px';
        note.style.borderRadius = '6px';
        note.style.backgroundColor = 'rgba(32, 156, 189, 0.1)';
        note.style.border = '1px solid var(--primary-teal)';
        
        note.innerHTML = `
          <span class="stat-orange"><strong>🏆 Leaderboard:</strong></span> 
          <span class="stat-blue">You placed #${rank} in ${niceMode} — ${currentTimeMode.toUpperCase()}</span>
        `;
        
        // Remove any existing placement message
        const existingNote = cta.querySelector('[data-placement-message]');
        if (existingNote) {
          existingNote.remove();
        }
        
        note.setAttribute('data-placement-message', 'true');
        cta.appendChild(note);
        
        console.log(`Leaderboard placement: #${rank} in ${currentDifficulty} ${currentTimeMode}`);
      } else if (cta) {
        // If user's score isn't in the top 100, show a generic message
        const niceMode = ({normal:'Normal', lead:'Lead Trumpet', hard:'Hard Mode', doublec:'Double C', ultra:'Ultra Hard'})[currentDifficulty] || currentDifficulty;
        
        const note = document.createElement('div');
        note.style.marginTop = '10px';
        note.style.padding = '8px';
        note.style.borderRadius = '6px';
        note.style.backgroundColor = 'rgba(246, 131, 24, 0.1)';
        note.style.border = '1px solid var(--primary-orange)';
        
        note.innerHTML = `
          <span class="stat-orange"><strong>🎯 Score Saved!</strong></span> 
          <span class="stat-blue">Your score of ${finalScore.toLocaleString()} has been saved to the ${niceMode} leaderboard!</span>
        `;
        
        // Remove any existing placement message
        const existingNote = cta.querySelector('[data-placement-message]');
        if (existingNote) {
          existingNote.remove();
        }
        
        note.setAttribute('data-placement-message', 'true');
        cta.appendChild(note);
        
        console.log(`Score saved: ${finalScore} in ${currentDifficulty} ${currentTimeMode}`);
      }
    } catch (error) {
      console.error('Error showing leaderboard placement:', error);
    }
  }

  function layoutForNote(midi) {
    // Simple layout: staff position based on midi
    const staffPos = (midi - MIDI_MIN) / (MIDI_MAX_C7 - MIDI_MIN);
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
        `Score: ${score.toLocaleString()}`,
        `Streak: ${streak.toLocaleString()}`,
        `Mult: x${multiplier.toFixed(2)}`,
        `Best: ${bestScore.toLocaleString()}`,
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
    const logos = document.querySelectorAll('#brandLogo');
    if (!logos.length) return;
    const dark = document.documentElement.classList.contains('dark');
    logos.forEach(logo => {
      logo.src = dark ? 'Untitled design dark.svg' : 'Untitled design.svg';
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

  // Navigation functionality
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      window.location.href = 'login.html';
    });
  }

  // Difficulty selector
  const difficultySelect = document.getElementById('difficulty');
  if (difficultySelect) {
    // Ensure default matches label changes
    currentDifficulty = difficultySelect.value;
    difficultySelect.addEventListener('change', (e) => {
      currentDifficulty = e.target.value;
      console.log('Difficulty changed to:', currentDifficulty);
      updateBestForCurrentSelection();
    });
  }

  if (timeModeSelect) {
    selectedTimeMode = timeModeSelect.value;
    timeModeSelect.addEventListener('change', (e) => {
      selectedTimeMode = e.target.value;
      setStartButtonLabel();
      if (roundState === 'idle') {
        ROUND_SECONDS = secondsForTimeMode(selectedTimeMode);
        remainingMs = ROUND_SECONDS * 1000;
      }
      updateBestForCurrentSelection();
    });
  }

    // Boot
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


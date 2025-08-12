(() => {
  // Mobile-optimized Trumpet Trainer game
  
  // Game state
  let isRunning = false;
  let currentNote = null;
  let score = 0;
  let correct = 0;
  let mistakes = 0;
  let startTime = null;
  let gameTimer = null;
  
  // DOM elements
  const staffContainer = document.getElementById('staffContainer');
  const startBtn = document.getElementById('startBtn');
  const scoreDisplay = document.getElementById('score');
  const accuracyDisplay = document.getElementById('accuracy');
  const controlBtns = document.querySelectorAll('.control-btn');
  
  // VexFlow for musical notation
  const { Factory } = Vex.Flow;
  
  // Note generation with proper octaves and accidentals
  const notes = [
    { name: 'C', octave: 4, accidental: null },
    { name: 'C#', octave: 4, accidental: '#' },
    { name: 'D', octave: 4, accidental: null },
    { name: 'D#', octave: 4, accidental: '#' },
    { name: 'E', octave: 4, accidental: null },
    { name: 'F', octave: 4, accidental: null },
    { name: 'F#', octave: 4, accidental: '#' },
    { name: 'G', octave: 4, accidental: null },
    { name: 'G#', octave: 4, accidental: '#' },
    { name: 'A', octave: 4, accidental: null },
    { name: 'A#', octave: 4, accidental: '#' },
    { name: 'B', octave: 4, accidental: null }
  ];
  
  // Valve combinations for different notes (simplified for now)
  const valveCombos = {
    0: [],      // Open (no valves)
    1: [1],     // First valve
    2: [2],     // Second valve  
    3: [3]      // Third valve
  };
  
  // Initialize game
  function initGame() {
    // Set up control button event listeners
    controlBtns.forEach(btn => {
      btn.addEventListener('touchstart', handleValvePress);
      btn.addEventListener('mousedown', handleValvePress);
    });
    
    // Set up start button
    startBtn.addEventListener('click', toggleGame);
    
    // Show initial state
    updateDisplay();
    
    // Initialize staff display
    renderStaff();
  }
  
  // Render musical staff
  function renderStaff() {
    try {
      console.log('Rendering staff...');
      staffContainer.innerHTML = '';
      
      const factory = new Factory({
        renderer: { elementId: 'staffContainer', width: 300, height: 120 }
      });
      
      const score = factory.EasyScore();
      const system = factory.System();
      
      system
        .addStave({
          voices: [
            score.voice(score.notes('C4/q'))
          ]
        })
        .addClef('treble')
        .addTimeSignature('4/4');
      
      factory.draw();
      console.log('Staff rendered successfully');
    } catch (error) {
      console.error('Error rendering staff:', error);
      // Fallback: show a simple note display
      staffContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div style="font-size: 3rem; color: var(--primary-teal);">🎺</div>
          <div style="font-size: 1.2rem; margin-top: 1rem;">Tap Start to Play</div>
        </div>
      `;
    }
  }
  
  // Handle valve button press
  function handleValvePress(e) {
    e.preventDefault();
    if (!isRunning) return;
    
    const valve = parseInt(e.currentTarget.dataset.valve);
    
    // Add haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50); // 50ms vibration
    }
    
    checkAnswer(valve);
  }
  
  // Check if the answer is correct
  function checkAnswer(valve) {
    if (!currentNote) return;
    
    // For now, let's make it simple - any valve press is correct
    // We can make this more sophisticated later
    if (valve >= 0 && valve <= 3) {
      correct++;
      showFeedback(e.currentTarget, true);
      nextNote();
    } else {
      mistakes++;
      showFeedback(e.currentTarget, false);
    }
    
    updateDisplay();
  }
  
  // Show visual feedback
  function showFeedback(button, isCorrect) {
    button.classList.add(isCorrect ? 'correct' : 'incorrect');
    
    setTimeout(() => {
      button.classList.remove('correct', 'incorrect');
    }, 300);
  }
  
  // Generate next note
  function nextNote() {
    currentNote = notes[Math.floor(Math.random() * notes.length)];
    renderNoteOnStaff(currentNote);
    score += 10;
  }
  
  // Render note on staff
  function renderNoteOnStaff(note) {
    try {
      console.log('Rendering note:', note);
      staffContainer.innerHTML = '';
      
      const factory = new Factory({
        renderer: { elementId: 'staffContainer', width: 300, height: 120 }
      });
      
      const score = factory.EasyScore();
      const system = factory.System();
      
      // Create note string with accidental if needed
      let noteString = note.name + note.octave + '/q';
      console.log('Note string:', noteString);
      
      system
        .addStave({
          voices: [
            score.voice(score.notes(noteString))
          ]
        })
        .addClef('treble')
        .addTimeSignature('4/4');
      
      factory.draw();
      console.log('Note rendered successfully');
    } catch (error) {
      console.error('Error rendering note:', error);
      // Fallback: show note as text
      staffContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
          <div style="font-size: 4rem; color: var(--primary-teal); font-weight: bold;">${note.name}</div>
          <div style="font-size: 1.5rem; margin-top: 1rem;">${note.octave}</div>
        </div>
      `;
    }
  }
  
  // Toggle game on/off
  function toggleGame() {
    if (isRunning) {
      stopGame();
    } else {
      startGame();
    }
  }
  
  // Start the game
  function startGame() {
    isRunning = true;
    startTime = Date.now();
    startBtn.textContent = 'Stop Game';
    document.body.classList.add('game-running');
    
    // Start game timer (60 seconds)
    gameTimer = setTimeout(() => {
      stopGame();
    }, 60000);
    
    // Generate first note
    nextNote();
  }
  
  // Stop the game
  function stopGame() {
    isRunning = false;
    startBtn.textContent = 'Start Game';
    document.body.classList.remove('game-running');
    
    if (gameTimer) {
      clearTimeout(gameTimer);
      gameTimer = null;
    }
    
    // Show final results
    showGameResults();
  }
  
  // Show game results
  function showGameResults() {
    const accuracy = correct + mistakes > 0 ? Math.round((correct / (correct + mistakes)) * 100) : 0;
    
    staffContainer.innerHTML = `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 2rem; margin-bottom: 1rem; color: var(--primary-teal);">🎉 Game Over! 🎉</div>
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">Final Score: ${score}</div>
        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">Correct: ${correct}</div>
        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">Accuracy: ${accuracy}%</div>
      </div>
    `;
  }
  
  // Update display
  function updateDisplay() {
    scoreDisplay.textContent = `Score: ${score}`;
    const accuracy = correct + mistakes > 0 ? Math.round((correct / (correct + mistakes)) * 100) : 0;
    accuracyDisplay.textContent = `Accuracy: ${accuracy}%`;
  }
  
  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
  
  // Prevent zoom on double tap
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
})(); 
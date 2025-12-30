/**
 * PRODUCTIVITY TRACKER
 * Desktop App with Tauri + AWS Sync + AI Insights
 * 
 * @author Alessio Ferrari
 * @version 1.1.1 - Fixed hourly chart calculation
 */

// ============================================
// CONFIGURATION
// ============================================

const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) || '';
const DEBUG = (typeof CONFIG !== 'undefined' && CONFIG.DEBUG) || false;

function log(...args) {
  if (DEBUG) console.log('[PT]', ...args);
}

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
  projects: [],
  sessions: [],
  activeTimer: null,
  startTime: null,
  elapsedSeconds: 0,
  timerInterval: null,
  isPaused: false,
  pausedElapsed: 0,
  // Pomodoro
  pomodoroMode: true,
  pomodoroDuration: 25 * 60,
  pomodoroRemaining: 0,
  // AI Config
  aiProvider: 'anthropic',
  aiModel: '',
  aiApiKey: '',
  // Charts
  charts: {
    hourly: null,
    weekly: null,
    projects: null
  }
};

// Default projects
const DEFAULT_PROJECTS = [
  { id: 'proj1', name: 'Work Project', color: '#00ff88' },
  { id: 'proj2', name: 'Side Project', color: '#ff6b35' },
  { id: 'proj3', name: 'Learning', color: '#00d4ff' }
];

// ============================================
// UTILITIES
// ============================================

function saveRecoveryState() {
  if (!state.activeTimer) {
    localStorage.removeItem('pt_recovery');
    return;
  }
  
  const recoveryData = {
    activeTimer: state.activeTimer,
    startTime: state.startTime,
    isPaused: state.isPaused,
    pausedElapsed: state.pausedElapsed,
    pomodoroMode: state.pomodoroMode,
    pomodoroDuration: state.pomodoroDuration,
    lastSeen: Date.now() 
  };
  
  localStorage.setItem('pt_recovery', JSON.stringify(recoveryData));
}

function checkRecoveryState() {
  try {
    const saved = localStorage.getItem('pt_recovery');
    if (!saved) return;

    const data = JSON.parse(saved);
    if (Date.now() - data.lastSeen > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('pt_recovery');
      return;
    }

    console.log('♻️ Recovering crashed session...');
    state.activeTimer = data.activeTimer;
    state.startTime = data.startTime;
    state.isPaused = data.isPaused;
    state.pausedElapsed = data.pausedElapsed;
    state.pomodoroMode = data.pomodoroMode;
    state.pomodoroDuration = data.pomodoroDuration;

    if (state.isPaused) {
      state.elapsedSeconds = state.pausedElapsed;
      updateTimerDisplay();
      renderProjects();
    } else {
      resumeTimer(); 
    }
  } catch (e) {
    console.error('Recovery failed:', e);
    localStorage.removeItem('pt_recovery');
  }
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTimeShort = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const getToday = () => new Date().toISOString().split('T')[0];

const getWeekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
};

const formatHour = (date) => {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDay = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// STORAGE
// ============================================

const Storage = {
  async save(key, data) {
    try {
      localStorage.setItem(`pt_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  },

  async load(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(`pt_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }
};

// ============================================
// DATA MANAGEMENT
// ============================================

async function loadData() {
  state.projects = await Storage.load('projects', DEFAULT_PROJECTS);
  state.sessions = await Storage.load('sessions', []);
  state.apiKey = await Storage.load('apiKey', '');
  
  if (state.apiKey) {
    document.getElementById('apiKeyInput').value = '••••••••••••••••';
  }
}

async function saveProjects() {
  localStorage.setItem('pt_projects', JSON.stringify(state.projects));
  await Storage.save('projects', state.projects);
  log('Projects saved, count:', state.projects.length);
}

async function saveSessions() {
  localStorage.setItem('pt_sessions', JSON.stringify(state.sessions));
  await Storage.save('sessions', state.sessions);
  log('Sessions saved, count:', state.sessions.length);
}

async function saveApiKey(key) {
  state.apiKey = key;
  await Storage.save('apiKey', key);
}

// ============================================
// TIMER FUNCTIONS
// ============================================

function startTimer(projectId) {
  if (state.isPaused && state.activeTimer === projectId) {
    resumeTimer();
    return;
  }
  
  if (state.activeTimer) {
    stopTimer(false);
  }

  state.activeTimer = projectId;
  state.startTime = Date.now();
  state.elapsedSeconds = 0;
  state.isPaused = false;
  state.pausedElapsed = 0;
  
  if (state.pomodoroMode && state.pomodoroDuration > 0) {
    state.pomodoroRemaining = state.pomodoroDuration;
  }

  state.timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    
    if (state.pomodoroMode && state.pomodoroDuration > 0) {
      state.pomodoroRemaining = state.pomodoroDuration - state.elapsedSeconds;
      
      if (state.pomodoroRemaining <= 0) {
        pomodoroFinished();
        return;
      }
    }
    
    updateTimerDisplay();
    if (state.elapsedSeconds % 2 === 0) saveRecoveryState(); 
  }, 1000);

  saveRecoveryState();
  updateTimerDisplay();
  renderProjects();
}

function pauseTimer() {
  if (!state.activeTimer || state.isPaused) return;
  
  clearInterval(state.timerInterval);
  state.isPaused = true;
  state.pausedElapsed = state.elapsedSeconds;
  
  updateTimerDisplay();
  renderProjects();
}

function resumeTimer() {
  if (!state.activeTimer || !state.isPaused) return;
  
  state.isPaused = false;
  state.startTime = Date.now() - (state.pausedElapsed * 1000);
  
  state.timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    
    if (state.pomodoroMode && state.pomodoroDuration > 0) {
      state.pomodoroRemaining = state.pomodoroDuration - state.elapsedSeconds;
      if (state.pomodoroRemaining <= 0) {
        pomodoroFinished();
        return;
      }
    }
    
    updateTimerDisplay();
    if (state.elapsedSeconds % 2 === 0) saveRecoveryState(); 
  }, 1000);

  saveRecoveryState();
  updateTimerDisplay();
  renderProjects();
}

function stopTimer(save = true) {
  if (!state.activeTimer) return;

  localStorage.removeItem('pt_recovery');
  clearInterval(state.timerInterval);

  const minDuration = (typeof CONFIG !== 'undefined' && CONFIG.MIN_SESSION_DURATION) || 60;

  if (save && state.elapsedSeconds >= minDuration) {
    const isBreak = state.activeTimer === 'break';
    const session = {
      id: generateId(),
      projectId: state.activeTimer,
      startTime: new Date(state.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: state.elapsedSeconds,
      date: getToday(),
      type: isBreak ? 'break' : 'work'
    };
    log('Saving session:', session);
    state.sessions.push(session);
    saveSessions();
  }

  state.activeTimer = null;
  state.startTime = null;
  state.elapsedSeconds = 0;
  state.isPaused = false;
  state.pausedElapsed = 0;
  state.pomodoroRemaining = 0;

  updateTimerDisplay();
  updateStats();
  renderProjects();
  renderSessions();
}

function startBreak(duration) {
  if (state.activeTimer) {
    stopTimer(state.activeTimer !== 'break');
  }

  state.activeTimer = 'break';
  state.startTime = Date.now();
  state.elapsedSeconds = 0;
  state.isPaused = false;
  state.pausedElapsed = 0;
  state.pomodoroMode = true;
  state.pomodoroDuration = duration;
  state.pomodoroRemaining = duration;

  state.timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    state.pomodoroRemaining = state.pomodoroDuration - state.elapsedSeconds;
    
    if (state.pomodoroRemaining <= 0) {
      breakFinished();
      return;
    }
    
    updateTimerDisplay();
  }, 1000);

  updateTimerDisplay();
  renderProjects();
}

function pomodoroFinished() {
  clearInterval(state.timerInterval);
  
  const session = {
    id: generateId(),
    projectId: state.activeTimer,
    startTime: new Date(state.startTime).toISOString(),
    endTime: new Date().toISOString(),
    duration: state.pomodoroDuration,
    date: getToday(),
    type: 'pomodoro'
  };
  state.sessions.push(session);
  saveSessions();
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🍅 Pomodoro completed!', {
      body: `${state.pomodoroDuration / 60} minute session finished`,
      icon: 'icons/icon.png'
    });
  }
  
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = 800;
    gain.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  } catch (e) {}
  
  const display = document.getElementById('timerDisplay');
  display.classList.add('finished');
  
  setTimeout(() => {
    display.classList.remove('finished');
    state.activeTimer = null;
    state.startTime = null;
    state.elapsedSeconds = 0;
    state.pomodoroRemaining = 0;
    updateTimerDisplay();
    updateStats();
    renderProjects();
    renderSessions();
  }, 3000);
}

function breakFinished() {
  clearInterval(state.timerInterval);
  
  const session = {
    id: generateId(),
    projectId: 'break',
    startTime: new Date(state.startTime).toISOString(),
    endTime: new Date().toISOString(),
    duration: state.pomodoroDuration,
    date: getToday(),
    type: 'break'
  };
  state.sessions.push(session);
  saveSessions();
  log('Break saved:', session);
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('☕ Break finished!', {
      body: 'Ready to get back to work?'
    });
  }
  
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = 600;
    gain.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => oscillator.stop(), 300);
  } catch (e) {}
  
  const display = document.getElementById('timerDisplay');
  display.classList.add('finished');
  
  setTimeout(() => {
    display.classList.remove('finished');
    state.activeTimer = null;
    state.startTime = null;
    state.elapsedSeconds = 0;
    state.pomodoroRemaining = 0;
    
    state.pomodoroDuration = 25 * 60;
    document.querySelectorAll('.pomo-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.pomo-btn[data-duration="1500"]').classList.add('active');
    
    updateTimerDisplay();
    updateStats();
    renderProjects();
    renderSessions();
  }, 3000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  const projectLabel = document.getElementById('timerProject');
  const stopBtn = document.getElementById('stopBtn');

  if (state.pomodoroMode && state.pomodoroDuration > 0 && state.activeTimer) {
    display.textContent = formatTime(Math.max(0, state.pomodoroRemaining));
    display.classList.add('countdown');
  } else {
    display.textContent = formatTime(state.elapsedSeconds);
    display.classList.remove('countdown');
  }

  if (state.activeTimer) {
    if (state.activeTimer === 'break') {
      display.style.color = 'var(--accent-cyan)';
      display.classList.add('active');
      projectLabel.innerHTML = `<span class="dot" style="background: var(--accent-cyan)"></span>☕ Break`;
      projectLabel.style.color = 'var(--accent-cyan)';
    } else {
      const project = state.projects.find(p => p.id === state.activeTimer);
      display.style.color = state.isPaused ? 'var(--accent-orange)' : project.color;
      display.classList.toggle('active', !state.isPaused);
      
      const statusText = state.isPaused ? ' (paused)' : '';
      projectLabel.innerHTML = `<span class="dot" style="background: ${project.color}; ${state.isPaused ? 'animation: none;' : ''}"></span>${project.name}${statusText}`;
      projectLabel.style.color = project.color;
    }
    
    stopBtn.classList.remove('hidden');
  } else {
    display.style.color = '';
    display.classList.remove('active');
    display.classList.remove('countdown');
    projectLabel.innerHTML = 'Select a project';
    projectLabel.style.color = '';
    stopBtn.classList.add('hidden');
  }
}

// ============================================
// STATS CALCULATION
// ============================================

/**
 * Calculate minutes worked within a specific hour slot
 * Handles sessions that span multiple hours correctly
 */
function getMinutesInHour(session, hourStart, hourEnd) {
  const sessionStart = new Date(session.startTime);
  const sessionEnd = new Date(session.endTime);
  
  // If session doesn't overlap with this hour, return 0
  if (sessionEnd <= hourStart || sessionStart >= hourEnd) {
    return 0;
  }
  
  // Calculate overlap
  const overlapStart = Math.max(sessionStart.getTime(), hourStart.getTime());
  const overlapEnd = Math.min(sessionEnd.getTime(), hourEnd.getTime());
  
  // Return minutes (max 60)
  return Math.min(60, Math.round((overlapEnd - overlapStart) / 60000));
}

function getStats() {
  const today = getToday();
  const weekAgo = getWeekAgo();

  const todaySessions = state.sessions.filter(s => s.date === today);
  const weekSessions = state.sessions.filter(s => s.date >= weekAgo);

  const todayTotal = todaySessions.reduce((acc, s) => acc + s.duration, 0);
  const weekTotal = weekSessions.reduce((acc, s) => acc + s.duration, 0);

  // Hourly data (last 8 hours) - FIXED CALCULATION
  const hourlyData = [];
  const now = new Date();
  
  for (let i = 7; i >= 0; i--) {
    const hourStart = new Date(now);
    hourStart.setHours(now.getHours() - i, 0, 0, 0);
    
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hourStart.getHours() + 1);

    // Calculate actual minutes worked WITHIN this hour
    const minutes = todaySessions.reduce((acc, session) => {
      return acc + getMinutesInHour(session, hourStart, hourEnd);
    }, 0);

    hourlyData.push({
      label: hourStart.getHours().toString().padStart(2, '0') + ':00',
      value: Math.min(60, minutes) // Cap at 60 minutes max
    });
  }

  const dailyData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const hours = Math.round(
      state.sessions
        .filter(s => s.date === dateStr)
        .reduce((acc, s) => acc + s.duration, 0) / 3600 * 10
    ) / 10;

    dailyData.push({
      label: formatDay(dateStr),
      value: hours
    });
  }

  const projectData = state.projects.map(p => {
    const totalSeconds = weekSessions
      .filter(s => s.projectId === p.id)
      .reduce((acc, s) => acc + s.duration, 0);
    
    const value = totalSeconds >= 3600 
      ? Math.round(totalSeconds / 3600 * 10) / 10
      : Math.round(totalSeconds / 60);
    
    const unit = totalSeconds >= 3600 ? 'h' : 'm';
    
    return { 
      name: p.name, 
      value: value,
      seconds: totalSeconds,
      unit: unit,
      color: p.color 
    };
  }).filter(p => p.seconds > 0);

  return { todayTotal, weekTotal, todaySessions, weekSessions, hourlyData, dailyData, projectData };
}

function updateStats() {
  const stats = getStats();

  document.getElementById('todayTotal').textContent = formatTime(stats.todayTotal);
  document.getElementById('weekTotal').textContent = formatTime(stats.weekTotal);
  document.getElementById('sessionCount').textContent = stats.todaySessions.length;
  document.getElementById('sessionsBadge').textContent = stats.todaySessions.length;
}

// ============================================
// PROJECT MANAGEMENT
// ============================================

function addProject(name, color) {
  const project = {
    id: generateId(),
    name: name.trim(),
    color: color
  };
  state.projects.push(project);
  saveProjects();
  renderProjects();
}

function deleteProject(id) {
  if (state.activeTimer === id) {
    stopTimer(false);
  }
  state.projects = state.projects.filter(p => p.id !== id);
  state.sessions = state.sessions.filter(s => s.projectId !== id);
  saveProjects();
  saveSessions();
  renderProjects();
  updateStats();
}

// ============================================
// RENDERING
// ============================================

function renderProjects() {
  const container = document.getElementById('projectsList');
  const stats = getStats();

  container.innerHTML = state.projects.map(project => {
    const projectTime = stats.todaySessions
      .filter(s => s.projectId === project.id)
      .reduce((acc, s) => acc + s.duration, 0);
    const isActive = state.activeTimer === project.id;

    return `
      <div class="project-item ${isActive ? 'active' : ''}" style="color: ${project.color}" data-project-id="${project.id}">
        <div class="project-color" style="background: ${project.color}"></div>
        <div class="project-info">
          <div class="project-name">${escapeHtml(project.name)}</div>
          <div class="project-time">Today: ${formatTime(projectTime)}</div>
        </div>
        <div class="project-actions">
          ${isActive ? `
            ${state.isPaused ? `
              <button class="project-btn start" data-action="resume" data-project-id="${project.id}" style="color: ${project.color}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Resume
              </button>
            ` : `
              <button class="project-btn pause" data-action="pause" style="color: var(--accent-orange)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
                Pause
              </button>
            `}
            <button class="project-btn stop" data-action="stop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12"/>
              </svg>
              Stop
            </button>
          ` : `
            <button class="project-btn start" data-action="start" data-project-id="${project.id}" style="color: ${project.color}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start
            </button>
          `}
          <button class="project-btn delete" data-action="delete" data-project-id="${project.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', handleProjectAction);
  });
}

function handleProjectAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const projectId = btn.dataset.projectId;

  switch (action) {
    case 'start':
      startTimer(projectId);
      break;
    case 'pause':
      pauseTimer();
      break;
    case 'resume':
      resumeTimer();
      break;
    case 'stop':
      stopTimer();
      break;
    case 'delete':
      deleteProject(projectId);
      break;
  }
}

function renderSessions() {
  const container = document.getElementById('sessionsList');
  const todaySessions = state.sessions
    .filter(s => s.date === getToday())
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  if (todaySessions.length === 0) {
    container.innerHTML = '<div class="no-sessions">No sessions today</div>';
    return;
  }

  container.innerHTML = todaySessions.map(session => {
    const isBreak = session.projectId === 'break' || session.type === 'break';
    
    if (isBreak) {
      return `
        <div class="session-item">
          <div class="session-color" style="background: var(--accent-cyan)"></div>
          <div class="session-info">
            <div class="session-project">☕ Break</div>
            <div class="session-time">${formatHour(session.startTime)} - ${formatHour(session.endTime)}</div>
          </div>
          <div class="session-duration" style="color: var(--accent-cyan)">${formatTimeShort(session.duration)}</div>
        </div>
      `;
    }
    
    const project = state.projects.find(p => p.id === session.projectId);
    if (!project) return '';

    return `
      <div class="session-item">
        <div class="session-color" style="background: ${project.color}"></div>
        <div class="session-info">
          <div class="session-project">${escapeHtml(project.name)}</div>
          <div class="session-time">${formatHour(session.startTime)} - ${formatHour(session.endTime)}</div>
        </div>
        <div class="session-duration">${formatTimeShort(session.duration)}</div>
      </div>
    `;
  }).join('');
}

// ============================================
// CHARTS
// ============================================

function initCharts() {
  const stats = getStats();

  const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
  state.charts.hourly = new Chart(hourlyCtx, {
    type: 'bar',
    data: {
      labels: stats.hourlyData.map(d => d.label),
      datasets: [{
        data: stats.hourlyData.map(d => d.value),
        backgroundColor: '#00ff8840',
        borderColor: '#00ff88',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: getChartOptions('Minutes', 60) // Max 60 minutes
  });

  const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
  state.charts.weekly = new Chart(weeklyCtx, {
    type: 'line',
    data: {
      labels: stats.dailyData.map(d => d.label),
      datasets: [{
        data: stats.dailyData.map(d => d.value),
        borderColor: '#00d4ff',
        backgroundColor: '#00d4ff20',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#00d4ff',
        pointRadius: 4
      }]
    },
    options: getChartOptions('Hours')
  });

  const projectsCtx = document.getElementById('projectsChart').getContext('2d');
  state.charts.projects = new Chart(projectsCtx, {
    type: 'doughnut',
    data: {
      labels: stats.projectData.map(d => d.name),
      datasets: [{
        data: stats.projectData.map(d => d.seconds),
        backgroundColor: stats.projectData.map(d => d.color + '80'),
        borderColor: stats.projectData.map(d => d.color),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const item = stats.projectData[context.dataIndex];
              return `${item.name}: ${item.value}${item.unit}`;
            }
          }
        }
      },
      cutout: '60%'
    }
  });

  renderProjectsLegend(stats.projectData);
}

function getChartOptions(yLabel, suggestedMax = null) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { color: '#ffffff10' },
        ticks: { color: '#666', font: { family: "'JetBrains Mono'" } }
      },
      y: {
        grid: { color: '#ffffff10' },
        ticks: { color: '#666', font: { family: "'JetBrains Mono'" } },
        title: { display: true, text: yLabel, color: '#666' },
        beginAtZero: true
      }
    }
  };
  
  // Set max for hourly chart (60 minutes)
  if (suggestedMax) {
    options.scales.y.suggestedMax = suggestedMax;
  }
  
  return options;
}

function updateCharts() {
  const stats = getStats();

  if (state.charts.hourly) {
    state.charts.hourly.data.labels = stats.hourlyData.map(d => d.label);
    state.charts.hourly.data.datasets[0].data = stats.hourlyData.map(d => d.value);
    state.charts.hourly.update();
  }

  if (state.charts.weekly) {
    state.charts.weekly.data.labels = stats.dailyData.map(d => d.label);
    state.charts.weekly.data.datasets[0].data = stats.dailyData.map(d => d.value);
    state.charts.weekly.update();
  }

  if (state.charts.projects) {
    state.charts.projects.data.labels = stats.projectData.map(d => d.name);
    state.charts.projects.data.datasets[0].data = stats.projectData.map(d => d.seconds);
    state.charts.projects.data.datasets[0].backgroundColor = stats.projectData.map(d => d.color + '80');
    state.charts.projects.data.datasets[0].borderColor = stats.projectData.map(d => d.color);
    state.charts.projects.update();
  }

  renderProjectsLegend(stats.projectData);
}

function renderProjectsLegend(data) {
  const container = document.getElementById('projectsLegend');
  
  if (data.length === 0) {
    container.innerHTML = '<div class="no-sessions">No data this week</div>';
    return;
  }

  container.innerHTML = data.map(p => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${p.color}"></div>
      <span class="legend-name">${escapeHtml(p.name)}</span>
      <span class="legend-value" style="color: ${p.color}">${p.value}${p.unit || 'h'}</span>
    </div>
  `).join('');
}

// ============================================
// AWS SYNC
// ============================================

async function syncToAWS() {
  if (!API_URL) {
    console.error('API_URL not configured in config.js');
    return;
  }

  const syncBtn = document.getElementById('syncBtn');
  syncBtn.classList.add('syncing');
  syncBtn.querySelector('span').textContent = 'Sync...';

  const payload = {
    date: getToday(),
    projects: state.projects,
    sessions: state.sessions.filter(s => s.date === getToday())
  };

  try {
    log('Syncing to AWS:', payload);
    
    const response = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    log('Sync result:', result);

    if (result.success) {
      syncBtn.classList.remove('syncing');
      syncBtn.classList.add('synced');
      syncBtn.querySelector('span').textContent = 'Synced!';
    } else {
      throw new Error(result.error || 'Sync failed');
    }

  } catch (error) {
    console.error('Sync error:', error);
    syncBtn.classList.remove('syncing');
    syncBtn.querySelector('span').textContent = 'Error!';
  }

  setTimeout(() => {
    syncBtn.classList.remove('synced');
    syncBtn.querySelector('span').textContent = 'Sync';
  }, 3000);
}

async function loadFromAWS(date = getToday()) {
  if (!API_URL) {
    log('API_URL not configured, skip load from AWS');
    return null;
  }

  try {
    log('Loading from AWS, date:', date);
    
    const response = await fetch(`${API_URL}/sync?date=${date}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.status === 404) {
      log('No data on AWS for date:', date);
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    log('Loaded from AWS:', data);
    return data;

  } catch (error) {
    console.error('Load from AWS error:', error);
    return null;
  }
}

async function loadHistoryFromAWS(days = 30) {
  if (!API_URL) return null;

  const to = getToday();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const from = fromDate.toISOString().split('T')[0];

  try {
    log('Loading history from AWS:', from, 'to', to);
    
    const response = await fetch(`${API_URL}/sync?from=${from}&to=${to}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    log('History loaded:', data.filesLoaded, 'files,', data.sessions.length, 'sessions');
    return data;

  } catch (error) {
    console.error('Load history error:', error);
    return null;
  }
}

async function mergeFromAWS() {
  const remoteData = await loadFromAWS();
  
  if (!remoteData) return;

  let projectsChanged = false;
  if (remoteData.projects) {
    remoteData.projects.forEach(remoteProj => {
      const localIndex = state.projects.findIndex(p => p.id === remoteProj.id);
      
      if (localIndex === -1) {
        state.projects.push(remoteProj);
        projectsChanged = true;
        log('Added project from AWS:', remoteProj.name);
      } else {
        const localProj = state.projects[localIndex];
        if (localProj.name !== remoteProj.name || localProj.color !== remoteProj.color) {
          state.projects[localIndex] = remoteProj; 
          projectsChanged = true;
          log('Updated project from AWS:', remoteProj.name);
        }
      }
    });
    
    if (projectsChanged) saveProjects();
  }

  if (remoteData.sessions) {
    let added = 0;
    remoteData.sessions.forEach(remoteSess => {
      const exists = state.sessions.find(s => s.id === remoteSess.id);
      if (!exists) {
        state.sessions.push(remoteSess);
        added++;
      }
    });
    if (added > 0) {
      saveSessions();
      log('Added sessions from AWS:', added);
    }
  }

  renderProjects();
  renderSessions();
  updateStats();
}

function setupAutoSync() {
  const interval = (typeof CONFIG !== 'undefined' && CONFIG.AUTO_SYNC_INTERVAL) || 0;
  
  if (interval > 0) {
    log('Auto-sync enabled, interval:', interval, 'minutes');
    
    setInterval(() => {
      if (state.sessions.length > 0) {
        log('Auto-sync triggered');
        syncToAWS();
      }
    }, interval * 60 * 1000);
  }
}

// ============================================
// AI MULTI-PROVIDER
// ============================================

function initAIConfig() {
  const providerSelect = document.getElementById('aiProvider');
  const modelSelect = document.getElementById('aiModel');
  
  providerSelect.innerHTML = Object.entries(CONFIG.AI_PROVIDERS)
    .map(([key, provider]) => `<option value="${key}">${provider.name}</option>`)
    .join('');
  
  const savedProvider = localStorage.getItem('pt_ai_provider') || 'anthropic';
  const savedModel = localStorage.getItem('pt_ai_model') || '';
  
  providerSelect.value = savedProvider;
  state.aiProvider = savedProvider;
  
  updateModelSelect();
  
  if (savedModel) {
    modelSelect.value = savedModel;
    state.aiModel = savedModel;
  }
  
  loadApiKeyForProvider(savedProvider);
  
  providerSelect.addEventListener('change', (e) => {
    state.aiProvider = e.target.value;
    localStorage.setItem('pt_ai_provider', e.target.value);
    updateModelSelect();
    loadApiKeyForProvider(e.target.value);
  });
  
  modelSelect.addEventListener('change', (e) => {
    state.aiModel = e.target.value;
    localStorage.setItem('pt_ai_model', e.target.value);
  });
}

function updateModelSelect() {
  const provider = CONFIG.AI_PROVIDERS[state.aiProvider];
  const modelSelect = document.getElementById('aiModel');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const apiKeyRow = document.getElementById('apiKeyRow');
  const docsLink = document.getElementById('providerDocs');
  
  modelSelect.innerHTML = provider.models
    .map(m => `<option value="${m}">${m}</option>`)
    .join('');
  
  state.aiModel = provider.defaultModel;
  modelSelect.value = provider.defaultModel;
  localStorage.setItem('pt_ai_model', provider.defaultModel);
  
  apiKeyInput.placeholder = provider.keyPlaceholder;
  docsLink.href = provider.docsUrl;
  
  if (provider.local) {
    apiKeyRow.style.display = 'none';
  } else {
    apiKeyRow.style.display = 'flex';
  }
}

function loadApiKeyForProvider(providerKey) {
  const savedKey = localStorage.getItem(`pt_ai_key_${providerKey}`) || '';
  const apiKeyInput = document.getElementById('apiKeyInput');
  
  if (savedKey) {
    apiKeyInput.value = '••••••••••••••••';
    state.aiApiKey = savedKey;
  } else {
    apiKeyInput.value = '';
    state.aiApiKey = '';
  }
}

function saveApiKeyHandler() {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const key = apiKeyInput.value;
  
  if (key && !key.startsWith('••')) {
    state.aiApiKey = key;
    localStorage.setItem(`pt_ai_key_${state.aiProvider}`, key);
    apiKeyInput.value = '••••••••••••••••';
    log('API key saved for', state.aiProvider);
  }
}

async function callAI(prompt) {
  const provider = CONFIG.AI_PROVIDERS[state.aiProvider];
  
  if (!provider.local && !state.aiApiKey) {
    throw new Error('API Key not configured');
  }
  
  log('Calling AI:', state.aiProvider, state.aiModel);
  
  switch (state.aiProvider) {
    case 'anthropic':
      return callAnthropic(prompt);
    case 'openai':
    case 'groq':
      return callOpenAICompatible(prompt);
    case 'ollama':
      return callOllama(prompt);
    default:
      throw new Error('Provider not supported');
  }
}

async function callAnthropic(prompt) {
  const response = await fetch(CONFIG.AI_PROVIDERS.anthropic.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': state.aiApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: state.aiModel,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message);
  }
  
  return data.content?.map(c => c.text || '').join('\n') || '';
}

async function callOpenAICompatible(prompt) {
  const provider = CONFIG.AI_PROVIDERS[state.aiProvider];
  
  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.aiApiKey}`
    },
    body: JSON.stringify({
      model: state.aiModel,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || data.error);
  }
  
  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(prompt) {
  const response = await fetch(CONFIG.AI_PROVIDERS.ollama.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: state.aiModel,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    })
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data.message?.content || '';
}

async function generateAISuggestions() {
  const btn = document.getElementById('generateAI');
  const results = document.getElementById('aiResults');

  const provider = CONFIG.AI_PROVIDERS[state.aiProvider];
  
  if (!provider.local && !state.aiApiKey) {
    results.innerHTML = `<div class="ai-content" style="border-color: var(--accent-red)">⚠️ Please enter your API Key for ${provider.name}</div>`;
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Loading history...
  `;

  const history = await loadHistoryFromAWS(30);
  
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Analyzing...
  `;

  const allSessions = history?.sessions || state.sessions;
  const stats = getStats();
  
  const workSessions = allSessions.filter(s => s.type !== 'break');
  const breakSessions = allSessions.filter(s => s.type === 'break');
  const totalWorkTime = workSessions.reduce((acc, s) => acc + s.duration, 0);
  const totalBreakTime = breakSessions.reduce((acc, s) => acc + s.duration, 0);
  
  const projectStats = {};
  workSessions.forEach(s => {
    if (!projectStats[s.projectId]) {
      projectStats[s.projectId] = { sessions: 0, duration: 0 };
    }
    projectStats[s.projectId].sessions++;
    projectStats[s.projectId].duration += s.duration;
  });
  
  const projectNames = {};
  state.projects.forEach(p => projectNames[p.id] = p.name);
  
  const projectSummary = Object.entries(projectStats)
    .map(([id, data]) => ({
      name: projectNames[id] || id,
      hours: Math.round(data.duration / 3600 * 10) / 10,
      sessions: data.sessions
    }))
    .sort((a, b) => b.hours - a.hours);

  const hourlyPattern = {};
  workSessions.forEach(s => {
    const hour = new Date(s.startTime).getHours();
    hourlyPattern[hour] = (hourlyPattern[hour] || 0) + s.duration;
  });
  
  const bestHours = Object.entries(hourlyPattern)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => `${h}:00`);

  const dayPattern = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  workSessions.forEach(s => {
    const day = new Date(s.startTime).getDay();
    dayPattern[day] += s.duration;
  });
  
  const bestDays = Object.entries(dayPattern)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => dayNames[d]);

  const prompt = `
Act as an expert Productivity Coach and Behavioral Analyst specializing in "Deep Work" and time management.
Your goal is to analyze the user's raw data and transform it into strategic insights, not just descriptive text.

USER DATA:
----------------
[GENERAL METRICS - 30 DAYS]
- Total Work Time: ${formatTime(totalWorkTime)}
- Focus Sessions: ${workSessions.length}
- Total Break Time: ${formatTime(totalBreakTime)} (${breakSessions.length} recorded breaks)
- Focus/Rest Ratio: ${totalBreakTime > 0 ? (totalWorkTime / totalBreakTime).toFixed(1) : '∞'}:1 (Ideal target between 3:1 and 6:1)
- Consistency: Data available for ${history?.filesLoaded || '1'} days.

[PROJECT ALLOCATION]
${projectSummary.map(p => `- ${p.name}: ${p.hours}h (${p.sessions} sess.) [${Math.round((p.hours / (totalWorkTime/60 || 1)) * 100)}% of total]`).join('\n')}

[CHRONOTYPE & PATTERNS]
- Peak Hours (Flow State): ${bestHours.length > 0 ? bestHours.join(', ') : 'Insufficient data'}
- Best Days: ${bestDays.length > 0 ? bestDays.join(', ') : 'Insufficient data'}

[TODAY]
- Work done: ${formatTime(stats.todayTotal)} across ${stats.todaySessions.length} sessions.
----------------

ANALYSIS INSTRUCTIONS:
1. Evaluate the **Focus/Rest Ratio**: If > 6:1, warn about burnout risk. If < 2:1, flag potential distractions.
2. Analyze **Fragmentation**: If there are many short sessions, suggest consolidating work blocks.
3. Check **Monotasking**: If one project dominates >80% of time, check if other priorities are being neglected.

REQUIRED OUTPUT (Use Markdown formatting):

### 📊 Rapid Diagnosis
[One punchy sentence on current status based on the numbers. E.g., "Great intensity, but you are neglecting recovery time."]

### 🔍 Key Insights
- **What's Working:** [Mention a specific positive data point, e.g., peak hours utilization or a well-managed project]
- **Critical Area:** [Identify a negative pattern or risk, e.g., breaks are too short or work is too fragmented]

### 💡 Personalized Strategy
[Provide 2 tactical tips. Do not say "take more breaks", say "Try the 52/17 method because your current ratio is X". Use specific project names.]

### 🎯 Your Mission Today
[ONE specific and actionable task based on "TODAY" data and "PATTERNS". E.g., "Since 3:00 PM is your peak hour, dedicate it entirely to Project X".]

Tone of voice: Professional, direct, motivating but data-driven. Do not be verbose.
`;

  try {
    const text = await callAI(prompt);
    results.innerHTML = `<div class="ai-content">${escapeHtml(text)}</div>`;

  } catch (error) {
    console.error('AI Error:', error);
    results.innerHTML = `<div class="ai-content" style="border-color: var(--accent-red)">❌ Error: ${escapeHtml(error.message)}</div>`;
  }

  btn.disabled = false;
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
    Generate AI Suggestions
  `;
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupEventHandlers() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`${view}View`).classList.add('active');
      
      if (view === 'analytics') {
        updateCharts();
      }
    });
  });

  document.getElementById('stopBtn').addEventListener('click', () => stopTimer());

  document.getElementById('addProjectBtn').addEventListener('click', () => {
    document.getElementById('addProjectForm').classList.remove('hidden');
    document.getElementById('newProjectName').focus();
  });

  document.getElementById('confirmAddProject').addEventListener('click', () => {
    const name = document.getElementById('newProjectName').value;
    const color = document.getElementById('newProjectColor').value;
    if (name.trim()) {
      addProject(name, color);
      document.getElementById('newProjectName').value = '';
      document.getElementById('addProjectForm').classList.add('hidden');
    }
  });

  document.getElementById('cancelAddProject').addEventListener('click', () => {
    document.getElementById('newProjectName').value = '';
    document.getElementById('addProjectForm').classList.add('hidden');
  });

  document.getElementById('newProjectName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('confirmAddProject').click();
    }
  });

  document.getElementById('syncBtn').addEventListener('click', syncToAWS);

  document.getElementById('sessionsToggle').addEventListener('click', () => {
    document.getElementById('sessionsList').classList.toggle('hidden');
  });

  document.getElementById('saveApiKey').addEventListener('click', saveApiKeyHandler);

  document.getElementById('apiKeyInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveApiKeyHandler();
  });

  document.getElementById('generateAI').addEventListener('click', generateAISuggestions);

  document.querySelectorAll('.pomo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const duration = parseInt(btn.dataset.duration);
      const type = btn.dataset.type;
      
      document.querySelectorAll('.pomo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      state.pomodoroDuration = duration;
      state.pomodoroMode = duration > 0;
      
      if (type === 'break') {
        startBreak(duration);
      }
    });
  });

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      syncToAWS();
    }
    if (e.key === 'Escape' && state.activeTimer) {
      stopTimer();
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  await loadData();
  await mergeFromAWS();

  checkRecoveryState();
  
  renderProjects();
  renderSessions();
  updateStats();
  initCharts();
  setupEventHandlers();
  initAIConfig();
  setupAutoSync();
  
  console.log('🚀 Productivity Tracker initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.pauseTimer = pauseTimer;
window.resumeTimer = resumeTimer;
window.deleteProject = deleteProject;
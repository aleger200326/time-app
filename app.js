const modeTabs = document.getElementById("modeTabs");
const modeDescription = document.getElementById("modeDescription");
const sessionCount = document.getElementById("sessionCount");
const timeText = document.getElementById("timeText");
const statusText = document.getElementById("statusText");
const progressRing = document.getElementById("progressRing");
const startPauseButton = document.getElementById("startPauseButton");
const resetButton = document.getElementById("resetButton");
const minutesInput = document.getElementById("minutesInput");
const secondsInput = document.getElementById("secondsInput");
const soundToggle = document.getElementById("soundToggle");
const timerTab = document.getElementById("timerTab");
const achievementsTab = document.getElementById("achievementsTab");
const timerPanel = document.getElementById("timerPanel");
const achievementsPanel = document.getElementById("achievementsPanel");
const achievementList = document.getElementById("achievementList");
const rankName = document.getElementById("rankName");
const rankMeterFill = document.getElementById("rankMeterFill");
const rankProgress = document.getElementById("rankProgress");
const unlockedCount = document.getElementById("unlockedCount");

const CIRCLE_LENGTH = 603.19;
const STORAGE_KEY = "focusTimerSystemProgress";

const state = {
  presets: [],
  achievements: [],
  mode: null,
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  running: false,
  timerId: null,
  audio: null,
  progress: {
    totalSessions: 0,
    completedModes: {},
    unlocked: [],
  },
};

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function render() {
  timeText.textContent = formatTime(state.remainingSeconds);
  startPauseButton.textContent = state.running ? "Пауза" : "Старт";
  sessionCount.textContent = `${state.progress.totalSessions} сессий`;
  minutesInput.value = Math.floor(state.totalSeconds / 60);
  secondsInput.value = state.totalSeconds % 60;

  const done = 1 - state.remainingSeconds / state.totalSeconds;
  progressRing.style.strokeDashoffset = String(CIRCLE_LENGTH * done);

  if (state.mode) {
    modeDescription.textContent = state.mode.description;
    progressRing.style.stroke = state.mode.color;
  }
  renderAchievements();
}

function loadSavedProgress() {
  try {
    if (!window.localStorage) return;
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.progress = {
      totalSessions: Number(saved.totalSessions) || 0,
      completedModes: saved.completedModes || {},
      unlocked: Array.isArray(saved.unlocked) ? saved.unlocked : [],
    };
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser previews.
    }
  }
}

function saveProgress() {
  try {
    if (window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    }
  } catch {
    // Keep the in-memory progress for the current session.
  }
}

function getAchievementProgress(achievement) {
  if (achievement.type === "modeCount") {
    const current = state.progress.completedModes[achievement.mode] || 0;
    return { current, target: achievement.target };
  }

  if (achievement.type === "allModes") {
    const current = state.presets.filter((mode) => (state.progress.completedModes[mode.id] || 0) > 0).length;
    return { current, target: achievement.target };
  }

  return { current: state.progress.totalSessions, target: achievement.target };
}

function isAchievementUnlocked(achievement) {
  return state.progress.unlocked.includes(achievement.id);
}

function checkAchievements() {
  const newlyUnlocked = [];

  state.achievements.forEach((achievement) => {
    if (isAchievementUnlocked(achievement)) return;
    const progress = getAchievementProgress(achievement);
    if (progress.current >= progress.target) {
      state.progress.unlocked.push(achievement.id);
      newlyUnlocked.push(achievement);
    }
  });

  if (newlyUnlocked.length) {
    const best = newlyUnlocked[newlyUnlocked.length - 1];
    statusText.textContent = `Ачивка открыта: ${best.title}`;
    saveProgress();
  }
}

function renderAchievements() {
  if (!achievementList || !state.achievements.length) return;

  const unlocked = state.achievements.filter(isAchievementUnlocked);
  unlockedCount.textContent = `${unlocked.length}/${state.achievements.length}`;

  const rankMap = ["E", "D", "C", "B", "A", "A+", "S"];
  const rankIndex = Math.max(0, Math.min(rankMap.length - 1, unlocked.length - 1));
  rankName.textContent = unlocked.length ? `${rankMap[rankIndex]}-RANK` : "LOCKED";
  rankMeterFill.style.width = `${Math.round((unlocked.length / state.achievements.length) * 100)}%`;
  rankProgress.textContent = unlocked.length
    ? `Система признала ${unlocked.length} испытаний. Следующий ранг требует ещё одну зачистку.`
    : "Заверши любую сессию, чтобы открыть первый ранг.";

  achievementList.innerHTML = "";
  state.achievements.forEach((achievement) => {
    const progress = getAchievementProgress(achievement);
    const unlockedNow = isAchievementUnlocked(achievement);
    const item = document.createElement("article");
    item.className = `achievement ${unlockedNow ? "is-unlocked" : "is-locked"}`;
    item.innerHTML = `
      <span class="achievement-rank">${achievement.rank}</span>
      <div>
        <h2>${achievement.title}</h2>
        <p>${achievement.description}</p>
        <div class="achievement-bar" aria-label="Прогресс ${achievement.title}">
          <span style="width: ${Math.min(100, Math.round((progress.current / progress.target) * 100))}%"></span>
        </div>
        <small>${Math.min(progress.current, progress.target)}/${progress.target}</small>
      </div>
    `;
    achievementList.appendChild(item);
  });
}

function switchView(view) {
  const showAchievements = view === "achievements";
  achievementsPanel.hidden = !showAchievements;
  timerPanel.hidden = showAchievements;
  achievementsTab.classList.toggle("is-active", showAchievements);
  timerTab.classList.toggle("is-active", !showAchievements);
  if (showAchievements) renderAchievements();
}

function setMode(modeId) {
  const mode = state.presets.find((item) => item.id === modeId);
  if (!mode) return;

  stopTimer();
  state.mode = mode;
  state.totalSeconds = mode.minutes * 60;
  state.remainingSeconds = state.totalSeconds;
  statusText.textContent = "Готов к старту";

  [...modeTabs.children].forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === modeId);
  });

  render();
}

function stopTimer() {
  state.running = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function playFinishSound() {
  if (!soundToggle.checked) return;
  if (!state.audio) state.audio = new AudioContext();

  [523, 659, 784].forEach((frequency, index) => {
    const oscillator = state.audio.createOscillator();
    const gain = state.audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, state.audio.currentTime + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.08, state.audio.currentTime + index * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.audio.currentTime + index * 0.12 + 0.18);
    oscillator.connect(gain);
    gain.connect(state.audio.destination);
    oscillator.start(state.audio.currentTime + index * 0.12);
    oscillator.stop(state.audio.currentTime + index * 0.12 + 0.2);
  });
}

function finishTimer() {
  stopTimer();
  state.remainingSeconds = 0;
  state.progress.totalSessions += 1;
  if (state.mode) {
    state.progress.completedModes[state.mode.id] = (state.progress.completedModes[state.mode.id] || 0) + 1;
  }
  statusText.textContent = "Готово. Можно сделать перерыв.";
  checkAchievements();
  saveProgress();
  playFinishSound();
  render();
}

function tick() {
  state.remainingSeconds -= 1;
  if (state.remainingSeconds <= 0) {
    finishTimer();
    return;
  }
  render();
}

function toggleTimer() {
  if (state.running) {
    stopTimer();
    statusText.textContent = "Пауза";
    render();
    return;
  }

  state.running = true;
  statusText.textContent = "Идёт фокус";
  state.timerId = setInterval(tick, 1000);
  render();
}

function resetTimer() {
  stopTimer();
  state.remainingSeconds = state.totalSeconds;
  statusText.textContent = "Сброшено";
  render();
}

function applyCustomDuration() {
  const minutes = Math.max(0, Math.min(120, Number(minutesInput.value) || 0));
  const seconds = Math.max(0, Math.min(59, Number(secondsInput.value) || 0));
  const totalSeconds = Math.max(1, minutes * 60 + seconds);
  stopTimer();
  state.totalSeconds = totalSeconds;
  state.remainingSeconds = state.totalSeconds;
  statusText.textContent = "Длительность изменена";
  render();
}

async function loadPresets() {
  try {
    const [presetResponse, achievementResponse] = await Promise.all([
      fetch("data/presets.json"),
      fetch("data/achievements.json"),
    ]);
    if (!presetResponse.ok) throw new Error("Не удалось загрузить data/presets.json");
    if (!achievementResponse.ok) throw new Error("Не удалось загрузить data/achievements.json");
    state.presets = await presetResponse.json();
    state.achievements = await achievementResponse.json();
    loadSavedProgress();

    modeTabs.innerHTML = "";
    state.presets.forEach((mode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = mode.label;
      button.dataset.mode = mode.id;
      button.addEventListener("click", () => setMode(mode.id));
      modeTabs.appendChild(button);
    });

    setMode(state.presets[0].id);
    renderAchievements();
  } catch (error) {
    modeDescription.textContent = "Ошибка загрузки данных. Запусти проект через локальный сервер.";
    statusText.textContent = error.message;
  }
}

startPauseButton.addEventListener("click", toggleTimer);
resetButton.addEventListener("click", resetTimer);
minutesInput.addEventListener("input", applyCustomDuration);
minutesInput.addEventListener("change", applyCustomDuration);
secondsInput.addEventListener("input", applyCustomDuration);
secondsInput.addEventListener("change", applyCustomDuration);
timerTab.addEventListener("click", () => switchView("timer"));
achievementsTab.addEventListener("click", () => switchView("achievements"));

loadPresets();

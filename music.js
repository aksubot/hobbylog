const MUSIC_INSTRUMENTS = {
  piano: { label: "Piano", emoji: "🎹" },
  cello: { label: "Cello", emoji: "🎻" },
};
const today = dateKey(new Date());
let selectedDate = today;
let visibleMonth = new Date();
visibleMonth.setDate(1);

const calendarGrid = document.querySelector("#calendar-grid");
const monthHeading = document.querySelector("#month-heading");
const selectedDateLabel = document.querySelector("#selected-date");
const feedback = document.querySelector("#music-feedback");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsError = document.querySelector("#settings-error");
const connectButton = document.querySelector("#connect-gist");
let sessions = loadSessions();
let settings = loadSettings();
let syncQueue = Promise.resolve();

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function loadSessions() {
  try {
    return HobbylogStore.loadMusicSessions();
  } catch (error) {
    setFeedback(`Could not read saved music sessions: ${error.message}`, true);
    return [];
  }
}

function loadSettings() {
  try {
    return HobbylogStore.loadSettings();
  } catch (error) {
    setFeedback(`Could not read saved Gist settings: ${error.message}`, true);
    return { token: "", gistId: "" };
  }
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
}

function setSyncStatus(message, isError = false) {
  const button = document.querySelector("#open-settings");
  const label = document.querySelector("#connection-label");
  label.textContent = settings.token && settings.gistId ? "Gist connected" : "Connect a Gist";
  button.classList.toggle("is-connected", Boolean(settings.token && settings.gistId));
  button.setAttribute("aria-label", label.textContent);
  button.title = message;
  if (isError) setFeedback(message, true);
}

function saveLocalSessions() {
  try {
    HobbylogStore.saveMusicSessions(sessions);
    return true;
  } catch (error) {
    setFeedback(`Could not save practice sessions in this browser: ${error.message}`, true);
    return false;
  }
}

function persistSessions() {
  if (!saveLocalSessions()) return;
  render();
  if (!settings.token || !settings.gistId) {
    setFeedback("Session saved on this device. Connect a Gist to sync across devices.");
    return;
  }
  setFeedback("Saved here · syncing to your Gist…");
  syncQueue = syncQueue.then(async () => {
    await HobbylogStore.syncToGist(settings.token, settings.gistId);
    setFeedback("Session saved and synced to your Gist.");
  }).catch((error) => {
    setSyncStatus(`Gist sync failed: ${error.message}`, true);
  });
}

function renderCalendar() {
  calendarGrid.replaceChildren();
  monthHeading.textContent = visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(start.getDate() - mondayOffset);

  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = dateKey(day);
    const daySessions = sessions.filter((session) => session.date === key);
    const isFuture = key > today;
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${daySessions.length ? `, ${daySessions.length} practice session${daySessions.length === 1 ? "" : "s"}` : ""}${key === today ? ", today" : ""}`);
    button.disabled = isFuture;
    if (day.getMonth() !== visibleMonth.getMonth()) button.classList.add("is-outside");
    if (key === today) button.classList.add("is-today");
    if (key === selectedDate) button.classList.add("is-selected");
    if (daySessions.length) button.classList.add("is-completed");
    if (isFuture) button.classList.add("is-future");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(day.getDate());
    button.append(number);
    if (daySessions.length) {
      const sessionMark = document.createElement("span");
      sessionMark.className = "day-workout";
      sessionMark.textContent = daySessions.length === 1
        ? `${MUSIC_INSTRUMENTS[daySessions[0].instrument].emoji} ${MUSIC_INSTRUMENTS[daySessions[0].instrument].label}`
        : `${daySessions.length} sessions`;
      button.append(sessionMark);
    }
    button.addEventListener("click", () => selectDate(key));
    calendarGrid.append(button);
  }
}

function renderStats() {
  const monthPrefix = today.slice(0, 7);
  const monthSessions = sessions.filter((session) => session.date.startsWith(`${monthPrefix}-`));
  document.querySelector("#month-count").textContent = String(monthSessions.length);
  document.querySelector("#piano-minutes").textContent = String(
    sessions.filter((session) => session.instrument === "piano").reduce((total, session) => total + session.minutes, 0)
  );
  document.querySelector("#cello-minutes").textContent = String(
    sessions.filter((session) => session.instrument === "cello").reduce((total, session) => total + session.minutes, 0)
  );
}

function renderRecent() {
  const list = document.querySelector("#recent-list");
  list.replaceChildren();
  const entries = [...sessions].sort((first, second) =>
    second.date.localeCompare(first.date) || (second.createdAt || 0) - (first.createdAt || 0)
  );
  document.querySelector("#recent-count").textContent = String(sessions.length);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "recent-empty";
    empty.textContent = "Your next practice session is a good place to start.";
    list.append(empty);
    return;
  }

  for (const session of entries.slice(0, 6)) {
    const item = document.createElement("div");
    item.className = "recent-item session-item";
    const emoji = document.createElement("span");
    emoji.className = "recent-emoji";
    emoji.textContent = MUSIC_INSTRUMENTS[session.instrument].emoji;
    const info = document.createElement("div");
    info.className = "recent-info";
    const title = document.createElement("p");
    title.className = "recent-type";
    title.textContent = `${MUSIC_INSTRUMENTS[session.instrument].label} · ${session.minutes} min`;
    const focus = document.createElement("p");
    focus.className = "recent-focus";
    focus.textContent = session.focus;
    const date = document.createElement("p");
    date.className = "recent-date";
    date.textContent = parseDate(session.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    info.append(title, focus, date);
    const remove = document.createElement("button");
    remove.className = "session-delete";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${MUSIC_INSTRUMENTS[session.instrument].label} session on ${date.textContent}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      sessions = sessions.filter((entry) => entry.id !== session.id);
      persistSessions();
    });
    item.append(emoji, info, remove);
    list.append(item);
  }
}

function selectDate(key) {
  selectedDate = key;
  const date = parseDate(key);
  visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  setFeedback("");
  render();
}

function render() {
  renderCalendar();
  renderStats();
  renderRecent();
  selectedDateLabel.textContent = parseDate(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function showSettings() {
  document.querySelector("#github-token").value = settings.token;
  document.querySelector("#gist-id").value = settings.gistId;
  settingsError.textContent = "";
  settingsDialog.showModal();
}

document.querySelector("#previous-month").addEventListener("click", () => {
  visibleMonth.setMonth(visibleMonth.getMonth() - 1);
  render();
});
document.querySelector("#next-month").addEventListener("click", () => {
  const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  if (dateKey(next) > today.slice(0, 7) + "-01") return;
  visibleMonth = next;
  render();
});
document.querySelector("#back-to-today").addEventListener("click", () => selectDate(today));

document.querySelector("#music-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const duration = Number(document.querySelector("#duration").value);
  const focus = document.querySelector("#focus").value.trim();
  if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
    setFeedback("Enter a practice duration between 1 and 600 minutes.", true);
    return;
  }
  if (!focus) {
    setFeedback("Add a piece, technique, or other focus for this session.", true);
    return;
  }
  sessions.push({
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    date: selectedDate,
    instrument: document.querySelector("#instrument").value,
    minutes: duration,
    focus,
    notes: document.querySelector("#notes").value.trim(),
  });
  persistSessions();
  document.querySelector("#focus").value = "";
  document.querySelector("#notes").value = "";
});

document.querySelector("#open-settings").addEventListener("click", showSettings);
document.querySelector("#footer-settings").addEventListener("click", showSettings);
document.querySelector("#close-settings").addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

document.querySelector("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = document.querySelector("#github-token").value.trim();
  const gistId = document.querySelector("#gist-id").value.trim();
  if (!token) {
    settingsError.textContent = "Enter a GitHub token with permission to access Gists.";
    return;
  }
  connectButton.disabled = true;
  connectButton.querySelector("span").textContent = "Connecting…";
  settingsError.textContent = "";
  try {
    const result = await HobbylogStore.connectToGist(token, gistId);
    const nextSettings = { token, gistId: result.gistId };
    HobbylogStore.saveSettings(nextSettings);
    HobbylogStore.saveWorkouts(result.workouts);
    HobbylogStore.saveMusicSessions(result.music);
    HobbylogStore.saveBusinessLogs(result.business);
    HobbylogStore.saveSleepLogs(result.sleep);
    HobbylogStore.saveNutritionData(result.nutrition);
    settings = nextSettings;
    sessions = result.music;
    setSyncStatus("Connected and synced with your GitHub Gist.");
    setFeedback("Connected and synced with your GitHub Gist.");
    render();
    settingsDialog.close();
  } catch (error) {
    settingsError.textContent = error.message;
  } finally {
    connectButton.disabled = false;
    connectButton.querySelector("span").textContent = "Connect & sync";
  }
});

document.querySelector("#disconnect-gist").addEventListener("click", () => {
  try {
    HobbylogStore.removeSettings();
    settings = { token: "", gistId: "" };
    setSyncStatus("Gist disconnected. Your local data is unchanged.");
    setFeedback("Disconnected. Your practice sessions remain saved on this device.");
    settingsDialog.close();
  } catch (error) {
    settingsError.textContent = `Could not disconnect: ${error.message}`;
  }
});

setSyncStatus(settings.token && settings.gistId ? "Connected to your GitHub Gist." : "Practice sessions are saved on this device.");
render();

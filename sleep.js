const BEDTIME_TARGET = 21 * 60 + 30;
const WAKE_TARGET = 7 * 60;
const today = dateKey(new Date());
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
let selectedDate = dateKey(yesterday);
let visibleMonth = new Date();
visibleMonth.setDate(1);

const calendarGrid = document.querySelector("#calendar-grid");
const monthHeading = document.querySelector("#month-heading");
const selectedDateLabel = document.querySelector("#selected-date");
const bedtimeInput = document.querySelector("#bedtime");
const wakeTimeInput = document.querySelector("#wake-time");
const feedback = document.querySelector("#sleep-feedback");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsError = document.querySelector("#settings-error");
const connectButton = document.querySelector("#connect-gist");
let logs = loadSleepLogs();
let settings = loadSettings();
let syncQueue = Promise.resolve();

function enableTextTimeFallback(input) {
  const probe = document.createElement("input");
  probe.setAttribute("type", "time");
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  if (probe.type === "time" && !isTouchDevice) return;

  input.type = "text";
  input.inputMode = "text";
  input.placeholder = input.id === "bedtime" ? "21:30" : "07:00";
  input.pattern = "([01][0-9]|2[0-3]):[0-5][0-9]";
  input.setAttribute("aria-description", "Enter a 24-hour time in HH:MM format.");
}

enableTextTimeFallback(bedtimeInput);
enableTextTimeFallback(wakeTimeInput);

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

function loadSleepLogs() {
  try {
    return HobbylogStore.loadSleepLogs();
  } catch (error) {
    setFeedback(`Could not read saved sleep logs: ${error.message}`, true);
    return {};
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

function scoreForNight(key, entry) {
  const day = parseDate(key).getDay();
  if (day === 5 || day === 6) return null;
  const bedtimeMinutes = timeToMinutes(entry.bedtime);
  const wakeMinutes = timeToMinutes(entry.wakeTime);
  const bedtimeDifference = Math.abs(((bedtimeMinutes - BEDTIME_TARGET + 720 + 1440) % 1440) - 720);
  const wakeDifference = Math.abs(wakeMinutes - WAKE_TARGET);
  return Math.max(0, Math.round(100 - (bedtimeDifference + wakeDifference) / 2));
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function saveLocalLogs() {
  try {
    HobbylogStore.saveSleepLogs(logs);
    return true;
  } catch (error) {
    setFeedback(`Could not save sleep logs in this browser: ${error.message}`, true);
    return false;
  }
}

function persistLogs() {
  if (!saveLocalLogs()) return false;
  render();
  if (!settings.token || !settings.gistId) {
    setFeedback("Sleep log saved on this device. Connect a Gist to sync across devices.");
    return true;
  }
  setFeedback("Saved here · syncing to your Gist…");
  syncQueue = syncQueue.then(async () => {
    await HobbylogStore.syncToGist(settings.token, settings.gistId);
    setFeedback("Sleep log saved and synced to your Gist.");
  }).catch((error) => {
    setSyncStatus(`Gist sync failed: ${error.message}`, true);
  });
  return true;
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
    const entry = logs[key];
    const score = entry ? scoreForNight(key, entry) : null;
    const isFuture = key > today;
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.setAttribute("role", "gridcell");
    const nightLabel = entry ? (score === null ? ", flexible night logged" : `, sleep score ${score} out of 100`) : "";
    button.setAttribute("aria-label", `${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${nightLabel}${key === today ? ", today" : ""}`);
    button.disabled = isFuture;
    if (day.getMonth() !== visibleMonth.getMonth()) button.classList.add("is-outside");
    if (key === today) button.classList.add("is-today");
    if (key === selectedDate) button.classList.add("is-selected");
    if (entry) button.classList.add(score === null ? "is-flexible-night" : "is-completed");
    if (isFuture) button.classList.add("is-future");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(day.getDate());
    button.append(number);
    if (entry) {
      const mark = document.createElement("span");
      mark.className = score === null ? "day-workout day-flexible-label" : "day-workout";
      mark.textContent = score === null ? "Flexible" : `${score} pts`;
      button.append(mark);
    }
    button.addEventListener("click", () => selectDate(key));
    calendarGrid.append(button);
  }
}

function renderStats() {
  const monthLogs = Object.entries(logs).filter(([key]) => key.startsWith(`${today.slice(0, 7)}-`));
  const strictScores = monthLogs
    .map(([key, entry]) => scoreForNight(key, entry))
    .filter((score) => score !== null);
  const average = strictScores.length
    ? Math.round(strictScores.reduce((total, score) => total + score, 0) / strictScores.length)
    : null;
  document.querySelector("#average-score").textContent = average === null ? "—" : String(average);
  document.querySelector("#logged-count").textContent = String(strictScores.length);
  document.querySelector("#on-target-count").textContent = String(strictScores.filter((score) => score >= 80).length);
}

function renderRecent() {
  const list = document.querySelector("#recent-list");
  list.replaceChildren();
  const entries = Object.entries(logs).sort(([first], [second]) => second.localeCompare(first));
  document.querySelector("#recent-count").textContent = String(entries.length);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "recent-empty";
    empty.textContent = "Your next night is a good place to start. Log what happened, not what you think should have happened.";
    list.append(empty);
    return;
  }

  for (const [key, entry] of entries.slice(0, 5)) {
    const score = scoreForNight(key, entry);
    const item = document.createElement("div");
    item.className = "recent-item session-item";
    const emoji = document.createElement("span");
    emoji.className = "recent-emoji sleep-recent-emoji";
    emoji.textContent = score === null ? "☾" : "✦";
    const info = document.createElement("div");
    info.className = "recent-info";
    const title = document.createElement("p");
    title.className = "recent-type";
    title.textContent = score === null ? "Flexible night" : `Sleep score · ${score}/100`;
    const times = document.createElement("p");
    times.className = "recent-focus";
    times.textContent = `Bed ${entry.bedtime} · Up ${entry.wakeTime}`;
    const date = document.createElement("p");
    date.className = "recent-date";
    date.textContent = `Night of ${parseDate(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
    info.append(title, times, date);
    const remove = document.createElement("button");
    remove.className = "session-delete";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete sleep log for ${date.textContent}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      delete logs[key];
      persistLogs();
    });
    item.append(emoji, info, remove);
    list.append(item);
  }
}

function renderSelectedDate() {
  const date = parseDate(selectedDate);
  selectedDateLabel.textContent = `Night of ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`;
  const flexible = date.getDay() === 5 || date.getDay() === 6;
  document.querySelector("#night-hint").textContent = flexible
    ? "Flexible night · log it if you like; it won’t affect your strict-night score."
    : "Target night · bedtime 21:30 and wake-up 07:00.";
  document.querySelector("#night-hint").classList.toggle("is-flexible", flexible);
  const entry = logs[selectedDate];
  bedtimeInput.value = entry?.bedtime || "21:30";
  wakeTimeInput.value = entry?.wakeTime || "07:00";
  renderScorePreview();
}

function renderScorePreview() {
  const result = document.querySelector("#sleep-result");
  if (!bedtimeInput.value || !wakeTimeInput.value) {
    result.textContent = "";
    return;
  }
  const date = parseDate(selectedDate);
  if (date.getDay() === 5 || date.getDay() === 6) {
    result.textContent = "Flexible night · no strict score";
    return;
  }
  const score = scoreForNight(selectedDate, { bedtime: bedtimeInput.value, wakeTime: wakeTimeInput.value });
  result.textContent = `Estimated score · ${score}/100`;
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
  renderSelectedDate();
}

function showSettings() {
  document.querySelector("#github-token").value = settings.token;
  document.querySelector("#gist-id").value = settings.gistId;
  settingsError.textContent = "";
  settingsDialog.showModal();
}

bedtimeInput.addEventListener("input", renderScorePreview);
wakeTimeInput.addEventListener("input", renderScorePreview);

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

document.querySelector("#sleep-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (selectedDate > today) {
    setFeedback("You can log sleep after the night has passed.", true);
    return;
  }
  logs[selectedDate] = { bedtime: bedtimeInput.value, wakeTime: wakeTimeInput.value };
  persistLogs();
});

document.querySelector("#clear-sleep").addEventListener("click", () => {
  if (!logs[selectedDate]) {
    setFeedback("No sleep log for this night.");
    return;
  }
  delete logs[selectedDate];
  if (persistLogs() && (!settings.token || !settings.gistId)) setFeedback("Sleep log removed.");
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
    settings = nextSettings;
    logs = result.sleep;
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
    setFeedback("Disconnected. Your sleep logs remain saved on this device.");
    settingsDialog.close();
  } catch (error) {
    settingsError.textContent = `Could not disconnect: ${error.message}`;
  }
});

setSyncStatus(settings.token && settings.gistId ? "Connected to your GitHub Gist." : "Sleep logs are saved on this device.");
render();

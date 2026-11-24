const PLAN_START = new Date(2026, 10, 30);
const startupWarnings = [];
const WORKOUTS = {
  strength: { label: "Strength", emoji: "🏋️" },
  cardio: { label: "Cardio / running", emoji: "🏃" },
  plyo: { label: "Plyometrics & agility", emoji: "⚡" },
  walking: { label: "Walking", emoji: "🚶" },
  yoga: { label: "Yoga / stretching", emoji: "🧘" },
  cycling: { label: "Cycling", emoji: "🚴" },
  swimming: { label: "Swimming", emoji: "🏊" },
  other: { label: "Something else", emoji: "✨" },
};
const TRAINING_WEEK = [
  { day: "MON", title: "Big lift A", kind: "Strength", short: "Lift A", type: "strength", emoji: "🏋️" },
  { day: "TUE", title: "Easy run", kind: "Conversational pace", short: "Easy run", type: "cardio", emoji: "🏃" },
  { day: "WED", title: "Big lift B", kind: "Strength", short: "Lift B", type: "strength", emoji: "🏋️" },
  { day: "THU", title: "Plyo & agility A", kind: "Short, quality reps", short: "Plyo", type: "plyo", emoji: "⚡" },
  { day: "FRI", title: "Big lift C", kind: "Strength", short: "Lift C", type: "strength", emoji: "🏋️" },
  { day: "SAT", title: "Plyo & agility B", kind: "Low-volume practice", short: "Plyo", type: "plyo", emoji: "⚡" },
  { day: "SUN", title: "Complete rest", kind: "No training", short: "Rest", type: "rest", emoji: "🌿" },
];
const CYCLE_PHASES = [
  {
    name: "Baseline",
    short: "01 · Baseline",
    description: "Find repeatable working weights and a comfortable amount of jumping. Keep 2–3 good reps in reserve; don’t test maxes.",
  },
  {
    name: "Push",
    short: "02 · Push",
    description: "If you’re recovering well, add a small amount of load to your main lifts or one rep per set—not both. Make agility work a little sharper while keeping jumps controlled and crisp.",
  },
  {
    name: "Deload",
    short: "03 · Deload",
    description: "Give fatigue a chance to drop: do about a third fewer lifting sets, use lighter loads, and cut jump contacts roughly in half. Keep the run easy.",
  },
];

const today = dateKey(new Date());
let selectedDate = today;
let visibleMonth = new Date();
visibleMonth.setDate(1);

const calendarGrid = document.querySelector("#calendar-grid");
const monthHeading = document.querySelector("#month-heading");
const selectedDateLabel = document.querySelector("#selected-date");
const workoutType = document.querySelector("#workout-type");
const logFeedback = document.querySelector("#log-feedback");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsError = document.querySelector("#settings-error");
const connectButton = document.querySelector("#connect-gist");
let workouts = loadWorkouts();
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

function loadWorkouts() {
  try {
    return HobbylogStore.loadWorkouts();
  } catch (error) {
    startupWarnings.push(`Could not read saved workouts: ${error.message}`);
    return {};
  }
}

function loadSettings() {
  try {
    return HobbylogStore.loadSettings();
  } catch (error) {
    startupWarnings.push(`Could not read saved Gist settings: ${error.message}`);
    return { token: "", gistId: "" };
  }
}

function saveLocalWorkouts() {
  try {
    HobbylogStore.saveWorkouts(workouts);
    return true;
  } catch (error) {
    setFeedback(`Could not save workouts in this browser: ${error.message}`, true);
    return false;
  }
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

function setFeedback(message, isError = false) {
  logFeedback.textContent = message;
  logFeedback.classList.toggle("is-error", isError);
}

function persistWorkouts() {
  const saved = saveLocalWorkouts();
  render();
  if (!saved) return;
  if (!settings.token || !settings.gistId) {
    setFeedback("Saved on this device. Connect a Gist to sync across devices.");
    return;
  }
  setFeedback("Saved here · syncing to your Gist…");
  syncQueue = syncQueue.then(async () => {
    await HobbylogStore.syncToGist(settings.token, settings.gistId);
    setFeedback("Saved and synced to your Gist.");
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
    const entry = workouts[key];
    const isOutside = day.getMonth() !== visibleMonth.getMonth();
    const isFuture = key > today;
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${entry ? `, ${WORKOUTS[entry.type].label}` : ""}${key === today ? ", today" : ""}`);
    button.disabled = isFuture;
    if (isOutside) button.classList.add("is-outside");
    if (key === today) button.classList.add("is-today");
    if (key === selectedDate) button.classList.add("is-selected");
    if (entry) button.classList.add("is-completed");
    if (isFuture) button.classList.add("is-future");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = String(day.getDate());
    button.append(number);
    if (entry) {
      const workout = document.createElement("span");
      workout.className = "day-workout";
      workout.textContent = `${WORKOUTS[entry.type].emoji} ${WORKOUTS[entry.type].label.split(" /")[0]}`;
      button.append(workout);
    } else if (key >= dateKey(PLAN_START) && isFuture) {
      const weekdayIndex = (day.getDay() + 6) % 7;
      const planEntry = TRAINING_WEEK[weekdayIndex];
      const planned = document.createElement("span");
      planned.className = "day-plan";
      planned.textContent = `${planEntry.emoji} ${planEntry.short}`;
      button.append(planned);
    }
    button.addEventListener("click", () => selectDate(key));
    calendarGrid.append(button);
  }
}

function selectDate(key) {
  selectedDate = key;
  const date = parseDate(key);
  visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  if (workouts[key]) workoutType.value = workouts[key].type;
  setFeedback("");
  render();
}

function isPlanRestDay(date) {
  if (dateKey(date) < dateKey(PLAN_START)) return false;
  return TRAINING_WEEK[(date.getDay() + 6) % 7].type === "rest";
}

function renderStats() {
  const currentMonthEntries = Object.keys(workouts).filter((key) => key.startsWith(`${today.slice(0, 7)}-`)).length;
  document.querySelector("#month-count").textContent = String(currentMonthEntries);
  document.querySelector("#total-count").textContent = String(Object.keys(workouts).length);

  let streak = 0;
  const cursor = parseDate(today);
  if (!workouts[dateKey(cursor)] && !isPlanRestDay(cursor)) cursor.setDate(cursor.getDate() - 1);
  while (workouts[dateKey(cursor)] || isPlanRestDay(cursor)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  document.querySelector("#streak-count").textContent = String(streak);
}

function getCycleForDate(date) {
  const dateValue = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const planStartValue = Date.UTC(PLAN_START.getFullYear(), PLAN_START.getMonth(), PLAN_START.getDate());
  const daysSinceStart = Math.floor((dateValue - planStartValue) / 86_400_000);
  const upcoming = daysSinceStart < 0;
  const cycleNumber = upcoming ? 1 : Math.floor(daysSinceStart / 21) + 1;
  const dayInCycle = upcoming ? 0 : daysSinceStart % 21;
  const phaseIndex = Math.floor(dayInCycle / 7);
  const cycleStart = new Date(PLAN_START);
  cycleStart.setDate(cycleStart.getDate() + (cycleNumber - 1) * 21);
  const phaseStart = new Date(cycleStart);
  phaseStart.setDate(phaseStart.getDate() + phaseIndex * 7);
  const phaseEnd = new Date(phaseStart);
  phaseEnd.setDate(phaseEnd.getDate() + 6);
  return { upcoming, cycleNumber, phaseIndex, phaseStart, phaseEnd };
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderTrainingPlan() {
  const cycle = getCycleForDate(new Date());
  const phase = CYCLE_PHASES[cycle.phaseIndex];
  const weekStart = new Date(cycle.phaseStart);
  const weekEnd = new Date(cycle.phaseEnd);
  document.querySelector("#cycle-caption").textContent = cycle.upcoming
    ? `Starts Monday · ${formatShortDate(PLAN_START)}`
    : `Cycle ${String(cycle.cycleNumber).padStart(2, "0")} · ${formatShortDate(cycle.phaseStart)}–${formatShortDate(cycle.phaseEnd)}`;
  document.querySelector("#phase-number").textContent = String(cycle.phaseIndex + 1).padStart(2, "0");
  document.querySelector("#phase-title").textContent = cycle.upcoming
    ? `Baseline · ${formatShortDate(weekStart)}–${formatShortDate(weekEnd)}`
    : `${phase.name} · ${formatShortDate(weekStart)}–${formatShortDate(weekEnd)}`;
  document.querySelector("#phase-description").textContent = phase.description;

  const steps = document.querySelector("#cycle-steps");
  steps.replaceChildren();
  CYCLE_PHASES.forEach((item, index) => {
    const step = document.createElement("div");
    step.className = "cycle-step";
    if (index === cycle.phaseIndex) step.classList.add("is-current");
    if (!cycle.upcoming && index < cycle.phaseIndex) step.classList.add("is-complete");
    const title = document.createElement("span");
    title.className = "cycle-step-number";
    title.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = item.name;
    step.append(title, label);
    steps.append(step);
  });

  const rhythm = document.querySelector("#weekly-rhythm");
  rhythm.replaceChildren();
  for (const session of TRAINING_WEEK) {
    const item = document.createElement("div");
    item.className = `rhythm-day${session.type === "rest" ? " is-rest" : ""}`;
    const weekday = document.createElement("span");
    weekday.className = "rhythm-weekday";
    weekday.textContent = session.day;
    const icon = document.createElement("span");
    icon.className = "rhythm-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = session.emoji;
    const title = document.createElement("span");
    title.className = "rhythm-title";
    title.textContent = session.title;
    const detail = document.createElement("span");
    detail.className = "rhythm-detail";
    detail.textContent = session.kind;
    item.append(weekday, icon, title, detail);
    rhythm.append(item);
  }
}

function renderRecent() {
  const list = document.querySelector("#recent-list");
  list.replaceChildren();
  const entries = Object.entries(workouts).sort(([first], [second]) => second.localeCompare(first)).slice(0, 3);
  document.querySelector("#recent-count").textContent = String(Object.keys(workouts).length);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "recent-empty";
    empty.textContent = "Your first workout is waiting. Log one whenever you’re ready.";
    list.append(empty);
    return;
  }

  for (const [key, entry] of entries) {
    const item = document.createElement("div");
    item.className = "recent-item";
    const emoji = document.createElement("span");
    emoji.className = "recent-emoji";
    emoji.textContent = WORKOUTS[entry.type].emoji;
    const info = document.createElement("div");
    info.className = "recent-info";
    const type = document.createElement("p");
    type.className = "recent-type";
    type.textContent = WORKOUTS[entry.type].label;
    const date = document.createElement("p");
    date.className = "recent-date";
    date.textContent = parseDate(key).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    info.append(type, date);
    item.append(emoji, info);
    list.append(item);
  }
}

function renderSelectedDate() {
  const date = parseDate(selectedDate);
  selectedDateLabel.textContent = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  if (workouts[selectedDate]) workoutType.value = workouts[selectedDate].type;
}

function render() {
  renderCalendar();
  renderStats();
  renderTrainingPlan();
  renderRecent();
  renderSelectedDate();
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

document.querySelector("#workout-form").addEventListener("submit", (event) => {
  event.preventDefault();
  workouts[selectedDate] = { type: workoutType.value };
  persistWorkouts();
  if (!settings.token || !settings.gistId) setFeedback("Workout saved on this device.");
});

document.querySelector("#clear-workout").addEventListener("click", () => {
  if (!workouts[selectedDate]) {
    setFeedback("No workout logged for this day.");
    return;
  }
  delete workouts[selectedDate];
  persistWorkouts();
  if (!settings.token || !settings.gistId) setFeedback("Workout removed. Rest days count, too.");
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
    settings = nextSettings;
    workouts = result.workouts;
    HobbylogStore.saveMusicSessions(result.music);
    HobbylogStore.saveBusinessLogs(result.business);
    if (!saveLocalWorkouts()) throw new Error("Gist connected, but local storage could not be updated.");
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
    setSyncStatus("Gist disconnected. Your local workouts are unchanged.");
    setFeedback("Disconnected. Your workouts remain saved on this device.");
    settingsDialog.close();
  } catch (error) {
    settingsError.textContent = `Could not disconnect: ${error.message}`;
  }
});

setSyncStatus(settings.token && settings.gistId ? "Connected to your GitHub Gist." : "Workouts are saved on this device.");
if (startupWarnings.length) setFeedback(startupWarnings.join(" "));
render();

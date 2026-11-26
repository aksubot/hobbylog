const FOOD_GROUP_LABELS = {
  fruit: "Fruit",
  vegetables: "Vegetables",
  "whole-grains": "Whole grains",
  legumes: "Beans / lentils",
  "nuts-seeds": "Nuts / seeds",
  "dairy-fortified": "Dairy / fortified",
  "protein-foods": "Protein foods",
};
const today = dateKey(new Date());
let selectedDate = today;

const dateInput = document.querySelector("#log-date");
const mealForm = document.querySelector("#meal-form");
const feedback = document.querySelector("#nutrition-feedback");
const foodSearch = document.querySelector("#food-search");
const foodServings = document.querySelector("#food-servings");
const foodFeedback = document.querySelector("#food-feedback");
const manualEstimateInputs = ["#meal-calories", "#meal-protein", "#meal-carbs", "#meal-fat"]
  .map((selector) => document.querySelector(selector));
const settingsDialog = document.querySelector("#settings-dialog");
const settingsError = document.querySelector("#settings-error");
const connectButton = document.querySelector("#connect-gist");
let nutrition = loadNutritionData();
let settings = loadSettings();
let selectedFoods = [];
let syncQueue = Promise.resolve();

dateInput.max = today;
dateInput.value = selectedDate;
for (const food of window.HobbylogFoodDatabase) {
  const option = document.createElement("option");
  option.value = food.name;
  document.querySelector("#food-options").append(option);
}

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

function loadNutritionData() {
  try {
    return HobbylogStore.loadNutritionData();
  } catch (error) {
    setFeedback(`Could not read saved nutrition logs: ${error.message}`, true);
    return { meals: [], water: {} };
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

function persistNutrition(message, nextNutrition) {
  try {
    HobbylogStore.saveNutritionData(nextNutrition);
  } catch (error) {
    setFeedback(`Could not save nutrition logs in this browser: ${error.message}`, true);
    return false;
  }
  nutrition = nextNutrition;
  render();
  if (!settings.token || !settings.gistId) {
    setFeedback(`${message} Saved on this device. Connect a Gist to sync across devices.`);
    return true;
  }
  setFeedback(`${message} Saved here · syncing to your Gist…`);
  syncQueue = syncQueue.then(async () => {
    await HobbylogStore.syncToGist(settings.token, settings.gistId);
    setFeedback(`${message} Saved and synced to your Gist.`);
  }).catch((error) => {
    setSyncStatus(`Gist sync failed: ${error.message}`, true);
  });
  return true;
}

function renderStats(dayMeals) {
  for (const [field, selector, coverageSelector] of [
    ["calories", "#daily-calories", "#calories-coverage"],
    ["protein", "#daily-protein", "#protein-coverage"],
    ["carbs", "#daily-carbs", "#carbs-coverage"],
    ["fat", "#daily-fat", "#fat-coverage"],
  ]) {
    const values = dayMeals.map((meal) => meal[field]).filter((value) => value !== null);
    const total = values.reduce((sum, value) => sum + value, 0);
    document.querySelector(selector).textContent = values.length
      ? `~${Number(total.toFixed(1)).toLocaleString()}`
      : "—";
    document.querySelector(coverageSelector).textContent = values.length
      ? `${values.length < dayMeals.length ? "Partial · " : ""}${values.length}/${dayMeals.length} meals estimated`
      : "No estimates logged";
  }
  const water = nutrition.water[selectedDate] || 0;
  document.querySelector("#daily-water").textContent = water.toLocaleString();
  document.querySelector("#water-total").textContent = water.toLocaleString();
}

function renderMeals(dayMeals) {
  const list = document.querySelector("#meal-list");
  list.replaceChildren();
  document.querySelector("#meal-count").textContent = String(dayMeals.length);
  if (!dayMeals.length) {
    const empty = document.createElement("p");
    empty.className = "recent-empty";
    empty.textContent = "No meals logged for this day. Add one whenever it feels useful.";
    list.append(empty);
    return;
  }

  for (const meal of [...dayMeals].sort((first, second) =>
    (second.createdAt || 0) - (first.createdAt || 0)
  )) {
    const item = document.createElement("div");
    item.className = "recent-item session-item nutrition-meal-item";
    const icon = document.createElement("span");
    icon.className = "recent-emoji nutrition-meal-emoji";
    icon.textContent = meal.type === "snack" ? "◒" : "✿";
    const info = document.createElement("div");
    info.className = "recent-info";
    const title = document.createElement("p");
    title.className = "recent-type";
    title.textContent = `${meal.type[0].toUpperCase()}${meal.type.slice(1)} · ${meal.portion} portion`;
    const description = document.createElement("p");
    description.className = "recent-focus nutrition-meal-description";
    description.textContent = meal.description;
    const nutritionDetails = [
      meal.calories === null ? null : `~${meal.calories} kcal`,
      meal.protein === null ? null : `P ${meal.protein}g`,
      meal.carbs === null ? null : `C ${meal.carbs}g`,
      meal.fat === null ? null : `F ${meal.fat}g`,
    ].filter(Boolean);
    const estimate = document.createElement("p");
    estimate.className = "recent-date";
    estimate.textContent = nutritionDetails.length ? nutritionDetails.join(" · ") : "No nutrition estimate";
    info.append(title, description, estimate);
    if (meal.foods.length) {
      const ingredients = document.createElement("p");
      ingredients.className = "nutrition-meal-foods";
      ingredients.textContent = `Food list · ${meal.foods.map((food) => `${food.name} · ${food.grams} g`).join(", ")}`;
      info.append(ingredients);
    }
    const remove = document.createElement("button");
    remove.className = "session-delete";
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${meal.type}: ${meal.description}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      const nextNutrition = {
        ...nutrition,
        meals: nutrition.meals.filter((entry) => entry.id !== meal.id),
      };
      persistNutrition("Meal removed.", nextNutrition);
    });
    item.append(icon, info, remove);
    list.append(item);
  }
}

function foodTotals(foods) {
  return {
    calories: foods.reduce((total, food) => total + food.calories, 0),
    protein: foods.reduce((total, food) => total + food.protein, 0),
    carbs: foods.reduce((total, food) => total + food.carbs, 0),
    fat: foods.reduce((total, food) => total + food.fat, 0),
  };
}

function renderSelectedFoods() {
  const list = document.querySelector("#selected-food-list");
  list.replaceChildren();
  for (const food of selectedFoods) {
    const row = document.createElement("div");
    row.className = "selected-food-item";
    const details = document.createElement("span");
    details.textContent = `${food.name} · ${food.servings} × ${food.servingLabel} (${food.grams} g)`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "session-delete";
    remove.setAttribute("aria-label", `Remove ${food.name} from this meal estimate`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      selectedFoods = selectedFoods.filter((entry) => entry.id !== food.id);
      renderSelectedFoods();
    });
    row.append(details, remove);
    list.append(row);
  }

  const hasFoods = selectedFoods.length > 0;
  for (const input of manualEstimateInputs) input.disabled = hasFoods;
  document.querySelector("#manual-estimates-legend").textContent = hasFoods
    ? "Food list estimate is used; remove all foods to enter manual numbers"
    : "Manual estimates · used when no foods are added";
  const preview = document.querySelector("#food-estimate-preview");
  if (!hasFoods) {
    preview.textContent = "No database foods added yet.";
    return;
  }
  const totals = foodTotals(selectedFoods);
  preview.textContent = `Estimated from food list · ~${Number(totals.calories.toFixed(1)).toLocaleString()} kcal · P ${totals.protein.toFixed(1)} g · C ${totals.carbs.toFixed(1)} g · F ${totals.fat.toFixed(1)} g`;
}

function renderVariety() {
  const end = parseDate(selectedDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const startKey = dateKey(start);
  const daysByGroup = Object.fromEntries(Object.keys(FOOD_GROUP_LABELS).map((group) => [group, new Set()]));
  for (const meal of nutrition.meals) {
    if (meal.date < startKey || meal.date > selectedDate) continue;
    for (const group of meal.foodGroups) daysByGroup[group].add(meal.date);
  }
  const list = document.querySelector("#variety-list");
  list.replaceChildren();
  const activeGroups = Object.values(daysByGroup).filter((days) => days.size > 0).length;
  document.querySelector("#variety-count").textContent = `${activeGroups}/7`;

  for (const [group, label] of Object.entries(FOOD_GROUP_LABELS)) {
    const row = document.createElement("div");
    row.className = "variety-row";
    const name = document.createElement("span");
    name.textContent = label;
    const track = document.createElement("span");
    track.className = "variety-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.className = "variety-fill";
    fill.style.width = `${(daysByGroup[group].size / 7) * 100}%`;
    track.append(fill);
    const count = document.createElement("span");
    count.className = "variety-days";
    count.textContent = `${daysByGroup[group].size}/7`;
    row.append(name, track, count);
    list.append(row);
  }
}

function render() {
  const dayMeals = nutrition.meals.filter((meal) => meal.date === selectedDate);
  document.querySelector("#selected-date-label").textContent =
    parseDate(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  renderStats(dayMeals);
  renderMeals(dayMeals);
  renderVariety();
}

function showSettings() {
  document.querySelector("#github-token").value = settings.token;
  document.querySelector("#gist-id").value = settings.gistId;
  settingsError.textContent = "";
  settingsDialog.showModal();
}

function numberOrNull(id, maximum) {
  const input = document.querySelector(id);
  if (!input.value.trim()) return null;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${input.labels[0].textContent} must be between 0 and ${maximum}.`);
  }
  return value;
}

document.querySelector("#add-food").addEventListener("click", () => {
  const search = foodSearch.value.trim().toLocaleLowerCase();
  const food = window.HobbylogFoodDatabase.find((entry) => entry.name.toLocaleLowerCase() === search);
  const servings = Number(foodServings.value);
  if (!food) {
    foodFeedback.textContent = "Choose a food from the suggestions, or leave this blank and enter a manual estimate.";
    return;
  }
  if (!Number.isFinite(servings) || servings < 0.1 || servings > 20) {
    foodFeedback.textContent = "Enter between 0.1 and 20 servings.";
    return;
  }
  if (!selectedFoods.length) {
    for (const input of manualEstimateInputs) input.value = "";
  }
  const grams = Number((food.servingGrams * servings).toFixed(1));
  const factor = grams / 100;
  selectedFoods.push({
    id: crypto.randomUUID(),
    foodId: food.id,
    name: food.name,
    servings: Number(servings.toFixed(1)),
    servingLabel: food.servingLabel,
    grams,
    calories: Number((food.caloriesPer100g * factor).toFixed(1)),
    protein: Number((food.proteinPer100g * factor).toFixed(1)),
    carbs: Number((food.carbsPer100g * factor).toFixed(1)),
    fat: Number((food.fatPer100g * factor).toFixed(1)),
    foodGroup: food.group,
  });
  foodSearch.value = "";
  foodServings.value = "1";
  foodFeedback.textContent = "Food added. Add another ingredient or save the meal.";
  renderSelectedFoods();
});

dateInput.addEventListener("change", () => {
  if (dateInput.value > today) {
    dateInput.value = selectedDate;
    setFeedback("Choose today or an earlier date.", true);
    return;
  }
  selectedDate = dateInput.value || today;
  dateInput.value = selectedDate;
  setFeedback("");
  render();
});

mealForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const description = document.querySelector("#meal-description").value.trim();
  if (!description) {
    setFeedback("Add a short description of the meal.", true);
    return;
  }
  try {
    const meal = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      date: selectedDate,
      type: document.querySelector("#meal-type").value,
      description,
      portion: document.querySelector("#portion-size").value,
      calories: selectedFoods.length ? Number(foodTotals(selectedFoods).calories.toFixed(1)) : numberOrNull("#meal-calories", 20000),
      protein: selectedFoods.length ? Number(foodTotals(selectedFoods).protein.toFixed(1)) : numberOrNull("#meal-protein", 1000),
      carbs: selectedFoods.length ? Number(foodTotals(selectedFoods).carbs.toFixed(1)) : numberOrNull("#meal-carbs", 2000),
      fat: selectedFoods.length ? Number(foodTotals(selectedFoods).fat.toFixed(1)) : numberOrNull("#meal-fat", 1000),
      foods: selectedFoods,
      foodGroups: [...new Set([
        ...mealForm.querySelectorAll('input[name="foodGroup"]:checked'),
      ].map((input) => input.value).concat(selectedFoods.map((food) => food.foodGroup).filter(Boolean)))],
    };
    const nextNutrition = { ...nutrition, meals: [...nutrition.meals, meal] };
    if (persistNutrition("Meal logged.", nextNutrition)) {
      mealForm.reset();
      selectedFoods = [];
      renderSelectedFoods();
      foodFeedback.textContent = "Reference values use the serving shown for each food; adjust servings to match your portion.";
    }
  } catch (error) {
    setFeedback(error.message, true);
  }
});

document.querySelector("#water-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.querySelector("#water-amount");
  const amount = Number(input.value);
  if (!Number.isInteger(amount) || amount < 1 || amount > 5000) {
    setFeedback("Enter a whole number of millilitres from 1 to 5,000.", true);
    return;
  }
  const current = nutrition.water[selectedDate] || 0;
  if (current + amount > 50000) {
    setFeedback("That total is unusually high. Check the amount before adding it.", true);
    return;
  }
  const nextNutrition = {
    ...nutrition,
    water: { ...nutrition.water, [selectedDate]: current + amount },
  };
  if (persistNutrition(`${amount} ml water added.`, nextNutrition)) input.value = "250";
});

document.querySelectorAll("[data-water-amount]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#water-amount").value = button.dataset.waterAmount;
    document.querySelector("#water-form").requestSubmit();
  });
});

document.querySelector("#clear-water").addEventListener("click", () => {
  if (!nutrition.water[selectedDate]) {
    setFeedback("No water logged for this day.");
    return;
  }
  const water = { ...nutrition.water };
  delete water[selectedDate];
  persistNutrition("Water log cleared.", { ...nutrition, water });
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
    nutrition = result.nutrition;
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
    setFeedback("Disconnected. Your nutrition logs remain saved on this device.");
    settingsDialog.close();
  } catch (error) {
    settingsError.textContent = `Could not disconnect: ${error.message}`;
  }
});

setSyncStatus(settings.token && settings.gistId ? "Connected to your GitHub Gist." : "Nutrition logs are saved on this device.");
renderSelectedFoods();
render();

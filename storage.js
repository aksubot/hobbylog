(() => {
  const WORKOUTS_KEY = "hobbylog.workouts.v1";
  const MUSIC_KEY = "hobbylog.music.v1";
  const BUSINESS_KEY = "hobbylog.business.v1";
  const SLEEP_KEY = "hobbylog.sleep.v1";
  const NUTRITION_KEY = "hobbylog.nutrition.v1";
  const SETTINGS_KEY = "hobbylog.github.v1";
  const GIST_FILENAME = "hobbylog-workouts.json";
  const GITHUB_API = "https://api.github.com";
  const WORKOUT_TYPES = new Set(["strength", "cardio", "plyo", "walking", "yoga", "cycling", "swimming", "other"]);
  const BUSINESS_TYPES = new Set(["websites", "candles"]);
  const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);
  const PORTION_SIZES = new Set(["small", "medium", "large"]);
  const FOOD_GROUPS = new Set(["fruit", "vegetables", "whole-grains", "legumes", "nuts-seeds", "dairy-fortified", "protein-foods"]);

  function readJson(key, description) {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (error) {
      throw new Error(`${description} is not valid JSON: ${error.message}`);
    }
  }

  function normalizeWorkouts(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Saved workout data has an unexpected format.");
    }
    return Object.fromEntries(
      Object.entries(value).filter(([date, entry]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        entry && typeof entry === "object" && !Array.isArray(entry) &&
        ((typeof entry.type === "string" && WORKOUT_TYPES.has(entry.type)) || entry.volleyball === true)
      ).map(([date, entry]) => [
        date,
        {
          ...(typeof entry.type === "string" && WORKOUT_TYPES.has(entry.type) ? { type: entry.type } : {}),
          ...(entry.volleyball === true ? { volleyball: true } : {}),
        },
      ])
    );
  }

  function isMusicSession(session) {
    return session && typeof session === "object" &&
      typeof session.id === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(session.date) &&
      (session.instrument === "piano" || session.instrument === "cello") &&
      Number.isInteger(session.minutes) && session.minutes > 0 &&
      typeof session.focus === "string" &&
      typeof session.notes === "string" &&
      (session.createdAt === undefined || Number.isFinite(session.createdAt));
  }

  function normalizeMusicSessions(value) {
    if (!Array.isArray(value)) throw new Error("Saved music sessions have an unexpected format.");
    return value.filter(isMusicSession);
  }

  function isBusinessLog(entry) {
    return entry && typeof entry === "object" &&
      typeof entry.id === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
      BUSINESS_TYPES.has(entry.business) &&
      typeof entry.task === "string" &&
      (entry.minutes === null || (Number.isInteger(entry.minutes) && entry.minutes > 0)) &&
      typeof entry.notes === "string" &&
      (entry.createdAt === undefined || Number.isFinite(entry.createdAt));
  }

  function normalizeBusinessLogs(value) {
    if (!Array.isArray(value)) throw new Error("Saved business logs have an unexpected format.");
    return value.filter(isBusinessLog);
  }

  function normalizeSleepLogs(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Saved sleep data has an unexpected format.");
    }
    return Object.fromEntries(
      Object.entries(value).filter(([date, entry]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(date) &&
        entry && typeof entry === "object" && !Array.isArray(entry) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.bedtime) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.wakeTime)
      ).map(([date, entry]) => [date, { bedtime: entry.bedtime, wakeTime: entry.wakeTime }])
    );
  }

  function isNutritionMeal(meal) {
    return meal && typeof meal === "object" &&
      typeof meal.id === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(meal.date) &&
      MEAL_TYPES.has(meal.type) &&
      typeof meal.description === "string" && meal.description.trim().length > 0 &&
      PORTION_SIZES.has(meal.portion) &&
      ["calories", "protein", "carbs", "fat"].every((key) =>
        meal[key] === null || (Number.isFinite(meal[key]) && meal[key] >= 0)
      ) &&
      (meal.foods === undefined || (Array.isArray(meal.foods) && meal.foods.every(isNutritionFood))) &&
      Array.isArray(meal.foodGroups) && meal.foodGroups.every((group) => FOOD_GROUPS.has(group)) &&
      (meal.createdAt === undefined || Number.isFinite(meal.createdAt));
  }

  function isNutritionFood(food) {
    return food && typeof food === "object" &&
      typeof food.id === "string" &&
      typeof food.foodId === "string" &&
      typeof food.name === "string" && food.name.trim().length > 0 &&
      Number.isFinite(food.servings) && food.servings > 0 &&
      typeof food.servingLabel === "string" &&
      Number.isFinite(food.grams) && food.grams > 0 &&
      ["calories", "protein", "carbs", "fat"].every((key) =>
        Number.isFinite(food[key]) && food[key] >= 0
      ) &&
      (food.foodGroup === null || FOOD_GROUPS.has(food.foodGroup));
  }

  function normalizeNutritionData(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Saved nutrition data has an unexpected format.");
    }
    if (!Array.isArray(value.meals)) {
      throw new Error("Saved nutrition meals have an unexpected format.");
    }
    if (value.water !== undefined && (!value.water || typeof value.water !== "object" || Array.isArray(value.water))) {
      throw new Error("Saved water logs have an unexpected format.");
    }
    const meals = value.meals.filter(isNutritionMeal).map((meal) => ({
      id: meal.id,
      date: meal.date,
      type: meal.type,
      description: meal.description.trim(),
      portion: meal.portion,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      foods: (meal.foods || []).map((food) => ({
        id: food.id,
        foodId: food.foodId,
        name: food.name.trim(),
        servings: food.servings,
        servingLabel: food.servingLabel,
        grams: food.grams,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        foodGroup: food.foodGroup,
      })),
      foodGroups: [...new Set(meal.foodGroups)],
      ...(Number.isFinite(meal.createdAt) ? { createdAt: meal.createdAt } : {}),
    }));
    const water = value.water && typeof value.water === "object" && !Array.isArray(value.water)
      ? Object.fromEntries(Object.entries(value.water).filter(([date, amount]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(amount) && amount >= 0
        ))
      : {};
    return { meals, water };
  }

  function loadWorkouts() {
    const data = readJson(WORKOUTS_KEY, "Saved workout data");
    return data ? normalizeWorkouts(data) : {};
  }

  function loadMusicSessions() {
    const data = readJson(MUSIC_KEY, "Saved music sessions");
    return data ? normalizeMusicSessions(data) : [];
  }

  function loadBusinessLogs() {
    const data = readJson(BUSINESS_KEY, "Saved business logs");
    return data ? normalizeBusinessLogs(data) : [];
  }

  function loadSleepLogs() {
    const data = readJson(SLEEP_KEY, "Saved sleep data");
    return data ? normalizeSleepLogs(data) : {};
  }

  function loadNutritionData() {
    const data = readJson(NUTRITION_KEY, "Saved nutrition data");
    return data ? normalizeNutritionData(data) : { meals: [], water: {} };
  }

  function loadSettings() {
    const data = readJson(SETTINGS_KEY, "Saved Gist settings");
    return data && typeof data === "object"
      ? {
          token: typeof data.token === "string" ? data.token : "",
          gistId: typeof data.gistId === "string" ? data.gistId : "",
        }
      : { token: "", gistId: "" };
  }

  function saveWorkouts(workouts) {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
  }

  function saveMusicSessions(sessions) {
    localStorage.setItem(MUSIC_KEY, JSON.stringify(sessions));
  }

  function saveBusinessLogs(logs) {
    localStorage.setItem(BUSINESS_KEY, JSON.stringify(logs));
  }

  function saveSleepLogs(logs) {
    localStorage.setItem(SLEEP_KEY, JSON.stringify(logs));
  }

  function saveNutritionData(data) {
    localStorage.setItem(NUTRITION_KEY, JSON.stringify(normalizeNutritionData(data)));
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function removeSettings() {
    localStorage.removeItem(SETTINGS_KEY);
  }

  function githubHeaders(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  async function readGitHubResponse(response, action) {
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${action}: GitHub returned an unreadable response (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      throw new Error(`${action}: ${body.message || `GitHub returned HTTP ${response.status}.`}`);
    }
    return body;
  }

  function parseGistData(gist) {
    const file = gist.files?.[GIST_FILENAME];
    if (!file || typeof file.content !== "string") {
      throw new Error(`This Gist does not contain ${GIST_FILENAME}.`);
    }
    let parsed;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      throw new Error("The data file in this Gist is not valid JSON.");
    }
    if (!parsed || typeof parsed !== "object") {
      throw new Error("The data file in this Gist has an unexpected format.");
    }
    return {
      workouts: normalizeWorkouts(parsed.workouts),
      music: normalizeMusicSessions(parsed.music || []),
      business: normalizeBusinessLogs(parsed.business || []),
      sleep: normalizeSleepLogs(parsed.sleep || {}),
      nutrition: normalizeNutritionData(parsed.nutrition || { meals: [], water: {} }),
    };
  }

  function currentData() {
    return {
      version: 5,
      workouts: loadWorkouts(),
      music: loadMusicSessions(),
      business: loadBusinessLogs(),
      sleep: loadSleepLogs(),
      nutrition: loadNutritionData(),
    };
  }

  async function connectToGist(token, gistId) {
    if (gistId) {
      const response = await fetch(`${GITHUB_API}/gists/${encodeURIComponent(gistId)}`, {
        headers: githubHeaders(token),
      });
      const gist = await readGitHubResponse(response, "Could not open this Gist");
      return { gistId: gist.id, ...parseGistData(gist) };
    }

    const data = currentData();
    const response = await fetch(`${GITHUB_API}/gists`, {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify({
        description: "My Hobbylog data",
        public: false,
        files: { [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) } },
      }),
    });
    const gist = await readGitHubResponse(response, "Could not create a secret Gist");
    return { gistId: gist.id, workouts: data.workouts, music: data.music, business: data.business, sleep: data.sleep, nutrition: data.nutrition };
  }

  async function syncToGist(token, gistId) {
    const response = await fetch(`${GITHUB_API}/gists/${encodeURIComponent(gistId)}`, {
      method: "PATCH",
      headers: githubHeaders(token),
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content: JSON.stringify(currentData(), null, 2) } },
      }),
    });
    await readGitHubResponse(response, "Could not sync data");
  }

  window.HobbylogStore = {
    loadWorkouts,
    loadMusicSessions,
    loadBusinessLogs,
    loadSleepLogs,
    loadNutritionData,
    loadSettings,
    saveWorkouts,
    saveMusicSessions,
    saveBusinessLogs,
    saveSleepLogs,
    saveNutritionData,
    saveSettings,
    removeSettings,
    connectToGist,
    syncToGist,
  };
})();

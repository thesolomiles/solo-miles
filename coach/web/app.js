const STORAGE_KEY = "coach_onboarding_draft_v1";
const STEP_STORAGE_KEY = "coach_onboarding_step_v1";

const PERSONA_LABEL = { coach: "Coach", nutritionist: "Nutritionist" };

const STEPS = [
  {
    type: "message",
    persona: "coach",
    text:
      "Hey, I'm your Coach. I'll be looking after your training - planning your sessions, " +
      "watching your load, telling you straight when something needs to change. Before we " +
      "start, I want to actually understand what you're working with.",
    cta: "Let's go",
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What's your name?",
    fields: [{ key: "name", type: "text", placeholder: "Your name" }],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What's your age?",
    fields: [{ key: "age", type: "number", placeholder: "Age" }],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What's your goal event, and when is it?",
    fields: [
      { key: "goal_event", type: "text", placeholder: "e.g. Century ride" },
      { key: "goal_date", type: "date" },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt:
      "What does that event demand - steady sustained effort (like a TT), punchy repeated " +
      "hard efforts (like ZRL/crit racing), or a mix?",
    fields: [
      {
        key: "event_demand_type",
        type: "radio",
        options: [
          ["steady", "Steady, sustained effort"],
          ["punchy", "Punchy, repeated hard efforts"],
          ["mixed", "A mix of both"],
        ],
      },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What's your current FTP, and when did you last test it?",
    fields: [
      { key: "ftp", type: "number", placeholder: "FTP (watts)" },
      { key: "ftp_test_method", type: "text", placeholder: "How you tested it (e.g. 20min test, ramp test)" },
      { key: "ftp_test_date", type: "date" },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "Do you know your short-duration power? (5s / 1min / 5min)",
    optionalNote: true,
    fields: [
      { key: "power_5s", type: "number", placeholder: "5 sec power (W)", optional: true },
      { key: "power_1min", type: "number", placeholder: "1 min power (W)", optional: true },
      { key: "power_5min", type: "number", placeholder: "5 min power (W)", optional: true },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "How would you describe your riding experience?",
    fields: [
      {
        key: "experience_level",
        type: "radio",
        options: [
          ["beginner", "Beginner"],
          ["intermediate", "Intermediate"],
          ["advanced", "Advanced"],
          ["competitive", "Competitive"],
        ],
      },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What does a typical recent week look like - hours, sessions?",
    fields: [
      { key: "recent_weekly_hours", type: "number", placeholder: "Hours/week recently" },
      {
        key: "recent_structure_notes",
        type: "textarea",
        placeholder: "e.g. 3 rides, mostly Z2, one harder group ride",
        optional: true,
      },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt:
      "Going forward, how many hours/week can you realistically train, and is that spread " +
      "evenly or weekend-heavy?",
    fields: [
      { key: "available_hours", type: "number", placeholder: "Hours/week available" },
      {
        key: "hours_distribution",
        type: "radio",
        options: [
          ["even", "Spread evenly"],
          ["weekend_heavy", "Weekend-heavy"],
        ],
      },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What's your setup - trainer, outdoor, or both? Power meter or estimated power?",
    fields: [
      {
        key: "training_setup",
        type: "radio",
        options: [
          ["trainer", "Trainer only"],
          ["outdoor", "Outdoor only"],
          ["both", "Both"],
        ],
      },
      {
        key: "power_source",
        type: "radio",
        options: [
          ["meter", "Power meter"],
          ["estimated", "Estimated"],
        ],
      },
    ],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "Any constraints right now - injuries, travel, work, other commitments?",
    optionalNote: true,
    fields: [
      {
        key: "constraints",
        type: "textarea",
        placeholder: "e.g. none, or knee niggle, travelling next month",
        optional: true,
      },
    ],
  },
  {
    type: "message",
    persona: "coach",
    text:
      "Good, that's everything I need for now. I'm going to hand you to the Nutritionist - " +
      "she'll sort out your fueling side, since that's half the job.",
    cta: "Continue",
  },
  {
    type: "message",
    persona: "nutritionist",
    text:
      "Hey, I'm your Nutritionist. Training's only half the equation - what you eat and when " +
      "decides whether it actually sticks. Quick questions.",
    cta: "Let's go",
  },
  {
    type: "form",
    persona: "nutritionist",
    prompt: "What's your sex? (needed for calorie/BMR calculation)",
    fields: [
      {
        key: "sex",
        type: "radio",
        options: [
          ["male", "Male"],
          ["female", "Female"],
          ["other", "Other / prefer not to say"],
        ],
      },
    ],
  },
  {
    type: "form",
    persona: "nutritionist",
    prompt: "Height and weight?",
    fields: [
      { key: "height_cm", type: "number", placeholder: "Height (cm)" },
      { key: "weight_kg", type: "number", placeholder: "Weight (kg)" },
    ],
  },
  {
    type: "form",
    persona: "nutritionist",
    prompt: "Any goal on weight - maintain, lose, gain?",
    fields: [
      {
        key: "weight_goal",
        type: "radio",
        options: [
          ["maintain", "Maintain"],
          ["lose", "Lose"],
          ["gain", "Gain"],
        ],
      },
    ],
  },
  {
    type: "form",
    persona: "nutritionist",
    prompt: "What's your day-to-day like outside training - desk job, on your feet, in between?",
    fields: [
      {
        key: "lifestyle_activity_level",
        type: "radio",
        options: [
          ["desk_job", "Desk job"],
          ["on_feet", "On my feet"],
          ["in_between", "In between"],
        ],
      },
    ],
  },
  {
    type: "form",
    persona: "nutritionist",
    prompt: "Any allergies, restrictions, or foods you don't eat?",
    optionalNote: true,
    fields: [
      {
        key: "dietary_restrictions",
        type: "textarea",
        placeholder: "e.g. none, vegetarian, lactose intolerant",
        optional: true,
      },
    ],
  },
  {
    type: "form",
    persona: "nutritionist",
    prompt: "How do you actually eat on a normal day - big meals, grazing, in between?",
    fields: [
      {
        key: "eating_pattern",
        type: "radio",
        options: [
          ["big_meals", "Big meals"],
          ["grazing", "Grazing / small frequent meals"],
          ["in_between", "In between"],
        ],
      },
    ],
  },
  {
    type: "message",
    persona: "coach",
    text: "Last bit from me - just the practical stuff so we don't annoy you.",
    cta: "Continue",
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What timezone are you in?",
    fields: [{ key: "timezone", type: "timezone" }],
  },
  {
    type: "form",
    persona: "coach",
    prompt: "What time do you usually wake up?",
    fields: [{ key: "wake_time", type: "time" }],
  },
  {
    type: "form",
    persona: "coach",
    prompt:
      "Do you want check-ins on everything (meals, snacks, mid-ride, all of it), or lighter " +
      "touch, just the big moments?",
    fields: [
      {
        key: "checkin_intensity",
        type: "radio",
        options: [
          ["everything", "Everything"],
          ["big_moments_only", "Just the big moments"],
        ],
      },
    ],
  },
  {
    type: "close",
    persona: "coach",
    text: "Good. We've got what we need - see you tomorrow morning.",
    cta: "Finish",
  },
];

const TOTAL_QUESTIONS = STEPS.filter((s) => s.type === "form").length;

let answers = {};
let stepIndex = 0;
let currentRole = null;

function loadDraft() {
  try {
    answers = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (e) {
    answers = {};
  }
  stepIndex = parseInt(localStorage.getItem(STEP_STORAGE_KEY) || "0", 10) || 0;
  if (stepIndex >= STEPS.length) stepIndex = 0;
}

function saveDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  localStorage.setItem(STEP_STORAGE_KEY, String(stepIndex));
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STEP_STORAGE_KEY);
}

function questionNumberFor(index) {
  let n = 0;
  for (let i = 0; i <= index; i++) {
    if (STEPS[i].type === "form") n++;
  }
  return n;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
  }
  (children || []).forEach((c) => c && node.appendChild(c));
  return node;
}

function renderPersonaHeader(persona) {
  const avatar = el("div", { class: `persona-avatar ${persona}`, text: persona === "coach" ? "C" : "N" });
  const name = el("div", { class: `persona-name ${persona}`, text: PERSONA_LABEL[persona] });
  return el("div", { class: "persona" }, [avatar, name]);
}

function fieldIsFilled(field) {
  const v = answers[field.key];
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function canAdvance(step) {
  if (step.type !== "form") return true;
  return step.fields.every((f) => f.optional || fieldIsFilled(f));
}

function renderField(field, onChange) {
  const wrapper = el("div", { class: "field" });

  if (field.type === "radio") {
    const group = el("div", { class: "radio-group" });
    const optionEls = [];
    field.options.forEach(([value, label]) => {
      const selected = answers[field.key] === value;
      const option = el("label", { class: `radio-option${selected ? " selected" : ""}` });
      const input = el("input", { type: "radio", name: field.key });
      input.checked = selected;
      input.addEventListener("change", () => {
        answers[field.key] = value;
        optionEls.forEach((o) => o.classList.remove("selected"));
        option.classList.add("selected");
        onChange();
      });
      option.appendChild(input);
      option.appendChild(el("span", { text: label }));
      group.appendChild(option);
      optionEls.push(option);
    });
    wrapper.appendChild(group);
    return wrapper;
  }

  if (field.type === "textarea") {
    const textarea = el("textarea", { placeholder: field.placeholder || "" });
    textarea.value = answers[field.key] || "";
    textarea.addEventListener("input", () => {
      answers[field.key] = textarea.value;
      onChange();
    });
    wrapper.appendChild(textarea);
    return wrapper;
  }

  if (field.type === "timezone") {
    const select = el("select", {});
    let zones = [];
    if (typeof Intl.supportedValuesOf === "function") {
      zones = Intl.supportedValuesOf("timeZone");
    }
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!answers[field.key]) answers[field.key] = detected;
    if (zones.length === 0) zones = [detected];
    zones.forEach((z) => {
      const opt = el("option", { value: z, text: z });
      if (z === answers[field.key]) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      answers[field.key] = select.value;
      onChange();
    });
    wrapper.appendChild(select);
    return wrapper;
  }

  // text, number, date, time
  const input = el("input", { type: field.type, placeholder: field.placeholder || "" });
  if (answers[field.key] !== undefined && answers[field.key] !== null) {
    input.value = answers[field.key];
  }
  input.addEventListener("input", () => {
    answers[field.key] = field.type === "number" ? input.value : input.value;
    onChange();
  });
  wrapper.appendChild(input);
  return wrapper;
}

function renderStep(container) {
  container.innerHTML = "";
  const step = STEPS[stepIndex];
  const card = el("div", { class: "card" });

  if (step.type === "form") {
    card.appendChild(el("div", { class: "progress", text: `Question ${questionNumberFor(stepIndex)} of ${TOTAL_QUESTIONS}` }));
  }

  card.appendChild(renderPersonaHeader(step.persona));

  if (step.type === "message" || step.type === "close") {
    card.classList.add("message-screen");
    card.appendChild(el("div", { class: `bubble ${step.persona}`, text: step.text }));
    const nextBtn = el("button", { class: "primary", text: step.cta });
    nextBtn.addEventListener("click", () => {
      if (step.type === "close") {
        submitOnboarding();
      } else {
        stepIndex++;
        saveDraft();
        renderStep(container);
      }
    });
    const nav = el("div", { class: "nav-row" }, [backButton(container), nextBtn]);
    card.appendChild(nav);
  } else {
    const promptText = step.prompt + (step.optionalNote ? " (optional - you can skip this)" : "");
    card.appendChild(el("div", { class: "prompt", text: promptText }));

    const rerenderNav = () => updateNextButtonState(nextBtn, step);

    step.fields.forEach((field) => {
      card.appendChild(renderField(field, rerenderNav));
    });

    const nextBtn = el("button", { class: "primary", text: "Next" });
    nextBtn.addEventListener("click", () => {
      stepIndex++;
      saveDraft();
      renderStep(container);
    });
    updateNextButtonState(nextBtn, step);

    const navChildren = [backButton(container), nextBtn];
    const nav = el("div", { class: "nav-row" }, navChildren);
    card.appendChild(nav);
  }

  container.appendChild(card);
}

function updateNextButtonState(btn, step) {
  btn.disabled = !canAdvance(step);
}

function backButton(container) {
  const btn = el("button", { class: "secondary", text: "Back" });
  if (stepIndex === 0) {
    btn.style.visibility = "hidden";
  }
  btn.addEventListener("click", () => {
    if (stepIndex > 0) {
      stepIndex--;
      saveDraft();
      renderStep(container);
    }
  });
  return btn;
}

function buildPayload() {
  const powerCurve = {};
  if (answers.power_5s) powerCurve["5s"] = Number(answers.power_5s);
  if (answers.power_1min) powerCurve["1min"] = Number(answers.power_1min);
  if (answers.power_5min) powerCurve["5min"] = Number(answers.power_5min);

  const payload = { ...answers };
  delete payload.power_5s;
  delete payload.power_1min;
  delete payload.power_5min;
  payload.power_curve_json = Object.keys(powerCurve).length ? JSON.stringify(powerCurve) : null;

  if (payload.age) payload.age = parseInt(payload.age, 10);
  if (payload.ftp) payload.ftp = parseInt(payload.ftp, 10);
  if (payload.recent_weekly_hours) payload.recent_weekly_hours = parseFloat(payload.recent_weekly_hours);
  if (payload.available_hours) payload.available_hours = parseFloat(payload.available_hours);
  if (payload.height_cm) payload.height_cm = parseFloat(payload.height_cm);
  if (payload.weight_kg) payload.weight_kg = parseFloat(payload.weight_kg);

  return payload;
}

async function submitOnboarding() {
  const payload = buildPayload();
  const resp = await fetch("/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    alert("Something went wrong saving your profile. Please try again.");
    return;
  }
  clearDraft();
  boot();
}

function renderWizard(container) {
  loadDraft();
  renderStep(container);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function buildTrainingLoadSvg(points, goalDate) {
  const width = 760;
  const height = 260;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const timestamps = points.map((p) => new Date(p.date).getTime());
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  const spanT = Math.max(maxT - minT, 1);

  const values = [];
  points.forEach((p) => {
    if (p.ctl != null) values.push(p.ctl);
    if (p.atl != null) values.push(p.atl);
  });
  const minV = Math.min(0, ...values);
  const maxV = Math.max(...values) * 1.1;
  const spanV = Math.max(maxV - minV, 1);

  const xFor = (t) => padLeft + ((t - minT) / spanT) * plotW;
  const yFor = (v) => padTop + plotH - ((v - minV) / spanV) * plotH;

  const ctlPoints = points
    .filter((p) => p.ctl != null)
    .map((p) => `${xFor(new Date(p.date).getTime())},${yFor(p.ctl)}`)
    .join(" ");
  const atlPoints = points
    .filter((p) => p.atl != null)
    .map((p) => `${xFor(new Date(p.date).getTime())},${yFor(p.atl)}`)
    .join(" ");

  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;
  const midDate = points[Math.floor(points.length / 2)].date;

  let goalMarker = "";
  if (goalDate) {
    const goalT = new Date(goalDate).getTime();
    if (!isNaN(goalT) && goalT >= minT && goalT <= maxT) {
      const gx = xFor(goalT);
      goalMarker =
        `<line x1="${gx}" y1="${padTop}" x2="${gx}" y2="${padTop + plotH}" ` +
        `stroke="#E0552B" stroke-width="1.5" stroke-dasharray="4,3" />` +
        `<text x="${gx}" y="${padTop - 4}" font-size="11" font-family="IBM Plex Mono, monospace" fill="#E0552B" text-anchor="middle">Goal</text>`;
    }
  }

  return (
    `<svg viewBox="0 0 ${width} ${height}" width="100%" height="260" font-family="IBM Plex Mono, monospace">` +
    `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="rgba(255,255,255,0.14)" />` +
    `<line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="rgba(255,255,255,0.14)" />` +
    `<text x="${padLeft - 8}" y="${padTop + 4}" font-size="11" fill="#9BA5AD" text-anchor="end">${Math.round(maxV)}</text>` +
    `<text x="${padLeft - 8}" y="${padTop + plotH}" font-size="11" fill="#9BA5AD" text-anchor="end">${Math.round(minV)}</text>` +
    `<polyline points="${ctlPoints}" fill="none" stroke="#9BBACC" stroke-width="2" />` +
    `<polyline points="${atlPoints}" fill="none" stroke="#E0552B" stroke-width="2" />` +
    goalMarker +
    `<text x="${padLeft}" y="${height - 8}" font-size="11" fill="#9BA5AD">${firstDate}</text>` +
    `<text x="${padLeft + plotW / 2}" y="${height - 8}" font-size="11" fill="#9BA5AD" text-anchor="middle">${midDate}</text>` +
    `<text x="${padLeft + plotW}" y="${height - 8}" font-size="11" fill="#9BA5AD" text-anchor="end">${lastDate}</text>` +
    `</svg>`
  );
}

function renderTrainingLoadSection(container, loadData) {
  const points = loadData.points || [];
  if (points.length === 0) {
    container.appendChild(
      el("div", {
        class: "chart-empty",
        text: 'No training load data yet. Click "Sync now" to pull it in.',
      })
    );
    return;
  }

  const chartHost = el("div", { class: "chart-host" });
  chartHost.innerHTML = buildTrainingLoadSvg(points, loadData.goal_date);
  container.appendChild(chartHost);

  const legend = el("div", { class: "chart-legend" });
  legend.appendChild(el("span", { class: "legend-item ctl", text: "Fitness (CTL)" }));
  legend.appendChild(el("span", { class: "legend-item atl", text: "Fatigue (ATL)" }));
  container.appendChild(legend);

  const days = daysUntil(loadData.goal_date);
  if (days !== null) {
    const label = days >= 0 ? `${days} days until goal` : "Goal date has passed";
    container.appendChild(el("div", { class: "goal-countdown", text: label }));
  }
}

async function renderDashboard(container, role) {
  container.innerHTML = "";
  const [profileResp, loadResp] = await Promise.all([
    fetch("/profile"),
    fetch("/dashboard/training-load"),
  ]);
  const profile = await profileResp.json();
  const loadData = await loadResp.json();

  const wrap = el("div", { class: "dashboard" });

  if (role === "guest") {
    wrap.appendChild(
      el("div", {
        class: "guest-banner",
        text: "This is a guest walkthrough - nothing here is saved or synced. Log in as the owner for the real thing.",
      })
    );
  }

  const header = el("div", { class: "dashboard-header" });
  header.appendChild(el("h1", { text: `Welcome back${profile.name ? ", " + profile.name : ""}.` }));
  if (role !== "guest") {
    const syncBtn = el("button", { class: "primary sync-btn", text: "Sync now" });
    header.appendChild(syncBtn);
    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = "Syncing...";
      try {
        await fetch("/dashboard/sync", { method: "POST" });
      } finally {
        renderDashboard(container, role);
      }
    });
  }
  wrap.appendChild(header);

  wrap.appendChild(el("div", { class: "subtitle", text: "Your profile is set. Here's what's on file." }));

  const grid = el("div", { class: "profile-grid" });
  const items = [
    ["Goal", profile.goal_event ? `${profile.goal_event} (${profile.goal_date || "no date"})` : "-"],
    ["FTP", profile.ftp ? `${profile.ftp}W` : "-"],
    ["Available hours/week", profile.available_hours || "-"],
    ["Experience", profile.experience_level || "-"],
    ["Weight", profile.weight_kg ? `${profile.weight_kg} kg` : "-"],
    ["Check-in style", profile.checkin_intensity || "-"],
  ];
  items.forEach(([label, value]) => {
    grid.appendChild(
      el("div", { class: "item" }, [
        el("div", { class: "label", text: label }),
        el("div", { class: "value", text: String(value) }),
      ])
    );
  });
  wrap.appendChild(grid);

  const chartCard = el("div", { class: "chart-card" });
  chartCard.appendChild(el("h2", { class: "chart-title", text: "Training load trend" }));
  renderTrainingLoadSection(chartCard, loadData);
  wrap.appendChild(chartCard);

  wrap.appendChild(
    el("div", {
      class: "coming-soon",
      text: "Planned-vs-actual nutrition log coming soon.",
    })
  );
  container.appendChild(wrap);
}

function renderTopBar(container) {
  const bar = el("div", { class: "topbar" });
  bar.appendChild(
    el("span", { class: "topbar-role", text: currentRole === "guest" ? "Guest demo" : "Signed in as owner" })
  );
  const logout = el("button", { class: "topbar-logout", text: "Log out" });
  logout.addEventListener("click", async () => {
    await fetch("/auth/logout", { method: "POST" });
    clearDraft();
    currentRole = null;
    boot();
  });
  bar.appendChild(logout);
  container.appendChild(bar);
}

function renderLogin(container) {
  container.innerHTML = "";
  const card = el("div", { class: "card login-card" });

  card.appendChild(el("div", { class: "prompt", text: "Sign in to Coach" }));
  card.appendChild(
    el("div", {
      class: "login-subtitle",
      text: "Leave both fields blank and log in to continue as a guest.",
    })
  );

  const form = el("form", { class: "login-form" });
  const usernameField = el("div", { class: "field" });
  usernameField.appendChild(el("input", { type: "text", placeholder: "Username", autocomplete: "username" }));
  const passwordField = el("div", { class: "field" });
  passwordField.appendChild(
    el("input", { type: "password", placeholder: "Password", autocomplete: "current-password" })
  );
  form.appendChild(usernameField);
  form.appendChild(passwordField);

  const error = el("div", { class: "login-error" });
  form.appendChild(error);

  const submitBtn = el("button", { class: "primary login-submit-btn", type: "submit", text: "Log in" });
  form.appendChild(submitBtn);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    const username = usernameField.querySelector("input").value;
    const password = passwordField.querySelector("input").value;
    const isGuest = !username.trim() && !password.trim();
    submitBtn.disabled = true;
    const resp = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isGuest ? { mode: "guest" } : { mode: "owner", username, password }),
    });
    submitBtn.disabled = false;
    if (resp.ok) {
      const data = await resp.json();
      currentRole = data.role;
      if (isGuest) clearDraft();
      boot();
    } else {
      error.textContent = "Wrong username or password.";
    }
  });

  card.appendChild(form);
  container.appendChild(card);
}

async function boot() {
  const container = document.getElementById("app");
  container.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const sessionResp = await fetch("/auth/session");
    const session = await sessionResp.json();
    currentRole = session.role;
    if (!currentRole) {
      renderLogin(container);
      return;
    }

    const resp = await fetch("/onboarding/status");
    const status = await resp.json();
    container.innerHTML = "";
    renderTopBar(container);
    const content = el("div", { class: "content" });
    container.appendChild(content);
    if (status.completed) {
      renderDashboard(content, currentRole);
    } else {
      renderWizard(content);
    }
  } catch (e) {
    container.innerHTML = '<div class="loading">Could not reach the server.</div>';
  }
}

boot();

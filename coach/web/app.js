const PERSONA_LABEL = { coach: "Coach", nutritionist: "Nutritionist" };

const CHAT_STORAGE_KEY = "coach_onboarding_chat_v1";
const PROGRAMME_CHAT_STORAGE_KEY = "coach_programme_chat_v1";

let currentRole = null;
let chatMessages = [];
let chatDraft = {};
let programmeMessages = [];
let programmeDraft = {};

function loadChat() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "{}");
    chatMessages = saved.messages || [];
    chatDraft = saved.draft || {};
  } catch (e) {
    chatMessages = [];
    chatDraft = {};
  }
}

function saveChat() {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages: chatMessages, draft: chatDraft }));
}

function clearChat() {
  localStorage.removeItem(CHAT_STORAGE_KEY);
  chatMessages = [];
  chatDraft = {};
}

function loadProgrammeChat() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRAMME_CHAT_STORAGE_KEY) || "{}");
    programmeMessages = saved.messages || [];
    programmeDraft = saved.draft || {};
  } catch (e) {
    programmeMessages = [];
    programmeDraft = {};
  }
}

function saveProgrammeChat() {
  localStorage.setItem(
    PROGRAMME_CHAT_STORAGE_KEY,
    JSON.stringify({ messages: programmeMessages, draft: programmeDraft })
  );
}

function clearProgrammeChat() {
  localStorage.removeItem(PROGRAMME_CHAT_STORAGE_KEY);
  programmeMessages = [];
  programmeDraft = {};
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

function renderTransition(container, text, subtext) {
  container.innerHTML = "";
  const children = [el("div", { class: "transition-text", text })];
  if (subtext) children.push(el("div", { class: "transition-subtext", text: subtext }));
  container.appendChild(el("div", { class: "transition-screen" }, children));
}

async function finishChatOnboarding(container) {
  renderTransition(container, "Setting up your dashboard...");

  const [resp] = await Promise.all([
    fetch("/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatDraft),
    }),
    new Promise((resolve) => setTimeout(resolve, 900)),
  ]);
  if (!resp.ok) {
    alert("Something went wrong saving your profile. Please try again.");
    return;
  }
  clearChat();
  boot();
}

function renderChat(container) {
  loadChat();
  container.innerHTML = "";

  const card = el("div", { class: "card chat-card" });
  card.appendChild(renderPersonaHeader("coach"));

  const log = el("div", { class: "chat-log" });
  card.appendChild(log);

  const inputRow = el("div", { class: "chat-input-row" });
  const textarea = el("textarea", { class: "chat-input", placeholder: "Type your reply..." });
  const sendBtn = el("button", { class: "primary chat-send-btn", text: "Send" });
  inputRow.appendChild(textarea);
  inputRow.appendChild(sendBtn);
  card.appendChild(inputRow);

  container.appendChild(card);

  function renderLog() {
    log.innerHTML = "";
    chatMessages.forEach((m) => {
      log.appendChild(el("div", { class: `bubble ${m.role === "user" ? "user" : "coach"}`, text: m.content }));
    });
    log.scrollTop = log.scrollHeight;
  }

  function setInputEnabled(enabled) {
    sendBtn.disabled = !enabled;
    textarea.disabled = !enabled;
  }

  async function open() {
    setInputEnabled(false);
    const typing = el("div", { class: "bubble coach typing", text: "..." });
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    try {
      const resp = await fetch("/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], draft: chatDraft }),
      });
      if (!resp.ok) throw new Error("bad response");
      const data = await resp.json();
      chatMessages.push({ role: "assistant", content: data.reply });
      chatDraft = data.draft || chatDraft;
      saveChat();
      renderLog();
    } catch (e) {
      typing.remove();
      log.appendChild(el("div", { class: "bubble coach", text: "Something went wrong loading your coach - refresh to try again." }));
    } finally {
      setInputEnabled(true);
      textarea.focus();
    }
  }

  async function send() {
    const text = textarea.value.trim();
    if (!text || sendBtn.disabled) return;

    chatMessages.push({ role: "user", content: text });
    textarea.value = "";
    saveChat();
    renderLog();

    setInputEnabled(false);
    const typing = el("div", { class: "bubble coach typing", text: "..." });
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    try {
      const resp = await fetch("/onboarding/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, draft: chatDraft }),
      });
      if (!resp.ok) throw new Error("bad response");
      const data = await resp.json();
      chatMessages.push({ role: "assistant", content: data.reply });
      chatDraft = data.draft || chatDraft;
      saveChat();
      renderLog();
      if (data.done) {
        await finishChatOnboarding(container);
        return;
      }
    } catch (e) {
      typing.remove();
      log.appendChild(el("div", { class: "bubble coach", text: "Something went wrong - try sending that again." }));
    } finally {
      setInputEnabled(true);
      textarea.focus();
    }
  }

  sendBtn.addEventListener("click", send);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  if (chatMessages.length === 0) {
    open();
  } else {
    renderLog();
    textarea.focus();
  }
}

async function finishProgrammeChat(container) {
  renderTransition(
    container,
    "Building your training programme...",
    "Drafting a full block day by day - this can take a minute or two."
  );

  const resp = await fetch("/programme/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: programmeDraft.notes || "" }),
  });
  if (!resp.ok) {
    alert("Something went wrong building your programme. Please try again.");
    return;
  }
  clearProgrammeChat();
  boot();
}

function renderProgrammeChat(container) {
  loadProgrammeChat();
  container.innerHTML = "";

  const card = el("div", { class: "card chat-card" });
  card.appendChild(renderPersonaHeader("coach"));

  const log = el("div", { class: "chat-log" });
  card.appendChild(log);

  const inputRow = el("div", { class: "chat-input-row" });
  const textarea = el("textarea", { class: "chat-input", placeholder: "Type your reply..." });
  const sendBtn = el("button", { class: "primary chat-send-btn", text: "Send" });
  inputRow.appendChild(textarea);
  inputRow.appendChild(sendBtn);
  card.appendChild(inputRow);

  container.appendChild(card);

  function renderLog() {
    log.innerHTML = "";
    programmeMessages.forEach((m) => {
      log.appendChild(el("div", { class: `bubble ${m.role === "user" ? "user" : "coach"}`, text: m.content }));
    });
    log.scrollTop = log.scrollHeight;
  }

  function setInputEnabled(enabled) {
    sendBtn.disabled = !enabled;
    textarea.disabled = !enabled;
  }

  async function open() {
    setInputEnabled(false);
    const typing = el("div", { class: "bubble coach typing", text: "..." });
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    try {
      const resp = await fetch("/programme/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [], draft: programmeDraft }),
      });
      if (!resp.ok) throw new Error("bad response");
      const data = await resp.json();
      programmeMessages.push({ role: "assistant", content: data.reply });
      programmeDraft = data.draft || programmeDraft;
      saveProgrammeChat();
      renderLog();
    } catch (e) {
      typing.remove();
      log.appendChild(el("div", { class: "bubble coach", text: "Something went wrong - refresh to try again." }));
    } finally {
      setInputEnabled(true);
      textarea.focus();
    }
  }

  async function send() {
    const text = textarea.value.trim();
    if (!text || sendBtn.disabled) return;

    programmeMessages.push({ role: "user", content: text });
    textarea.value = "";
    saveProgrammeChat();
    renderLog();

    setInputEnabled(false);
    const typing = el("div", { class: "bubble coach typing", text: "..." });
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    try {
      const resp = await fetch("/programme/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: programmeMessages, draft: programmeDraft }),
      });
      if (!resp.ok) throw new Error("bad response");
      const data = await resp.json();
      programmeMessages.push({ role: "assistant", content: data.reply });
      programmeDraft = data.draft || programmeDraft;
      saveProgrammeChat();
      renderLog();
      if (data.done) {
        await finishProgrammeChat(container);
        return;
      }
    } catch (e) {
      typing.remove();
      log.appendChild(el("div", { class: "bubble coach", text: "Something went wrong - try sending that again." }));
    } finally {
      setInputEnabled(true);
      textarea.focus();
    }
  }

  sendBtn.addEventListener("click", send);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  if (programmeMessages.length === 0) {
    open();
  } else {
    renderLog();
    textarea.focus();
  }
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

function weekdayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function renderDaysTable(container, days) {
  const table = el("table", { class: "programme-table" });
  const thead = el("thead");
  thead.appendChild(
    el("tr", {}, [
      el("th", { text: "Date" }),
      el("th", { text: "Training" }),
      el("th", { text: "Nutrition" }),
    ])
  );
  table.appendChild(thead);

  const tbody = el("tbody");
  days.forEach((day) => {
    const row = el("tr", { class: "day-row" }, [
      el("td", { class: "day-date" }, [
        el("div", { class: "day-weekday", text: weekdayLabel(day.date) }),
        el("div", { class: "day-date-text", text: day.date }),
      ]),
      el("td", { text: day.training_summary || "-" }),
      el("td", { text: day.nutrition_summary || "-" }),
    ]);

    const detailRow = el("tr", { class: "day-detail-row hidden" });
    const detailCell = el("td", { colspan: "3" }, [
      el("div", { class: "day-detail" }, [
        el("div", { class: "day-detail-label", text: "Training" }),
        el("div", { class: "day-detail-text", text: day.training_detail || "No detail." }),
        el("div", { class: "day-detail-label", text: "Nutrition" }),
        el("div", { class: "day-detail-text", text: day.nutrition_detail || "No detail." }),
      ]),
    ]);
    detailRow.appendChild(detailCell);

    row.addEventListener("click", () => {
      detailRow.classList.toggle("hidden");
      row.classList.toggle("expanded");
    });

    tbody.appendChild(row);
    tbody.appendChild(detailRow);
  });
  table.appendChild(tbody);

  const tableWrap = el("div", { class: "programme-table-wrap" });
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);
}

function renderProgrammeTable(container, programme) {
  const days = programme.days || [];
  const phases = programme.phases || [];

  if (programme.notes) {
    container.appendChild(el("div", { class: "programme-notes", text: programme.notes }));
  }

  if (phases.length === 0) {
    renderDaysTable(container, days);
    return;
  }

  phases.forEach((phase) => {
    const phaseDays = days.filter((d) => d.date >= phase.start_date && d.date <= phase.end_date);
    if (phaseDays.length === 0) return;

    const section = el("div", { class: "programme-phase" });
    section.appendChild(el("h3", { class: "programme-phase-title", text: phase.name }));
    section.appendChild(
      el("div", {
        class: "programme-phase-meta",
        text: `${phase.purpose} · ${phase.start_date} – ${phase.end_date}`,
      })
    );
    renderDaysTable(section, phaseDays);
    container.appendChild(section);
  });
}

async function renderDashboard(container, role) {
  container.innerHTML = "";
  const [profileResp, loadResp, statusResp] = await Promise.all([
    fetch("/profile"),
    fetch("/dashboard/training-load"),
    fetch("/programme/status"),
  ]);
  const profile = await profileResp.json();
  const loadData = await loadResp.json();
  const programmeStatus = await statusResp.json();

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
  header.appendChild(el("h1", { text: profile.name ? `Welcome, ${profile.name}.` : "Welcome." }));
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

  if (profile.profile_summary) {
    wrap.appendChild(el("div", { class: "summary-card", text: profile.profile_summary }));
  }

  const programmeSection = el("div", { class: "programme-section" });
  if (!programmeStatus.has_programme) {
    const cta = el("div", { class: "programme-cta" });
    cta.appendChild(el("h2", { text: "Your training & nutrition programme" }));
    cta.appendChild(
      el("div", {
        class: "programme-cta-text",
        text: "You don't have a plan yet. Build one and I'll map out your training and fueling day by day.",
      })
    );
    const buildBtn = el("button", { class: "primary programme-cta-btn", text: "Build my programme" });
    buildBtn.addEventListener("click", () => renderProgrammeChat(container));
    cta.appendChild(buildBtn);
    programmeSection.appendChild(cta);
  } else {
    const programmeHeader = el("div", { class: "programme-header" });
    programmeHeader.appendChild(el("h2", { text: "Your programme" }));
    const rebuildBtn = el("button", { class: "secondary programme-rebuild-btn", text: "Rebuild" });
    rebuildBtn.addEventListener("click", () => renderProgrammeChat(container));
    programmeHeader.appendChild(rebuildBtn);
    programmeSection.appendChild(programmeHeader);

    const programme = await (await fetch("/programme")).json();
    renderProgrammeTable(programmeSection, programme);
  }
  wrap.appendChild(programmeSection);

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
    clearChat();
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
      if (isGuest) clearChat();
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
      renderChat(content);
    }
  } catch (e) {
    container.innerHTML = '<div class="loading">Could not reach the server.</div>';
  }
}

boot();

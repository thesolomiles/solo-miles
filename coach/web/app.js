const PERSONA_LABEL = { coach: "Coach", nutritionist: "Nutritionist" };

const CHAT_STORAGE_KEY = "coach_onboarding_chat_v1";

const LOGO_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
  <rect x="1.5" y="1.5" width="21" height="21" rx="7" fill="var(--color-primary)" />
  <path d="M6 14.5l3.2-4.2 2.6 2.4 3-4.7L18 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

let chatMessages = [];
let chatDraft = {};

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

const SYNC_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>' +
  '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';

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

function chatBubble(role, text, persona = "coach") {
  const isUser = role === "user";
  const row = el("div", { class: `message-row ${isUser ? "user" : persona}` });
  if (!isUser) row.appendChild(el("div", { class: `bubble-avatar ${persona}`, text: persona === "coach" ? "C" : "N" }));
  row.appendChild(el("div", { class: `bubble ${isUser ? "user" : persona}`, text }));
  return row;
}

function typingBubble(persona = "coach") {
  const row = el("div", { class: `message-row ${persona}` });
  row.appendChild(el("div", { class: `bubble-avatar ${persona}`, text: persona === "coach" ? "C" : "N" }));
  const dots = [1, 2, 3].map(() => el("span", { class: "typing-dot" }));
  row.appendChild(el("div", { class: `bubble ${persona} typing` }, dots));
  return row;
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

function createChatModal({ closable = true, subtitle = null, onClose = null } = {}) {
  const overlay = el("div", { class: "modal-overlay" });
  const modal = el("div", { class: "modal-card" });

  const header = el("div", { class: "modal-header" });
  header.appendChild(renderPersonaHeader("coach"));
  if (closable) {
    const closeBtn = el("button", { class: "modal-close-btn", text: "×" });
    closeBtn.addEventListener("click", () => dismiss());
    header.appendChild(closeBtn);
  }
  modal.appendChild(header);

  if (subtitle) {
    modal.appendChild(el("div", { class: "modal-subtitle", text: subtitle }));
  }

  const log = el("div", { class: "chat-log" });
  modal.appendChild(log);

  const inputRow = el("div", { class: "chat-input-row" });
  const textarea = el("textarea", { class: "chat-input", placeholder: "Type your reply..." });
  const sendBtn = el("button", { class: "primary chat-send-btn", text: "Send" });
  inputRow.appendChild(textarea);
  inputRow.appendChild(sendBtn);
  modal.appendChild(inputRow);

  overlay.appendChild(modal);

  function onKeydown(e) {
    if (closable && e.key === "Escape") dismiss();
  }

  function close() {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  }

  function dismiss() {
    close();
    if (onClose) onClose();
  }

  document.addEventListener("keydown", onKeydown);
  if (closable) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismiss();
    });
  }

  document.body.appendChild(overlay);

  return { overlay, log, textarea, sendBtn, close };
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
  // Keep the dashboard rendered behind the modal (it shows through the glass overlay).

  // Closing an unfinished chat throws the whole conversation away - nothing is
  // stored until the coach has everything and onboarding completes.
  const modal = createChatModal({
    closable: true,
    onClose: () => {
      clearChat();
      renderDashboard(container);
    },
  });
  const { log, textarea, sendBtn } = modal;

  function renderLog() {
    log.innerHTML = "";
    chatMessages.forEach((m) => {
      log.appendChild(chatBubble(m.role, m.content));
    });
    log.scrollTop = log.scrollHeight;
  }

  function setInputEnabled(enabled) {
    sendBtn.disabled = !enabled;
    textarea.disabled = !enabled;
  }

  async function open() {
    setInputEnabled(false);
    const typing = typingBubble();
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
      log.appendChild(chatBubble("assistant", "Something went wrong loading your coach - refresh to try again."));
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
    const typing = typingBubble();
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
        modal.close();
        await finishChatOnboarding(container);
        return;
      }
    } catch (e) {
      typing.remove();
      log.appendChild(chatBubble("assistant", "Something went wrong - try sending that again."));
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

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

// Catmull-Rom-style smoothing: turns a list of [x, y] points into a flowing cubic-bezier path.
function smoothLinePath(coords) {
  if (coords.length === 0) return "";
  const f = (n) => n.toFixed(1);
  if (coords.length === 1) return `M ${f(coords[0][0])} ${f(coords[0][1])}`;
  const k = 0.18;
  let d = `M ${f(coords[0][0])} ${f(coords[0][1])}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * k;
    const c1y = p1[1] + (p2[1] - p0[1]) * k;
    const c2x = p2[0] - (p3[0] - p1[0]) * k;
    const c2y = p2[1] - (p3[1] - p1[1]) * k;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

function buildTssDailySvg(points, goalDate) {
  const width = 760;
  const height = 264;
  const padLeft = 40;
  const padRight = 18;
  const padTop = 26;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseY = padTop + plotH;
  const f = (n) => n.toFixed(1);

  const timestamps = points.map((p) => new Date(p.date).getTime());
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  const spanT = Math.max(maxT - minT, 1);
  const spanDays = Math.max(1, spanT / 86400000);
  const dayW = plotW / (spanDays + 1);
  const barW = Math.max(3, Math.min(12, dayW * 0.72));

  const maxV = Math.max(1, ...points.map((p) => p.tss || 0)) * 1.1;

  const xFor = (t) => padLeft + ((t - minT) / spanT) * plotW;
  const yFor = (v) => padTop + plotH - (v / maxV) * plotH;

  // Faint horizontal gridlines + y-axis labels.
  let grid = "";
  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const y = padTop + (plotH * i) / rows;
    const v = maxV - (maxV * i) / rows;
    grid +=
      `<line x1="${padLeft}" y1="${f(y)}" x2="${padLeft + plotW}" y2="${f(y)}" stroke="#EEF1F5" stroke-width="1" />` +
      `<text x="${padLeft - 10}" y="${f(y + 3.5)}" font-size="10" fill="#A7AEBA" text-anchor="end">${Math.round(v)}</text>`;
  }

  let bars = "";
  points.forEach((p) => {
    const v = p.tss || 0;
    if (v <= 0) return;
    const cx = xFor(new Date(p.date).getTime());
    const x = cx - barW / 2;
    const y = yFor(v);
    const h = baseY - y;
    const r = Math.min(barW / 2, 3);
    const hitW = Math.max(barW + 3, dayW);
    bars +=
      `<g class="tss-bar-group" data-date="${p.date}" data-tss="${v}">` +
      `<rect class="tss-hit" x="${f(cx - hitW / 2)}" y="${padTop}" width="${f(hitW)}" height="${f(plotH)}" fill="transparent" />` +
      `<rect class="tss-bar" x="${f(x)}" y="${f(y)}" width="${f(barW)}" height="${f(h)}" rx="${f(r)}" fill="url(#tssBar)" />` +
      `</g>`;
  });

  let goalMarker = "";
  if (goalDate) {
    const goalT = new Date(goalDate).getTime();
    if (!isNaN(goalT) && goalT >= minT && goalT <= maxT) {
      const gx = xFor(goalT);
      goalMarker =
        `<line x1="${f(gx)}" y1="${padTop}" x2="${f(gx)}" y2="${f(baseY)}" ` +
        `stroke="#DE5F55" stroke-width="1.5" stroke-dasharray="4,4" />` +
        `<text x="${f(gx)}" y="${padTop - 8}" font-size="10" font-weight="700" fill="#DE5F55" text-anchor="middle">GOAL</text>`;
    }
  }

  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;
  const midDate = points[Math.floor(points.length / 2)].date;

  return (
    `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" font-family="JetBrains Mono, monospace">` +
    `<defs><linearGradient id="tssBar" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#39D1E9" /><stop offset="100%" stop-color="#0FA9C8" />` +
    `</linearGradient></defs>` +
    grid +
    bars +
    goalMarker +
    `<text x="${padLeft}" y="${height - 8}" font-size="10" fill="#A7AEBA">${firstDate}</text>` +
    `<text x="${padLeft + plotW / 2}" y="${height - 8}" font-size="10" fill="#A7AEBA" text-anchor="middle">${midDate}</text>` +
    `<text x="${padLeft + plotW}" y="${height - 8}" font-size="10" fill="#A7AEBA" text-anchor="end">${lastDate}</text>` +
    `</svg>`
  );
}

function renderTssDailySection(container, data) {
  const points = (data && data.points) || [];
  if (points.length === 0) {
    container.appendChild(
      el("div", {
        class: "chart-empty",
        text: 'No ride data yet. Click "Sync now" to pull it in.',
      })
    );
    return;
  }

  const chartHost = el("div", { class: "chart-host" });
  chartHost.innerHTML = buildTssDailySvg(points, data.goal_date);
  container.appendChild(chartHost);

  const tooltip = el("div", { class: "chart-tooltip" });
  chartHost.appendChild(tooltip);
  chartHost.querySelectorAll(".tss-bar-group").forEach((group) => {
    group.addEventListener("mouseenter", () => {
      tooltip.innerHTML =
        `<strong>${group.getAttribute("data-tss")} TSS</strong>` +
        `<span class="tt-date">${group.getAttribute("data-date")}</span>`;
      tooltip.classList.add("visible");
    });
    group.addEventListener("mousemove", (e) => {
      const rect = chartHost.getBoundingClientRect();
      tooltip.style.left = `${e.clientX - rect.left}px`;
      tooltip.style.top = `${e.clientY - rect.top - 12}px`;
    });
    group.addEventListener("mouseleave", () => {
      tooltip.classList.remove("visible");
    });
  });

  const days = daysUntil(data.goal_date);
  if (days !== null) {
    const label = days >= 0 ? `${days} days until goal` : "Goal date has passed";
    container.appendChild(el("div", { class: "goal-countdown", text: label }));
  }
}

function buildPlaceholderBarsSvg() {
  const width = 760;
  const height = 264;
  const padLeft = 40;
  const padRight = 18;
  const padTop = 26;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseY = padTop + plotH;
  const f = (n) => n.toFixed(1);

  const heights = [
    0.4, 0.55, 0.32, 0.7, 0.48, 0.62, 0.44, 0.8, 0.36, 0.58, 0.5, 0.74, 0.4, 0.54, 0.84, 0.46, 0.6,
    0.5, 0.68, 0.35, 0.56, 0.64, 0.42, 0.76, 0.5, 0.6, 0.45, 0.78, 0.34, 0.55, 0.7, 0.5, 0.6, 0.4,
  ];
  const n = heights.length;
  const step = plotW / n;
  const barW = Math.min(11, step * 0.6);

  let bars = "";
  for (let i = 0; i < n; i++) {
    const h = plotH * heights[i] * 0.82;
    const x = padLeft + i * step + (step - barW) / 2;
    const y = baseY - h;
    bars += `<rect x="${f(x)}" y="${f(y)}" width="${f(barW)}" height="${f(h)}" rx="3" fill="#E8ECF1" />`;
  }

  return (
    `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">` +
    `<line x1="${padLeft}" y1="${f(baseY)}" x2="${padLeft + plotW}" y2="${f(baseY)}" stroke="#EDF0F4" />` +
    bars +
    `</svg>`
  );
}

function renderProgrammeEmptyState(card, telegramLink) {
  const host = el("div", { class: "chart-host chart-empty-host" });
  host.innerHTML = buildPlaceholderBarsSvg();

  const overlay = el("div", { class: "chart-empty-overlay" });
  overlay.appendChild(el("div", { class: "chart-empty-title", text: "No programme yet" }));
  overlay.appendChild(
    el("div", {
      class: "chart-empty-text",
      text: "Message your coach on Telegram and ask them to build you a plan - it'll show up here once it's saved.",
    })
  );
  if (telegramLink) {
    const link = el("a", { class: "primary", href: telegramLink, target: "_blank", rel: "noopener", text: "Open Telegram" });
    overlay.appendChild(link);
  }

  host.appendChild(overlay);
  card.appendChild(host);
}

function escapeXml(text) {
  return String(text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function shortDateLabel(dateStr) {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
}

function buildTssByDaySvg(days) {
  const width = 760;
  const height = 300;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 56;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxV = Math.max(1, ...days.flatMap((d) => [d.projected_tss, d.actual_tss]));
  const yFor = (v) => padTop + plotH - (v / maxV) * plotH;

  const groupW = plotW / days.length;
  const barW = Math.max(2, Math.min(14, groupW * 0.36));
  const gap = 2;

  let bars = "";
  let labels = "";
  days.forEach((d, i) => {
    const groupX = padLeft + i * groupW + groupW / 2;
    const xProj = groupX - barW - gap / 2;
    const xAct = groupX + gap / 2;
    const yProj = yFor(d.projected_tss);
    const yAct = yFor(d.actual_tss);
    bars +=
      `<rect x="${xProj}" y="${yProj}" width="${barW}" height="${padTop + plotH - yProj}" fill="#16BAD6" rx="1.5" />` +
      `<rect x="${xAct}" y="${yAct}" width="${barW}" height="${padTop + plotH - yAct}" fill="#3C424D" rx="1.5" />`;
    const labelY = padTop + plotH + 14;
    labels += `<text x="${groupX}" y="${labelY}" font-size="9" fill="#8A919D" text-anchor="end" transform="rotate(-45 ${groupX} ${labelY})">${escapeXml(shortDateLabel(d.date))}</text>`;
  });

  return (
    `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" font-family="JetBrains Mono, monospace">` +
    `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#E4E8EE" />` +
    `<line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#E4E8EE" />` +
    `<text x="${padLeft - 8}" y="${padTop + 4}" font-size="11" fill="#8A919D" text-anchor="end">${Math.round(maxV)}</text>` +
    `<text x="${padLeft - 8}" y="${padTop + plotH}" font-size="11" fill="#8A919D" text-anchor="end">0</text>` +
    bars +
    labels +
    `</svg>`
  );
}

function renderTssByDaySection(container, days) {
  if (!days || days.length === 0) {
    container.appendChild(
      el("div", { class: "chart-empty", text: "No days yet - build a programme to see this." })
    );
    return;
  }

  const chartHost = el("div", { class: "chart-host" });
  chartHost.innerHTML = buildTssByDaySvg(days);
  container.appendChild(chartHost);

  const legend = el("div", { class: "chart-legend" });
  legend.appendChild(el("span", { class: "legend-item ctl", text: "Projected TSS" }));
  legend.appendChild(el("span", { class: "legend-item atl", text: "Actual TSS" }));
  container.appendChild(legend);
}

function weekdayLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function macroCell(value, unit) {
  return el("td", { class: "macro-cell", text: value != null ? `${value}${unit}` : "-" });
}

function renderDaysTable(container, days) {
  const table = el("table", { class: "programme-table" });
  const thead = el("thead");
  thead.appendChild(
    el("tr", {}, [
      el("th", { text: "Date" }),
      el("th", { text: "Training" }),
      el("th", { text: "Cal" }),
      el("th", { text: "Protein" }),
      el("th", { text: "Carbs" }),
      el("th", { text: "Fat" }),
    ])
  );
  table.appendChild(thead);

  const tbody = el("tbody");
  days.forEach((day) => {
    const trainingCell = el("td", { text: day.training_summary || "-" });
    const calCell = macroCell(day.calories, "");
    const proteinCell = macroCell(day.protein_g, "g");
    const carbsCell = macroCell(day.carbs_g, "g");
    const fatCell = macroCell(day.fat_g, "g");

    const row = el("tr", { class: "day-row" }, [
      el("td", { class: "day-date" }, [
        el("div", { class: "day-weekday", text: weekdayLabel(day.date) }),
        el("div", { class: "day-date-text", text: day.date }),
      ]),
      trainingCell,
      calCell,
      proteinCell,
      carbsCell,
      fatCell,
    ]);

    const trainingText = el("div", { class: "day-detail-text", text: day.training_detail || "No detail." });
    const nutritionText = el("div", { class: "day-detail-text", text: day.nutrition_detail || "No detail." });

    const detailRow = el("tr", { class: "day-detail-row hidden" });
    const detailCell = el("td", { colspan: "6" }, [
      el("div", { class: "day-detail" }, [
        el("div", { class: "day-detail-label", text: "Training" }),
        trainingText,
        el("div", { class: "day-detail-label", text: "Nutrition" }),
        nutritionText,
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

    const projectedTss = phaseDays.reduce((sum, d) => sum + (d.training_load || 0), 0);

    const section = el("div", { class: "programme-phase" });
    section.appendChild(el("h3", { class: "programme-phase-title", text: phase.name }));
    section.appendChild(
      el("div", {
        class: "programme-phase-meta",
        text: `${phase.purpose} · ${phase.start_date} – ${phase.end_date} · Projected TSS: ${projectedTss}`,
      })
    );
    renderDaysTable(section, phaseDays);
    container.appendChild(section);
  });
}

function buildConnectionItem(connections, kind) {
  const item = el("div", { class: "connection-item" });

  if (kind === "strava") {
    item.appendChild(el("div", { class: "connection-name", text: "Strava" }));
    item.appendChild(
      el("div", { class: "connection-desc", text: "Pulls your rides in automatically to feed training load." })
    );
    const btn = el("button", {
      class: connections.strava_connected ? "connection-btn connected" : "primary connection-btn",
      text: connections.strava_connected ? "Connected" : "Connect Strava",
    });
    if (connections.strava_connected) {
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => {
        window.location.href = "/strava/authorize";
      });
    }
    item.appendChild(btn);
    return item;
  }

  item.appendChild(el("div", { class: "connection-name", text: "Telegram" }));
  item.appendChild(
    el("div", { class: "connection-desc", text: "Where you'll chat with your coach day to day." })
  );
  const btn = el("button", {
    class: "primary connection-btn",
    text: connections.telegram_connected ? "Open Telegram chat" : "Chat on Telegram",
  });
  if (!connections.telegram_link) {
    btn.disabled = true;
    btn.textContent = "Telegram unavailable";
    btn.className = "secondary connection-btn";
  } else {
    btn.addEventListener("click", () => {
      window.open(connections.telegram_link, "_blank", "noopener");
    });
  }
  item.appendChild(btn);
  return item;
}

function openConnectionsModal(connections) {
  const overlay = el("div", { class: "modal-overlay" });
  const modal = el("div", { class: "modal-card connections-modal" });

  const close = () => overlay.remove();

  const header = el("div", { class: "modal-header" });
  header.appendChild(el("h2", { class: "connections-title", text: "Connect your accounts" }));
  const closeBtn = el("button", { class: "modal-close-btn", text: "×" });
  closeBtn.addEventListener("click", close);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  modal.appendChild(
    el("div", {
      class: "connections-intro",
      text:
        "Strava lets your coach see the rides you've actually done, so training load stays accurate " +
        "without you entering anything by hand. Telegram is where you'll actually talk to your coach - " +
        "daily briefs, check-ins, questions - answered like texting a person.",
    })
  );

  const row = el("div", { class: "connections-row" });
  row.appendChild(buildConnectionItem(connections, "strava"));
  row.appendChild(buildConnectionItem(connections, "telegram"));
  modal.appendChild(row);

  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.body.appendChild(overlay);
}

function fmtDuration(secs) {
  if (!secs) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function relativeDay(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return "";
  if (d === 0) return "Today";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${-d} days ago`;
  if (d === 1) return "Tomorrow";
  return `in ${d} days`;
}

function overviewTile(label, valueText, subText, extra, caption) {
  const tile = el("div", { class: "overview-tile" });
  const labelRow = el("div", { class: "overview-label" }, [el("span", { text: label })]);
  if (caption) labelRow.appendChild(el("span", { class: "overview-caption", text: caption }));
  tile.appendChild(labelRow);
  const empty = valueText === null || valueText === undefined || valueText === "—";
  tile.appendChild(
    el("div", { class: empty ? "overview-value overview-value--empty" : "overview-value", text: empty ? "—" : valueText })
  );
  if (extra) tile.appendChild(extra);
  tile.appendChild(el("div", { class: "overview-sub", text: subText || "" }));
  return tile;
}

function renderOverviewStrip(overview) {
  const card = el("div", { class: "chart-card overview-card" });
  card.appendChild(el("h2", { class: "chart-title", text: "At a glance" }));
  const grid = el("div", { class: "overview-grid" });

  // Latest activity (from synced Strava rides).
  const la = overview.latest_activity;
  if (la) {
    const bits = [];
    const dur = fmtDuration(la.duration_secs);
    if (dur) bits.push(dur);
    if (la.avg_power != null) bits.push(`${la.avg_power} W`);
    if (la.avg_hr != null) bits.push(`${la.avg_hr} bpm`);
    if (la.tss != null) bits.push(`${la.tss} TSS`);
    const rel = relativeDay(la.date);
    grid.appendChild(overviewTile("Latest activity", la.name || la.type || "Activity", bits.join(" · "), null, rel));
  } else {
    grid.appendChild(overviewTile("Latest activity", "—", "No rides synced yet"));
  }

  // Next workout (planned session, if one is scheduled).
  const nw = overview.next_workout;
  if (nw) {
    const bits = [];
    const rel = relativeDay(nw.date);
    if (rel) bits.push(rel);
    const dur = fmtDuration(nw.duration_secs);
    if (dur) bits.push(dur);
    if (nw.load != null) bits.push(`${nw.load} TSS`);
    grid.appendChild(overviewTile("Next workout", nw.name || "Workout", bits.join(" · ")));
  } else {
    grid.appendChild(overviewTile("Next workout", "—", "Nothing scheduled"));
  }

  // FTP.
  grid.appendChild(
    overviewTile(
      "FTP",
      overview.ftp ? `${overview.ftp} W` : "—",
      overview.ftp_test_date ? `Set ${overview.ftp_test_date}` : "Functional threshold power"
    )
  );

  // Weekly hours — actual vs planned, with a small progress bar.
  const wh = overview.weekly_hours || {};
  const actual = wh.actual != null ? wh.actual : 0;
  const planned = wh.planned;
  let bar = null;
  if (planned) {
    const pct = Math.max(0, Math.min(100, (actual / planned) * 100));
    const track = el("div", { class: "overview-bar" });
    const fill = el("div", { class: "overview-bar-fill" });
    fill.style.width = `${pct}%`;
    track.appendChild(fill);
    bar = track;
  }
  const valueText = planned != null ? `${actual.toFixed(1)} / ${planned.toFixed(1)} h` : `${actual.toFixed(1)} h`;
  grid.appendChild(
    overviewTile("Weekly hours", valueText, planned != null ? "actual / planned this week" : "actual this week", bar)
  );

  card.appendChild(grid);
  return card;
}

function renderConnectionsCard(connections) {
  const bothConnected = connections.strava_connected && connections.telegram_connected;

  const card = el("div", { class: "chart-card connections-card" });
  card.appendChild(el("h2", { class: "connections-title", text: "Connect your accounts" }));
  card.appendChild(
    el("div", {
      class: "connections-intro",
      text: bothConnected
        ? "Strava and Telegram are linked. Manage them any time."
        : "Link Strava and Telegram so your coach sees your rides and can chat with you day to day.",
    })
  );

  const btn = el("button", {
    class: "connections-open-btn",
    text: bothConnected ? "Manage connections" : "Connect your accounts",
  });
  btn.addEventListener("click", () => openConnectionsModal(connections));
  card.appendChild(btn);
  return card;
}

async function renderDashboard(container) {
  container.innerHTML = "";
  const profile = await (await fetch("/profile")).json();

  const wrap = el("div", { class: "dashboard" });

  const header = el("div", { class: "dashboard-header" });
  const headText = el("div", { class: "page-head-text" });
  headText.appendChild(el("h1", { text: profile.name ? `Welcome, ${profile.name}.` : "Welcome." }));
  headText.appendChild(
    el("p", { class: "page-head-sub", text: "Here's where your training stands today." })
  );
  header.appendChild(headText);
  const syncBtn = el("button", {
    class: "primary sync-btn has-tooltip",
    "aria-label": "Sync now",
    "data-tooltip": "Sync now",
  });
  syncBtn.innerHTML = SYNC_ICON;
  header.appendChild(syncBtn);
  syncBtn.addEventListener("click", async () => {
    syncBtn.disabled = true;
    syncBtn.classList.add("is-busy");
    syncBtn.setAttribute("data-tooltip", "Syncing…");
    try {
      await fetch("/dashboard/sync", { method: "POST" });
    } finally {
      renderDashboard(container);
    }
  });
  wrap.appendChild(header);

  if (!profile.onboarding_completed_at) {
    const narrow = el("div", { class: "narrow-col" });
    narrow.appendChild(
      el("div", {
        class: "subtitle",
        text: "I don't know anything about you yet - let's fix that.",
      })
    );
    const cta = el("div", { class: "programme-cta" });
    cta.appendChild(el("h2", { text: "Talk to your coach" }));
    cta.appendChild(
      el("div", {
        class: "programme-cta-text",
        text: "Tell your coach about your training, your goals, and your setup. The more you share, the more they have to work with - if you come in empty, that's fine too, we'll figure it out together.",
      })
    );
    const talkBtn = el("button", { class: "primary programme-cta-btn", text: "Speak to your coach" });
    talkBtn.addEventListener("click", () => renderChat(container));
    cta.appendChild(talkBtn);
    narrow.appendChild(cta);
    wrap.appendChild(narrow);
    container.appendChild(wrap);
    return;
  }

  const [statusResp, connectionsResp, overviewResp] = await Promise.all([
    fetch("/programme/status"),
    fetch("/connections/status"),
    fetch("/dashboard/overview"),
  ]);
  const programmeStatus = await statusResp.json();
  const connections = await connectionsResp.json();
  const overview = await overviewResp.json();

  // Profile stat tiles (rendered inside the Coach's read card in the side column).
  const stats = [
    { label: "Goal", value: profile.goal_event || "—", sub: profile.goal_date || null },
    { label: "FTP", value: profile.ftp ? `${profile.ftp} W` : "—" },
    { label: "Weekly hours", value: profile.available_hours ? `${profile.available_hours} h` : "—" },
    { label: "Experience", value: profile.experience_level || "—" },
    { label: "Age", value: profile.age != null ? String(profile.age) : "—" },
    { label: "Sex", value: profile.sex || "—" },
    { label: "Height", value: profile.height_cm ? `${profile.height_cm} cm` : "—" },
    { label: "Weight", value: profile.weight_kg ? `${profile.weight_kg} kg` : "—" },
    { label: "Check-in style", value: profile.checkin_intensity || "—" },
  ];

  // At-a-glance snapshot, above the programme (main) and about (side) columns.
  wrap.appendChild(renderOverviewStrip(overview));

  // Main + side dashboard grid.
  const grid = el("div", { class: "dash-grid" });
  const main = el("div", { class: "dash-col dash-col--main" });
  const side = el("aside", { class: "dash-col dash-col--side" });

  // TSS chart. With a programme: projected vs actual per day. Otherwise: an empty state
  // pointing the athlete to build one via the coach on Telegram.
  const tssCard = el("div", { class: "chart-card" });
  tssCard.appendChild(el("h2", { class: "chart-title", text: "TSS by day" }));
  if (programmeStatus.has_programme) {
    const tssDays = await (await fetch("/dashboard/tss-by-day")).json();
    renderTssByDaySection(tssCard, tssDays);
  } else {
    renderProgrammeEmptyState(tssCard, connections.telegram_link);
  }
  main.appendChild(tssCard);

  // Programme overview (read-only; the plan is built by talking to the coach on Telegram).
  if (programmeStatus.has_programme) {
    const programmeSection = el("div", { class: "programme-section" });
    const programmeHeader = el("div", { class: "programme-header" });
    programmeHeader.appendChild(el("h2", { text: "Programme overview" }));
    programmeSection.appendChild(programmeHeader);

    const programme = await (await fetch("/programme")).json();
    renderProgrammeTable(programmeSection, programme);
    main.appendChild(programmeSection);
  }

  // Side column: about the rider (facts + coach's read), connections, what's next.
  const summary = el("div", { class: "summary-card" });
  summary.appendChild(
    el("h2", { class: "summary-card-title", text: profile.name ? `About ${profile.name}` : "About you" })
  );

  const statGrid = el("div", { class: "stat-grid summary-stats" });
  stats.forEach((s) => {
    const tile = el("div", { class: "stat-tile" });
    tile.appendChild(el("div", { class: "stat-label", text: s.label }));
    tile.appendChild(el("div", { class: "stat-value", text: String(s.value) }));
    if (s.sub) tile.appendChild(el("div", { class: "stat-sub", text: s.sub }));
    statGrid.appendChild(tile);
  });
  summary.appendChild(statGrid);

  if (profile.profile_summary) {
    summary.appendChild(el("div", { class: "card-eyebrow", text: "Coach's read" }));
    summary.appendChild(el("p", { class: "summary-text", text: profile.profile_summary }));
  }
  side.appendChild(summary);

  // Coach's thoughts - the coach's current, personable read on the athlete. Fetched lazily
  // (it's an LLM call) so the rest of the dashboard renders immediately.
  const thoughts = el("div", { class: "summary-card" });
  thoughts.appendChild(el("h2", { class: "summary-card-title", text: "Coach's thoughts" }));
  const thoughtsText = el("p", { class: "summary-text", text: "Thinking…" });
  thoughts.appendChild(thoughtsText);
  side.appendChild(thoughts);
  fetch("/agents/coach/brief")
    .then((r) => r.json())
    .then((d) => {
      thoughtsText.textContent = d.brief || "Nothing to add right now.";
    })
    .catch(() => {
      thoughtsText.textContent = "Couldn't load your coach's thoughts right now.";
    });

  side.appendChild(renderConnectionsCard(connections));

  grid.appendChild(main);
  grid.appendChild(side);
  wrap.appendChild(grid);

  container.appendChild(wrap);
}

function contentEl() {
  return document.querySelector(".content");
}

function initials(name) {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function renderPlaceholder(container, title, body) {
  container.innerHTML = "";
  const wrap = el("div", { class: "dashboard" });
  const header = el("div", { class: "dashboard-header" });
  header.appendChild(el("h1", { text: title }));
  wrap.appendChild(header);
  wrap.appendChild(el("div", { class: "coming-soon", text: body }));
  container.appendChild(wrap);
}

async function renderTopBar(container) {
  const bar = el("header", { class: "topbar" });
  const inner = el("div", { class: "topbar-inner" });

  // Logo — returns to the dashboard.
  const brand = el("button", { class: "brand", type: "button", "aria-label": "Coach home" });
  const mark = el("span", { class: "brand-mark" });
  mark.innerHTML = LOGO_SVG;
  brand.appendChild(mark);
  brand.appendChild(el("span", { class: "brand-name", text: "Coach" }));
  brand.addEventListener("click", () => renderDashboard(contentEl()));
  inner.appendChild(brand);

  // Profile avatar + dropdown menu.
  const menuWrap = el("div", { class: "user-menu" });
  const avatarBtn = el("button", {
    class: "avatar-btn",
    type: "button",
    "aria-haspopup": "true",
    "aria-expanded": "false",
    "aria-label": "Account menu",
  });
  const avatar = el("span", { class: "avatar avatar--empty" });
  avatarBtn.appendChild(avatar);
  menuWrap.appendChild(avatarBtn);

  const menu = el("div", { class: "menu", role: "menu" });
  menu.hidden = true;

  const closeMenu = () => {
    menu.hidden = true;
    avatarBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKey);
  };
  const openMenu = () => {
    menu.hidden = false;
    avatarBtn.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
  };
  function onDocClick(e) {
    if (!menuWrap.contains(e.target)) closeMenu();
  }
  function onKey(e) {
    if (e.key === "Escape") closeMenu();
  }

  const addItem = (label, onClick, extraClass = "") => {
    const item = el("button", { class: `menu-item ${extraClass}`.trim(), type: "button", role: "menuitem", text: label });
    item.addEventListener("click", () => {
      closeMenu();
      onClick();
    });
    menu.appendChild(item);
  };

  addItem("Profile", () => renderPlaceholder(contentEl(), "Profile", "Your profile lives here — coming soon."));
  addItem("Settings", () => renderPlaceholder(contentEl(), "Settings", "Settings are on the way."));
  menu.appendChild(el("div", { class: "menu-sep" }));
  addItem(
    "Log out",
    async () => {
      await fetch("/auth/logout", { method: "POST" });
      clearChat();
      boot();
    },
    "menu-item--danger"
  );

  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden ? openMenu() : closeMenu();
  });

  menuWrap.appendChild(menu);
  inner.appendChild(menuWrap);
  bar.appendChild(inner);
  container.appendChild(bar);

  // Fill the avatar with the athlete's initials once the profile loads.
  try {
    const profile = await (await fetch("/profile")).json();
    const ini = initials(profile.name);
    if (ini) {
      avatar.textContent = ini;
      avatar.classList.remove("avatar--empty");
    }
  } catch (e) {
    /* leave the empty avatar */
  }
}

function renderLogin(container) {
  container.innerHTML = "";
  container.classList.remove("signed-in");
  const card = el("div", { class: "card login-card" });

  card.appendChild(el("div", { class: "prompt", text: "Sign in to Coach" }));

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
    submitBtn.disabled = true;
    const resp = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    submitBtn.disabled = false;
    if (resp.ok) {
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
  container.classList.remove("signed-in");
  container.innerHTML = '<div class="loading">Loading...</div>';
  try {
    const sessionResp = await fetch("/auth/session");
    const session = await sessionResp.json();
    if (!session.authenticated) {
      renderLogin(container);
      return;
    }

    container.innerHTML = "";
    container.classList.add("signed-in");
    renderTopBar(container);
    const content = el("div", { class: "content" });
    container.appendChild(content);
    renderDashboard(content);
  } catch (e) {
    container.innerHTML = '<div class="loading">Could not reach the server.</div>';
  }
}

boot();

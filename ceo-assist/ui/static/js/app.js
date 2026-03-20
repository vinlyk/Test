/* ── CEO-Assist Frontend ─────────────────────────────────────── */

marked.setOptions({ breaks: true, gfm: true });

let ws = null;
let isStreaming = false;
let currentAssistantBubble = null;
let currentAssistantText = "";

// ── WebSocket Connection ──────────────────────────────────────────────────────

function connectWS() {
  const badge = document.getElementById("conn-badge");
  badge.textContent = "Connecting...";
  badge.className = "connection-badge";

  ws = new WebSocket(`ws://${location.host}/ws/chat`);

  ws.onopen = () => {
    badge.textContent = "Connected";
    badge.className = "connection-badge connected";
    document.getElementById("send-btn").disabled = false;
  };

  ws.onclose = () => {
    badge.textContent = "Reconnecting...";
    badge.className = "connection-badge error";
    setTimeout(connectWS, 2000);
  };

  ws.onerror = () => {
    badge.textContent = "Error";
    badge.className = "connection-badge error";
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };
}

function handleServerMessage(msg) {
  removeTypingIndicator();

  if (msg.type === "chunk") {
    if (!currentAssistantBubble) {
      currentAssistantText = "";
      const [msgEl, bubble] = createAssistantBubble();
      currentAssistantBubble = bubble;
    }
    currentAssistantText += msg.text;
    // Re-render as markdown on each chunk
    currentAssistantBubble.innerHTML = DOMPurify.sanitize(
      marked.parse(currentAssistantText)
    );
    scrollToBottom();
  } else if (msg.type === "done") {
    currentAssistantBubble = null;
    currentAssistantText = "";
    setStreaming(false);
  } else if (msg.type === "error") {
    appendErrorMessage(msg.message || "An error occurred.");
    setStreaming(false);
    currentAssistantBubble = null;
    currentAssistantText = "";
  }
}

// ── Sending Messages ──────────────────────────────────────────────────────────

function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text || isStreaming) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    appendErrorMessage("Not connected. Please wait...");
    return;
  }
  // Remove welcome card
  document.querySelector(".welcome-card")?.remove();

  appendUserMessage(text);
  input.value = "";
  resizeTextarea(input);
  showTypingIndicator();
  setStreaming(true);

  ws.send(JSON.stringify({ message: text }));
}

function sendQuick(text) {
  document.querySelector(".welcome-card")?.remove();
  document.getElementById("user-input").value = text;
  sendMessage();
}

// ── Message Rendering ─────────────────────────────────────────────────────────

function appendUserMessage(text) {
  const container = document.getElementById("messages");
  const el = document.createElement("div");
  el.className = "message user";
  el.innerHTML = `
    <div class="message-label">You</div>
    <div class="message-bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(el);
  scrollToBottom();
}

function createAssistantBubble() {
  const container = document.getElementById("messages");
  const el = document.createElement("div");
  el.className = "message assistant";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  el.innerHTML = `<div class="message-label">CEO-Assist</div>`;
  el.appendChild(bubble);
  container.appendChild(el);
  scrollToBottom();
  return [el, bubble];
}

function appendErrorMessage(text) {
  const container = document.getElementById("messages");
  const el = document.createElement("div");
  el.className = "message assistant";
  el.innerHTML = `
    <div class="message-label">System</div>
    <div class="message-bubble" style="border-color:var(--red);color:var(--red)">
      ${escapeHtml(text)}
    </div>
  `;
  container.appendChild(el);
  scrollToBottom();
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function showTypingIndicator() {
  const container = document.getElementById("messages");
  const el = document.createElement("div");
  el.id = "typing-indicator";
  el.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(el);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById("typing-indicator")?.remove();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function setStreaming(val) {
  isStreaming = val;
  const btn = document.getElementById("send-btn");
  const input = document.getElementById("user-input");
  btn.disabled = val;
  input.disabled = val;
}

function scrollToBottom() {
  const container = document.getElementById("messages");
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

// ── Keyboard handling ─────────────────────────────────────────────────────────

document.getElementById("user-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById("user-input").addEventListener("input", function () {
  resizeTextarea(this);
});

// ── Integration Status ────────────────────────────────────────────────────────

async function loadStatus() {
  try {
    const resp = await fetch("/api/status");
    const data = await resp.json();
    const integrations = data.integrations || {};
    for (const [key, ok] of Object.entries(integrations)) {
      const el = document.querySelector(`[data-key="${key}"]`);
      if (el) {
        el.className = `integration-item ${ok ? "ok" : "warn"}`;
      }
    }
    // Show Microsoft auth button if not configured
    if (!integrations.microsoft) {
      document.getElementById("ms-auth-btn-wrap").style.display = "block";
    }
  } catch {
    // Status check failed silently
  }
}

// ── Microsoft Auth ────────────────────────────────────────────────────────────

async function startMsAuth() {
  try {
    const resp = await fetch("/api/microsoft/auth/start");
    if (!resp.ok) {
      const err = await resp.json();
      alert(`Cannot start auth: ${err.detail}`);
      return;
    }
    const data = await resp.json();
    showDialog(`
      <h3>Connect Microsoft 365</h3>
      <p style="color:var(--text-muted);margin-bottom:16px">
        To connect your Outlook, Calendar, and OneNote:
      </p>
      <ol style="padding-left:20px;color:var(--text);margin-bottom:16px">
        <li>Go to <strong><a href="${data.verification_url}" target="_blank" style="color:var(--accent)">${data.verification_url}</a></strong></li>
        <li>Enter this code: <strong style="font-size:20px;letter-spacing:4px;color:var(--green)">${data.user_code}</strong></li>
        <li>Sign in with your Microsoft account</li>
      </ol>
      <button class="btn-primary" onclick="completeMsAuth('${data.device_code}')">
        I've signed in — Complete Connection
      </button>
    `);
  } catch (e) {
    alert("Error starting auth: " + e.message);
  }
}

async function completeMsAuth(deviceCode) {
  closeDialog();
  showDialog("<h3>Completing authentication...</h3><p>Please wait...</p>");
  try {
    const resp = await fetch("/api/microsoft/auth/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
    });
    const data = await resp.json();
    closeDialog();
    if (data.success) {
      document.getElementById("ms-auth-btn-wrap").style.display = "none";
      const el = document.querySelector('[data-key="microsoft"]');
      if (el) el.className = "integration-item ok";
      appendErrorMessage("Microsoft 365 connected successfully!");
    } else {
      alert("Authentication failed. Please try again.");
    }
  } catch (e) {
    closeDialog();
    alert("Error completing auth: " + e.message);
  }
}

// ── Quick Action Dialogs ──────────────────────────────────────────────────────

function showMeetingPrepDialog() {
  showDialog(`
    <h3>Prepare for a Meeting</h3>
    <label>Meeting subject / company name</label>
    <input id="prep-subject" type="text" placeholder="e.g. Quarterly review with Acme Corp" />
    <label>Attendee names or emails (comma separated)</label>
    <input id="prep-attendees" type="text" placeholder="e.g. John Smith, sarah@acme.com" />
    <label>Meeting date</label>
    <input id="prep-date" type="date" />
    <button class="btn-primary" onclick="submitMeetingPrep()">Prepare Brief</button>
  `);
  // Set today as default
  document.getElementById("prep-date").value = new Date().toISOString().split("T")[0];
}

function submitMeetingPrep() {
  const subject = document.getElementById("prep-subject").value.trim();
  const attendees = document.getElementById("prep-attendees").value.trim();
  const date = document.getElementById("prep-date").value;
  if (!subject) { alert("Please enter the meeting subject."); return; }
  closeDialog();
  const prompt = `Please prepare a comprehensive meeting brief for:
**Meeting:** ${subject}
**Date:** ${date}
**Attendees:** ${attendees || "See calendar"}

Please:
1. Check my calendar for this meeting
2. Search for recent emails with each attendee
3. Look up their backgrounds in the CRM and via web search
4. Summarize our last communications and any open topics
5. Suggest key objectives and talking points for me
6. Flag any relevant recent news`;
  sendQuick(prompt);
}

function showPostMeetingDialog() {
  showDialog(`
    <h3>Capture Post-Meeting Notes</h3>
    <label>Meeting title</label>
    <input id="notes-title" type="text" placeholder="e.g. Q1 Strategy Review with Board" />
    <label>Attendees (comma separated)</label>
    <input id="notes-attendees" type="text" placeholder="e.g. John, Sarah, Mike" />
    <label>Quick notes (bullet points, decisions, actions)</label>
    <textarea id="notes-content" rows="5" placeholder="- Discussed Q1 results&#10;- Agreed to expand to APAC&#10;- Action: John to prepare financial model by March 30"></textarea>
    <button class="btn-primary" onclick="submitPostMeeting()">Save & Summarize</button>
  `);
}

function submitPostMeeting() {
  const title = document.getElementById("notes-title").value.trim();
  const attendees = document.getElementById("notes-attendees").value.trim();
  const content = document.getElementById("notes-content").value.trim();
  if (!title) { alert("Please enter a meeting title."); return; }
  closeDialog();
  const today = new Date().toISOString().split("T")[0];
  const prompt = `Please help me capture and structure my post-meeting notes:

**Meeting:** ${title}
**Date:** ${today}
**Attendees:** ${attendees}

**My raw notes:**
${content}

Please:
1. Structure this into a clean meeting summary (key points, decisions, action items)
2. Save the notes to OneNote or local file
3. Draft a brief follow-up email I can review and send to the attendees
4. Update CRM notes if any of the attendees are in Affinity`;
  sendQuick(prompt);
}

function showTravelDialog() {
  showDialog(`
    <h3>Plan Business Travel</h3>
    <label>From city</label>
    <input id="travel-from" type="text" placeholder="e.g. Singapore, SIN" />
    <label>To city</label>
    <input id="travel-to" type="text" placeholder="e.g. London, LHR" />
    <label>Departure date</label>
    <input id="travel-dep" type="date" />
    <label>Return date (leave blank for one-way)</label>
    <input id="travel-ret" type="date" />
    <label>Class</label>
    <select id="travel-class">
      <option value="BUSINESS" selected>Business</option>
      <option value="FIRST">First</option>
      <option value="PREMIUM_ECONOMY">Premium Economy</option>
      <option value="ECONOMY">Economy</option>
    </select>
    <button class="btn-primary" onclick="submitTravel()">Search Flights & Hotels</button>
  `);
}

function submitTravel() {
  const from = document.getElementById("travel-from").value.trim();
  const to = document.getElementById("travel-to").value.trim();
  const dep = document.getElementById("travel-dep").value;
  const ret = document.getElementById("travel-ret").value;
  const cls = document.getElementById("travel-class").value;
  if (!from || !to || !dep) { alert("Please fill in origin, destination, and departure date."); return; }
  closeDialog();
  let prompt = `Please plan my business travel:
- From: ${from}
- To: ${to}
- Departure: ${dep}
${ret ? `- Return: ${ret}` : "- One-way trip"}
- Preferred class: ${cls}

Please:
1. Search for available ${cls.toLowerCase()} class flights
2. Search for 5-star hotels in ${to} for the trip dates
3. Present a clean travel itinerary with pricing`;
  sendQuick(prompt);
}

// ── Dialog helpers ────────────────────────────────────────────────────────────

function showDialog(html) {
  document.getElementById("dialog-content").innerHTML = html;
  document.getElementById("dialog-overlay").classList.remove("hidden");
}

function closeDialog() {
  document.getElementById("dialog-overlay").classList.add("hidden");
  document.getElementById("dialog-content").innerHTML = "";
}

// ── Audit Log ────────────────────────────────────────────────────────────────

function toggleAuditLog() {
  const panel = document.getElementById("audit-panel");
  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
    loadAuditLog();
  } else {
    panel.classList.add("hidden");
  }
}

async function loadAuditLog() {
  try {
    const resp = await fetch("/api/audit?n=50");
    const data = await resp.json();
    const container = document.getElementById("audit-entries");
    const entries = data.entries || [];
    if (!entries.length) {
      container.innerHTML = '<p style="color:var(--text-muted)">No audit entries yet.</p>';
      return;
    }
    container.innerHTML = entries.reverse().map(e => `
      <div class="audit-entry">
        <div class="entry-action">${e.action}</div>
        <div class="entry-resource">→ ${e.resource}</div>
        <div class="entry-ts">${e.ts.replace("T", " ").slice(0, 19)}</div>
        ${Object.keys(e.details || {}).length ?
          `<div style="color:var(--text-muted);margin-top:4px">${JSON.stringify(e.details)}</div>` : ""}
      </div>
    `).join("");
  } catch {
    document.getElementById("audit-entries").textContent = "Failed to load audit log.";
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

async function resetConversation() {
  if (!confirm("Start a new conversation? This will clear the current context.")) return;
  await fetch("/api/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  document.getElementById("messages").innerHTML = `
    <div class="welcome-card">
      <h2>New conversation started.</h2>
      <p>What would you like help with?</p>
    </div>
  `;
  currentAssistantBubble = null;
  currentAssistantText = "";
}

// ── Init ──────────────────────────────────────────────────────────────────────

connectWS();
loadStatus();

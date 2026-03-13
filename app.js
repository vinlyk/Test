/* ═══════════════════════════════════════════════════════════════════════════
   Football Stream Finder – app.js
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Data: Upcoming Manchester United Fixtures ───────────────────────────── */
const manUtdMatches = [
  {
    competition: "Premier League",
    home: "Manchester United",
    away: "Arsenal",
    date: "2026-03-15",
    time: "16:30",
    status: "upcoming",
    utd: true,
  },
  {
    competition: "UEFA Europa League",
    home: "Manchester United",
    away: "Athletic Bilbao",
    date: "2026-03-19",
    time: "20:00",
    status: "upcoming",
    utd: true,
  },
  {
    competition: "FA Cup",
    home: "Fulham",
    away: "Manchester United",
    date: "2026-03-22",
    time: "14:00",
    status: "upcoming",
    utd: true,
  },
  {
    competition: "Premier League",
    home: "Tottenham Hotspur",
    away: "Manchester United",
    date: "2026-04-05",
    time: "12:30",
    status: "upcoming",
    utd: true,
  },
  {
    competition: "UEFA Europa League",
    home: "Athletic Bilbao",
    away: "Manchester United",
    date: "2026-04-09",
    time: "20:00",
    status: "upcoming",
    utd: true,
  },
  {
    competition: "Premier League",
    home: "Manchester United",
    away: "Chelsea",
    date: "2026-04-19",
    time: "16:30",
    status: "upcoming",
    utd: true,
  },
];

/* ── Data: Free Streaming Sites ──────────────────────────────────────────── */
const streamingSites = [
  {
    name: "BBC iPlayer",
    url: "bbc.co.uk/iplayer",
    icon: "📺",
    iconBg: "#b5121b",
    desc: "Official UK broadcaster. Streams FA Cup, selected Premier League highlights, and some international fixtures free with a UK TV Licence / free account. VPN required outside the UK.",
    tags: ["free", "hd", "no-signup", "manutd", "vpn"],
    reliability: 5,
    notes: "Best legal option for UK viewers. Ad-free.",
  },
  {
    name: "ITV X",
    url: "itvx.com",
    icon: "🎬",
    iconBg: "#003087",
    desc: "Free UK streaming. Airs UEFA Europa League matches live, including Man United's European campaigns. Requires a free account. Use VPN outside the UK.",
    tags: ["free", "hd", "manutd", "vpn", "account"],
    reliability: 5,
    notes: "Official UEFA Europa League broadcaster in UK.",
  },
  {
    name: "Channel 4 / All 4",
    url: "channel4.com/stream",
    icon: "4️⃣",
    iconBg: "#1a1a1a",
    desc: "UK free-to-air broadcaster streaming occasional top-flight football and highlight shows. Free with an account.",
    tags: ["free", "hd", "vpn", "account"],
    reliability: 4,
    notes: "Good for highlights and special tournaments.",
  },
  {
    name: "TUDN (Univision)",
    url: "tudn.com",
    icon: "🌎",
    iconBg: "#005eb8",
    desc: "US-based Spanish-language sports network. Streams selected Premier League and Champions League matches free with a cable TV provider login or free trial.",
    tags: ["free", "hd", "manutd", "account"],
    reliability: 4,
    notes: "Free trial available. Great Man United coverage.",
  },
  {
    name: "Pluto TV",
    url: "pluto.tv",
    icon: "🪐",
    iconBg: "#2c2c5e",
    desc: "Completely free, no-sign-up streaming service with dedicated sports channels. Airs football highlights and some live matches. US/EU availability.",
    tags: ["free", "no-signup", "manutd"],
    reliability: 3,
    notes: "No account needed. Limited live match availability.",
  },
  {
    name: "Tubi TV",
    url: "tubitv.com",
    icon: "📡",
    iconBg: "#fa4b22",
    desc: "Free ad-supported VOD and some live sports. Occasional football content including Premier League replays.",
    tags: ["free", "no-signup", "adblocker"],
    reliability: 3,
    notes: "Good for replays & on-demand. Ads present.",
  },
  {
    name: "Peacock Free Tier",
    url: "peacocktv.com",
    icon: "🦚",
    iconBg: "#00205b",
    desc: "NBC's streaming platform. Free tier includes some Premier League matches. Frequently shows Manchester United games on the free plan.",
    tags: ["free", "hd", "manutd", "account"],
    reliability: 4,
    notes: "Free tier has ads but genuine Premier League games.",
  },
  {
    name: "DAZN Free (select regions)",
    url: "dazn.com",
    icon: "🎯",
    iconBg: "#f5d100",
    desc: "Sports streaming giant. Offers a free tier or free trial in select regions (Germany, Canada, Japan). Streams Champions League and Premier League.",
    tags: ["free", "hd", "manutd", "account"],
    reliability: 4,
    notes: "Check if free tier is available in your country.",
  },
  {
    name: "LiveSoccerTV",
    url: "livesoccertv.com",
    icon: "🔍",
    iconBg: "#2d6a4f",
    desc: "Not a streaming site itself but an official schedule aggregator. Shows where every match is streaming legally (free & paid) worldwide, per country.",
    tags: ["free", "no-signup", "manutd"],
    reliability: 5,
    notes: "Essential tool – shows legal free options per country.",
  },
  {
    name: "SoccerStreams (Reddit Guide)",
    url: "reddit.com/r/soccerstreams",
    icon: "👾",
    iconBg: "#ff4500",
    desc: "Reddit community that compiles links to legally free or grey-area streams before each match. Covers all Man United games extensively.",
    tags: ["free", "no-signup", "manutd", "adblocker"],
    reliability: 3,
    notes: "Community curated. Use ad-blocker and VPN for safety.",
  },
  {
    name: "Cricfree",
    url: "cricfree.sc",
    icon: "🏏",
    iconBg: "#1e3a5f",
    desc: "Multi-sport free streaming site with dedicated football channels. Streams Premier League, FA Cup, and European matches including Man United.",
    tags: ["free", "no-signup", "manutd", "adblocker"],
    reliability: 3,
    notes: "Ad-blocker strongly recommended. Streams may vary.",
  },
  {
    name: "Hesgoal",
    url: "hesgoal.tv",
    icon: "⚡",
    iconBg: "#ff6600",
    desc: "Popular free football streaming aggregator. Provides links to live streams for Premier League and European matches, including Man United.",
    tags: ["free", "no-signup", "manutd", "adblocker"],
    reliability: 3,
    notes: "High traffic site. Use ad-blocker. URL may change.",
  },
  {
    name: "VIPLeague",
    url: "vipleague.lc",
    icon: "🏆",
    iconBg: "#1a472a",
    desc: "Free streaming site covering Premier League, Champions League, Europa League. Consistently provides streams for Man United matches.",
    tags: ["free", "no-signup", "manutd", "adblocker"],
    reliability: 3,
    notes: "Multiple streams per game. Use an ad-blocker.",
  },
  {
    name: "Streameast",
    url: "streameast.live",
    icon: "🌐",
    iconBg: "#0d3b5e",
    desc: "Clean interface free sports streaming site with a wide variety of football matches. Covers Man United games consistently.",
    tags: ["free", "no-signup", "hd", "manutd", "adblocker"],
    reliability: 3,
    notes: "Good HD quality. Ad-blocker recommended.",
  },
  {
    name: "SportSurge",
    url: "sportsurge.net",
    icon: "⚽",
    iconBg: "#2c3e50",
    desc: "Aggregator that links to free football streams. Simple UI listing all live football, including every Manchester United fixture.",
    tags: ["free", "no-signup", "manutd", "adblocker"],
    reliability: 3,
    notes: "Easy to navigate. Check listing before kickoff.",
  },
  {
    name: "Buffstreams",
    url: "buffstreams.app",
    icon: "📶",
    iconBg: "#2e4057",
    desc: "Free sports streaming site covering NFL, NBA, and football. Has a solid track record for Manchester United Premier League streams.",
    tags: ["free", "no-signup", "manutd", "adblocker"],
    reliability: 3,
    notes: "Reliable for Premier League. Use ad-blocker.",
  },
];

/* ── State ───────────────────────────────────────────────────────────────── */
let activeFilter = "all";
let searchQuery  = "";

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function formatDate(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function starsHtml(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function tagHtml(tag) {
  const map = {
    free:      ["tag-free",      "Free"],
    hd:        ["tag-hd",        "HD"],
    "no-signup":["tag-nosignup", "No Sign-up"],
    manutd:    ["tag-manutd",    "Man United"],
    vpn:       ["tag-vpn",       "VPN Needed"],
    adblocker: ["tag-adblocker", "Ad-Blocker"],
    account:   ["tag-account",   "Free Account"],
  };
  const [cls, label] = map[tag] || ["", tag];
  return `<span class="tag ${cls}">${label}</span>`;
}

/* ── Render Match Cards ──────────────────────────────────────────────────── */
function renderMatches() {
  const container = document.getElementById("matchCards");
  container.innerHTML = manUtdMatches.map(m => {
    const statusClass = m.status === "live" ? "status-live" :
                        m.status === "soon" ? "status-soon" : "status-upcoming";
    const statusLabel = m.status === "live" ? "🔴 LIVE" :
                        m.status === "soon" ? "Starting Soon" : "Upcoming";
    return `
      <div class="match-card">
        <div class="match-competition">${m.competition}</div>
        <div class="match-teams">${m.home} <span style="color:var(--muted)">vs</span> ${m.away}</div>
        <div class="match-meta">
          <span class="match-date">📅 ${formatDate(m.date, m.time)}</span>
          <span class="match-status ${statusClass}">${statusLabel}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* ── Render Site Cards ───────────────────────────────────────────────────── */
function renderSites() {
  const container  = document.getElementById("siteCards");
  const noResults  = document.getElementById("noResults");
  const q          = searchQuery.toLowerCase();

  const filtered = streamingSites.filter(site => {
    const matchesSearch = !q ||
      site.name.toLowerCase().includes(q) ||
      site.desc.toLowerCase().includes(q) ||
      site.url.toLowerCase().includes(q) ||
      site.tags.some(t => t.includes(q));

    const matchesFilter =
      activeFilter === "all"       ? true :
      activeFilter === "manutd"    ? site.tags.includes("manutd") :
      activeFilter === "free"      ? site.tags.includes("free") :
      activeFilter === "hd"        ? site.tags.includes("hd") :
      activeFilter === "no-signup" ? site.tags.includes("no-signup") :
      true;

    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = "";
    noResults.style.display = "block";
  } else {
    noResults.style.display = "none";
    container.innerHTML = filtered.map(site => `
      <div class="site-card">
        <div class="site-header">
          <div class="site-icon" style="background:${site.iconBg}">${site.icon}</div>
          <div>
            <div class="site-name">${site.name}</div>
            <div class="site-url">🔗 ${site.url}</div>
          </div>
        </div>
        <div class="site-desc">${site.desc}</div>
        <div class="site-tags">${site.tags.map(tagHtml).join("")}</div>
        <div class="site-footer">
          <div class="reliability">
            <span class="stars">${starsHtml(site.reliability)}</span>
            <span>Reliability</span>
          </div>
          <a
            class="visit-btn"
            href="https://${site.url}"
            target="_blank"
            rel="noopener noreferrer"
            onclick="return confirmVisit(event, '${site.url}')"
          >Visit →</a>
        </div>
      </div>
    `).join("");
  }
}

/* ── Confirm before leaving ──────────────────────────────────────────────── */
function confirmVisit(e, url) {
  const confirmed = confirm(
    `You are about to visit: https://${url}\n\n` +
    "Tip: Use an ad-blocker and consider a VPN for safety.\n\n" +
    "Proceed?"
  );
  if (!confirmed) e.preventDefault();
  return confirmed;
}

/* ── Public: filter & search handlers ───────────────────────────────────── */
function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderSites();
}

function applyFilters() {
  searchQuery = document.getElementById("searchInput").value;
  renderSites();
}

/* ── Init ────────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  renderMatches();
  renderSites();
});

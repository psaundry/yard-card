const CRITERIA = [
  { key: "build", label: "Balance & build", max: 20 },
  { key: "muscle", label: "Muscle & condition", max: 20 },
  { key: "grooming", label: "Grooming", max: 15 },
  { key: "legs", label: "Legs & feet", max: 10 },
  { key: "movement", label: "Movement", max: 10 },
  { key: "demeanour", label: "Demeanour", max: 10 },
  { key: "tack", label: "Tack", max: 5 },
  { key: "strapper", label: "Strapper", max: 10 },
];
const LS = "yardcard.party.v2";
const STORE_KEY = "yardcard.store.v3";
const $ = (s, el=document) => el.querySelector(s);
const view = $("#view");
let CARD = null;
let raceCache = null;
let horseIndex = 0;
let activeRaceNo = null;
let activeParty = null;

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null") || { scores: {} }; }
  catch { return { scores: {} }; }
}
function saveStore(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
function attachmentsFrom(card) {
  const out = {};
  (card.tables || []).forEach(t => {
    out[String(t.raceNumber)] = {
      raceNumber: t.raceNumber, partyId: t.id, team: t.team,
      members: t.members, official: true, leaveSuite: t.leaveSuite
    };
  });
  return out;
}
function boardState() {
  const scores = loadStore().scores || {};
  const atts = attachmentsFrom(CARD);
  const board = (CARD.races || []).map(r => {
    const att = atts[String(r.raceNumber)];
    const rs = scores[String(r.raceNumber)] || {};
    const ranked = Object.values(rs).filter(s => s && s.total != null)
      .sort((a,b) => (b.total||0) - (a.total||0) || (b.tie||0) - (a.tie||0));
    return {
      raceNumber: r.raceNumber, name: r.name, nameForm: r.nameForm,
      distance: r.distance, time: r.time, live: r.live, scratched: r.scratched,
      leaveSuite: att?.leaveSuite, attachment: att,
      winner: ranked[0] || null, ranked: ranked.slice(0,3), scoredCount: ranked.length
    };
  }).sort((a,b) => a.raceNumber - b.raceNumber);
  return { meetingName: CARD.meetingName, venue: CARD.venue, date: CARD.date, attachments: atts, board };
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 1600);
}
function loadParty() { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } }
function saveParty(p) { localStorage.setItem(LS, JSON.stringify(p)); }
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Melbourne" });
}
function groupTag(r) {
  const n = (r.name || "").toUpperCase();
  if (/UNDERWOOD|SIR RUPERT/.test(n)) return "GROUP 1";
  if (/PRELUDE|HOW NOW|NATURALISM/.test(n)) return "FEATURE";
  return r.nameForm || "";
}
async function boot() {
  if (CARD) return CARD;
  CARD = Object.assign({}, window.CARD_META || {}, {
    tables: window.CARD_TABLES || [],
    races: [].concat(window.CARD_RACES_A || [], window.CARD_RACES_B || [])
  });
  return CARD;
}
async function api(path, opts) {
  await boot();
  const method = (opts && opts.method) || "GET";
  let body = {};
  if (opts && opts.body) body = JSON.parse(opts.body);
  if (path === "/api/state") return boardState();
  if (path.startsWith("/api/race/")) {
    const n = Number(path.split("/").pop());
    const race = CARD.races.find(r => r.raceNumber === n);
    if (!race) throw new Error("Race not found");
    const scores = (loadStore().scores || {})[String(n)] || {};
    return { ...race, attachment: attachmentsFrom(CARD)[String(n)], scores };
  }
  if (path === "/api/score" && method === "POST") {
    const marks = body.marks || {};
    const total = ["build","muscle","grooming","legs","movement","demeanour","tack","strapper"]
      .reduce((s,k) => s + Number(marks[k]||0), 0);
    const store = loadStore();
    store.scores = store.scores || {};
    const n = String(body.raceNumber);
    store.scores[n] = store.scores[n] || {};
    store.scores[n][String(body.cloth)] = {
      cloth: body.cloth, name: body.name, marks, note: body.note || "",
      total, tie: Number(marks.muscle||0)+Number(marks.grooming||0), partyId: body.partyId
    };
    saveStore(store);
    return store.scores[n][String(body.cloth)];
  }
  if (path === "/api/host/login") {
    if (String(body.pin||"") !== "mpc19") throw new Error("Wrong PIN");
    return { ok: true };
  }
  if (path === "/api/host/reset") {
    saveStore({ scores: {} });
    return { ok: true };
  }
  throw new Error("Request failed");
}
function navActive(name) {
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === name));
}
function route() {
  const parts = (location.hash.replace("#", "") || "/judge").split("/").filter(Boolean);
  if (parts[0] === "board") return renderBoard();
  if (parts[0] === "host") return renderHost();
  if (parts[0] === "race" && parts[1]) return renderRace(Number(parts[1]));
  return renderJudgeHome();
}
function stepValues(max) {
  if (max <= 5) return [1,2,3,4,5];
  if (max === 10) return [5,6,7,8,9,10];
  if (max === 15) return [9,10,11,12,13,14,15];
  return [12,14,16,18,20];
}
function totalOf(marks) { return CRITERIA.reduce((s,c) => s + (Number(marks?.[c.key]) || 0), 0); }

async function renderJudgeHome() {
  navActive("judge");
  $("#dock")?.remove();
  localStorage.removeItem(LS);
  const state = await api("/api/state");
  view.innerHTML = `
    <section class="hero">
      <div class="kicker">Caulfield · 19 September 2026 · Skyline Suites</div>
      <h1>Best presented in the yard</h1>
      <p>All ten tables. Tap This is us on your race. Scores stay on this phone.</p>
    </section>
    <div class="card">
      <h2>Allocated tables</h2>
      <div id="races"></div>
    </div>`;
  $("#races").innerHTML = state.board.map(r => {
    const att = r.attachment;
    const g1 = groupTag(r) === "GROUP 1" ? " g1" : "";
    return `<div class="race">
      <div class="rn${g1}">${r.raceNumber}</div>
      <div class="meta">
        <div class="kicker">${groupTag(r)} · out ${r.leaveSuite || ""}</div>
        <b>${r.name}</b>
        <div class="who">${(att?.members || []).join(" · ")}</div>
      </div>
      <button class="btn soil" data-claim="${att?.partyId || ""}">This is us</button>
    </div>`;
  }).join("");
  document.querySelectorAll("[data-claim]").forEach(btn => {
    btn.onclick = () => {
      const att = Object.values(state.attachments).find(a => a.partyId === btn.dataset.claim);
      if (!att) return;
      saveParty({ id: att.partyId, team: att.team, members: att.members });
      location.hash = "#/race/" + att.raceNumber;
    };
  });
}

async function renderRace(n) {
  navActive("judge");
  activeParty = loadParty();
  raceCache = await api("/api/race/" + n);
  const live = raceCache.horses.filter(h => !h.scratched);
  live.forEach(h => {
    const existing = raceCache.scores[String(h.cloth)];
    h.marks = existing ? { ...existing.marks } : {};
    h.note = existing?.note || "";
  });
  raceCache.live = live;
  if (activeRaceNo !== n) { horseIndex = 0; activeRaceNo = n; }
  horseIndex = Math.min(horseIndex, Math.max(live.length - 1, 0));
  paintHorse();
}

function goHorse(delta) {
  horseIndex = Math.max(0, Math.min(raceCache.live.length - 1, horseIndex + delta));
  paintHorse();
}

function paintHorse() {
  const race = raceCache;
  const live = race.live;
  const h = live[horseIndex];
  if (!h) return;
  const scr = race.horses.filter(x => x.scratched);
  view.innerHTML = `
    <section class="hero">
      <div class="kicker">${groupTag(race)} · ${fmtTime(race.time)} · ${race.distance} · ${live.length} to judge</div>
      <h1>R${race.raceNumber} ${race.name}</h1>
      <p>Present as they walk to the start. ${(race.attachment?.members || []).join(" · ")}</p>
    </section>
    <div class="yard">
      <div class="progress">
        ${live.map((x,i) => `<button class="${i===horseIndex?"on":""} ${totalOf(x.marks)? "done":""}" data-i="${i}">${x.cloth}</button>`).join("")}
      </div>
      <div class="horse-pane" id="pane"></div>
      ${scr.length ? `<div class="muted" style="padding:0 6px">Scratched · ${scr.map(x => x.cloth + " " + x.name).join(" · ")}</div>` : ""}
      <button class="btn ghost" style="width:100%" id="back">Back to tables</button>
    </div>`;
  document.querySelectorAll(".progress [data-i]").forEach(b => b.onclick = () => { horseIndex = Number(b.dataset.i); paintHorse(); });
  $("#back").onclick = () => { location.hash = "#/judge"; };
  mountPane(h);
  mountDock();
}

function mountPane(h) {
  const pane = $("#pane");
  pane.innerHTML = `
    <div class="hd">
      <div style="display:flex;gap:12px">
        <div class="cloth">${h.cloth}</div>
        <div>
          <b style="font-size:22px">${h.name}</b>
          <div class="muted">J ${h.jockey || "—"}</div>
          <div class="muted">T ${h.trainer || "—"} · box ${h.barrier ?? "—"} · ${h.weight || ""}</div>
        </div>
      </div>
      <div class="total-pill"><b id="htot">${totalOf(h.marks)}</b><span>/ 100</span></div>
    </div>
    ${CRITERIA.map(c => `
      <div class="crit">
        <div class="lab"><span>${c.label}</span><span>/${c.max}</span></div>
        <div class="scores" data-key="${c.key}">
          ${stepValues(c.max).map(v => `<button data-v="${v}" class="${Number(h.marks[c.key])===v?"on":""}">${v}</button>`).join("")}
        </div>
      </div>`).join("")}`;
  pane.querySelectorAll(".scores button").forEach(b => {
    b.onclick = () => {
      const key = b.parentElement.dataset.key;
      h.marks[key] = Number(b.dataset.v);
      b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      $("#htot").textContent = totalOf(h.marks);
      persist(h);
      mountDock();
    };
  });
}

async function persist(h) {
  try {
    await api("/api/score", { method: "POST", body: JSON.stringify({
      raceNumber: raceCache.raceNumber, partyId: activeParty?.id, cloth: h.cloth, name: h.name, marks: h.marks, note: h.note || ""
    })});
  } catch (e) { toast(e.message || "Save failed"); }
}

function mountDock() {
  let dock = $("#dock");
  if (!dock) { dock = document.createElement("div"); dock.className = "dock"; dock.id = "dock"; document.body.appendChild(dock); }
  const live = raceCache.live;
  const ranked = live.filter(h => totalOf(h.marks) > 0).sort((a,b) => totalOf(b.marks) - totalOf(a.marks));
  const lead = ranked[0];
  const last = horseIndex >= live.length - 1;
  dock.innerHTML = `
    <button class="btn ghost" id="prev" style="color:#f4ead3;border-color:#6d5c4a">Prev</button>
    <div class="lead">${lead ? lead.cloth + " " + lead.name + " · " + totalOf(lead.marks) : ranked.length + " / " + live.length + " scored"}</div>
    <button class="btn gold" id="save" style="margin:0;width:auto">${last ? "Save" : "Next"}</button>`;
  $("#prev").onclick = () => goHorse(-1);
  $("#save").onclick = () => {
    const h = live[horseIndex];
    persist(h);
    toast(h.name + " · " + totalOf(h.marks));
    if (horseIndex < live.length - 1) goHorse(1);
  };
}

async function renderBoard() {
  navActive("board");
  $("#dock")?.remove();
  const state = await api("/api/state");
  view.innerHTML = `
    <section class="hero">
      <div class="kicker">Skyline Suites · live</div>
      <h1>Best presented</h1>
      <p>${state.meetingName}. Winners lock as each table finishes in the yard.</p>
    </section>
    <div class="board-grid">
      ${state.board.map(r => {
        const w = r.winner;
        return `<div class="brow ${w ? "hot" : ""}">
          <div class="r">${r.raceNumber}</div>
          <div>
            <b>${r.name}</b>
            <div class="muted">${w ? w.cloth + " " + w.name : "Still in the yard"} · ${fmtTime(r.time)}</div>
          </div>
          <div style="font-family:'Instrument Serif',Georgia,serif;font-size:30px;text-align:right">${w ? w.total : "—"}</div>
        </div>`;
      }).join("")}
    </div>`;
}

async function renderHost() {
  navActive("host");
  $("#dock")?.remove();
  if (sessionStorage.getItem("yard.host") !== "1") {
    view.innerHTML = `
      <section class="hero"><div class="kicker">Coordinator</div><h1>Host desk</h1><p>See which tables have left and which races have a winner.</p></section>
      <div class="card"><input id="pin" type="password" placeholder="Host PIN" /><button class="btn gold" id="login">Unlock</button></div>`;
    $("#login").onclick = async () => {
      try { await api("/api/host/login", { method:"POST", body: JSON.stringify({ pin: $("#pin").value }) }); sessionStorage.setItem("yard.host","1"); renderHost(); }
      catch(e) { toast(e.message); }
    };
    return;
  }
  const state = await api("/api/state");
  view.innerHTML = `
    <section class="hero"><div class="kicker">Host</div><h1>Tables and winners</h1><p>Leave-suite times are T-20. Present before they jump.</p></section>
    <div class="card">
      ${state.board.map(r => `
        <div class="race">
          <div class="rn${groupTag(r)==="GROUP 1"?" g1":""}">${r.raceNumber}</div>
          <div class="meta">
            <div class="kicker">leave ${r.leaveSuite || ""} · ${r.live} live / ${r.scratched} scr</div>
            <b>${r.name}</b>
            <div class="who">${(r.attachment?.members || []).join(" · ") || "No table"}</div>
          </div>
          <div>${r.winner ? `<span class="chip">${r.winner.cloth} ${r.winner.name} ${r.winner.total}</span>` : `<span class="muted">${r.scoredCount} scored</span>`}</div>
        </div>`).join("")}
    </div>`;
}

window.addEventListener("hashchange", route);
route();
setInterval(() => {
  if (/board|host/.test(location.hash)) route();
}, 8000);

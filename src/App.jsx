import { useState, useEffect, useRef } from "react";

// ─── Firebase ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyD-F1SW-pGMUGTr0eHud5lRUXaq0FqPMhU",
  authDomain: "bushwood-51c18.firebaseapp.com",
  databaseURL: "https://bushwood-51c18-default-rtdb.firebaseio.com",
  projectId: "bushwood-51c18",
  storageBucket: "bushwood-51c18.firebasestorage.app",
  messagingSenderId: "848406161785",
  appId: "1:848406161785:web:63f5327a7f9c1f6dc527a8",
  measurementId: "G-DF6BSH9WEJ"
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

let firebaseDB = null;
async function initFirebase() {
  if (firebaseDB) return firebaseDB;
  await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js");
  const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
  firebaseDB = window.firebase.database(app);
  return firebaseDB;
}

// ─── Static schedule skeleton ─────────────────────────────────────────────────
const DEFAULT_TEAMS = [
  { id: "A", name: "Group A", captain: "Hank", color: "#c8a84b" },
  { id: "B", name: "Group B", captain: "Tom",  color: "#4a90d9" },
  { id: "C", name: "Group C", captain: "DJ",   color: "#e05c5c" },
];

const SCHEDULE = [
  {
    day: 1, label: "Thursday", course: "TPC Myrtle Beach", tee: "White tee · 1:30 first tee · Singles go first",
    matchups: [
      { id: "d1m1", label: "Matchup 1", groupA: "A", groupB: "B" },
      { id: "d1m2", label: "Matchup 2", groupA: "B", groupB: "C" },
      { id: "d1m3", label: "Matchup 3", groupA: "C", groupB: "A" },
    ],
  },
  {
    day: 2, label: "Friday", course: "Caledonia Golf & Fish Club", tee: "Mallard · 12:39 first tee · Singles go first",
    matchups: [
      { id: "d2m1", label: "Matchup 1", groupA: "A", groupB: "C" },
      { id: "d2m2", label: "Matchup 2", groupA: "B", groupB: "A" },
      { id: "d2m3", label: "Matchup 3", groupA: "C", groupB: "B" },
    ],
  },
  {
    day: 3, label: "Saturday", course: "True Blue Golf Club", tee: "White · 12:39 first tee · Singles go last",
    matchups: [
      { id: "d3m1", label: "Matchup 1", groupA: "A", groupB: "C" },
      { id: "d3m2", label: "Matchup 2", groupA: "B", groupB: "A" },
      { id: "d3m3", label: "Matchup 3", groupA: "C", groupB: "B" },
    ],
  },
];

const ALL_MATCHUPS = SCHEDULE.flatMap(d => d.matchups);
const initialHoles    = Object.fromEntries(ALL_MATCHUPS.map(m => [m.id, {}]));
// pairings[matchupId] = { namesA: ["",""], namesB: ["",""] }
const initialPairings = Object.fromEntries(ALL_MATCHUPS.map(m => [m.id, { namesA: ["", ""], namesB: ["", ""] }]));

// ─── Scoring helpers ──────────────────────────────────────────────────────────
function getNineResults(holes) {
  function winner(hs) {
    let a = 0, b = 0;
    hs.forEach(h => { if (holes[h] === "A") a++; else if (holes[h] === "B") b++; });
    if (hs.filter(h => holes[h]).length < 9) return null;
    return a > b ? "A" : b > a ? "B" : "H";
  }
  return { front: winner([1,2,3,4,5,6,7,8,9]), back: winner([10,11,12,13,14,15,16,17,18]) };
}

function calcMatchPts(holes) {
  const { front, back } = getNineResults(holes);
  let pA = 0, pB = 0;
  [front, back].forEach(w => {
    if (w === "A") pA++; else if (w === "B") pB++; else if (w === "H") { pA += 0.5; pB += 0.5; }
  });
  return { pA, pB };
}

function calcStandings(holesAll) {
  const pts = { A: 0, B: 0, C: 0 };
  ALL_MATCHUPS.forEach(m => {
    const { pA, pB } = calcMatchPts(holesAll[m.id] || {});
    pts[m.groupA] += pA;
    pts[m.groupB] += pB;
  });
  return pts;
}

function getTeamById(teams, id) { return teams.find(t => t.id === id); }

// ─── Input style ──────────────────────────────────────────────────────────────
const inputStyle = (color) => ({
  background: "#0a1a0f",
  border: `1px solid ${color}50`,
  borderRadius: 7,
  color: "#f0f9f4",
  fontSize: 13,
  padding: "7px 10px",
  outline: "none",
  fontFamily: "Georgia, serif",
  width: "100%",
  boxSizing: "border-box",
});

// ─── Hole Grid ────────────────────────────────────────────────────────────────
function HoleGrid({ matchupId, holes, onScore, tA, tB }) {
  const { front, back } = getNineResults(holes);

  function NineLabel({ winner }) {
    if (!winner) return <span style={{ fontSize: 10, color: "#374a3c" }}>In progress</span>;
    if (winner === "H") return <span style={{ fontSize: 10, color: "#facc15", fontWeight: 700 }}>Halved · ½pt each</span>;
    const t = winner === "A" ? tA : tB;
    return <span style={{ fontSize: 10, color: t.color, fontWeight: 700 }}>{t.name} wins · 1pt</span>;
  }

  return (
    <div>
      {[[1,2,3,4,5,6,7,8,9],[10,11,12,13,14,15,16,17,18]].map((sideHoles, si) => {
        const winner = si === 0 ? front : back;
        return (
          <div key={si} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#6b9f7e", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {si === 0 ? "Front 9" : "Back 9"}
              </span>
              <NineLabel winner={winner} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 3 }}>
              {sideHoles.map(h => {
                const r = holes[h];
                return (
                  <div key={h} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#4a6a54", marginBottom: 2 }}>{h}</div>
                    {["A","H","B"].map(res => {
                      const active = r === res;
                      const bg = active ? (res === "A" ? tA.color : res === "B" ? tB.color : "#92400e") : "#0a1a0f";
                      return (
                        <button key={res} onClick={() => onScore(matchupId, h, res)}
                          style={{ display: "block", width: "100%", marginBottom: 2, background: bg, border: `1px solid ${active ? bg : "#1e3a24"}`, borderRadius: 3, color: active ? "#fff" : "#374a3c", fontSize: 9, padding: "3px 0", cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                          {res === "A" ? tA.id : res === "B" ? tB.id : "H"}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 11, color: "#6b9f7e", paddingTop: 8, borderTop: "1px solid #1e3a24" }}>
        <span><span style={{ color: tA.color }}>■</span> A = {tA.name}</span>
        <span><span style={{ color: "#92400e" }}>■</span> H = Halved</span>
        <span><span style={{ color: tB.color }}>■</span> B = {tB.name}</span>
      </div>
    </div>
  );
}

// ─── Matchup Card ─────────────────────────────────────────────────────────────
function MatchupCard({ matchup, holes, pairings, teams, onScore, onPairingChange }) {
  const [open, setOpen] = useState(false);
  const tA = getTeamById(teams, matchup.groupA);
  const tB = getTeamById(teams, matchup.groupB);
  const h = holes[matchup.id] || {};
  const { front, back } = getNineResults(h);
  const { pA, pB } = calcMatchPts(h);
  const pair = pairings[matchup.id] || { namesA: ["",""], namesB: ["",""] };
  const namesA = pair.namesA || ["",""];
  const namesB = pair.namesB || ["",""];
  const played = Object.keys(h).length;

  const labelA = namesA.filter(Boolean).join(" & ") || tA.name;
  const labelB = namesB.filter(Boolean).join(" & ") || tB.name;

  function chip(w) {
    if (!w) return <span style={{ color: "#2d4a35", fontSize: 11 }}>—</span>;
    if (w === "H") return <span style={{ color: "#facc15", fontSize: 11, fontWeight: 700 }}>½</span>;
    return <span style={{ color: (w === "A" ? tA : tB).color, fontSize: 11, fontWeight: 700 }}>1</span>;
  }

  function updateName(side, idx, val) {
    const key = side === "A" ? "namesA" : "namesB";
    const cur = [...(side === "A" ? namesA : namesB)];
    cur[idx] = val;
    onPairingChange(matchup.id, key, cur);
  }

  return (
    <div style={{ background: "#111f14", border: "1px solid #1e3a24", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
      {/* Header row */}
      <div onClick={() => setOpen(o => !o)} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#4a6a54", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>{matchup.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: tA.color, fontWeight: 700, fontSize: 15 }}>{labelA}</span>
            <span style={{ color: "#2d4a35", fontSize: 12 }}>vs</span>
            <span style={{ color: tB.color, fontWeight: 700, fontSize: 15 }}>{labelB}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", marginRight: 6 }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 10, color: "#4a6a54" }}>F9</span>{chip(front)}
            <span style={{ fontSize: 10, color: "#4a6a54" }}>B9</span>{chip(back)}
          </div>
          <div style={{ fontSize: 11, color: "#4a6a54" }}>{played}/18</div>
        </div>
        <span style={{ color: "#2d4a35", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <>
          {/* Player name inputs */}
          <div style={{ padding: "14px 16px", background: "#0d1a0f", borderTop: "1px solid #1e3a24" }}>
            <div style={{ fontSize: 11, color: "#4ade80", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>Players</div>
            <div style={{ display: "flex", gap: 12 }}>
              {[{ t: tA, side: "A", names: namesA }, { t: tB, side: "B", names: namesB }].map(({ t, side, names }) => (
                <div key={side} style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.name}</div>
                  {[0, 1].map(idx => (
                    <input
                      key={idx}
                      value={names[idx] || ""}
                      placeholder={`Player ${idx + 1}`}
                      onChange={e => updateName(side, idx, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{ ...inputStyle(t.color), marginBottom: 6 }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Points row */}
          <div style={{ display: "flex", borderTop: "1px solid #1e3a24", borderBottom: "1px solid #1e3a24" }}>
            {[{ t: tA, pts: pA, opp: pB, label: labelA }, { t: tB, pts: pB, opp: pA, label: labelB }].map(({ t, pts, opp, label }, i) => (
              <div key={t.id} style={{ flex: 1, padding: "10px 16px", textAlign: i === 0 ? "left" : "right", borderLeft: i === 1 ? "1px solid #1e3a24" : "none" }}>
                <div style={{ fontSize: 10, color: t.color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: pts > opp ? t.color : pts === opp && pts > 0 ? "#facc15" : "#f0f9f4", lineHeight: 1 }}>{pts}</div>
                <div style={{ fontSize: 10, color: "#4a6a54" }}>pts</div>
              </div>
            ))}
          </div>

          {/* Hole grid */}
          <div style={{ padding: "14px 10px 14px" }}>
            <HoleGrid matchupId={matchup.id} holes={h} onScore={onScore} tA={tA} tB={tB} />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Standings ────────────────────────────────────────────────────────────────
function Standings({ holesAll, teams }) {
  const pts = calcStandings(holesAll);
  const sorted = [...teams].map(t => ({ ...t, pts: pts[t.id] })).sort((a, b) => b.pts - a.pts);
  const maxPts = 18;
  const anyPts = sorted.some(t => t.pts > 0);

  return (
    <div style={{ background: "#0d1f11", borderBottom: "1px solid #1e3a24", padding: "16px 20px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#4ade80", textTransform: "uppercase", marginBottom: 12 }}>Championship Standings</div>
      {sorted.map((t, i) => (
        <div key={t.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: t.color, fontSize: 14, fontWeight: 700 }}>
              {i === 0 && anyPts ? "🏆 " : `${i+1}. `}{t.name}
              <span style={{ color: "#4a6a54", fontSize: 12, fontWeight: 400 }}> ({t.captain})</span>
            </span>
            <span style={{ color: "#c8e6d2", fontSize: 14, fontWeight: 700 }}>{t.pts} <span style={{ color: "#4a6a54", fontSize: 11, fontWeight: 400 }}>/ {maxPts}</span></span>
          </div>
          <div style={{ height: 6, background: "#1e3a24", borderRadius: 4 }}>
            <div style={{ height: 6, background: t.color, borderRadius: 4, width: `${(t.pts / maxPts) * 100}%`, transition: "width 0.4s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Group Name Editor ────────────────────────────────────────────────────────
function GroupNameEditor({ teams, onChange }) {
  return (
    <div style={{ background: "#0d1f11", borderBottom: "1px solid #1e3a24", padding: "14px 20px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#4ade80", textTransform: "uppercase", marginBottom: 12 }}>Team Names</div>
      <div style={{ display: "flex", gap: 10 }}>
        {teams.map(t => (
          <div key={t.id} style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: t.color, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>Group {t.id}</div>
            <input
              value={t.name}
              onChange={e => onChange(t.id, "name", e.target.value)}
              style={{ ...inputStyle(t.color), fontSize: 13, fontWeight: 700 }}
            />
            <input
              value={t.captain}
              placeholder="Captain"
              onChange={e => onChange(t.id, "captain", e.target.value)}
              style={{ ...inputStyle(t.color), fontSize: 12, marginTop: 5, color: "#6b9f7e" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [holes, setHoles]       = useState(initialHoles);
  const [pairings, setPairings] = useState(initialPairings);
  const [teams, setTeams]       = useState(DEFAULT_TEAMS);
  const [activeDay, setActiveDay] = useState(0);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const dbReady = useRef(false);

  useEffect(() => {
    initFirebase().then(db => {
      dbReady.current = true;
      setConnected(true);

      db.ref("holes").on("value", snap => {
        const val = snap.val();
        if (val) setHoles(prev => ({ ...initialHoles, ...val }));
      });
      db.ref("pairings").on("value", snap => {
        const val = snap.val();
        if (val) setPairings(prev => ({ ...initialPairings, ...val }));
      });
      db.ref("teams").on("value", snap => {
        const val = snap.val();
        if (val) setTeams(DEFAULT_TEAMS.map(dt => ({ ...dt, ...(val[dt.id] || {}) })));
      });
    }).catch(err => console.error("Firebase init failed", err));
  }, []);

  async function handleScore(matchupId, hole, result) {
    setHoles(prev => {
      const cur = { ...prev[matchupId] };
      if (cur[hole] === result) delete cur[hole]; else cur[hole] = result;
      return { ...prev, [matchupId]: cur };
    });
    if (!dbReady.current) return;
    setSyncing(true);
    try {
      const db = await initFirebase();
      const cur = (await db.ref(`holes/${matchupId}/${hole}`).get()).val();
      if (cur === result) await db.ref(`holes/${matchupId}/${hole}`).remove();
      else await db.ref(`holes/${matchupId}/${hole}`).set(result);
    } catch(e) { console.error(e); }
    setSyncing(false);
  }

  async function handlePairingChange(matchupId, key, val) {
    setPairings(prev => ({ ...prev, [matchupId]: { ...prev[matchupId], [key]: val } }));
    if (!dbReady.current) return;
    try {
      const db = await initFirebase();
      await db.ref(`pairings/${matchupId}/${key}`).set(val);
    } catch(e) { console.error(e); }
  }

  async function handleTeamChange(teamId, field, val) {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, [field]: val } : t));
    if (!dbReady.current) return;
    try {
      const db = await initFirebase();
      await db.ref(`teams/${teamId}/${field}`).set(val);
    } catch(e) { console.error(e); }
  }

  const day = SCHEDULE[activeDay];

  return (
    <div style={{ minHeight: "100vh", background: "#0a1a0f", fontFamily: "'Playfair Display', Georgia, serif" }}>
      {/* Header */}
      <div style={{ background: "#0d1f11", borderBottom: "1px solid #1e3a24", padding: "14px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#4ade80", textTransform: "uppercase" }}>Pawleys Island · 2025</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f0f9f4" }}>Bushwood Cup</div>
          <div style={{ fontSize: 12, color: "#6b9f7e", fontStyle: "italic", fontFamily: "Georgia, serif" }}>Match Play · 1 pt per 9 holes</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#4ade80" : "#e05c5c", boxShadow: connected ? "0 0 6px #4ade80" : "none" }} />
            <span style={{ fontSize: 11, color: connected ? "#4ade80" : "#e05c5c" }}>
              {syncing ? "Saving…" : connected ? "Live" : "Connecting…"}
            </span>
          </div>
          <button onClick={() => setShowEdit(e => !e)}
            style={{ background: "transparent", border: "1px solid #1e3a24", borderRadius: 7, color: "#6b9f7e", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "Georgia, serif" }}>
            {showEdit ? "Done" : "✏ Edit Teams"}
          </button>
        </div>
      </div>

      {showEdit && <GroupNameEditor teams={teams} onChange={handleTeamChange} />}
      <Standings holesAll={holes} teams={teams} />

      {/* Day Tabs */}
      <div style={{ display: "flex", background: "#0d1f11", borderBottom: "1px solid #1e3a24" }}>
        {SCHEDULE.map((d, i) => (
          <button key={i} onClick={() => setActiveDay(i)}
            style={{ flex: 1, background: "transparent", border: "none", borderBottom: activeDay === i ? "2px solid #4ade80" : "2px solid transparent", color: activeDay === i ? "#f0f9f4" : "#4a6a54", padding: "10px 4px", cursor: "pointer", fontFamily: "'Playfair Display', serif" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{d.label}</div>
            <div style={{ fontSize: 10, color: "#6b9f7e" }}>Day {d.day}</div>
          </button>
        ))}
      </div>

      {/* Day content */}
      <div style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#4ade80", letterSpacing: "0.2em", textTransform: "uppercase" }}>{day.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f0f9f4" }}>{day.course}</div>
          <div style={{ fontSize: 12, color: "#6b9f7e", fontStyle: "italic", fontFamily: "Georgia, serif", marginTop: 2 }}>{day.tee}</div>
        </div>
        {day.matchups.map(m => (
          <MatchupCard
            key={m.id}
            matchup={m}
            holes={holes}
            pairings={pairings}
            teams={teams}
            onScore={handleScore}
            onPairingChange={handlePairingChange}
          />
        ))}
      </div>
    </div>
  );
}

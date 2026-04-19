import { useState, useEffect, useRef } from "react";

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

const DEFAULT_TEAMS = [
{ id: "A", name: "Group A", captain: "Hank", color: "#c8a84b" },
{ id: "B", name: "Group B", captain: "Tom", color: "#4a90d9" },
{ id: "C", name: "Group C", captain: "DJ", color: "#e05c5c" },
];

const SCHEDULE = [
{
day: 1, label: "Thursday", course: "TPC Myrtle Beach",
tee: "White tee · 1:30 first tee · Singles go first",
nines: [[1,2,3,4,5,6,7,8,9],[10,11,12,13,14,15,16,17,18]],
nineLabels: ["Front 9","Back 9"],
teamMatchups: [
{ id: "d1m1", label: "Matchup 1", groupA: "A", groupB: "B" },
{ id: "d1m2", label: "Matchup 2", groupA: "B", groupB: "C" },
{ id: "d1m3", label: "Matchup 3", groupA: "C", groupB: "A" },
],
singlesId: "d1s",
},
{
day: 2, label: "Friday", course: "Caledonia Golf & Fish Club",
tee: "Mallard · 12:39 first tee · Singles go first",
nines: [[1,2,3,4,5,6,7,8,9],[10,11,12,13,14,15,16,17,18],[19,20,21,22,23,24,25,26,27]],
nineLabels: ["Front 9","Middle 9","Back 9"],
teamMatchups: [
{ id: "d2m1", label: "Matchup 1", groupA: "A", groupB: "C" },
{ id: "d2m2", label: "Matchup 2", groupA: "B", groupB: "A" },
{ id: "d2m3", label: "Matchup 3", groupA: "C", groupB: "B" },
],
singlesId: "d2s",
},
{
day: 3, label: "Saturday", course: "True Blue Golf Club",
tee: "White · 12:39 first tee · Singles go last",
nines: [[1,2,3,4,5,6,7,8,9],[10,11,12,13,14,15,16,17,18]],
nineLabels: ["Front 9","Back 9"],
teamMatchups: [
{ id: "d3m1", label: "Matchup 1", groupA: "A", groupB: "C" },
{ id: "d3m2", label: "Matchup 2", groupA: "B", groupB: "A" },
{ id: "d3m3", label: "Matchup 3", groupA: "C", groupB: "B" },
],
singlesId: "d3s",
},
];

const ALL_TEAM_MATCHUP_IDS = SCHEDULE.flatMap(d => d.teamMatchups.map(m => m.id));
const ALL_SINGLES_IDS = SCHEDULE.map(d => d.singlesId);
const initialTeamHoles = Object.fromEntries(ALL_TEAM_MATCHUP_IDS.map(id => [id, {}]));
const initialSinglesHoles = Object.fromEntries(ALL_SINGLES_IDS.map(id => [id, {}]));
const initialTeamPairings = Object.fromEntries(ALL_TEAM_MATCHUP_IDS.map(id => [id, { namesA: ["",""], namesB: ["",""] }]));
const initialSinglesPairings = Object.fromEntries(ALL_SINGLES_IDS.map(id => [id, { nameA: "", nameB: "", nameC: "" }]));

function getTeamById(teams, id) { return teams.find(t => t.id === id); }

// ─── Scoring helpers ──────────────────────────────────────────────────────────
function calcHoleDots(scores) {
const entries = Object.entries(scores).filter(([, v]) => v !== null && v !== undefined && v !== "");
if (entries.length < 3) return null;
const [sA, sB, sC] = [Number(scores.A), Number(scores.B), Number(scores.C)];
if (isNaN(sA) || isNaN(sB) || isNaN(sC)) return null;
const sorted = [{ id:"A",s:sA },{ id:"B",s:sB },{ id:"C",s:sC }].sort((x,y) => x.s - y.s);
const dots = { A:0, B:0, C:0 };
if (sorted[0].s === sorted[1].s && sorted[1].s === sorted[2].s) {
dots.A = 2; dots.B = 2; dots.C = 2;
} else if (sorted[0].s === sorted[1].s) {
dots[sorted[0].id] = 3; dots[sorted[1].id] = 3; dots[sorted[2].id] = 0;
} else if (sorted[1].s === sorted[2].s) {
dots[sorted[0].id] = 4; dots[sorted[1].id] = 1; dots[sorted[2].id] = 1;
} else {
dots[sorted[0].id] = 4; dots[sorted[1].id] = 2; dots[sorted[2].id] = 0;
}
return dots;
}

function calcSinglesTotal(singlesHoles, nines) {
const total = { A:0, B:0, C:0 };
nines.flat().forEach(h => {
const hData = singlesHoles[h] || singlesHoles[String(h)];
if (!hData) return;
const dots = calcHoleDots(hData);
if (dots) { total.A += dots.A; total.B += dots.B; total.C += dots.C; }
});
return total;
}

// Returns dots per nine: { A, B, C } for a single nine
function calcNineDots(singlesHoles, nineHoles) {
const nine = { A:0, B:0, C:0 };
nineHoles.forEach(h => {
const hData = singlesHoles[h] || singlesHoles[String(h)];
if (!hData) return;
const dots = calcHoleDots(hData);
if (dots) { nine.A += dots.A; nine.B += dots.B; nine.C += dots.C; }
});
return nine;
}

// Match play points per nine: 2-1-0 based on dots earned, ties split (1.5 each)
// Returns { A, B, C } match play pts for that nine (null if nine not complete)
function calcNineMatchPlayPts(singlesHoles, nineHoles) {
// Only award once all 9 holes have scores for all 3 players
const complete = nineHoles.every(h => {
const hData = singlesHoles[h] || singlesHoles[String(h)];
return hData && calcHoleDots(hData) !== null;
});
if (!complete) return null;

const nine = calcNineDots(singlesHoles, nineHoles);
const sorted = [{ id:"A", d:nine.A }, { id:"B", d:nine.B }, { id:"C", d:nine.C }]
.sort((x, y) => y.d - x.d);
const pts = { A:0, B:0, C:0 };

if (sorted[0].d === sorted[1].d && sorted[1].d === sorted[2].d) {
// 3-way tie → 1 each (2+1+0 / 3 ≈ 1)
pts.A = 1; pts.B = 1; pts.C = 1;
} else if (sorted[0].d === sorted[1].d) {
// Tie for 1st → 1.5, 1.5, 0
pts[sorted[0].id] = 1.5; pts[sorted[1].id] = 1.5; pts[sorted[2].id] = 0;
} else if (sorted[1].d === sorted[2].d) {
// Tie for 2nd → 2, 0.5, 0.5
pts[sorted[0].id] = 2; pts[sorted[1].id] = 0.5; pts[sorted[2].id] = 0.5;
} else {
pts[sorted[0].id] = 2; pts[sorted[1].id] = 1; pts[sorted[2].id] = 0;
}
return pts;
}

// Total singles match play pts across all nines
function calcSinglesMatchPlayTotal(singlesHoles, nines) {
const total = { A:0, B:0, C:0 };
nines.forEach(nine => {
const pts = calcNineMatchPlayPts(singlesHoles, nine);
if (pts) { total.A += pts.A; total.B += pts.B; total.C += pts.C; }
});
return total;
}

function getNineResult(holes, nineHoles) {
let a = 0, b = 0;
nineHoles.forEach(h => {
const v = holes[h] || holes[String(h)];
if (v === "A") a++; else if (v === "B") b++;
});
const played = nineHoles.filter(h => holes[h] || holes[String(h)]).length;
if (played < 9) return null;
return a > b ? "A" : b > a ? "B" : "H";
}

function calcTeamMatchPts(holes, nines) {
let pA = 0, pB = 0;
nines.forEach(nine => {
const w = getNineResult(holes, nine);
if (w === "A") pA++; else if (w === "B") pB++; else if (w === "H") { pA += 0.5; pB += 0.5; }
});
return { pA, pB };
}

// ─── Match play live status (current standing through holes played) ────────────
// Returns { leader: 'A'|'B'|null, up: number, holesPlayed, holesRemaining, dormie, over, overText }
function getMatchPlayStatus(holes, nines) {
const allHoles = nines.flat();
const total = allHoles.length;
let winsA = 0, winsB = 0;
let lastPlayedIdx = -1;

allHoles.forEach((h, i) => {
const v = holes[h] || holes[String(h)];
if (v === "A") { winsA++; lastPlayedIdx = i; }
else if (v === "B") { winsB++; lastPlayedIdx = i; }
else if (v === "H") { lastPlayedIdx = i; }
});

const holesPlayed = lastPlayedIdx + 1;
const holesRemaining = total - holesPlayed;
const diff = winsA - winsB;
const up = Math.abs(diff);
const leader = diff > 0 ? "A" : diff < 0 ? "B" : null;

// Match over if leader's lead > holes remaining
const over = leader && up > holesRemaining;
// Dormie = lead equals holes remaining
const dormie = leader && up === holesRemaining && holesRemaining > 0;

let statusText = "";
if (holesPlayed === 0) {
statusText = "Not started";
} else if (over) {
statusText = `${up}&${holesRemaining}`;
} else if (holesPlayed === total) {
if (!leader) statusText = "All Square";
else statusText = `${up} UP`;
} else if (dormie) {
statusText = `Dormie ${up}`;
} else if (!leader) {
statusText = `All Square`;
} else {
statusText = `${up} UP`;
}

return { leader, up, holesPlayed, holesRemaining, dormie, over, statusText, total };
}

function calcStandings(teamHolesAll, singlesHolesAll) {
const matchPts = { A:0, B:0, C:0 };
const dots = { A:0, B:0, C:0 };
SCHEDULE.forEach(d => {
d.teamMatchups.forEach(m => {
const h = teamHolesAll[m.id] || {};
const { pA, pB } = calcTeamMatchPts(h, d.nines);
matchPts[m.groupA] += pA; matchPts[m.groupB] += pB;
});
const sh = singlesHolesAll[d.singlesId] || {};
const sd = calcSinglesTotal(sh, d.nines);
dots.A += sd.A; dots.B += sd.B; dots.C += sd.C;
// Singles nine match play pts count toward team championship
const smp = calcSinglesMatchPlayTotal(sh, d.nines);
matchPts.A += smp.A; matchPts.B += smp.B; matchPts.C += smp.C;
});
return { matchPts, dots };
}

const inputStyle = (color) => ({
background: "#0a1a0f", border: `1px solid ${color}50`, borderRadius: 7,
color: "#f0f9f4", fontSize: 13, padding: "7px 10px", outline: "none",
fontFamily: "Georgia, serif", width: "100%", boxSizing: "border-box",
});

// ─── Live status badge ────────────────────────────────────────────────────────
function StatusBadge({ status, tA, tB }) {
const { leader, statusText, over, dormie, holesPlayed } = status;
if (holesPlayed === 0) return <span style={{ fontSize:14, color:"#374a3c" }}>Not started</span>;
const color = over ? (leader === "A" ? tA.color : tB.color)
: dormie ? "#facc15"
: leader ? (leader === "A" ? tA.color : tB.color)
: "#6b9f7e";
const prefix = over ? "✓ " : dormie ? "⚑ " : "";
const teamLabel = leader ? `${leader === "A" ? tA.name : tB.name} ` : "";
return (
<span style={{ fontSize:14, color, fontWeight: over||dormie ? 700 : 500 }}>
{prefix}{teamLabel}{statusText}
</span>
);
}

// ─── Team Hole Grid ───────────────────────────────────────────────────────────
function TeamHoleGrid({ matchupId, holes, onScore, onUndo, tA, tB, nines, nineLabels }) {
const history = useRef([]);

function handleScore(matchupId, h, res) {
history.current.push({ matchupId, h, prev: holes[h] || holes[String(h)] || null });
onScore(matchupId, h, res);
}

function handleUndo() {
if (history.current.length === 0) return;
const last = history.current.pop();
if (last.prev === null) onScore(last.matchupId, last.h, holes[last.h] || holes[String(last.h)]);
else onScore(last.matchupId, last.h, last.prev);
// Force clear if was null
if (last.prev === null) onUndo(last.matchupId, last.h);
}

return (
<div>
{nines.map((nineHoles, si) => {
const winner = getNineResult(holes, nineHoles);
return (
<div key={si} style={{ marginBottom:14 }}>
<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
<span style={{ fontSize:14, color:"#6b9f7e", letterSpacing:"0.15em", textTransform:"uppercase" }}>{nineLabels[si]}</span>
{winner === null ? <span style={{ fontSize:13, color:"#374a3c" }}>In progress</span>
: winner === "H" ? <span style={{ fontSize:13, color:"#facc15", fontWeight:700 }}>Halved · ½pt each</span>
: <span style={{ fontSize:13, color:(winner==="A"?tA:tB).color, fontWeight:700 }}>{(winner==="A"?tA:tB).name} wins · 1pt</span>}
</div>
<div style={{ display:"grid", gridTemplateColumns:"repeat(9, 1fr)", gap:3 }}>
{nineHoles.map((h, hi) => {
const r = holes[h] || holes[String(h)];
return (
<div key={h} style={{ textAlign:"center" }}>
<div style={{ fontSize:12, color:"#4a6a54", marginBottom:2 }}>{hi+1}</div>
{["A","H","B"].map(res => {
const active = r === res;
const bg = active ? (res==="A"?tA.color:res==="B"?tB.color:"#92400e") : "#0a1a0f";
return (
<button key={res} onClick={() => handleScore(matchupId, h, res)}
style={{ display:"block", width:"100%", marginBottom:2, background:bg, border:`1px solid ${active?bg:"#1e3a24"}`, borderRadius:3, color:active?"#fff":"#374a3c", fontSize:12, padding:"3px 0", cursor:"pointer", fontWeight:active?700:400 }}>
{res==="A"?tA.id:res==="B"?tB.id:"H"}
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
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:8, borderTop:"1px solid #1e3a24" }}>
<div style={{ display:"flex", gap:12, fontSize:14, color:"#6b9f7e" }}>
<span><span style={{color:tA.color}}>■</span> A={tA.name}</span>
<span><span style={{color:"#92400e"}}>■</span> H=Halved</span>
<span><span style={{color:tB.color}}>■</span> B={tB.name}</span>
</div>
<button onClick={handleUndo}
style={{ background:"transparent", border:"1px solid #1e3a24", borderRadius:6, color:"#6b9f7e", padding:"4px 10px", fontSize:14, cursor:"pointer" }}>
↩ Undo
</button>
</div>
</div>
);
}

// ─── Singles Hole Grid ────────────────────────────────────────────────────────
function SinglesHoleGrid({ singlesId, holes, onSinglesScore, teams, nines, nineLabels }) {
const tA = getTeamById(teams,"A"), tB = getTeamById(teams,"B"), tC = getTeamById(teams,"C");
const [focusedCell, setFocusedCell] = useState(null);
const history = useRef([]);

function handleInput(hole, teamId, val) {
const num = val === "" ? "" : parseInt(val);
if (val !== "" && (isNaN(num) || num < 1 || num > 20)) return;
const hData = holes[hole] || holes[String(hole)] || {};
history.current.push({ hole, teamId, prev: hData[teamId] ?? null });
onSinglesScore(singlesId, hole, teamId, val === "" ? "" : num);
}

function handleUndo() {
if (history.current.length === 0) return;
const last = history.current.pop();
onSinglesScore(singlesId, last.hole, last.teamId, last.prev === null ? "" : last.prev);
}

return (
<div>
{nines.map((nineHoles, si) => {
const nineDots = calcNineDots(holes, nineHoles);
const nineMP = calcNineMatchPlayPts(holes, nineHoles);
const nineComplete = nineMP !== null;

return (
<div key={si} style={{ marginBottom:18 }}>
<div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
<span style={{ fontSize:14, color:"#6b9f7e", letterSpacing:"0.15em", textTransform:"uppercase" }}>{nineLabels[si]}</span>
{!nineComplete && <span style={{ fontSize:13, color:"#374a3c" }}>In progress</span>}
</div>
{nineComplete && (
<div style={{ display:"flex", gap:0, marginBottom:8, border:"1px solid #1e3a24", borderRadius:8, overflow:"hidden" }}>
{["A","B","C"].map((tid, i) => {
const t = getTeamById(teams, tid);
const mp = nineMP[tid];
const bestMP = Math.max(nineMP.A, nineMP.B, nineMP.C);
return (
<div key={tid} style={{ flex:1, padding:"6px 8px", textAlign:"center", borderLeft:i>0?"1px solid #1e3a24":"none", background:mp===bestMP?"#1a2e1a":"transparent" }}>
<div style={{ fontSize:13, color:t.color, fontWeight:700 }}>{t.name}</div>
<div style={{ fontSize:14, color:"#c8e6d2" }}>{nineDots[tid]}<span style={{fontSize:12,color:"#4a6a54"}}>d</span></div>
<div style={{ fontSize:16, fontWeight:700, color:mp===bestMP?t.color:"#6b9f7e" }}>{mp}<span style={{fontSize:12,color:"#4a6a54"}}> mp</span></div>
</div>
);
})}
</div>
)}
<div style={{ overflowX:"auto" }}>
<div style={{ display:"grid", gridTemplateColumns:`40px repeat(${nineHoles.length}, 1fr)`, gap:3, minWidth:340 }}>
<div>
<div style={{ height:18 }} />
{["A","B","C"].map(tid => {
const t = getTeamById(teams,tid);
return <div key={tid} style={{ height:34, display:"flex", alignItems:"center", marginBottom:2 }}>
<span style={{ fontSize:14, color:t.color, fontWeight:700 }}>{t.id}</span>
</div>;
})}
<div style={{ height:20, display:"flex", alignItems:"center" }}>
<span style={{ fontSize:12, color:"#4a6a54" }}>dots</span>
</div>
</div>
{nineHoles.map((h, hi) => {
const hData = holes[h] || holes[String(h)] || {};
const dots = calcHoleDots(hData);
return (
<div key={h} style={{ textAlign:"center" }}>
<div style={{ fontSize:12, color:"#4a6a54", marginBottom:2, height:18, display:"flex", alignItems:"center", justifyContent:"center" }}>{hi+1}</div>
{["A","B","C"].map(tid => {
const t = getTeamById(teams,tid);
const val = hData[tid] ?? "";
const d = dots ? dots[tid] : null;
const isWinner = d === 4, isMid = d === 3;
const focused = focusedCell === `${h}-${tid}`;
return (
<div key={tid} style={{ marginBottom:2 }}>
<input type="number" inputMode="numeric" value={val} placeholder="—"
onFocus={() => setFocusedCell(`${h}-${tid}`)}
onBlur={() => setFocusedCell(null)}
onChange={e => handleInput(h, tid, e.target.value)}
style={{ width:"100%", height:30, background:isWinner?`${t.color}30`:isMid?`${t.color}15`:"#0a1a0f", border:`1px solid ${focused?t.color:isWinner?t.color:"#1e3a24"}`, borderRadius:4, color:isWinner?t.color:"#c8e6d2", fontSize:15, fontWeight:isWinner?700:400, textAlign:"center", outline:"none", boxSizing:"border-box", MozAppearance:"textfield" }} />
</div>
);
})}
<div style={{ height:20, display:"flex", alignItems:"center", justifyContent:"center" }}>
{dots ? <span style={{ fontSize:12, color:"#4ade80", fontWeight:700 }}>{dots.A}/{dots.B}/{dots.C}</span>
: <span style={{ fontSize:12, color:"#1e3a24" }}>—</span>}
</div>
</div>
);
})}
</div>
</div>
</div>
);
})}
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:8, borderTop:"1px solid #1e3a24" }}>
<span style={{ fontSize:14, color:"#6b9f7e" }}>Enter strokes · dots auto-calculate</span>
<button onClick={handleUndo}
style={{ background:"transparent", border:"1px solid #1e3a24", borderRadius:6, color:"#6b9f7e", padding:"4px 10px", fontSize:14, cursor:"pointer" }}>
↩ Undo
</button>
</div>
</div>
);
}

// ─── Team Matchup Card ────────────────────────────────────────────────────────
function TeamMatchupCard({ matchup, holes, pairings, teams, nines, nineLabels, onScore, onUndo, onPairingChange }) {
const [open, setOpen] = useState(false);
const tA = getTeamById(teams, matchup.groupA);
const tB = getTeamById(teams, matchup.groupB);
const h = holes[matchup.id] || {};
const { pA, pB } = calcTeamMatchPts(h, nines);
const pair = pairings[matchup.id] || { namesA:["",""], namesB:["",""] };
const namesA = pair.namesA || ["",""];
const namesB = pair.namesB || ["",""];
const labelA = namesA.filter(Boolean).join(" & ") || tA.name;
const labelB = namesB.filter(Boolean).join(" & ") || tB.name;
const status = getMatchPlayStatus(h, nines);
const played = Object.keys(h).length;

function updateName(side, idx, val) {
const key = side==="A"?"namesA":"namesB";
const cur = [...(side==="A"?namesA:namesB)];
cur[idx] = val;
onPairingChange(matchup.id, key, cur);
}

return (
<div style={{ background: status.over ? "#131f10" : "#111f14", border: `1px solid ${status.over ? (status.leader==="A"?tA.color:tB.color)+"60" : "#1e3a24"}`, borderRadius:12, marginBottom:10, overflow:"hidden" }}>
<div onClick={() => setOpen(o=>!o)} style={{ padding:"14px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
<div style={{ flex:1 }}>
<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
<span style={{ fontSize:14, color:"#4a6a54", letterSpacing:"0.12em", textTransform:"uppercase" }}>{matchup.label}</span>
{status.over && <span style={{ fontSize:13, background:(status.leader==="A"?tA.color:tB.color)+"20", color:(status.leader==="A"?tA.color:tB.color), borderRadius:4, padding:"1px 6px", fontWeight:700 }}>FINAL</span>}
</div>
<div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
<span style={{ color:tA.color, fontWeight:700, fontSize:18 }}>{labelA}</span>
<span style={{ color:"#2d4a35", fontSize:15 }}>vs</span>
<span style={{ color:tB.color, fontWeight:700, fontSize:18 }}>{labelB}</span>
</div>
<StatusBadge status={status} tA={tA} tB={tB} />
</div>
<div style={{ textAlign:"right", marginRight:6 }}>
<div style={{ fontSize:22, fontWeight:700, color:"#f0f9f4" }}>{pA} – {pB}</div>
<div style={{ fontSize:14, color:"#4a6a54" }}>{played}/{nines.length*9}</div>
</div>
<span style={{ color:"#2d4a35", fontSize:15 }}>{open?"▲":"▼"}</span>
</div>

{open && (
<>
<div style={{ padding:"14px 16px", background:"#0d1a0f", borderTop:"1px solid #1e3a24" }}>
<div style={{ fontSize:14, color:"#4ade80", letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:12 }}>Players</div>
<div style={{ display:"flex", gap:12 }}>
{[{t:tA,side:"A",names:namesA},{t:tB,side:"B",names:namesB}].map(({t,side,names}) => (
<div key={side} style={{ flex:1 }}>
<div style={{ fontSize:14, color:t.color, fontWeight:700, marginBottom:8, textTransform:"uppercase" }}>{t.name}</div>
{[0,1].map(idx => (
<input key={idx} value={names[idx]||""} placeholder={`Player ${idx+1}`}
onChange={e => updateName(side, idx, e.target.value)}
onClick={e => e.stopPropagation()}
style={{...inputStyle(t.color), marginBottom:6}} />
))}
</div>
))}
</div>
</div>

<div style={{ display:"flex", borderTop:"1px solid #1e3a24", borderBottom:"1px solid #1e3a24" }}>
{[{t:tA,pts:pA,opp:pB,label:labelA},{t:tB,pts:pB,opp:pA,label:labelB}].map(({t,pts,opp,label},i) => (
<div key={t.id} style={{ flex:1, padding:"10px 16px", textAlign:i===0?"left":"right", borderLeft:i===1?"1px solid #1e3a24":"none" }}>
<div style={{ fontSize:13, color:t.color, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:2 }}>{label}</div>
<div style={{ fontSize:34, fontWeight:700, color:pts>opp?t.color:pts===opp&&pts>0?"#facc15":"#f0f9f4", lineHeight:1 }}>{pts}</div>
<div style={{ fontSize:13, color:"#4a6a54" }}>pts</div>
</div>
))}
</div>

<div style={{ padding:"14px 10px 14px" }}>
<TeamHoleGrid matchupId={matchup.id} holes={h} onScore={onScore} onUndo={onUndo} tA={tA} tB={tB} nines={nines} nineLabels={nineLabels} />
</div>
</>
)}
</div>
);
}

// ─── Singles Card ─────────────────────────────────────────────────────────────
function SinglesCard({ singlesId, holes, pairings, teams, nines, nineLabels, onSinglesScore, onPairingChange }) {
const [open, setOpen] = useState(false);
const h = holes[singlesId] || {};
const pair = pairings[singlesId] || { nameA:"", nameB:"", nameC:"" };
const totals = calcSinglesTotal(h, nines);
const tA = getTeamById(teams,"A"), tB = getTeamById(teams,"B"), tC = getTeamById(teams,"C");
const labelA = pair.nameA || tA.name;
const labelB = pair.nameB || tB.name;
const labelC = pair.nameC || tC.name;
const holesPlayed = Object.keys(h).length;
const maxDots = nines.flat().length * 4; // theoretical max per player

return (
<div style={{ background:"#111f14", border:"1px solid #4ade8030", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
<div onClick={() => setOpen(o=>!o)} style={{ padding:"14px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
<div style={{ flex:1 }}>
<div style={{ fontSize:14, color:"#4ade80", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3 }}>Singles · 6 Dots Per Hole</div>
<div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
<span style={{ color:tA.color, fontWeight:700, fontSize:17 }}>{labelA}</span>
<span style={{ color:"#2d4a35" }}>·</span>
<span style={{ color:tB.color, fontWeight:700, fontSize:17 }}>{labelB}</span>
<span style={{ color:"#2d4a35" }}>·</span>
<span style={{ color:tC.color, fontWeight:700, fontSize:17 }}>{labelC}</span>
</div>
</div>
<div style={{ textAlign:"right", marginRight:6 }}>
<div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginBottom:2 }}>
{[{t:tA,d:totals.A},{t:tB,d:totals.B},{t:tC,d:totals.C}].map(({t,d}) => (
<span key={t.id} style={{ fontSize:16, color:t.color, fontWeight:700 }}>{d}<span style={{fontSize:12,color:"#4a6a54"}}>d</span></span>
))}
</div>
<div style={{ fontSize:14, color:"#4a6a54" }}>{holesPlayed}/{nines.length*9}</div>
</div>
<span style={{ color:"#2d4a35", fontSize:15 }}>{open?"▲":"▼"}</span>
</div>

{open && (
<>
<div style={{ padding:"14px 16px", background:"#0d1a0f", borderTop:"1px solid #1e3a24" }}>
<div style={{ fontSize:14, color:"#4ade80", letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:12 }}>Players</div>
<div style={{ display:"flex", gap:8 }}>
{[{t:tA,field:"nameA",val:pair.nameA},{t:tB,field:"nameB",val:pair.nameB},{t:tC,field:"nameC",val:pair.nameC}].map(({t,field,val}) => (
<div key={field} style={{ flex:1 }}>
<div style={{ fontSize:13, color:t.color, fontWeight:700, marginBottom:6, textTransform:"uppercase" }}>{t.name}</div>
<input value={val||""} placeholder="Name"
onChange={e => onPairingChange(singlesId, field, e.target.value)}
onClick={e => e.stopPropagation()}
style={{...inputStyle(t.color), fontSize:15}} />
</div>
))}
</div>
</div>

{(() => {
const mpTotals = calcSinglesMatchPlayTotal(h, nines);
const bestMP = Math.max(mpTotals.A, mpTotals.B, mpTotals.C);
const bestDots = Math.max(totals.A, totals.B, totals.C);
return (
<div style={{ display:"flex", borderTop:"1px solid #1e3a24", borderBottom:"1px solid #1e3a24" }}>
{[{t:tA,d:totals.A,mp:mpTotals.A,label:labelA},{t:tB,d:totals.B,mp:mpTotals.B,label:labelB},{t:tC,d:totals.C,mp:mpTotals.C,label:labelC}].map(({t,d,mp,label},i) => (
<div key={t.id} style={{ flex:1, padding:"10px 8px", textAlign:"center", borderLeft:i>0?"1px solid #1e3a24":"none" }}>
<div style={{ fontSize:13, color:t.color, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{label}</div>
<div style={{ fontSize:26, fontWeight:700, color:d===bestDots&&d>0?t.color:"#f0f9f4", lineHeight:1 }}>{d}</div>
<div style={{ fontSize:13, color:"#4a6a54", marginBottom:4 }}>dots</div>
<div style={{ fontSize:18, fontWeight:700, color:mp===bestMP&&mp>0?t.color:"#6b9f7e" }}>{mp}</div>
<div style={{ fontSize:13, color:"#4a6a54" }}>match pts</div>
</div>
))}
</div>
);
})()}

<div style={{ padding:"14px 10px 14px" }}>
<SinglesHoleGrid singlesId={singlesId} holes={h} onSinglesScore={onSinglesScore} teams={teams} nines={nines} nineLabels={nineLabels} />
</div>
</>
)}
</div>
);
}

// ─── Day Recap Modal ──────────────────────────────────────────────────────────
function DayRecap({ day, teamHoles, singlesHoles, teamPairings, singlesPairings, teams, onClose }) {
const tA = getTeamById(teams,"A"), tB = getTeamById(teams,"B"), tC = getTeamById(teams,"C");
const dayMatchPts = { A:0, B:0, C:0 };

return (
<div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
onClick={onClose}>
<div style={{ background:"#0d1f11", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:600, maxHeight:"85vh", overflowY:"auto", padding:24 }}
onClick={e => e.stopPropagation()}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
<div>
<div style={{ fontSize:14, color:"#4ade80", letterSpacing:"0.2em", textTransform:"uppercase" }}>{day.label} Recap</div>
<div style={{ fontSize:20, fontWeight:700, color:"#f0f9f4" }}>{day.course}</div>
</div>
<button onClick={onClose} style={{ background:"transparent", border:"none", color:"#6b9f7e", fontSize:26, cursor:"pointer", padding:"4px 8px" }}>✕</button>
</div>

{/* Singles recap */}
{(() => {
const sh = singlesHoles[day.singlesId] || {};
const sp = singlesPairings[day.singlesId] || {};
const totals = calcSinglesTotal(sh, day.nines);
const sorted = [
{t:tA,d:totals.A,name:sp.nameA||tA.name},
{t:tB,d:totals.B,name:sp.nameB||tB.name},
{t:tC,d:totals.C,name:sp.nameC||tC.name},
].sort((a,b) => b.d - a.d);
dayMatchPts.A += 0; dayMatchPts.B += 0; dayMatchPts.C += 0;
const mpTotals = calcSinglesMatchPlayTotal(sh, day.nines);
const sortedWithMP = sorted.map(x => ({...x, mp: mpTotals[x.t.id]}));
return (
<div style={{ background:"#111f14", borderRadius:10, padding:16, marginBottom:12 }}>
<div style={{ fontSize:14, color:"#4ade80", textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:12 }}>Singles · 6 Dots + Match Play</div>
{sortedWithMP.map(({t,d,name,mp},i) => (
<div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
<span style={{ fontSize:18, width:20 }}>{i===0?"🥇":i===1?"🥈":"🥉"}</span>
<span style={{ color:t.color, fontWeight:700, flex:1 }}>{name}</span>
<span style={{ color:"#c8e6d2", fontWeight:700, fontSize:18 }}>{d}<span style={{ color:"#4a6a54", fontSize:14 }}> dots</span></span>
<span style={{ color:t.color, fontWeight:700, fontSize:18, marginLeft:8 }}>{mp}<span style={{ color:"#4a6a54", fontSize:14 }}> mp</span></span>
</div>
))}
</div>
);
})()}

{/* Team matchup recaps */}
{day.teamMatchups.map(m => {
const h = teamHoles[m.id] || {};
const tp = teamPairings[m.id] || {};
const tTeamA = getTeamById(teams, m.groupA);
const tTeamB = getTeamById(teams, m.groupB);
const { pA, pB } = calcTeamMatchPts(h, day.nines);
const namesA = (tp.namesA||["",""]).filter(Boolean).join(" & ") || tTeamA.name;
const namesB = (tp.namesB||["",""]).filter(Boolean).join(" & ") || tTeamB.name;
const status = getMatchPlayStatus(h, day.nines);
dayMatchPts[m.groupA] += pA;
dayMatchPts[m.groupB] += pB;
const winner = pA > pB ? m.groupA : pB > pA ? m.groupB : null;
return (
<div key={m.id} style={{ background:"#111f14", borderRadius:10, padding:16, marginBottom:12 }}>
<div style={{ fontSize:14, color:"#4a6a54", textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:10 }}>{m.label}</div>
<div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
<div style={{ flex:1 }}>
<div style={{ color:tTeamA.color, fontWeight:700 }}>{namesA}</div>
<div style={{ fontSize:15, color:"#4a6a54" }}>{tTeamA.name}</div>
</div>
<div style={{ textAlign:"center", padding:"0 12px" }}>
<div style={{ fontSize:26, fontWeight:700, color:"#f0f9f4" }}>{pA} – {pB}</div>
<div style={{ fontSize:14, color: status.over?(winner===m.groupA?tTeamA.color:tTeamB.color):"#6b9f7e" }}>
{status.over ? `${status.statusText}` : status.statusText}
</div>
</div>
<div style={{ flex:1, textAlign:"right" }}>
<div style={{ color:tTeamB.color, fontWeight:700 }}>{namesB}</div>
<div style={{ fontSize:15, color:"#4a6a54" }}>{tTeamB.name}</div>
</div>
</div>
</div>
);
})}

{/* Day points summary */}
{(() => {
const sh = singlesHoles[day.singlesId] || {};
const smp = calcSinglesMatchPlayTotal(sh, day.nines);
const totalDayPts = { A: dayMatchPts.A + smp.A, B: dayMatchPts.B + smp.B, C: dayMatchPts.C + smp.C };
return (
<div style={{ background:"#0a1a0f", borderRadius:10, padding:16, border:"1px solid #1e3a24" }}>
<div style={{ fontSize:14, color:"#4ade80", textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:12 }}>Day Points</div>
{[tA,tB,tC].sort((a,b) => totalDayPts[b.id]-totalDayPts[a.id]).map((t) => (
<div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
<span style={{ color:t.color, fontWeight:700, flex:1 }}>{t.name}</span>
<span style={{ color:"#6b9f7e", fontSize:16 }}>{dayMatchPts[t.id]} team</span>
<span style={{ color:"#4a6a54", fontSize:15 }}>+</span>
<span style={{ color:"#6b9f7e", fontSize:16 }}>{smp[t.id]} singles</span>
<span style={{ color:"#f0f9f4", fontWeight:700, fontSize:20, marginLeft:4 }}>{totalDayPts[t.id]}<span style={{ color:"#4a6a54", fontSize:14 }}> pts</span></span>
</div>
))}
</div>
);
})()}

<button onClick={onClose}
style={{ width:"100%", marginTop:16, background:"#2D6A4F", border:"none", borderRadius:10, color:"#fff", padding:"14px 0", fontSize:18, fontWeight:700, cursor:"pointer" }}>
Close
</button>
</div>
</div>
);
}

// ─── Standings ────────────────────────────────────────────────────────────────
function Standings({ teamHolesAll, singlesHolesAll, teams }) {
const { matchPts, dots } = calcStandings(teamHolesAll, singlesHolesAll);
const sorted = [...teams].map(t => ({ ...t, matchPts:matchPts[t.id], dots:dots[t.id] }))
.sort((a,b) => (b.matchPts*100+b.dots)-(a.matchPts*100+a.dots));
const anyActivity = sorted.some(t => t.matchPts > 0 || t.dots > 0);
const maxMatchPts = 24;

return (
<div style={{ background:"#0d1f11", borderBottom:"1px solid #1e3a24", padding:"16px 20px" }}>
<div style={{ fontSize:14, letterSpacing:"0.25em", color:"#4ade80", textTransform:"uppercase", marginBottom:12 }}>Championship Standings</div>
{sorted.map((t,i) => (
<div key={t.id} style={{ marginBottom:12 }}>
<div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, alignItems:"center" }}>
<span style={{ color:t.color, fontSize:17, fontWeight:700 }}>
{i===0&&anyActivity?"🏆 ":`${i+1}. `}{t.name}
<span style={{ color:"#4a6a54", fontSize:15, fontWeight:400 }}> ({t.captain})</span>
</span>
<div>
<span style={{ color:"#c8e6d2", fontSize:17, fontWeight:700 }}>{t.matchPts}<span style={{ color:"#4a6a54", fontSize:14, fontWeight:400 }}> pts</span></span>
<span style={{ color:"#4a6a54", fontSize:15 }}> · </span>
<span style={{ color:t.color, fontSize:16, fontWeight:700 }}>{t.dots}<span style={{ color:"#4a6a54", fontSize:14, fontWeight:400 }}> dots</span></span>
</div>
</div>
<div style={{ height:6, background:"#1e3a24", borderRadius:4 }}>
<div style={{ height:6, background:t.color, borderRadius:4, width:`${Math.min((t.matchPts/maxMatchPts)*100,100)}%`, transition:"width 0.4s ease" }} />
</div>
</div>
))}
</div>
);
}

// ─── Group Name Editor ────────────────────────────────────────────────────────
function GroupNameEditor({ teams, onChange }) {
return (
<div style={{ background:"#0d1f11", borderBottom:"1px solid #1e3a24", padding:"14px 20px" }}>
<div style={{ fontSize:14, letterSpacing:"0.2em", color:"#4ade80", textTransform:"uppercase", marginBottom:12 }}>Team Names</div>
<div style={{ display:"flex", gap:10 }}>
{teams.map(t => (
<div key={t.id} style={{ flex:1 }}>
<div style={{ fontSize:13, color:t.color, marginBottom:5, textTransform:"uppercase" }}>Group {t.id}</div>
<input value={t.name} onChange={e => onChange(t.id,"name",e.target.value)}
style={{...inputStyle(t.color), fontSize:16, fontWeight:700}} />
<input value={t.captain} placeholder="Captain" onChange={e => onChange(t.id,"captain",e.target.value)}
style={{...inputStyle(t.color), fontSize:15, marginTop:5, color:"#6b9f7e"}} />
</div>
))}
</div>
</div>
);
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
const [teamHoles, setTeamHoles] = useState(initialTeamHoles);
const [singlesHoles, setSinglesHoles] = useState(initialSinglesHoles);
const [teamPairings, setTeamPairings] = useState(initialTeamPairings);
const [singlesPairings, setSinglesPairings] = useState(initialSinglesPairings);
const [teams, setTeams] = useState(DEFAULT_TEAMS);
const [activeDay, setActiveDay] = useState(0);
const [connected, setConnected] = useState(false);
const [syncing, setSyncing] = useState(false);
const [showEdit, setShowEdit] = useState(false);
const [showRecap, setShowRecap] = useState(false);
const dbReady = useRef(false);

useEffect(() => {
initFirebase().then(db => {
dbReady.current = true; setConnected(true);
db.ref("teamHoles").on("value", snap => { const v=snap.val(); if(v) setTeamHoles(p=>({...initialTeamHoles,...v})); });
db.ref("singlesHoles").on("value", snap => { const v=snap.val(); if(v) setSinglesHoles(p=>({...initialSinglesHoles,...v})); });
db.ref("teamPairings").on("value", snap => { const v=snap.val(); if(v) setTeamPairings(p=>({...initialTeamPairings,...v})); });
db.ref("singlesPairings").on("value", snap => { const v=snap.val(); if(v) setSinglesPairings(p=>({...initialSinglesPairings,...v})); });
db.ref("teams").on("value", snap => { const v=snap.val(); if(v) setTeams(DEFAULT_TEAMS.map(dt=>({...dt,...(v[dt.id]||{})}))); });
}).catch(err => console.error(err));
}, []);

async function handleTeamScore(matchupId, hole, result) {
setTeamHoles(prev => {
const cur = {...prev[matchupId]};
if (cur[hole]===result) delete cur[hole]; else cur[hole]=result;
return {...prev,[matchupId]:cur};
});
if (!dbReady.current) return;
setSyncing(true);
try {
const db = await initFirebase();
const cur = (await db.ref(`teamHoles/${matchupId}/${hole}`).get()).val();
if (cur===result) await db.ref(`teamHoles/${matchupId}/${hole}`).remove();
else await db.ref(`teamHoles/${matchupId}/${hole}`).set(result);
} catch(e) { console.error(e); }
setSyncing(false);
}

async function handleTeamUndo(matchupId, hole) {
setTeamHoles(prev => {
const cur = {...prev[matchupId]};
delete cur[hole];
return {...prev,[matchupId]:cur};
});
if (!dbReady.current) return;
try { const db = await initFirebase(); await db.ref(`teamHoles/${matchupId}/${hole}`).remove(); } catch(e) { console.error(e); }
}

async function handleSinglesScore(singlesId, hole, teamId, val) {
setSinglesHoles(prev => {
const cur = {...prev[singlesId]};
const holeData = {...(cur[hole]||{})};
if (val===""||val===null) delete holeData[teamId]; else holeData[teamId]=val;
if (Object.keys(holeData).length===0) delete cur[hole]; else cur[hole]=holeData;
return {...prev,[singlesId]:cur};
});
if (!dbReady.current) return;
setSyncing(true);
try {
const db = await initFirebase();
if (val===""||val===null) await db.ref(`singlesHoles/${singlesId}/${hole}/${teamId}`).remove();
else await db.ref(`singlesHoles/${singlesId}/${hole}/${teamId}`).set(val);
} catch(e) { console.error(e); }
setSyncing(false);
}

async function handleTeamPairingChange(matchupId, key, val) {
setTeamPairings(prev => ({...prev,[matchupId]:{...prev[matchupId],[key]:val}}));
if (!dbReady.current) return;
try { const db=await initFirebase(); await db.ref(`teamPairings/${matchupId}/${key}`).set(val); } catch(e){console.error(e);}
}

async function handleSinglesPairingChange(singlesId, key, val) {
setSinglesPairings(prev => ({...prev,[singlesId]:{...prev[singlesId],[key]:val}}));
if (!dbReady.current) return;
try { const db=await initFirebase(); await db.ref(`singlesPairings/${singlesId}/${key}`).set(val); } catch(e){console.error(e);}
}

async function handleTeamChange(teamId, field, val) {
setTeams(prev => prev.map(t=>t.id===teamId?{...t,[field]:val}:t));
if (!dbReady.current) return;
try { const db=await initFirebase(); await db.ref(`teams/${teamId}/${field}`).set(val); } catch(e){console.error(e);}
}

const day = SCHEDULE[activeDay];

return (
<div style={{ minHeight:"100vh", background:"#0a1a0f", fontFamily:"'Playfair Display', Georgia, serif" }}>
{showRecap && (
<DayRecap day={day} teamHoles={teamHoles} singlesHoles={singlesHoles}
teamPairings={teamPairings} singlesPairings={singlesPairings}
teams={teams} onClose={() => setShowRecap(false)} />
)}

{/* Header */}
<div style={{ background:"#0d1f11", borderBottom:"1px solid #1e3a24", padding:"14px 20px", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
<div>
<div style={{ fontSize:13, letterSpacing:"0.3em", color:"#4ade80", textTransform:"uppercase" }}>Pawleys Island · 2025</div>
<div style={{ fontSize:26, fontWeight:700, color:"#f0f9f4" }}>Bushwood Cup</div>
<div style={{ fontSize:15, color:"#6b9f7e", fontStyle:"italic", fontFamily:"Georgia, serif" }}>Match Play · 1pt per 9 · 6-dot Singles</div>
</div>
<div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
<div style={{ display:"flex", alignItems:"center", gap:6 }}>
<div style={{ width:8, height:8, borderRadius:"50%", background:connected?"#4ade80":"#e05c5c", boxShadow:connected?"0 0 6px #4ade80":"none" }} />
<span style={{ fontSize:14, color:connected?"#4ade80":"#e05c5c" }}>{syncing?"Saving…":connected?"Live":"Connecting…"}</span>
</div>
<button onClick={() => setShowEdit(e=>!e)}
style={{ background:"transparent", border:"1px solid #1e3a24", borderRadius:7, color:"#6b9f7e", padding:"4px 10px", fontSize:14, cursor:"pointer", fontFamily:"Georgia, serif" }}>
{showEdit?"Done":"✏ Edit Teams"}
</button>
</div>
</div>

{showEdit && <GroupNameEditor teams={teams} onChange={handleTeamChange} />}
<Standings teamHolesAll={teamHoles} singlesHolesAll={singlesHoles} teams={teams} />

{/* Day Tabs */}
<div style={{ display:"flex", background:"#0d1f11", borderBottom:"1px solid #1e3a24" }}>
{SCHEDULE.map((d,i) => (
<button key={i} onClick={() => setActiveDay(i)}
style={{ flex:1, background:"transparent", border:"none", borderBottom:activeDay===i?"2px solid #4ade80":"2px solid transparent", color:activeDay===i?"#f0f9f4":"#4a6a54", padding:"10px 4px", cursor:"pointer", fontFamily:"'Playfair Display', serif" }}>
<div style={{ fontSize:16, fontWeight:700 }}>{d.label}</div>
<div style={{ fontSize:13, color:"#6b9f7e" }}>{d.nines.length*9} holes</div>
</button>
))}
</div>

{/* Day content */}
<div style={{ padding:"16px", maxWidth:640, margin:"0 auto" }}>
<div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:14 }}>
<div>
<div style={{ fontSize:14, color:"#4ade80", letterSpacing:"0.2em", textTransform:"uppercase" }}>{day.label}</div>
<div style={{ fontSize:20, fontWeight:700, color:"#f0f9f4" }}>{day.course}</div>
<div style={{ fontSize:15, color:"#6b9f7e", fontStyle:"italic", fontFamily:"Georgia, serif", marginTop:2 }}>{day.tee}</div>
</div>
<button onClick={() => setShowRecap(true)}
style={{ background:"#1e3a24", border:"1px solid #2d5a38", borderRadius:8, color:"#4ade80", padding:"8px 14px", fontSize:15, cursor:"pointer", fontFamily:"'Playfair Display', serif", whiteSpace:"nowrap" }}>
📋 Recap
</button>
</div>

<SinglesCard singlesId={day.singlesId} holes={singlesHoles} pairings={singlesPairings}
teams={teams} nines={day.nines} nineLabels={day.nineLabels}
onSinglesScore={handleSinglesScore} onPairingChange={handleSinglesPairingChange} />

<div style={{ fontSize:14, color:"#4a6a54", letterSpacing:"0.15em", textTransform:"uppercase", margin:"16px 0 10px" }}>Team Matchups</div>

{day.teamMatchups.map(m => (
<TeamMatchupCard key={m.id} matchup={m} holes={teamHoles} pairings={teamPairings}
teams={teams} nines={day.nines} nineLabels={day.nineLabels}
onScore={handleTeamScore} onUndo={handleTeamUndo} onPairingChange={handleTeamPairingChange} />
))}
</div>
</div>
);
}

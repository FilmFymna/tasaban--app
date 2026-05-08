import { useState, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────────
const SUPABASE_URL = "https://ikekpqqmrbnumfysndxk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZWtwcXFtcmJudW1meXNuZHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxODQ2ODYsImV4cCI6MjA5Mzc2MDY4Nn0.Pjil9BaxhTq3MXO4_vvIrVW5dg_761s7wlnNk92kYHo";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadAllData() {
  const { data, error } = await supabase.from("monthly_data").select("*");
  if (error) throw error;
  const MD = {};
  (data || []).forEach(row => {
    MD[row.month] = {
      days: row.days || [],
      table: row.table_data || {},
      history: row.history || [],
    };
  });
  return MD;
}

async function saveMonthData(month, monthData) {
  const { error } = await supabase.from("monthly_data").upsert({
    month,
    days: monthData.days,
    table_data: monthData.table,
    history: monthData.history,
    updated_at: new Date().toISOString(),
  }, { onConflict: "month" });
  if (error) throw error;
}


const TESSABAN = [
  "เทศบาลเมืองวารินชำราบ","เทศบาลตำบลห้วยขะยูง","เทศบาลตำบลนาเยีย",
  "เทศบาลตำบลแสนสุข","เทศบาลตำบลเมืองศรีไค","เทศบาลตำบลคำน้ำแซบ",
  "เทศบาลตำบลคำขวาง","เทศบาลตำบลบุ่งไหม","เทศบาลตำบลธาตุ",
  "เทศบาลตำบลบุ่งมะแลง","เทศบาลตำบลท่าช้าง","เทศบาลตำบลสว่าง",
  "เทศบาลตำบลนาเรือง","เทศบาลตำบลนาจาน","เทศบาลตำบลสำโรง",
];
const OBT = [
  "อบต.คูเมือง","อบต.ท่าลาด","อบต.โนนผึ้ง","อบต.โนนโหนน",
  "อบต.บุ่งหวาย","อบต.โพธิ์ใหญ่","อบต.สระสมิง","อบต.หนองกินเพล",
  "อบต.ห้วยขะยุง","อบต.ขามป้อม","อบต.ค้อน้อย","อบต.โคกก่อง",
  "อบต.โคกสว่าง","อบต.โนนกลาง","อบต.โนนกาเล็น","อบต.บอน",
  "อบต.หนองไฮ","อบต.แก่งโดม","อบต.นาดี",
];
const ALL_ORGS = [...TESSABAN, ...OBT];
const MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];

// ─── HELPERS ─────────────────────────────────────────────────
const emptyCell = () => ({ p97: "", p3: "" });
const initMD    = () => ({ days: [], table: {}, history: [] });

function addDayToTable(table, day) {
  const t = { ...table };
  ALL_ORGS.forEach(o => {
    t[o] = { ...(t[o] || {}), [day]: t[o]?.[day] || emptyCell() };
  });
  return t;
}
function removeDayFromTable(table, day) {
  const t = { ...table };
  ALL_ORGS.forEach(o => { const r = { ...(t[o] || {}) }; delete r[day]; t[o] = r; });
  return t;
}
function sortDays(days) {
  return [...days].sort((a, b) => parseInt(a) - parseInt(b));
}

const fmtN = n => { const v = parseFloat(n); if (!v) return ""; return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2); };
const fmtF = n => { if (!n && n !== 0) return "-"; const v = parseFloat(n); if (isNaN(v) || v === 0) return "-"; return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

const sumRow   = (tbl, org, days, f) => days.reduce((s, d) => s + (parseFloat(tbl[org]?.[d]?.[f]) || 0), 0);
const sumDay   = (tbl, day, list, f) => list.reduce((s, o) => s + (parseFloat(tbl[o]?.[day]?.[f]) || 0), 0);
const sumGroup = (tbl, list, days, f) => list.reduce((s, o) => s + sumRow(tbl, o, days, f), 0);

function matchOrg(name) {
  if (!name) return null;
  const norm = s => s.replace(/\s+/g, "")
    .replace("เทศบาลตำบล", "ตำบล")
    .replace("เทศบาลเมือง", "เมือง")
    .replace("อบต.", "").replace("อบต", "");
  const n = norm(name);
  return ALL_ORGS.find(o => {
    const m = norm(o);
    return m === n || m.includes(n) || n.includes(m);
  }) || null;
}

// ─── STYLES ──────────────────────────────────────────────────
const C = { blue: "#0f4c81", green: "#1a7a4a", gold: "#e8a020", red: "#c0392b", bg: "#f2f5f8" };

// ─── APP ─────────────────────────────────────────────────────
export default function App() {
  // All useState at top — never inside conditions
  const [loaded,     setLoaded]     = useState(false);
  const [saveStatus, setSaveStatus] = useState(""); // "" | "saving" | "saved" | "error"
  const [mainTab,    setMainTab]    = useState("monthly"); // monthly | summary
  const [subTab,     setSubTab]     = useState("import");  // import | monthtable | compare
  const [activeM,    setActiveM]    = useState("เมษายน");
  const [MD,         setMD]         = useState({});
  const [msg,        setMsg]        = useState(null);
  const [cmpData,    setCmpData]    = useState(null); // { day, pdf, calc, tessaban, obt }
  const [jsonText,   setJsonText]   = useState("");
  const [dayInput,   setDayInput]   = useState("");
  const [jsonErr,    setJsonErr]    = useState("");
  const [manDay,     setManDay]     = useState("");

  // ── Getters ──
  const getM    = useCallback(m => MD[m] || initMD(), [MD]);
  const hasData = useCallback(m => (MD[m]?.days?.length || 0) > 0, [MD]);
  const cur     = getM(activeM);

  // ── Setter helper — tracks which month changed for targeted save ──
  const setM = useCallback((m, fn) => {
    setMD(prev => {
      const cur = prev[m] || initMD();
      return { ...prev, [m]: typeof fn === "function" ? fn(cur) : fn };
    });
    setLastSavedMonth(m);
  }, []);

  // ── Load from Supabase on mount ──
  useEffect(() => {
    (async () => {
      try {
        const data = await loadAllData();
        if (Object.keys(data).length > 0) setMD(data);
      } catch (e) { console.error("Load error:", e); }
      setLoaded(true);
    })();
  }, []);

  // ── Auto-save changed month to Supabase (debounced 1s) ──
  const [lastSavedMonth, setLastSavedMonth] = useState(null);
  useEffect(() => {
    if (!loaded || !lastSavedMonth) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const monthData = MD[lastSavedMonth];
        if (monthData) await saveMonthData(lastSavedMonth, monthData);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2500);
      } catch (e) {
        console.error("Save error:", e);
        setSaveStatus("error");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [MD, loaded, lastSavedMonth]);

  // ── Add day ──
  const addDay = useCallback((d, m) => {
    const n = parseInt(d);
    if (!n || n < 1 || n > 31) return;
    const s = String(n), month = m || activeM;
    setM(month, cur => {
      if (cur.days.includes(s)) return cur;
      return {
        ...cur,
        days:  sortDays([...cur.days, s]),
        table: addDayToTable({ ...cur.table }, s),
      };
    });
  }, [activeM, setM]);

  // ── Remove day ──
  const removeDay = useCallback(d => {
    setM(activeM, cur => ({
      ...cur,
      days:    cur.days.filter(x => x !== d),
      table:   removeDayFromTable({ ...cur.table }, d),
      history: cur.history.filter(h => h.day !== d),
    }));
  }, [activeM, setM]);

  // ── Edit cell ──
  const setCell = useCallback((org, day, field, val) => {
    setM(activeM, cur => ({
      ...cur,
      table: {
        ...cur.table,
        [org]: {
          ...cur.table[org],
          [day]: { ...cur.table[org]?.[day], [field]: val },
        },
      },
    }));
  }, [activeM, setM]);

  // ── Import JSON ──
  const handleImport = () => {
    setJsonErr("");
    const n = parseInt(dayInput);
    if (!n || n < 1 || n > 31) { setJsonErr("ระบุวันที่ให้ถูกต้อง (1-31)"); return; }
    const dayStr = String(n);

    let parsed;
    try {
      parsed = JSON.parse(jsonText.replace(/```json|```/g, "").trim());
    } catch {
      setJsonErr("JSON ไม่ถูกต้อง — คัดลอกให้ครบ"); return;
    }
    if (!Array.isArray(parsed?.rows)) { setJsonErr("ไม่พบ rows ใน JSON"); return; }

    // Single setM call — no separate addDay to avoid race condition
    setM(activeM, cur => {
      const newDays  = cur.days.includes(dayStr) ? cur.days : sortDays([...cur.days, dayStr]);
      const newTable = addDayToTable({ ...cur.table }, dayStr);

      parsed.rows.forEach(row => {
        const found = matchOrg(row.matched || row.name);
        if (found && (row.p97 || row.p3)) {
          newTable[found][dayStr] = {
            p97: row.p97 ? String(row.p97) : "",
            p3:  row.p3  ? String(row.p3)  : "",
          };
        }
      });

      const newHistory = [
        ...cur.history.filter(h => h.day !== dayStr),
        {
          day:          dayStr,
          total_p97:    parsed.total_p97    || 0,
          total_p3:     parsed.total_p3     || 0,
          total_amount: parsed.total_amount || 0,
          rows:         parsed.rows,
        },
      ].sort((a, b) => parseInt(a.day) - parseInt(b.day));

      return { ...cur, days: newDays, table: newTable, history: newHistory };
    });

    const matched = parsed.rows.filter(r => matchOrg(r.matched || r.name)).length;
    setMsg({ type: "ok", text: `✅ วันที่ ${dayStr} เดือน${activeM}: จับคู่ได้ ${matched}/${parsed.rows.length} รายการ` });
    setJsonText("");
    setDayInput("");
    setSubTab("monthtable");
  };

  // ── Compare: use last imported history entry ──
  const doCompare = useCallback(() => {
    const history = getM(activeM).history;
    if (!history.length) return;
    const lastH = history[history.length - 1];
    const tbl   = getM(activeM).table;
    const d     = lastH.day;
    const tT97  = sumDay(tbl, d, TESSABAN, "p97"), tT3 = sumDay(tbl, d, TESSABAN, "p3");
    const tO97  = sumDay(tbl, d, OBT,      "p97"), tO3 = sumDay(tbl, d, OBT,      "p3");
    setCmpData({
      day:      d,
      pdf:      lastH,
      calc:     { p97: tT97 + tO97, p3: tT3 + tO3, total: tT97 + tO97 + tT3 + tO3 },
      tessaban: { p97: tT97, p3: tT3 },
      obt:      { p97: tO97, p3: tO3 },
    });
    setSubTab("compare");
  }, [activeM, getM]);

  // ── Month summary helper ──
  const mSum = useCallback(m => {
    const { days, table } = getM(m);
    return {
      t97:  sumGroup(table, TESSABAN, days, "p97"),
      t3:   sumGroup(table, TESSABAN, days, "p3"),
      o97:  sumGroup(table, OBT,      days, "p97"),
      o3:   sumGroup(table, OBT,      days, "p3"),
      days: days.length,
    };
  }, [getM]);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans Thai','Sarabun',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{ background: `linear-gradient(135deg,${C.blue},#1a6bb5)`, color: "#fff", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 3px 12px rgba(0,0,0,0.22)", position: "sticky", top: 0, zIndex: 100, minHeight: 54 }}>
        <span style={{ fontSize: 22 }}>🏛️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>ระบบบันทึกยอดรายวัน เทศบาล / อบต.</div>
          <div style={{ fontSize: 10, opacity: .75 }}>ส่ง PDF ในแชท → Claude อ่าน → คัดลอก JSON → วางที่นี่</div>
        </div>
        {/* Save status badge */}
        {saveStatus && (
          <div style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12,
            background: saveStatus === "saved" ? "rgba(26,122,74,0.9)" : saveStatus === "error" ? "rgba(192,57,43,0.9)" : "rgba(255,255,255,0.2)",
            color: "#fff", whiteSpace: "nowrap" }}>
            {saveStatus === "saving" ? "💾 บันทึก..." : saveStatus === "saved" ? "✅ บันทึกแล้ว" : "❌ บันทึกไม่ได้"}
          </div>
        )}
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          {[["monthly", "📅 รายเดือน"], ["summary", "📊 รายปี"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setMainTab(id)}
              style={{ padding: "4px 11px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: mainTab === id ? C.gold : "rgba(255,255,255,0.15)", color: mainTab === id ? "#1a1a1a" : "#fff" }}>
              {lbl}
            </button>
          ))}
        </div>
      </header>

      {/* Loading */}
      {!loaded && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 16 }}>
          <div style={{ fontSize: 42 }}>⏳</div>
          <div style={{ fontSize: 16, color: "#666", fontWeight: 600 }}>กำลังโหลดข้อมูล...</div>
        </div>
      )}

      {/* Main content — only show after loaded */}
      {loaded && (
        <>
          {/* Notification */}
          {msg && (
            <div style={{ margin: "10px 16px 0", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center",
              background: msg.type === "ok" ? "#e6f9ee" : "#fde8e8",
              color:      msg.type === "ok" ? "#1a6b38" : "#c0392b",
              border:     `1px solid ${msg.type === "ok" ? "#9de0b6" : "#f5b7b1"}` }}>
              <span>{msg.text}</span>
              <button onClick={() => setMsg(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, opacity: .5 }}>×</button>
            </div>
          )}

          {/* ══ MONTHLY VIEW ══ */}
          {mainTab === "monthly" && (
            <div style={{ padding: "12px 16px" }}>
              {/* Month selector */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                {MONTHS.map(m => (
                  <button key={m} onClick={() => { setActiveM(m); setSubTab("import"); setCmpData(null); }}
                    style={{ padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, position: "relative",
                      background: activeM === m ? C.blue : hasData(m) ? "#d1fae5" : "#e2e8f0",
                      color:      activeM === m ? "#fff"  : hasData(m) ? C.green   : "#555" }}>
                    {m}
                    {hasData(m) && activeM !== m && (
                      <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, background: C.green, borderRadius: "50%", border: "1.5px solid #fff" }} />
                    )}
                  </button>
                ))}
              </div>

              {/* Sub tabs */}
              <div style={{ display: "flex", background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", width: "fit-content", marginBottom: 14 }}>
                {[["import", "📋 นำเข้า"], ["monthtable", "📅 ตารางเดือน"], ["compare", "🔍 ตรวจสอบ"]].map(([id, lbl]) => (
                  <button key={id} onClick={() => setSubTab(id)}
                    style={{ padding: "7px 15px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: subTab === id ? C.blue : "transparent", color: subTab === id ? "#fff" : "#555" }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* ── IMPORT ── */}
              {subTab === "import" && (
                <div style={{ maxWidth: 660, margin: "0 auto" }}>
                  {/* How-to */}
                  <div style={{ background: "linear-gradient(135deg,#e8f4fd,#f0f9ff)", borderRadius: 12, padding: "14px 18px", marginBottom: 14, border: "1px solid #bee3f8" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.blue, marginBottom: 10 }}>📖 วิธีนำเข้าข้อมูล</div>
                    {[
                      ["1️⃣", "แนบไฟล์ PDF ในช่องแชท Claude"],
                      ["2️⃣", "พิมพ์: อ่านข้อมูลจาก PDF นี้ให้เป็น JSON"],
                      ["3️⃣", "คัดลอก JSON ที่ Claude ตอบกลับ"],
                      ["4️⃣", "ระบุวันที่ + วาง JSON ด้านล่าง → กด นำเข้า"],
                    ].map(([n, t]) => (
                      <div key={n} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{n}</span>
                        <span style={{ fontSize: 13, color: "#2d5986", lineHeight: 1.5 }}>{t}</span>
                      </div>
                    ))}
                  </div>

                  {/* Form */}
                  <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: C.blue, marginBottom: 14 }}>📥 วาง JSON — เดือน{activeM}</div>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 }}>วันที่ในเอกสาร</div>
                      <input type="text" inputMode="numeric" placeholder="เช่น 1, 15, 30" value={dayInput}
                        onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); if (v === "" || parseInt(v) <= 31) setDayInput(v); }}
                        style={{ width: 130, padding: "9px 12px", borderRadius: 8, border: `2px solid ${dayInput ? C.blue : "#d0d5dd"}`, fontFamily: "inherit", fontSize: 18, textAlign: "center", boxSizing: "border-box", outline: "none" }} />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 5 }}>JSON จาก Claude</div>
                      <textarea value={jsonText} onChange={e => { setJsonText(e.target.value); setJsonErr(""); }}
                        placeholder={'วาง JSON ที่ได้จาก Claude...\n{"rows":[{"name":"...","matched":"...","p97":0,"p3":0}],"total_p97":0,"total_p3":0,"total_amount":0}'}
                        style={{ width: "100%", minHeight: 180, padding: "10px 12px", borderRadius: 8, border: `2px solid ${jsonErr ? "#f5b7b1" : jsonText ? "#90caf9" : "#d0d5dd"}`, fontFamily: "monospace", fontSize: 12, boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                      {jsonErr && <div style={{ color: C.red, fontSize: 13, marginTop: 4 }}>⚠️ {jsonErr}</div>}
                    </div>

                    <button onClick={handleImport} disabled={!jsonText || !dayInput}
                      style={{ width: "100%", padding: 13, background: jsonText && dayInput ? C.blue : "#ccc", color: "#fff", border: "none", borderRadius: 10, cursor: jsonText && dayInput ? "pointer" : "default", fontFamily: "inherit", fontSize: 15, fontWeight: 800 }}>
                      📥 นำเข้าวันที่ {dayInput || "..."} เดือน{activeM}
                    </button>
                  </div>

                  {/* Manual day add */}
                  <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", marginTop: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 700, color: C.blue, marginBottom: 8, fontSize: 13 }}>⚙️ เพิ่มวันเปล่าด้วยตนเอง</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" inputMode="numeric" placeholder="วันที่ เช่น 5" value={manDay}
                        onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); if (v === "" || parseInt(v) <= 31) setManDay(v); }}
                        onKeyDown={e => { if (e.key === "Enter") { addDay(manDay); setManDay(""); } }}
                        style={{ width: 110, padding: "7px 10px", borderRadius: 7, border: "1px solid #d0d5dd", fontFamily: "inherit", fontSize: 14 }} />
                      <button onClick={() => { addDay(manDay); setManDay(""); }}
                        style={{ padding: "7px 14px", background: C.blue, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700 }}>+ เพิ่ม</button>
                    </div>
                    {cur.days.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {cur.days.map(d => (
                          <span key={d} style={{ background: "#e8f0fe", color: C.blue, padding: "3px 10px 3px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                            {d}
                            <button onClick={() => removeDay(d)} style={{ border: "none", background: "none", color: C.red, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── MONTH TABLE ── */}
              {subTab === "monthtable" && (
                <div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 16, color: C.blue }}>ตารางรวมเดือน {activeM}</span>
                    <span style={{ fontSize: 13, color: "#888" }}>| {cur.days.length} วัน | นำเข้าแล้ว {cur.history.length} ครั้ง</span>
                    {cur.history.length > 0 && (
                      <button onClick={doCompare}
                        style={{ marginLeft: "auto", padding: "6px 14px", background: C.green, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
                        🔍 เทียบ PDF ล่าสุด
                      </button>
                    )}
                  </div>

                  {cur.days.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#ccc", background: "#fff", borderRadius: 12 }}>
                      <div style={{ fontSize: 44, marginBottom: 10 }}>📅</div>
                      <div>ยังไม่มีข้อมูล — ไปที่แท็บ "📋 นำเข้า"</div>
                    </div>
                  ) : (
                    <>
                      {/* History badges */}
                      {cur.history.length > 0 && (
                        <div style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>📄 ไฟล์ที่นำเข้าแล้ว</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {cur.history.map(h => (
                              <div key={h.day} style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                                <span style={{ fontWeight: 700, color: C.green }}>วันที่ {h.day}</span>
                                <span style={{ color: "#888", marginLeft: 8 }}>
                                  97%: {(h.total_p97 || 0).toFixed(2)} | 3%: {(h.total_p3 || 0).toFixed(2)} | รวม: {(h.total_amount || 0).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <MonthTable title="เทศบาล" list={TESSABAN} days={cur.days} table={cur.table} setCell={setCell} C={C} />
                      <div style={{ height: 16 }} />
                      <MonthTable title="อบต." list={OBT} days={cur.days} table={cur.table} setCell={setCell} C={C} />

                      {/* Grand totals */}
                      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <SumCard label="รวมเทศบาล" p97={sumGroup(cur.table, TESSABAN, cur.days, "p97")} p3={sumGroup(cur.table, TESSABAN, cur.days, "p3")} color={C.blue} />
                        <SumCard label="รวม อบต."   p97={sumGroup(cur.table, OBT,      cur.days, "p97")} p3={sumGroup(cur.table, OBT,      cur.days, "p3")} color={C.green} />
                        <div style={{ background: "#1a1a2e", color: "#fff", borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ fontSize: 11, opacity: .7, marginBottom: 3 }}>ยอดรวมเดือน{activeM}</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: C.gold }}>
                            {(sumGroup(cur.table, ALL_ORGS, cur.days, "p97") + sumGroup(cur.table, ALL_ORGS, cur.days, "p3")).toFixed(2)}
                          </div>
                          <div style={{ fontSize: 10, opacity: .6, marginTop: 2 }}>
                            97%: {sumGroup(cur.table, ALL_ORGS, cur.days, "p97").toFixed(2)} | 3%: {sumGroup(cur.table, ALL_ORGS, cur.days, "p3").toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── COMPARE ── */}
              {subTab === "compare" && (
                <div style={{ maxWidth: 680, margin: "0 auto" }}>
                  {!cmpData ? (
                    <div style={{ textAlign: "center", padding: 60, color: "#ccc", background: "#fff", borderRadius: 12 }}>
                      <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
                      <div>นำเข้าข้อมูลก่อน แล้วกด "เทียบ PDF ล่าสุด" ในแท็บตารางเดือน</div>
                    </div>
                  ) : (
                    <CompareView cmp={cmpData} activeM={activeM} C={C} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ SUMMARY VIEW ══ */}
          {mainTab === "summary" && (
            <SummaryView
              MONTHS={MONTHS} mSum={mSum} hasData={hasData}
              setActiveM={setActiveM} setMainTab={setMainTab} setSubTab={setSubTab}
              getM={getM} C={C} fmtF={fmtF}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── MONTH TABLE ─────────────────────────────────────────────
// Rows = orgs, Cols = day×2 (97% left, 3% right), last 3 cols = month total
function MonthTable({ title, list, days, table, setCell, C }) {
  const col    = title === "เทศบาล" ? C.blue : C.green;
  const rowSum = (org, f)  => days.reduce((s, d) => s + (parseFloat(table[org]?.[d]?.[f]) || 0), 0);
  const daySum = (day, f)  => list.reduce((s, o) => s + (parseFloat(table[o]?.[day]?.[f]) || 0), 0);
  const allSum = f         => list.reduce((s, o) => s + rowSum(o, f), 0);

  const cellW = 48;
  const nameW = 160;

  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
      {/* Section header */}
      <div style={{ background: col, color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>
        <span style={{ fontSize: 11, opacity: .75, background: "rgba(255,255,255,0.2)", padding: "1px 8px", borderRadius: 20 }}>97% / 3%</span>
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: .85 }}>
          Σ97%: {allSum("p97").toFixed(2)} | Σ3%: {allSum("p3").toFixed(2)} | รวม: {(allSum("p97") + allSum("p3")).toFixed(2)}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, tableLayout: "fixed", width: nameW + days.length * cellW * 2 + 190 }}>
          <thead>
            {/* Row 1: day group headers */}
            <tr style={{ background: "#f1f5f9" }}>
              <th style={{ width: nameW, padding: "6px 8px", textAlign: "left", fontWeight: 700, fontSize: 12, color: "#4a5568", borderBottom: "1px solid #e2e8f0", borderRight: "2px solid #aac4e0" }}>
                หน่วยงาน
              </th>
              {days.map(d => (
                <th key={d} colSpan={2} style={{ width: cellW * 2, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontSize: 12, color: col, borderBottom: "1px solid #e2e8f0", borderRight: "2px solid #aac4e0" }}>
                  วันที่ {d}
                </th>
              ))}
              <th colSpan={3} style={{ width: 190, padding: "6px 4px", textAlign: "center", fontWeight: 700, fontSize: 12, color: col, background: "#dbeafe", borderBottom: "1px solid #e2e8f0" }}>
                รวมทั้งเดือน
              </th>
            </tr>
            {/* Row 2: 97% | 3% sub-headers (97% always left, 3% always right) */}
            <tr style={{ borderBottom: "2px solid #cbd5e0" }}>
              <th style={{ width: nameW, padding: "4px 8px", background: "#edf2f7", borderRight: "2px solid #aac4e0" }} />
              {days.map(d => (
                <React.Fragment key={d}>
                  <th style={{ width: cellW, padding: "4px 2px", textAlign: "center", fontWeight: 700, fontSize: 10, color: "#fff", background: col }}>97%</th>
                  <th style={{ width: cellW, padding: "4px 2px", textAlign: "center", fontWeight: 700, fontSize: 10, color: "#fff", background: "#888", borderRight: "2px solid #aac4e0" }}>3%</th>
                </React.Fragment>
              ))}
              <th style={{ width: 60, padding: "4px 2px", textAlign: "center", fontWeight: 700, fontSize: 10, color: "#fff", background: col }}>97%</th>
              <th style={{ width: 60, padding: "4px 2px", textAlign: "center", fontWeight: 700, fontSize: 10, color: "#fff", background: "#888" }}>3%</th>
              <th style={{ width: 70, padding: "4px 2px", textAlign: "center", fontWeight: 800, fontSize: 10, color: "#1a1a2e", background: "#bfdbfe" }}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {list.map((org, i) => {
              const r97 = rowSum(org, "p97"), r3 = rowSum(org, "p3");
              return (
                <tr key={org} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={{ padding: "3px 8px", borderBottom: "1px solid #e8ecf0", borderRight: "2px solid #aac4e0", fontWeight: 500, color: "#1a2744", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12 }}>
                    {org}
                  </td>
                  {days.map(d => (
                    <React.Fragment key={d}>
                      {/* 97% — LEFT */}
                      <td style={{ padding: 2, borderBottom: "1px solid #e8ecf0", background: "#f0f6ff", textAlign: "right" }}>
                        <input type="text" inputMode="decimal"
                          value={table[org]?.[d]?.p97 ?? ""}
                          onChange={e => setCell(org, d, "p97", e.target.value.replace(/[^0-9.]/g, ""))}
                          style={{ width: "100%", border: "none", background: "transparent", textAlign: "right", padding: "3px 4px", fontFamily: "inherit", fontSize: 11.5, outline: "none", color: col, fontWeight: 600, boxSizing: "border-box" }} />
                      </td>
                      {/* 3% — RIGHT */}
                      <td style={{ padding: 2, borderBottom: "1px solid #e8ecf0", borderRight: "2px solid #aac4e0", background: "#f9f9f9", textAlign: "right" }}>
                        <input type="text" inputMode="decimal"
                          value={table[org]?.[d]?.p3 ?? ""}
                          onChange={e => setCell(org, d, "p3", e.target.value.replace(/[^0-9.]/g, ""))}
                          style={{ width: "100%", border: "none", background: "transparent", textAlign: "right", padding: "3px 4px", fontFamily: "inherit", fontSize: 11.5, outline: "none", color: "#888", boxSizing: "border-box" }} />
                      </td>
                    </React.Fragment>
                  ))}
                  <td style={{ padding: "3px 6px", borderBottom: "1px solid #e8ecf0", textAlign: "right", fontWeight: 700, color: col, background: "#eff6ff" }}>{fmtN(r97)}</td>
                  <td style={{ padding: "3px 6px", borderBottom: "1px solid #e8ecf0", textAlign: "right", fontWeight: 600, color: "#666", background: "#f3f3f3" }}>{fmtN(r3)}</td>
                  <td style={{ padding: "3px 6px", borderBottom: "1px solid #e8ecf0", textAlign: "right", fontWeight: 800, color: "#1a1a2e", background: "#dbeafe", fontSize: 12 }}>{fmtN(r97 + r3)}</td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr style={{ borderTop: "2px solid #94a3b8", background: "#edf2f7" }}>
              <td style={{ padding: "5px 8px", fontWeight: 800, color: col, borderRight: "2px solid #aac4e0", fontSize: 12 }}>รวม</td>
              {days.map(d => (
                <React.Fragment key={d}>
                  <td style={{ padding: "5px 4px", textAlign: "right", fontWeight: 700, color: col, background: "#dbeafe", fontSize: 12 }}>{fmtN(daySum(d, "p97"))}</td>
                  <td style={{ padding: "5px 4px", textAlign: "right", fontWeight: 600, color: "#555", background: "#e5e5e5", borderRight: "2px solid #aac4e0", fontSize: 12 }}>{fmtN(daySum(d, "p3"))}</td>
                </React.Fragment>
              ))}
              <td style={{ padding: "5px 6px", textAlign: "right", background: col, color: "#fff", fontWeight: 800, fontSize: 12 }}>{fmtN(allSum("p97"))}</td>
              <td style={{ padding: "5px 6px", textAlign: "right", background: "#555", color: "#fff", fontWeight: 700, fontSize: 12 }}>{fmtN(allSum("p3"))}</td>
              <td style={{ padding: "5px 6px", textAlign: "right", background: "#1a1a2e", color: C.gold, fontWeight: 900, fontSize: 13 }}>{fmtN(allSum("p97") + allSum("p3"))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── COMPARE VIEW ────────────────────────────────────────────
function CompareView({ cmp, activeM, C }) {
  const rows = [
    ["97% รวม",  cmp.calc.p97,   cmp.pdf.total_p97    || 0],
    ["3% รวม",   cmp.calc.p3,    cmp.pdf.total_p3     || 0],
    ["รวมเงิน",  cmp.calc.total, cmp.pdf.total_amount || 0],
  ];
  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
      <div style={{ background: C.blue, color: "#fff", padding: "14px 18px" }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>ผลเปรียบเทียบ — วันที่ {cmp.day} เดือน{activeM}</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: "#f8f9fa", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#555", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>📄 <b>PDF:</b></span>
          <span>97% = <b>{(cmp.pdf.total_p97 || 0).toFixed(2)}</b></span>
          <span>3% = <b>{(cmp.pdf.total_p3 || 0).toFixed(2)}</b></span>
          <span>รวม = <b>{(cmp.pdf.total_amount || 0).toFixed(2)}</b></span>
        </div>
        {rows.map(([lbl, calc, pdf]) => {
          const ok = Math.abs(calc - pdf) < 0.06;
          return (
            <div key={lbl} style={{ marginBottom: 10, padding: "12px 14px", borderRadius: 9, background: ok ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${ok ? "#86efac" : "#fca5a5"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{lbl}</span>
                <span style={{ fontSize: 20 }}>{ok ? "✅" : "❌"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["คำนวณได้", calc, C.blue], ["ใน PDF", pdf, "#276749"], ["ผลต่าง", calc - pdf, ok ? "#888" : C.red]].map(([l, v, co]) => (
                  <div key={l} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: co }}>{(+v).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
          {[{ lbl: "เทศบาล", d: cmp.tessaban, c: C.blue }, { lbl: "อบต.", d: cmp.obt, c: C.green }].map(({ lbl, d, c }) => (
            <div key={lbl} style={{ background: c, color: "#fff", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{lbl}</div>
              <div style={{ display: "flex", gap: 14 }}>
                <div><div style={{ fontSize: 10, opacity: .75 }}>97%</div><div style={{ fontSize: 16, fontWeight: 800 }}>{d.p97.toFixed(2)}</div></div>
                <div><div style={{ fontSize: 10, opacity: .75 }}>3%</div><div style={{ fontSize: 16, fontWeight: 800 }}>{d.p3.toFixed(2)}</div></div>
                <div><div style={{ fontSize: 10, opacity: .75 }}>รวม</div><div style={{ fontSize: 16, fontWeight: 800 }}>{(d.p97 + d.p3).toFixed(2)}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SUMMARY VIEW ────────────────────────────────────────────
function SummaryView({ MONTHS, mSum, hasData, setActiveM, setMainTab, setSubTab, getM, C, fmtF }) {
  const thS = (w, left = false, bg) => ({ padding: "6px 8px", textAlign: left ? "left" : "center", fontWeight: 700, fontSize: 11, color: "#4a5568", borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", minWidth: w, whiteSpace: "nowrap", ...(bg ? { background: bg } : {}) });
  const tdS = { borderBottom: "1px solid #e8ecf0", borderRight: "1px solid #e8ecf0", verticalAlign: "middle" };

  const yearTot = MONTHS.reduce((a, m) => {
    const s = mSum(m);
    return { t97: a.t97 + s.t97, t3: a.t3 + s.t3, o97: a.o97 + s.o97, o3: a.o3 + s.o3 };
  }, { t97: 0, t3: 0, o97: 0, o3: 0 });

  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ fontWeight: 800, fontSize: 17, color: C.blue, marginBottom: 14 }}>📊 สรุปยอดรายปี</div>

      {/* Month cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 8, marginBottom: 18 }}>
        {MONTHS.map(m => {
          const s = mSum(m); const total = s.t97 + s.t3 + s.o97 + s.o3;
          return (
            <div key={m} onClick={() => { setActiveM(m); setMainTab("monthly"); setSubTab("monthtable"); }}
              style={{ background: hasData(m) ? "#fff" : "#f8f8f8", borderRadius: 10, padding: "12px 14px", cursor: "pointer", boxShadow: "0 1px 5px rgba(0,0,0,0.07)", border: `1.5px solid ${hasData(m) ? "#bee3f8" : "#e8e8e8"}` }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: hasData(m) ? C.blue : "#bbb", marginBottom: 4 }}>{m}</div>
              {hasData(m) ? (
                <>
                  <div style={{ fontSize: 11, color: "#aaa", marginBottom: 3 }}>{s.days} วัน</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.blue }}>{fmtF(total)}</div>
                  <div style={{ fontSize: 10, color: "#999", marginTop: 3, display: "flex", gap: 6 }}>
                    <span style={{ color: C.blue }}>ทบ {fmtF(s.t97 + s.t3)}</span>
                    <span style={{ color: C.green }}>อบต {fmtF(s.o97 + s.o3)}</span>
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: "#ccc" }}>ยังไม่มีข้อมูล</div>}
            </div>
          );
        })}
      </div>

      {/* Monthly summary table */}
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 18 }}>
        <div style={{ background: C.blue, color: "#fff", padding: "10px 16px", fontWeight: 800, fontSize: 14 }}>ตารางสรุปยอดแต่ละเดือน</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={thS(90, true)}>เดือน</th>
                <th style={thS(42)}>วัน</th>
                <th style={thS(100)}>ทบ 97%</th>
                <th style={thS(90)}>ทบ 3%</th>
                <th style={thS(100)}>อบต 97%</th>
                <th style={thS(90)}>อบต 3%</th>
                <th style={thS(105, false, "#e8f0fe")}>รวมทบ</th>
                <th style={thS(105, false, "#e6f4ed")}>รวมอบต</th>
                <th style={thS(115, false, "#1a1a2e")}>รวมทั้งหมด</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const s = mSum(m); const tT = s.t97 + s.t3, oT = s.o97 + s.o3, gT = tT + oT;
                return (
                  <tr key={m} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", cursor: "pointer" }}
                    onClick={() => { setActiveM(m); setMainTab("monthly"); setSubTab("monthtable"); }}>
                    <td style={{ ...tdS, fontWeight: 700, color: hasData(m) ? C.blue : "#bbb", padding: "6px 10px" }}>{m}</td>
                    <td style={{ ...tdS, textAlign: "center", color: "#888", padding: "6px 4px" }}>{s.days || "-"}</td>
                    <td style={{ ...tdS, textAlign: "right", padding: "6px 8px" }}>{fmtF(s.t97)}</td>
                    <td style={{ ...tdS, textAlign: "right", padding: "6px 8px", color: "#999" }}>{fmtF(s.t3)}</td>
                    <td style={{ ...tdS, textAlign: "right", padding: "6px 8px" }}>{fmtF(s.o97)}</td>
                    <td style={{ ...tdS, textAlign: "right", padding: "6px 8px", color: "#999" }}>{fmtF(s.o3)}</td>
                    <td style={{ ...tdS, textAlign: "right", padding: "6px 8px", fontWeight: 700, color: C.blue, background: "#f0f6ff" }}>{fmtF(tT)}</td>
                    <td style={{ ...tdS, textAlign: "right", padding: "6px 8px", fontWeight: 700, color: C.green, background: "#f0faf4" }}>{fmtF(oT)}</td>
                    <td style={{ ...tdS, textAlign: "right", padding: "6px 10px", fontWeight: 800, color: "#1a1a2e", background: "#f5f5fa" }}>{fmtF(gT)}</td>
                  </tr>
                );
              })}
              {/* Year total row */}
              <tr style={{ background: "#1a1a2e", color: "#fff", fontWeight: 800 }}>
                <td style={{ ...tdS, padding: "8px 10px", color: "#ffd84d", borderColor: "#333" }} colSpan={2}>รวมทั้งปี</td>
                <td style={{ ...tdS, textAlign: "right", padding: "8px 8px", color: "#90caf9", borderColor: "#333" }}>{fmtF(yearTot.t97)}</td>
                <td style={{ ...tdS, textAlign: "right", padding: "8px 8px", color: "#90caf9", borderColor: "#333" }}>{fmtF(yearTot.t3)}</td>
                <td style={{ ...tdS, textAlign: "right", padding: "8px 8px", color: "#a5d6a7", borderColor: "#333" }}>{fmtF(yearTot.o97)}</td>
                <td style={{ ...tdS, textAlign: "right", padding: "8px 8px", color: "#a5d6a7", borderColor: "#333" }}>{fmtF(yearTot.o3)}</td>
                <td style={{ ...tdS, textAlign: "right", padding: "8px 8px", color: "#90caf9", fontWeight: 900, borderColor: "#333" }}>{fmtF(yearTot.t97 + yearTot.t3)}</td>
                <td style={{ ...tdS, textAlign: "right", padding: "8px 8px", color: "#a5d6a7", fontWeight: 900, borderColor: "#333" }}>{fmtF(yearTot.o97 + yearTot.o3)}</td>
                <td style={{ ...tdS, textAlign: "right", padding: "8px 10px", color: "#ffd84d", fontSize: 14, fontWeight: 900, borderColor: "#333" }}>{fmtF(yearTot.t97 + yearTot.t3 + yearTot.o97 + yearTot.o3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-org annual totals — uses TESSABAN/OBT constants directly */}
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
        <div style={{ background: C.green, color: "#fff", padding: "10px 16px", fontWeight: 800, fontSize: 14 }}>ยอดรวมรายหน่วยงานตลอดปี</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={thS(36, true)}>#</th>
                <th style={thS(180, true)}>หน่วยงาน</th>
                <th style={thS(100)}>97%</th>
                <th style={thS(100)}>3%</th>
                <th style={thS(110)}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {[["เทศบาล", TESSABAN, C.blue], ["อบต.", OBT, C.green]].map(([grp, list, col]) => (
                <React.Fragment key={grp}>
                  <tr style={{ background: col }}>
                    <td colSpan={5} style={{ padding: "5px 12px", color: "#fff", fontWeight: 800, fontSize: 13 }}>{grp}</td>
                  </tr>
                  {list.map((org, i) => {
                    const t97 = MONTHS.reduce((s, m) => s + sumRow(getM(m).table, org, getM(m).days, "p97"), 0);
                    const t3  = MONTHS.reduce((s, m) => s + sumRow(getM(m).table, org, getM(m).days, "p3"),  0);
                    return (
                      <tr key={org} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                        <td style={{ ...tdS, textAlign: "center", color: "#bbb", padding: "5px 6px" }}>{i + 1}</td>
                        <td style={{ ...tdS, padding: "5px 10px", fontWeight: 500, color: "#2d3748", whiteSpace: "nowrap" }}>{org}</td>
                        <td style={{ ...tdS, textAlign: "right", padding: "5px 8px", color: col }}>{fmtF(t97)}</td>
                        <td style={{ ...tdS, textAlign: "right", padding: "5px 8px", color: "#999" }}>{fmtF(t3)}</td>
                        <td style={{ ...tdS, textAlign: "right", padding: "5px 8px", fontWeight: 700, color: "#1a1a2e" }}>{fmtF(t97 + t3)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SUM CARD ────────────────────────────────────────────────
function SumCard({ label, p97, p3, color }) {
  return (
    <div style={{ background: color, color: "#fff", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, opacity: .8, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div><div style={{ fontSize: 10, opacity: .7 }}>97%</div><div style={{ fontSize: 14, fontWeight: 800 }}>{p97.toFixed(2)}</div></div>
        <div><div style={{ fontSize: 10, opacity: .7 }}>3%</div><div style={{ fontSize: 14, fontWeight: 800 }}>{p3.toFixed(2)}</div></div>
        <div><div style={{ fontSize: 10, opacity: .7 }}>รวม</div><div style={{ fontSize: 14, fontWeight: 800, color: "#ffd84d" }}>{(p97 + p3).toFixed(2)}</div></div>
      </div>
    </div>
  );
}

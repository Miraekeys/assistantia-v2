import React, { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// SUPABASE CLIENT — Variables d'environnement
// ============================================================
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;

const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const sb = {
  from: (table) => ({
    select: async (columns = "*") => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, { headers: supabaseHeaders });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    selectWhere: async (columns, filters) => {
      const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join("&");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${params}`, { headers: supabaseHeaders });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    selectSearch: async (columns, field, query) => {
      const words = query.split(/\s+/).filter(w => w.length > 2).slice(0, 5);
      if (words.length === 0) return { data: [], error: null };
      const tsQuery = words.join(" & ");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${field}=fts.${tsQuery}`, { headers: supabaseHeaders });
      const data = await res.json();
      return { data: Array.isArray(data) ? data : [], error: res.ok ? null : data };
    },
    selectIlike: async (columns, field, term) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${field}=ilike.*${encodeURIComponent(term)}*`, { headers: supabaseHeaders });
      const data = await res.json();
      return { data: Array.isArray(data) ? data : [], error: res.ok ? null : data };
    },
    insert: async (row) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST", headers: supabaseHeaders, body: JSON.stringify(row),
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    update: async (values, filters) => {
      const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join("&");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        method: "PATCH", headers: supabaseHeaders, body: JSON.stringify(values),
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    delete: async (filters) => {
      const params = Object.entries(filters).map(([k, v]) => `${k}=eq.${v}`).join("&");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        method: "DELETE", headers: supabaseHeaders,
      });
      return { error: res.ok ? null : await res.json() };
    },
    upsert: async (row) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...supabaseHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(row),
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
  }),
};

// ============================================================
// N8N SERVER + WEBHOOK UUIDs
// ============================================================
const N8N_BASE = "http://178.104.84.46:5678/webhook";
const AGENTS_CONFIG = {
  eclaireur:   { id: "eclaireur",   name: "L'Éclaireur",  emoji: "🧭", cls: "Chef de Projet",       color: "#378ADD", webhook: "8ef6e565-4d52-47ce-ae4b-26c5f679998c",   skills: ["Orchestration","Coordination","Analyse de projet"] },
  stratege:    { id: "stratege",    name: "Le Stratège",   emoji: "🏰", cls: "Grand Stratège",        color: "#639922", webhook: "4b896da9-ad76-43e2-8961-7efcd4b6efac",    skills: ["Stratégie contenu","Pipeline","Planification"] },
  oracle:      { id: "oracle",      name: "L'Oracle",      emoji: "📡", cls: "Voyant des Tendances",  color: "#F4A261", webhook: "33d10308-a3c0-4aa1-9367-31759a073e26",      skills: ["Veille","Alertes","Tendances"] },
  conteur:     { id: "conteur",     name: "Le Conteur",    emoji: "🎭", cls: "Barde Scénariste",      color: "#D4537E", webhook: "8ef6e565-4d52-47ce-ae4b-26c5f679998c",     skills: ["Scripts","Storytelling","Rédaction"] },
  heraut:      { id: "heraut",      name: "Le Héraut",     emoji: "📣", cls: "Héraut Marketing",      color: "#7F77DD", webhook: "867d9d3c-0f7a-43b7-bc97-faf7e958119a",      skills: ["Marketing","Réseaux sociaux","SEO"] },
  analyste:    { id: "analyste",    name: "L'Analyste",    emoji: "📊", cls: "Maître des Chiffres",   color: "#1D9E75", webhook: "91201aa8-86d1-49b9-bbce-cad66c23f3b0",    skills: ["Data","KPI","Performances"] },
  alchimiste:  { id: "alchimiste",  name: "L'Alchimiste",  emoji: "🏪", cls: "Marchand Alchimiste",   color: "#7F77DD", webhook: "54a08eea-be14-415c-9a05-f53ab66e5490",  skills: ["E-commerce","Conversion","Tunnel de vente"] },
};
const PIPELINE_WEBHOOK = "b2f30187-5665-4c57-995a-f0073320e26f";

const SECTION_COLORS = {
  bibliotheque: { main: "#00B4D8", bg: "rgba(0,180,216,0.1)", border: "rgba(0,180,216,0.35)" },
  projets:      { main: "#F4A261", bg: "rgba(244,162,97,0.1)", border: "rgba(244,162,97,0.35)" },
  agents:       { main: "#7F77DD", bg: "rgba(127,119,221,0.1)", border: "rgba(127,119,221,0.35)" },
  chaines:      { main: "#2EC4B6", bg: "rgba(46,196,182,0.1)", border: "rgba(46,196,182,0.35)" },
  profil:       { main: "#D4537E", bg: "rgba(212,83,126,0.1)", border: "rgba(212,83,126,0.3)" },
};

// ============================================================
// STYLES — Dark Mode #0A0F1A + Wayfinding
// ============================================================
const S = {
  app: { display:"flex", height:"100vh", overflow:"hidden", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background:"#0A0F1A", color:"#E8EDF5" },
  sidebar: { width:220, background:"#0F1B2D", borderRight:"1px solid rgba(255,255,255,0.08)", display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto" },
  sidebarLogo: { padding:"16px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", gap:10 },
  logoIcon: { width:32, height:32, background:"#1E3A5F", border:"1px solid #00B4D8", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", color:"#00B4D8", fontSize:13, fontWeight:600 },
  main: { flex:1, display:"flex", flexDirection:"column", minWidth:0, background:"#141E2E" },
  topbar: (color) => ({ height:52, background:"#0F1B2D", borderBottom:"1px solid rgba(255,255,255,0.08)", borderTop:`3px solid ${color}`, display:"flex", alignItems:"center", padding:"0 20px", gap:12, flexShrink:0 }),
  page: { flex:1, overflowY:"auto", padding:"20px 24px" },
  pageTitle: (color) => ({ fontSize:20, fontWeight:600, color:"#E8EDF5", display:"flex", alignItems:"center", gap:10, marginBottom:18 }),
  accent: (color) => ({ width:4, height:22, background:color, borderRadius:2 }),
  surface2: { background:"#1A2740", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12 },
  surface3: { background:"#1F2E45", borderRadius:8, padding:"9px 10px" },
  text: "#E8EDF5", text2: "#A8B5CC", text3: "#5C6B85",
  navy: "#0F1B2D", navy2: "#1E3A5F",
  border: "rgba(255,255,255,0.08)", border2: "rgba(255,255,255,0.14)",
  btn: (bg, color) => ({ background:bg, color, border:"none", padding:"7px 16px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer" }),
  input: { width:"100%", padding:"10px 14px", background:"#1A2740", border:"1px solid rgba(255,255,255,0.14)", borderRadius:10, color:"#E8EDF5", fontSize:14, fontFamily:"inherit", outline:"none" },
  card: { background:"#1A2740", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, overflow:"hidden", cursor:"pointer", transition:"border-color 0.15s" },
};

// ============================================================
// NAV ITEMS
// ============================================================
const NAV_ITEMS = [
  { id: "bibliotheque", label: "Bibliothèque", section: "Contenu" },
  { id: "projets",      label: "Projets",      section: "Contenu" },
  { id: "chaines",      label: "Chaînes",      section: "Contenu" },
  { id: "profil",       label: "Mon profil",   section: "Compte" },
];

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  // Navigation
  const [page, setPage] = useState("bibliotheque");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Data from Supabase
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [userSettings, setUserSettings] = useState({});
  const [trash, setTrash] = useState([]);

  // UI state
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Chat state — separate per agent to avoid Bug 4
  const [chatMessages, setChatMessages] = useState({});
  const [chatInputs, setChatInputs] = useState({});
  const [agentLoading, setAgentLoading] = useState({});

  // Polling refs
  const pollRefs = useRef({});

  // ── INITIAL DATA LOAD ──
  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadVideos(), loadChannels(), loadNotifications(),
      loadProjects(), loadTasks(), loadNotes(), loadUserSettings(), loadTrash(),
    ]);
    setLoading(false);
  };

  const loadVideos = async () => {
    const { data } = await sb.from("transcriptions").select("*");
    if (data && Array.isArray(data)) setVideos(data);
  };
  const loadChannels = async () => {
    const { data } = await sb.from("channels").select("*");
    if (data && Array.isArray(data)) setChannels(data);
  };
  const loadNotifications = async () => {
    const { data } = await sb.from("notifications").select("*");
    if (data && Array.isArray(data)) setNotifications(data);
  };
  const loadProjects = async () => {
    const { data } = await sb.from("projects").select("*");
    if (data && Array.isArray(data)) setProjects(data);
  };
  const loadTasks = async () => {
    const { data } = await sb.from("tasks").select("*");
    if (data && Array.isArray(data)) setTasks(data);
  };
  const loadNotes = async () => {
    const { data } = await sb.from("notes").select("*");
    if (data && Array.isArray(data)) setNotes(data);
  };
  const loadUserSettings = async () => {
    const { data } = await sb.from("user_settings").select("*");
    if (data && Array.isArray(data) && data.length > 0) setUserSettings(data[0]);
  };
  const loadTrash = async () => {
    const { data } = await sb.from("trash").select("*");
    if (data && Array.isArray(data)) setTrash(data);
  };

  // ── ADD YOUTUBE URL → PIPELINE (Bug 2 fix) ──
  const addYoutubeUrl = async () => {
    if (!newUrl.trim()) return;
    const url = newUrl.trim();
    setNewUrl("");
    setShowAddUrl(false);

    // 1. Send to n8n pipeline
    try {
      await fetch(`${N8N_BASE}/${PIPELINE_WEBHOOK}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, question: "Analyse cette vidéo" }),
      });
    } catch (e) { console.error("Pipeline error:", e); }

    // 2. Create processing entry in Supabase
    await sb.from("transcriptions").insert({
      url, title: "Transcription en cours...", status: "processing", created_at: new Date().toISOString(),
    });

    // 3. Create notification
    await sb.from("notifications").insert({
      type: "info", message: `Vidéo ajoutée. Transcription en cours (30-60 min).`, read: false, created_at: new Date().toISOString(),
    });

    await loadVideos();
    await loadNotifications();

    // 4. Poll every 30s until completed
    const pollId = setInterval(async () => {
      const { data } = await sb.from("transcriptions").selectWhere("status", { url });
      if (data && data[0]?.status === "completed") {
        clearInterval(pollId);
        await loadVideos();
        await sb.from("notifications").insert({
          type: "success", message: "Transcription terminée !", read: false, created_at: new Date().toISOString(),
        });
        await loadNotifications();
      }
    }, 30000);
    pollRefs.current[url] = pollId;
  };

  // ── SEND MESSAGE TO AGENT (Bug 1 fix) ──
  const sendAgentMessage = async (agentId) => {
    const msg = chatInputs[agentId]?.trim();
    if (!msg) return;

    const agent = AGENTS_CONFIG[agentId];
    setChatInputs(prev => ({ ...prev, [agentId]: "" }));
    setChatMessages(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), { role: "user", content: msg, time: new Date() }],
    }));
    setAgentLoading(prev => ({ ...prev, [agentId]: true }));

    try {
      // 1. Search relevant context in Supabase (Bug 1 fix)
      let contextStr = "Aucune donnée pertinente trouvée dans la base.";
      const { data: context } = await sb.from("transcriptions").selectSearch(
        "title,channel,transcript_fr,summary", "transcript_fr", msg
      );
      if (context && context.length > 0) {
        contextStr = context.map(t => `[${t.channel || ""}] ${t.title || ""}: ${t.summary || t.transcript_fr?.slice(0, 500) || ""}`).join("\n");
      }

      // 2. Send message + context to webhook (response.text(), NOT .json())
      const resp = await fetch(`${N8N_BASE}/${agent.webhook}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, context: contextStr }),
      });
      const agentResponse = await resp.text();

      setChatMessages(prev => ({
        ...prev,
        [agentId]: [...(prev[agentId] || []), { role: "agent", content: agentResponse, time: new Date() }],
      }));
    } catch (e) {
      setChatMessages(prev => ({
        ...prev,
        [agentId]: [...(prev[agentId] || []), { role: "agent", content: `Erreur de connexion à l'agent. Vérifie que le serveur n8n est actif. (${e.message})`, time: new Date() }],
      }));
    }
    setAgentLoading(prev => ({ ...prev, [agentId]: false }));
  };

  // ── DOUBLE-CLICK DELETE → TRASH ──
  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteItem = async (type, id, title) => {
    if (pendingDelete?.id === id) {
      // Second click — delete
      await sb.from("trash").insert({ type, original_id: id, title, deleted_at: new Date().toISOString() });
      if (type === "video") {
        await sb.from("transcriptions").delete({ id });
        await loadVideos();
      } else if (type === "note") {
        await sb.from("notes").delete({ id });
        await loadNotes();
      } else if (type === "task") {
        await sb.from("tasks").delete({ id });
        await loadTasks();
      }
      await loadTrash();
      setPendingDelete(null);
    } else {
      setPendingDelete({ id, type, title });
      setTimeout(() => setPendingDelete(prev => prev?.id === id ? null : prev), 3000);
    }
  };

  // ── SAVE NOTE ──
  const saveNote = async (note) => {
    if (note.id) {
      await sb.from("notes").update({ content: note.content, title: note.title, updated_at: new Date().toISOString() }, { id: note.id });
    } else {
      await sb.from("notes").insert({ ...note, created_at: new Date().toISOString() });
    }
    await loadNotes();
  };

  // ── SAVE USER SETTINGS (Budget, etc.) ──
  const saveUserSettings = async (newSettings) => {
    const merged = { ...userSettings, ...newSettings };
    await sb.from("user_settings").upsert(merged);
    setUserSettings(merged);
  };

  // ── UPDATE TASK COLUMN (Kanban) ──
  const updateTaskColumn = async (taskId, newColumn) => {
    await sb.from("tasks").update({ column: newColumn }, { id: taskId });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column: newColumn } : t));
  };

  // ── RESTORE FROM TRASH ──
  const restoreFromTrash = async (trashItem) => {
    await sb.from("trash").delete({ id: trashItem.id });
    await loadTrash();
    await loadAllData();
  };

  // Current section color
  const currentSection = selectedAgent ? "agents" : (selectedVideo ? "bibliotheque" : page);
  const sectionColor = SECTION_COLORS[currentSection] || SECTION_COLORS.bibliotheque;
  const processingVideos = videos.filter(v => v.status === "processing");
  const completedVideos = videos.filter(v => v.status !== "processing");
  const unreadNotifs = notifications.filter(n => !n.read);

  // ── RENDER ──
  if (loading) {
    return (
      <div style={{ ...S.app, alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🧭</div>
          <div style={{ fontSize:16, color:S.text2 }}>Chargement de votre espace...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {/* ── SIDEBAR ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <div style={S.logoIcon}>AI</div>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:S.text }}>AssistantIA</div>
            <div style={{ fontSize:10, color:S.text3 }}>Espace de travail</div>
          </div>
        </div>

        <div style={{ flex:1, padding:"8px 0", overflowY:"auto" }}>
          {["Contenu", "Compte"].map(section => (
            <React.Fragment key={section}>
              <div style={{ padding:"12px 14px 4px", fontSize:9, color:S.text3, textTransform:"uppercase", letterSpacing:"0.1em" }}>{section}</div>
              {NAV_ITEMS.filter(n => n.section === section).map(item => {
                const isActive = page === item.id && !selectedAgent && !selectedVideo;
                const sc = SECTION_COLORS[item.id] || sectionColor;
                return (
                  <div key={item.id}
                    onClick={() => { setPage(item.id); setSelectedAgent(null); setSelectedVideo(null); }}
                    style={{
                      display:"flex", alignItems:"center", gap:9, padding:"7px 14px", cursor:"pointer", fontSize:12.5,
                      color: isActive ? sc.main : S.text2,
                      background: isActive ? sc.bg : "transparent",
                      borderRight: isActive ? `2px solid ${sc.main}` : "2px solid transparent",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {item.label}
                    {item.id === "bibliotheque" && processingVideos.length > 0 && (
                      <span style={{ marginLeft:"auto", background:"rgba(230,57,70,0.2)", color:"#E63946", fontSize:10, padding:"1px 6px", borderRadius:10, border:"1px solid rgba(230,57,70,0.3)" }}>
                        {processingVideos.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          {/* Agents list */}
          <div style={{ padding:"12px 14px 4px", fontSize:9, color:S.text3, textTransform:"uppercase", letterSpacing:"0.1em" }}>Équipe</div>
          {Object.values(AGENTS_CONFIG).map(agent => {
            const isActive = selectedAgent === agent.id;
            return (
              <div key={agent.id}
                onClick={() => { setSelectedAgent(agent.id); setSelectedVideo(null); }}
                style={{
                  display:"flex", alignItems:"center", gap:8, padding:"6px 14px", cursor:"pointer",
                  background: isActive ? SECTION_COLORS.agents.bg : "transparent",
                  borderLeft: isActive ? `2px solid ${SECTION_COLORS.agents.main}` : "2px solid transparent",
                }}
              >
                <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, border:`1px solid ${S.border2}`, background:`${agent.color}15` }}>
                  {agent.emoji}
                </div>
                <span style={{ fontSize:12, color: isActive ? SECTION_COLORS.agents.main : S.text2, fontWeight: isActive ? 500 : 400 }}>{agent.name}</span>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#2EC4B6", marginLeft:"auto" }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={S.main}>
        {/* TOPBAR */}
        <div style={S.topbar(sectionColor.main)}>
          {/* Search */}
          <div style={{ flex:1, maxWidth:340, display:"flex", alignItems:"center", gap:8, background:"#141E2E", border:`1px solid ${S.border2}`, borderRadius:8, padding:"7px 12px", color:S.text3, fontSize:13 }}>
            <span>🔍</span>
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              style={{ background:"transparent", border:"none", outline:"none", color:S.text, fontSize:13, flex:1, fontFamily:"inherit" }}
            />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginLeft:"auto" }}>
            {/* Pipeline status */}
            <div style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 12px", borderRadius:8, border:`1px solid ${S.border2}`, fontSize:12, color:S.text2 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#2EC4B6", animation:"pulse 2s ease infinite" }} />
              Pipeline actif
            </div>
            {/* Add URL button */}
            <button onClick={() => setShowAddUrl(true)} style={S.btn(sectionColor.main, "#0F1B2D")}>+ Ajouter</button>
            {/* Notifications bell */}
            <div style={{ position:"relative", cursor:"pointer" }} onClick={() => setShowNotifs(!showNotifs)}>
              <span style={{ fontSize:18 }}>🔔</span>
              {unreadNotifs.length > 0 && (
                <span style={{ position:"absolute", top:-4, right:-4, background:"#E63946", color:"#fff", fontSize:9, width:16, height:16, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>
                  {unreadNotifs.length}
                </span>
              )}
            </div>
            {/* Avatar */}
            <div style={{ width:34, height:34, borderRadius:"50%", border:`2px solid ${sectionColor.main}`, background:S.navy2, display:"flex", alignItems:"center", justifyContent:"center", color:sectionColor.main, fontSize:13, fontWeight:600, cursor:"pointer" }}
              onClick={() => { setPage("profil"); setSelectedAgent(null); setSelectedVideo(null); }}>
              M
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS DROPDOWN */}
        {showNotifs && (
          <div style={{ position:"absolute", top:55, right:80, width:340, maxHeight:400, overflowY:"auto", background:"#0F1B2D", border:`1px solid ${S.border2}`, borderRadius:12, zIndex:100, boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${S.border}`, fontSize:13, fontWeight:600 }}>Notifications</div>
            {notifications.length === 0 && <div style={{ padding:16, fontSize:12, color:S.text3 }}>Aucune notification.</div>}
            {notifications.slice(0, 20).map((n, i) => (
              <div key={n.id || i} style={{ padding:"10px 16px", borderBottom:`1px solid ${S.border}`, fontSize:12, color: n.read ? S.text3 : S.text2 }}
                onClick={async () => {
                  if (n.id && !n.read) { await sb.from("notifications").update({ read: true }, { id: n.id }); await loadNotifications(); }
                }}>
                <span style={{ marginRight:8 }}>{n.type === "success" ? "✅" : n.type === "warning" ? "⚠️" : "ℹ️"}</span>
                {n.message}
                <div style={{ fontSize:10, color:S.text3, marginTop:4 }}>{n.created_at ? new Date(n.created_at).toLocaleString("fr-FR") : ""}</div>
              </div>
            ))}
          </div>
        )}

        {/* ADD URL MODAL */}
        {showAddUrl && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
            onClick={() => setShowAddUrl(false)}>
            <div style={{ background:"#0F1B2D", border:`1px solid ${S.border2}`, borderRadius:14, padding:24, width:480 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>Ajouter une vidéo YouTube</div>
              <input
                value={newUrl} onChange={e => setNewUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={S.input}
                onKeyDown={e => { if (e.key === "Enter") addYoutubeUrl(); }}
              />
              <div style={{ display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" }}>
                <button onClick={() => setShowAddUrl(false)} style={{ ...S.btn("transparent", S.text2), border:`1px solid ${S.border2}` }}>Annuler</button>
                <button onClick={addYoutubeUrl} style={S.btn("#00B4D8", "#0F1B2D")}>Envoyer au pipeline</button>
              </div>
            </div>
          </div>
        )}

        {/* ── PAGE CONTENT ── */}
        <div style={S.page}>
          {selectedVideo ? (
            <VideoDetailPage video={selectedVideo} onBack={() => setSelectedVideo(null)} sectionColor={sectionColor} onAgentOpen={setSelectedAgent} />
          ) : selectedAgent ? (
            <AgentPage
              agent={AGENTS_CONFIG[selectedAgent]}
              messages={chatMessages[selectedAgent] || []}
              input={chatInputs[selectedAgent] || ""}
              onInputChange={val => setChatInputs(prev => ({ ...prev, [selectedAgent]: val }))}
              onSend={() => sendAgentMessage(selectedAgent)}
              loading={agentLoading[selectedAgent]}
              sectionColor={SECTION_COLORS.agents}
              videos={videos}
            />
          ) : page === "bibliotheque" ? (
            <BiblioPage
              videos={videos} processingVideos={processingVideos} completedVideos={completedVideos}
              onVideoClick={setSelectedVideo} sectionColor={sectionColor}
              onDelete={deleteItem} pendingDelete={pendingDelete} searchQuery={searchQuery}
            />
          ) : page === "projets" ? (
            <ProjetsPage projects={projects} tasks={tasks} videos={videos}
              onUpdateTaskColumn={updateTaskColumn} sectionColor={sectionColor}
              onVideoClick={setSelectedVideo} loadTasks={loadTasks} loadProjects={loadProjects} />
          ) : page === "chaines" ? (
            <ChainesPage channels={channels} videos={videos} sectionColor={sectionColor}
              onVideoClick={setSelectedVideo} />
          ) : page === "profil" ? (
            <ProfilPage userSettings={userSettings} onSave={saveUserSettings}
              sectionColor={sectionColor} trash={trash} onRestore={restoreFromTrash}
              notifications={notifications} />
          ) : null}
        </div>
      </div>

      {/* ── NOTES RAPIDES (floating button) ── */}
      <div style={{ position:"fixed", bottom:20, right:20, zIndex:50 }}>
        {showNotes && (
          <NotesPanel notes={notes} onSave={saveNote} onClose={() => setShowNotes(false)} onDelete={deleteItem} pendingDelete={pendingDelete} />
        )}
        <button onClick={() => setShowNotes(!showNotes)}
          style={{ width:48, height:48, borderRadius:"50%", background:"#00B4D8", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:"0 4px 16px rgba(0,180,216,0.3)" }}>
          ✏️
        </button>
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
        input::placeholder, textarea::placeholder { color:#5C6B85; }
      `}</style>
    </div>
  );
}

// ============================================================
// BIBLIOTHÈQUE PAGE
// ============================================================
function BiblioPage({ videos, processingVideos, completedVideos, onVideoClick, sectionColor, onDelete, pendingDelete, searchQuery }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date");

  const filtered = completedVideos.filter(v => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (v.title || "").toLowerCase().includes(q) || (v.channel || "").toLowerCase().includes(q) || (v.summary || "").toLowerCase().includes(q);
    }
    if (filter === "all") return true;
    return (v.language || v.lang || "").toLowerCase().includes(filter);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "score") return (b.score || 0) - (a.score || 0);
    return new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0);
  });

  const totalTools = completedVideos.reduce((acc, v) => acc + (v.tools_detected?.length || 0), 0);
  const avgScore = completedVideos.length ? (completedVideos.reduce((acc, v) => acc + (v.score || 0), 0) / completedVideos.length).toFixed(1) : "—";

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18 }}>
        <div>
          <div style={S.pageTitle(sectionColor.main)}>
            <span style={S.accent(sectionColor.main)} />
            Bibliothèque
          </div>
          <div style={{ fontSize:12, color:S.text3, paddingLeft:14 }}>
            {completedVideos.length} vidéos · {processingVideos.length} en cours
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <select value={sort} onChange={e => setSort(e.target.value)}
            style={{ background:"#1A2740", border:`1px solid ${S.border2}`, color:S.text2, fontSize:12, padding:"6px 10px", borderRadius:7, cursor:"pointer" }}>
            <option value="date">Trier : Date</option>
            <option value="score">Trier : Score</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          { label: "Vidéos ingérées", value: completedVideos.length, delta: `+${processingVideos.length} en cours` },
          { label: "Score moyen", value: avgScore },
          { label: "Outils détectés", value: totalTools },
          { label: "En attente", value: processingVideos.length, delta: processingVideos.length > 0 ? "Transcription…" : "" },
        ].map((s, i) => (
          <div key={i} style={{ background:S.navy, border:`1px solid ${S.border}`, borderRadius:10, padding:"12px 14px" }}>
            <div style={{ fontSize:10, color:S.text3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:600, color:S.text }}>{s.value}</div>
            {s.delta && <div style={{ fontSize:11, marginTop:3, color: i === 3 ? "#F4A261" : "#2EC4B6" }}>{s.delta}</div>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:11, color:S.text3 }}>Source :</span>
        {[
          { id: "all", label: "Tout" },
          { id: "ko", label: "🇰🇷 Coréen" },
          { id: "fr", label: "🇫🇷 Français" },
          { id: "en", label: "🌍 International" },
        ].map(f => (
          <span key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding:"5px 12px", borderRadius:20, fontSize:11, cursor:"pointer",
              border: `1px solid ${filter === f.id ? sectionColor.main : S.border2}`,
              color: filter === f.id ? S.navy : S.text2,
              background: filter === f.id ? sectionColor.main : "transparent",
              fontWeight: filter === f.id ? 600 : 400,
            }}>{f.label}</span>
        ))}
      </div>

      {/* Processing cards */}
      {processingVideos.map(v => (
        <div key={v.id || v.url} style={{ background:"#1A2740", border:"1px dashed rgba(0,180,216,0.35)", borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
          <div style={{ width:28, height:28, border:`2px solid ${S.border2}`, borderTop:"2px solid #00B4D8", borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:S.text }}>{v.title || v.url}</div>
            <div style={{ fontSize:11, color:S.text3, marginTop:2 }}>Transcription en cours · Traduction FR automatique après</div>
            <div style={{ marginTop:7, height:3, background:S.border, borderRadius:2, overflow:"hidden" }}>
              <div style={{ height:"100%", width:"42%", background:"#00B4D8", borderRadius:2 }} />
            </div>
          </div>
          <div style={{ fontSize:12, color:S.text3, whiteSpace:"nowrap" }}>~30 min</div>
        </div>
      ))}

      {/* Video grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {sorted.map(v => (
          <VideoCard key={v.id} video={v} onClick={() => onVideoClick(v)} sectionColor={sectionColor}
            onDelete={onDelete} pendingDelete={pendingDelete} />
        ))}
      </div>

      {sorted.length === 0 && !processingVideos.length && (
        <div style={{ textAlign:"center", padding:60, color:S.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📚</div>
          <div style={{ fontSize:14 }}>Aucune vidéo dans la bibliothèque.</div>
          <div style={{ fontSize:12, marginTop:8 }}>Clique sur "+ Ajouter" pour ajouter ta première URL YouTube.</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// VIDEO CARD
// ============================================================
function VideoCard({ video: v, onClick, sectionColor, onDelete, pendingDelete }) {
  const thumbUrl = v.url ? `https://img.youtube.com/vi/${extractYtId(v.url)}/hqdefault.jpg` : null;
  const isPending = pendingDelete?.id === v.id;

  return (
    <div onClick={onClick}
      style={{ ...S.card, opacity: isPending ? 0.5 : (v.is_duplicate ? 0.6 : 1) }}>
      <div style={{ position:"relative", aspectRatio:"16/9", background:S.navy, overflow:"hidden" }}>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={e => { e.target.style.display = "none"; }} />
        ) : (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, opacity:0.4 }}>📺</div>
        )}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"55%", background:"linear-gradient(to top,rgba(10,15,26,0.92),transparent)", pointerEvents:"none" }} />
        {v.score && (
          <span style={{ position:"absolute", top:8, right:8, padding:"3px 8px", borderRadius:20, fontSize:10, fontWeight:600,
            background: v.score >= 8 ? "rgba(46,196,182,0.25)" : "rgba(244,162,97,0.2)",
            color: v.score >= 8 ? "#2EC4B6" : "#F4A261",
            border: `1px solid ${v.score >= 8 ? "rgba(46,196,182,0.4)" : "rgba(244,162,97,0.35)"}`,
          }}>{v.score}/10</span>
        )}
        {v.duration && <span style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.8)", color:"#fff", fontSize:10, padding:"2px 6px", borderRadius:4 }}>{v.duration}</span>}
        {v.is_duplicate && <span style={{ position:"absolute", top:8, left:8, background:"rgba(230,57,70,0.2)", color:"#E63946", fontSize:10, padding:"2px 7px", borderRadius:4, border:"1px solid rgba(230,57,70,0.3)" }}>Similaire</span>}
      </div>
      <div style={{ padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
          <span style={{ fontSize:11, color:S.text3 }}>{v.channel || "—"}</span>
          <span style={{ fontSize:11, color:S.text3, marginLeft:"auto" }}>{v.created_at ? new Date(v.created_at).toLocaleDateString("fr-FR") : ""}</span>
        </div>
        <div style={{ fontSize:13, fontWeight:500, color:S.text, lineHeight:1.4, marginBottom:3 }}>{v.title}</div>
        {v.title_original && <div style={{ fontSize:10, color:S.text3, marginBottom:6, fontStyle:"italic" }}>{v.title_original}</div>}
        {v.summary && <div style={{ fontSize:11, color:S.text2, lineHeight:1.5, marginBottom:9 }}>{(v.summary || "").slice(0, 120)}…</div>}
        {v.tools_detected && v.tools_detected.length > 0 && (
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:9 }}>
            {v.tools_detected.slice(0, 3).map((t, i) => (
              <span key={i} style={{ padding:"3px 8px", borderRadius:20, fontSize:10, background:"rgba(255,255,255,0.07)", color:S.text2, border:`1px solid ${S.border2}` }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <button style={{ padding:"5px 11px", borderRadius:7, fontSize:11, border:`1px solid ${sectionColor.border}`, color:sectionColor.main, cursor:"pointer", background:sectionColor.bg }}>Lire</button>
          <button onClick={e => { e.stopPropagation(); onDelete("video", v.id, v.title); }}
            style={{ padding:"5px 11px", borderRadius:7, fontSize:11, border:`1px solid ${S.border2}`, color: isPending ? "#E63946" : S.text3, cursor:"pointer", background: isPending ? "rgba(230,57,70,0.1)" : "transparent" }}>
            {isPending ? "Confirmer ×" : "🗑"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VIDEO DETAIL PAGE (Bug 3 fix — clickable cards)
// ============================================================
function VideoDetailPage({ video: v, onBack, sectionColor, onAgentOpen }) {
  return (
    <div>
      <button onClick={onBack}
        style={{ ...S.btn("transparent", S.text2), border:`1px solid ${S.border2}`, marginBottom:16 }}>
        ← Retour à la bibliothèque
      </button>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:16 }}>
        {/* Main content */}
        <div>
          <div style={{ ...S.surface2, padding:20, marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              {v.score && <span style={{ padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600, background:"rgba(46,196,182,0.2)", color:"#2EC4B6", border:"1px solid rgba(46,196,182,0.3)" }}>{v.score}/10</span>}
              <span style={{ fontSize:12, color:S.text3 }}>{v.channel}</span>
              <span style={{ fontSize:12, color:S.text3 }}>{v.created_at ? new Date(v.created_at).toLocaleDateString("fr-FR") : ""}</span>
            </div>
            <h2 style={{ fontSize:20, fontWeight:600, marginBottom:6, color:S.text }}>{v.title}</h2>
            {v.title_original && <div style={{ fontSize:13, color:S.text3, fontStyle:"italic", marginBottom:16 }}>{v.title_original}</div>}

            {/* Summary */}
            {v.summary && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:S.text3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Résumé</div>
                <div style={{ fontSize:13, color:S.text2, lineHeight:1.7, padding:14, background:"#1F2E45", borderRadius:8, border:`1px solid ${S.border}` }}>
                  {v.summary}
                </div>
              </div>
            )}

            {/* Transcription */}
            <div>
              <div style={{ fontSize:11, color:S.text3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Transcription complète</div>
              <div style={{ fontSize:12, color:S.text2, lineHeight:1.8, padding:14, background:"#1F2E45", borderRadius:8, border:`1px solid ${S.border}`, maxHeight:400, overflowY:"auto", whiteSpace:"pre-wrap" }}>
                {v.transcript_fr || v.transcript || "Transcription non disponible."}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Thumbnail */}
          {v.url && (
            <div style={{ ...S.surface2, overflow:"hidden" }}>
              <img src={`https://img.youtube.com/vi/${extractYtId(v.url)}/hqdefault.jpg`} alt=""
                style={{ width:"100%", aspectRatio:"16/9", objectFit:"cover" }}
                onError={e => { e.target.style.display = "none"; }} />
              <div style={{ padding:12 }}>
                <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#00B4D8", textDecoration:"none" }}>
                  Voir sur YouTube ↗
                </a>
              </div>
            </div>
          )}

          {/* Detected tools */}
          {v.tools_detected && v.tools_detected.length > 0 && (
            <div style={{ ...S.surface2, padding:14 }}>
              <div style={{ fontSize:11, color:S.text3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Outils détectés</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {v.tools_detected.map((t, i) => (
                  <span key={i} style={{ padding:"5px 12px", borderRadius:20, fontSize:12, background:"rgba(255,255,255,0.07)", color:S.text2, border:`1px solid ${S.border2}` }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Promo codes */}
          {v.promo_codes && v.promo_codes.length > 0 && (
            <div style={{ ...S.surface2, padding:14 }}>
              <div style={{ fontSize:11, color:S.text3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Codes promo détectés</div>
              {v.promo_codes.map((c, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#1F2E45", borderRadius:7, marginBottom:4 }}>
                  <span style={{ fontFamily:"monospace", fontSize:13, fontWeight:600, color:"#2EC4B6" }}>{c}</span>
                  <button onClick={() => navigator.clipboard?.writeText(c)}
                    style={{ marginLeft:"auto", padding:"2px 8px", borderRadius:5, fontSize:10, border:"1px solid rgba(46,196,182,0.3)", color:"#2EC4B6", cursor:"pointer", background:"transparent" }}>
                    Copier
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick agent access */}
          <div style={{ ...S.surface2, padding:14 }}>
            <div style={{ fontSize:11, color:S.text3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Consulter un agent</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.values(AGENTS_CONFIG).slice(0, 4).map(a => (
                <button key={a.id} onClick={() => onAgentOpen(a.id)}
                  style={{ padding:"5px 12px", borderRadius:7, fontSize:11, border:`1px solid ${S.border2}`, color:S.text2, cursor:"pointer", background:"transparent" }}>
                  {a.emoji} {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AGENT PAGE (Bug 1 + Bug 4 fix)
// ============================================================
function AgentPage({ agent, messages, input, onInputChange, onSend, loading, sectionColor, videos }) {
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Double Enter to send (Bug 4 fix — dedicated input)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Check if previous key was also Enter (double enter)
      if (e.target.dataset.lastEnter && Date.now() - parseInt(e.target.dataset.lastEnter) < 500) {
        e.preventDefault();
        onSend();
        e.target.dataset.lastEnter = "";
        return;
      }
      e.target.dataset.lastEnter = Date.now().toString();
    }
  };

  const agentVideosCount = videos.filter(v => v.status !== "processing").length;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", height:"calc(100vh - 92px)", overflow:"hidden" }}>
      {/* FICHE RPG */}
      <div style={{ background:"#1A2740", borderRight:`1px solid ${S.border}`, overflowY:"auto" }}>
        <div style={{ padding:20, borderBottom:`1px solid ${S.border}`, textAlign:"center" }}>
          <div style={{ width:72, height:72, borderRadius:"50%", background:sectionColor.bg, border:`2px solid ${sectionColor.main}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, margin:"0 auto 10px", boxShadow:`0 0 20px ${sectionColor.main}33` }}>
            {agent.emoji}
          </div>
          <div style={{ fontSize:10, color:sectionColor.main, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:4 }}>Classe · {agent.cls}</div>
          <div style={{ fontSize:18, fontWeight:700, color:S.text }}>{agent.name}</div>
          <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:S.text3 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#2EC4B6" }} />En ligne
            </div>
          </div>
        </div>

        {/* Skills */}
        <div style={{ padding:14, borderBottom:`1px solid ${S.border}` }}>
          <div style={{ fontSize:10, color:S.text3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Compétences</div>
          {agent.skills.map((skill, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
              <div style={{ fontSize:12, color:S.text2, flex:1 }}>{skill}</div>
              <div style={{ width:80, height:5, background:S.border, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${85 + Math.random() * 15}%`, borderRadius:3, background:sectionColor.main }} />
              </div>
            </div>
          ))}
        </div>

        {/* Base info */}
        <div style={{ padding:14 }}>
          <div style={{ fontSize:10, color:S.text3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Base de connaissances</div>
          <div style={{ fontSize:12, color:S.text2 }}>
            {agentVideosCount} vidéos accessibles dans la base
          </div>
        </div>
      </div>

      {/* CONVERSATION */}
      <div style={{ display:"flex", flexDirection:"column", minHeight:0 }}>
        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${S.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:sectionColor.bg, border:`1px solid ${sectionColor.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{agent.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:S.text }}>{agent.name}</div>
            <div style={{ fontSize:11, color:S.text3 }}>Web search actif · Base : {agentVideosCount} vidéos</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          {messages.length === 0 && (
            <div style={{ textAlign:"center", color:S.text3, padding:40 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>{agent.emoji}</div>
              <div style={{ fontSize:14, marginBottom:4 }}>Discute avec {agent.name}</div>
              <div style={{ fontSize:12 }}>Pose ta question — l'agent consultera automatiquement ta base de données.</div>
            </div>
          )}
          {messages.map((msg, i) => (
            msg.role === "user" ? (
              <div key={i} style={{ display:"flex", justifyContent:"flex-end" }}>
                <div style={{ maxWidth:"65%", background:sectionColor.bg, border:`1px solid ${sectionColor.border}`, borderRadius:"12px 12px 4px 12px", padding:"10px 14px", fontSize:13, color:S.text, lineHeight:1.6 }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:sectionColor.bg, border:`1px solid ${sectionColor.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{agent.emoji}</div>
                <div style={{ maxWidth:"72%" }}>
                  <div style={{ fontSize:10, color:sectionColor.main, marginBottom:4, fontWeight:500 }}>{agent.name}</div>
                  <div style={{ background:"#1A2740", border:`1px solid ${S.border2}`, borderRadius:"4px 12px 12px 12px", padding:"10px 14px", fontSize:13, color:S.text2, lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          ))}
          {loading && (
            <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:sectionColor.bg, border:`1px solid ${sectionColor.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{agent.emoji}</div>
              <div style={{ background:"#1A2740", border:`1px solid ${S.border2}`, borderRadius:"4px 12px 12px 12px", padding:"12px 16px", display:"flex", gap:4 }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{ width:6, height:6, borderRadius:"50%", background:sectionColor.main, animation:`typing 1.2s ease infinite ${d * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input (Bug 4 fix — controlled input with stable ref) */}
        <div style={{ borderTop:`1px solid ${S.border}`, padding:"14px 20px", flexShrink:0 }}>
          <div style={{ background:"#1A2740", border:`1px solid ${S.border2}`, borderRadius:10, padding:"2px 2px 2px 14px", display:"flex", alignItems:"flex-end", gap:8 }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Écris ta demande à ${agent.name}… (Double Entrée pour envoyer)`}
              rows={1}
              style={{ flex:1, background:"transparent", border:"none", outline:"none", color:S.text, fontSize:13, padding:"10px 0", resize:"none", minHeight:42, maxHeight:120, fontFamily:"inherit", lineHeight:1.5 }}
            />
            <button onClick={onSend} disabled={loading}
              style={{ width:36, height:36, borderRadius:8, background:sectionColor.main, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginBottom:2, opacity: loading ? 0.5 : 1 }}>
              <span style={{ color:"#fff", fontSize:14 }}>→</span>
            </button>
          </div>
          <div style={{ fontSize:10, color:S.text3, marginTop:6, textAlign:"center" }}>
            <strong style={{ color:S.text2 }}>Double Entrée</strong> pour envoyer · Entrée simple = saut de ligne
          </div>
        </div>
      </div>

      <style>{`@keyframes typing { 0%,60%,100%{opacity:0.3;transform:translateY(0)} 30%{opacity:1;transform:translateY(-3px)} }`}</style>
    </div>
  );
}

// ============================================================
// PROJETS PAGE — Kanban
// ============================================================
function ProjetsPage({ projects, tasks, videos, onUpdateTaskColumn, sectionColor, onVideoClick, loadTasks, loadProjects }) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [draggedTask, setDraggedTask] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingNote, setEditingNote] = useState("");

  const COLUMNS = [
    { id: "backlog", label: "📥 Backlog", color: "#8892B0" },
    { id: "todo", label: "📋 À faire", color: "#00B4D8" },
    { id: "doing", label: "⚡ En cours", color: "#F4A261" },
    { id: "done", label: "✅ Terminé", color: "#2EC4B6" },
  ];

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    await sb.from("tasks").insert({
      title: newTaskTitle, column: "backlog", project_id: selectedProject?.id, created_at: new Date().toISOString(),
    });
    setNewTaskTitle("");
    await loadTasks();
  };

  const addProject = async () => {
    if (!newProjectName.trim()) return;
    await sb.from("projects").insert({
      name: newProjectName, status: "active", created_at: new Date().toISOString(),
    });
    setNewProjectName("");
    await loadProjects();
  };

  const handleDrop = (columnId) => {
    if (draggedTask) {
      onUpdateTaskColumn(draggedTask.id, columnId);
      setDraggedTask(null);
    }
  };

  const projectTasks = selectedProject ? tasks.filter(t => t.project_id === selectedProject.id) : tasks;

  return (
    <div>
      <div style={S.pageTitle(sectionColor.main)}>
        <span style={S.accent(sectionColor.main)} />
        Projets
      </div>

      {/* Project list */}
      <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
        <div
          onClick={() => setSelectedProject(null)}
          style={{ padding:"6px 14px", borderRadius:20, fontSize:12, cursor:"pointer",
            background: !selectedProject ? sectionColor.bg : "transparent",
            border: `1px solid ${!selectedProject ? sectionColor.main : S.border2}`,
            color: !selectedProject ? sectionColor.main : S.text2, fontWeight: !selectedProject ? 600 : 400 }}>
          Toutes les tâches
        </div>
        {projects.map(p => (
          <div key={p.id}
            onClick={() => setSelectedProject(p)}
            style={{ padding:"6px 14px", borderRadius:20, fontSize:12, cursor:"pointer",
              background: selectedProject?.id === p.id ? sectionColor.bg : "transparent",
              border: `1px solid ${selectedProject?.id === p.id ? sectionColor.main : S.border2}`,
              color: selectedProject?.id === p.id ? sectionColor.main : S.text2, fontWeight: selectedProject?.id === p.id ? 600 : 400 }}>
            {p.name}
          </div>
        ))}
        {/* Add project inline */}
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
            placeholder="Nouveau projet..." onKeyDown={e => { if (e.key === "Enter") addProject(); }}
            style={{ ...S.input, padding:"5px 10px", fontSize:11, width:160 }} />
          <button onClick={addProject} style={S.btn(sectionColor.main, S.navy)}>+</button>
        </div>
      </div>

      {/* Add task */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
          placeholder="Ajouter une tâche..."
          onKeyDown={e => { if (e.key === "Enter") addTask(); }}
          style={{ ...S.input, flex:1 }} />
        <button onClick={addTask} style={S.btn(sectionColor.main, S.navy)}>Ajouter</button>
      </div>

      {/* Kanban board */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${COLUMNS.length}, 1fr)`, gap:12 }}>
        {COLUMNS.map(col => (
          <div key={col.id}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.id)}
            style={{ background:"#0F1B2D", border:`1px solid ${S.border}`, borderRadius:12, padding:12, minHeight:200 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:600, color:col.color }}>{col.label}</span>
              <span style={{ fontSize:11, color:S.text3, marginLeft:"auto" }}>
                {projectTasks.filter(t => t.column === col.id).length}
              </span>
            </div>
            {projectTasks.filter(t => t.column === col.id).map(task => (
              <div key={task.id}
                draggable
                onDragStart={() => setDraggedTask(task)}
                style={{ background:"#1A2740", border:`1px solid ${S.border2}`, borderRadius:8, padding:"10px 12px", marginBottom:8, cursor:"grab", fontSize:12, color:S.text2 }}>
                {task.title}
                {task.agent && <div style={{ fontSize:10, color:S.text3, marginTop:4 }}>{task.agent}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Project detail / notes */}
      {selectedProject && (
        <div style={{ ...S.surface2, padding:16, marginTop:16 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:12, color:S.text }}>{selectedProject.name} — Notes du projet</div>
          <textarea
            value={editingNote}
            onChange={e => setEditingNote(e.target.value)}
            placeholder="Notes, compte rendu, problématique du projet..."
            style={{ ...S.input, minHeight:120, resize:"vertical" }}
          />
          <button onClick={async () => {
            await sb.from("projects").update({ notes: editingNote }, { id: selectedProject.id });
            await loadProjects();
          }}
            style={{ ...S.btn(sectionColor.main, S.navy), marginTop:8 }}>Enregistrer</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHAÎNES PAGE
// ============================================================
function ChainesPage({ channels, videos, sectionColor, onVideoClick }) {
  return (
    <div>
      <div style={S.pageTitle(sectionColor.main)}>
        <span style={S.accent(sectionColor.main)} />
        Chaînes surveillées
      </div>

      {channels.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:S.text3 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📡</div>
          <div style={{ fontSize:14 }}>Aucune chaîne dans la base.</div>
          <div style={{ fontSize:12, marginTop:8 }}>Les chaînes apparaissent automatiquement quand des vidéos sont ingérées.</div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:14 }}>
        {channels.map(ch => {
          const chVideos = videos.filter(v => v.channel === ch.name && v.status !== "processing");
          return (
            <div key={ch.id} style={{ ...S.surface2, padding:18 }}>
              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                <div style={{ width:50, height:50, borderRadius:"50%", background:S.navy2, border:`2px solid ${S.border2}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                  {ch.flag || "📺"}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:600, color:S.text }}>{ch.name}</div>
                  <div style={{ fontSize:12, color:S.text3, marginTop:2 }}>{chVideos.length} vidéos ingérées</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:20, background:"rgba(46,196,182,0.1)", border:"1px solid rgba(46,196,182,0.25)", fontSize:11, color:"#2EC4B6" }}>
                  Surveillée
                </div>
              </div>

              {/* Recent videos from this channel */}
              {chVideos.slice(0, 3).map(v => (
                <div key={v.id} onClick={() => onVideoClick(v)}
                  style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 6px", borderRadius:8, cursor:"pointer", marginBottom:4 }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width:72, height:40, borderRadius:5, background:S.navy, flexShrink:0, overflow:"hidden" }}>
                    {v.url && <img src={`https://img.youtube.com/vi/${extractYtId(v.url)}/default.jpg`} alt=""
                      style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.style.display = "none"} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:S.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{v.title}</div>
                    <div style={{ fontSize:10, color:S.text3, marginTop:2 }}>{v.created_at ? new Date(v.created_at).toLocaleDateString("fr-FR") : ""}</div>
                  </div>
                  {v.score && <span style={{ padding:"2px 6px", borderRadius:10, fontSize:10, background:"rgba(46,196,182,0.15)", color:"#2EC4B6", border:"1px solid rgba(46,196,182,0.3)" }}>{v.score}/10</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// PROFIL PAGE (Bug 5 fix — Budget editable)
// ============================================================
function ProfilPage({ userSettings, onSave, sectionColor, trash, onRestore, notifications }) {
  const [budgetThreshold, setBudgetThreshold] = useState(userSettings.budget_threshold || 50);
  const [showTrash, setShowTrash] = useState(false);

  const currentSpend = userSettings.current_spend || 0;
  const budgetPct = budgetThreshold > 0 ? (currentSpend / budgetThreshold) * 100 : 0;
  const budgetColor = budgetPct >= 80 ? "#E63946" : budgetPct >= 60 ? "#F4A261" : "#2EC4B6";

  return (
    <div>
      <div style={S.pageTitle(sectionColor.main)}>
        <span style={S.accent(sectionColor.main)} />
        Profil & Préférences
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:16 }}>
        {/* Left — Identity */}
        <div>
          <div style={{ ...S.surface2, overflow:"hidden" }}>
            <div style={{ padding:"24px 20px", textAlign:"center", borderBottom:`1px solid ${S.border}`, background:`linear-gradient(to bottom, ${sectionColor.bg}, transparent)` }}>
              <div style={{ width:80, height:80, borderRadius:"50%", border:`3px solid ${sectionColor.main}`, background:S.navy2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:700, color:sectionColor.main, margin:"0 auto 12px" }}>M</div>
              <div style={{ fontSize:17, fontWeight:600, color:S.text }}>{userSettings.display_name || "Utilisateur"}</div>
              <div style={{ fontSize:12, color:S.text3, marginTop:3 }}>{userSettings.email || ""}</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:8, padding:"4px 12px", borderRadius:20, background:sectionColor.bg, border:`1px solid ${sectionColor.border}`, fontSize:11, color:sectionColor.main, fontWeight:500 }}>
                ⭐ {userSettings.plan || "Solo"}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr" }}>
              {[
                { label: "Chaînes", val: userSettings.channels_count || 0 },
                { label: "Vidéos", val: userSettings.videos_count || 0 },
                { label: "Projets", val: userSettings.projects_count || 0 },
              ].map((s, i) => (
                <div key={i} style={{ padding:"10px 8px", textAlign:"center", borderRight: i < 2 ? `1px solid ${S.border}` : "none" }}>
                  <div style={{ fontSize:16, fontWeight:600, color:S.text }}>{s.val}</div>
                  <div style={{ fontSize:9, color:S.text3, marginTop:2, textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Trash access */}
            <div style={{ padding:14, borderTop:`1px solid ${S.border}` }}>
              <button onClick={() => setShowTrash(!showTrash)}
                style={{ ...S.btn("transparent", S.text2), border:`1px solid ${S.border2}`, width:"100%", fontSize:12 }}>
                🗑️ Corbeille ({trash.length})
              </button>
            </div>
          </div>
        </div>

        {/* Right — Settings */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* BUDGET SECTION (Bug 5 fix) */}
          <div style={{ ...S.surface2, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${S.border}`, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:7, background:sectionColor.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>💰</div>
              <div style={{ fontSize:13, fontWeight:500, color:S.text }}>Budget API</div>
            </div>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:11, color:S.text3, marginBottom:4 }}>Dépenses actuelles</div>
                  <div style={{ fontSize:24, fontWeight:600, color:budgetColor }}>{currentSpend.toFixed(2)} €</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:S.text3, marginBottom:4 }}>Seuil d'alerte (modifiable)</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <input
                      type="number" value={budgetThreshold}
                      onChange={e => setBudgetThreshold(Number(e.target.value))}
                      style={{ ...S.input, width:100, padding:"6px 10px" }}
                    />
                    <span style={{ fontSize:12, color:S.text3 }}>€ / mois</span>
                    <button onClick={() => onSave({ budget_threshold: budgetThreshold })}
                      style={S.btn(sectionColor.main, "#fff")}>
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height:6, background:S.border, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(budgetPct, 100)}%`, background:budgetColor, borderRadius:3, transition:"width 0.3s" }} />
              </div>
              <div style={{ fontSize:11, color:S.text3, marginTop:6 }}>
                {budgetPct.toFixed(0)}% du budget utilisé
                {budgetPct >= 80 && <span style={{ color:"#E63946", marginLeft:8 }}>⚠ Attention — seuil critique</span>}
                {budgetPct >= 60 && budgetPct < 80 && <span style={{ color:"#F4A261", marginLeft:8 }}>⚠ Approche du seuil</span>}
              </div>
            </div>
          </div>

          {/* Affinities */}
          <div style={{ ...S.surface2, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${S.border}`, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:7, background:sectionColor.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🎯</div>
              <div style={{ fontSize:13, fontWeight:500, color:S.text }}>Domaine & affinités</div>
            </div>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {(userSettings.affinities || []).map((a, i) => (
                  <span key={i} style={{ padding:"5px 12px", borderRadius:20, fontSize:12, background:sectionColor.bg, border:`1px solid ${sectionColor.main}`, color:S.text, fontWeight:500 }}>{a}</span>
                ))}
                {(!userSettings.affinities || userSettings.affinities.length === 0) && (
                  <span style={{ fontSize:12, color:S.text3 }}>Aucune affinité définie. Configure-les dans l'onboarding.</span>
                )}
              </div>
            </div>
          </div>

          {/* Agent config */}
          <div style={{ ...S.surface2, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${S.border}`, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:7, background:"rgba(127,119,221,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>⚙️</div>
              <div style={{ fontSize:13, fontWeight:500, color:S.text }}>Configuration des agents</div>
            </div>
            <div style={{ padding:"14px 16px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {Object.values(AGENTS_CONFIG).map(a => (
                  <div key={a.id} style={{ padding:"10px 12px", background:"#1F2E45", borderRadius:8, display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, border:`1px solid ${S.border2}`, background:`${a.color}15` }}>{a.emoji}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:S.text }}>{a.name}</div>
                    </div>
                    <div style={{ width:32, height:18, borderRadius:9, cursor:"pointer", background:"#2EC4B6", position:"relative" }}>
                      <div style={{ width:14, height:14, borderRadius:"50%", background:"#fff", position:"absolute", top:2, left:16 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trash panel */}
      {showTrash && (
        <div style={{ ...S.surface2, padding:16, marginTop:16 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:12, color:S.text }}>🗑️ Corbeille (conservation 30 jours)</div>
          {trash.length === 0 && <div style={{ fontSize:12, color:S.text3 }}>La corbeille est vide.</div>}
          {trash.map(item => (
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderBottom:`1px solid ${S.border}` }}>
              <span style={{ fontSize:12, color:S.text2, flex:1 }}>{item.title || item.type}</span>
              <span style={{ fontSize:10, color:S.text3 }}>{item.deleted_at ? new Date(item.deleted_at).toLocaleDateString("fr-FR") : ""}</span>
              <button onClick={() => onRestore(item)}
                style={{ padding:"4px 10px", borderRadius:6, fontSize:11, border:`1px solid ${S.border2}`, color:"#2EC4B6", cursor:"pointer", background:"transparent" }}>
                Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NOTES RAPIDES PANEL
// ============================================================
function NotesPanel({ notes, onSave, onClose, onDelete, pendingDelete }) {
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const startNew = () => { setEditing("new"); setTitle(""); setContent(""); };
  const startEdit = (note) => { setEditing(note.id); setTitle(note.title || ""); setContent(note.content || ""); };
  const save = () => {
    if (editing === "new") onSave({ title, content });
    else onSave({ id: editing, title, content });
    setEditing(null);
  };

  return (
    <div style={{ position:"absolute", bottom:60, right:0, width:340, maxHeight:500, background:"#0F1B2D", border:`1px solid rgba(0,180,216,0.35)`, borderRadius:12, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:13, fontWeight:600, color:"#E8EDF5" }}>📝 Notes Rapides</span>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={startNew} style={{ padding:"3px 10px", borderRadius:6, fontSize:11, border:"1px solid rgba(0,180,216,0.35)", color:"#00B4D8", cursor:"pointer", background:"rgba(0,180,216,0.1)" }}>+ Nouvelle</button>
          <button onClick={onClose} style={{ padding:"3px 8px", borderRadius:6, fontSize:12, border:"none", color:"#5C6B85", cursor:"pointer", background:"transparent" }}>✕</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:12 }}>
        {editing ? (
          <div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre (optionnel)"
              style={{ ...S.input, marginBottom:8, fontSize:12, padding:"8px 10px" }} />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Ta note..."
              style={{ ...S.input, minHeight:100, resize:"vertical", fontSize:12 }} />
            <div style={{ display:"flex", gap:6, marginTop:8 }}>
              <button onClick={save} style={S.btn("#00B4D8", "#0F1B2D")}>Enregistrer</button>
              <button onClick={() => setEditing(null)} style={{ ...S.btn("transparent", "#A8B5CC"), border:`1px solid rgba(255,255,255,0.14)` }}>Annuler</button>
            </div>
          </div>
        ) : (
          <>
            {notes.length === 0 && <div style={{ fontSize:12, color:"#5C6B85", textAlign:"center", padding:20 }}>Aucune note. Clique "+" pour commencer.</div>}
            {notes.map(note => (
              <div key={note.id} style={{ padding:"10px 12px", background:"#1A2740", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, marginBottom:8, cursor:"pointer" }}
                onClick={() => startEdit(note)}>
                {note.title && <div style={{ fontSize:12, fontWeight:500, color:"#E8EDF5", marginBottom:4 }}>{note.title}</div>}
                <div style={{ fontSize:11, color:"#A8B5CC", lineHeight:1.5 }}>{(note.content || "").slice(0, 100)}{(note.content || "").length > 100 ? "…" : ""}</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  <span style={{ fontSize:9, color:"#5C6B85" }}>{note.updated_at ? new Date(note.updated_at).toLocaleDateString("fr-FR") : ""}</span>
                  <button onClick={e => { e.stopPropagation(); onDelete("note", note.id, note.title); }}
                    style={{ fontSize:10, color: pendingDelete?.id === note.id ? "#E63946" : "#5C6B85", cursor:"pointer", background:"transparent", border:"none" }}>
                    {pendingDelete?.id === note.id ? "Confirmer ×" : "🗑"}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// UTILITIES
// ============================================================
function extractYtId(url) {
  if (!url) return "";
  const match = url.match(/(?:v=|\/)([\w-]{11})/);
  return match ? match[1] : "";
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Plus, Users, Clock, Calendar, Play, LogIn, LogOut, Crown, X, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";

interface Tournament {
  id: string;
  name: string;
  format: string;
  status: "upcoming" | "ongoing" | "finished";
  timeControl: string;
  startTime: string | null;
  creatorId: string;
  creatorUsername: string;
  participantCount: number;
}

interface TournamentDetail extends Tournament {
  participants: { userId: string; username: string; points: number; rank: number | null }[];
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa", label: "Upcoming" },
  ongoing:  { bg: "rgba(34,197,94,0.15)",  text: "#4ade80", label: "Live" },
  finished: { bg: "rgba(255,255,255,0.07)", text: "rgba(255,255,255,0.4)", label: "Finished" },
};

const TC_LABELS: Record<string, string> = {
  bullet_1: "Bullet 1+0", blitz_3: "Blitz 3+0", blitz_5: "Blitz 5+0",
  rapid_10: "Rapid 10+0", rapid_15_10: "Rapid 15+10",
};

export default function TournamentsPage() {
  const user = getUser();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<TournamentDetail | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "my">("all");

  const [form, setForm] = useState({
    name: "",
    format: "swiss",
    timeControl: "blitz_5",
    startTime: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "my" && user) {
        const data = await apiFetch<any[]>("/tournament/my");
        setTournaments(data as any);
      } else {
        const data = await apiFetch<Tournament[]>("/tournament");
        setTournaments(data);
      }
    } catch { setTournaments([]); }
    finally { setLoading(false); }
  }, [tab, user?.id]);

  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    try {
      const data = await apiFetch<TournamentDetail>(`/tournament/${id}`);
      setSelected(data);
    } catch {}
  }, []);

  const handleJoin = useCallback(async (id: string) => {
    setActionLoading(id + "_join");
    try {
      await apiFetch(`/tournament/${id}/join`, { method: "POST" });
      await load();
      if (selected?.id === id) await openDetail(id);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  }, [load, selected, openDetail]);

  const handleLeave = useCallback(async (id: string) => {
    setActionLoading(id + "_leave");
    try {
      await apiFetch(`/tournament/${id}/leave`, { method: "DELETE" });
      await load();
      if (selected?.id === id) await openDetail(id);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  }, [load, selected, openDetail]);

  const handleStart = useCallback(async (id: string) => {
    setActionLoading(id + "_start");
    try {
      await apiFetch(`/tournament/${id}/start`, { method: "PATCH" });
      await load();
      if (selected?.id === id) await openDetail(id);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  }, [load, selected, openDetail]);

  const handleCreate = async () => {
    if (!form.name.trim()) { alert("Please enter a tournament name"); return; }
    setActionLoading("create");
    try {
      await apiFetch("/tournament", { method: "POST", body: JSON.stringify(form) });
      setShowCreate(false);
      setForm({ name: "", format: "swiss", timeControl: "blitz_5", startTime: "" });
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const isJoined = (t: TournamentDetail) => t.participants.some(p => p.userId === user?.id);

  return (
    <div style={{ padding: "28px 36px", minHeight: "100%", background: "linear-gradient(180deg,#0a0a12,#0d0d1a)", color: "white" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Trophy size={24} color="#a855f7" />
            <h1 style={{ fontSize: "26px", fontWeight: 800, margin: 0 }}>Tournaments</h1>
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", margin: 0, fontSize: "13px" }}>
            Compete in organized chess tournaments
          </p>
        </div>
        {user && (
          <button onClick={() => setShowCreate(true)} style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "linear-gradient(135deg,#a855f7,#7c3aed)",
            border: "none", borderRadius: "10px", color: "white",
            padding: "10px 18px", cursor: "pointer", fontWeight: 700, fontSize: "13px",
          }}>
            <Plus size={16} /> Create Tournament
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {(["all", "my"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 18px", borderRadius: "7px", fontWeight: 600, fontSize: "13px", border: "none", cursor: "pointer",
            background: tab === t ? "rgba(168,85,247,0.25)" : "transparent",
            color: tab === t ? "#a855f7" : "rgba(255,255,255,0.5)",
          }}>
            {t === "all" ? "All Tournaments" : "My Tournaments"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid rgba(168,85,247,0.3)", borderTop: "3px solid #a855f7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      ) : tournaments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.3)" }}>
          <Trophy size={48} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>No tournaments yet</p>
          {user && <p style={{ fontSize: "13px" }}>Be the first to create one!</p>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px,1fr))", gap: "14px" }}>
          {tournaments.map(t => {
            const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.upcoming;
            return (
              <div key={t.id} onClick={() => openDetail(t.id)} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "14px", padding: "18px 20px", cursor: "pointer", transition: "all 0.2s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.35)"; (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.06)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, flex: 1 }}>{t.name}</h3>
                  <span style={{ background: st.bg, color: st.text, borderRadius: "8px", padding: "2px 10px", fontSize: "11px", fontWeight: 700, flexShrink: 0, marginLeft: "10px" }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <Info icon={<Crown size={11} />} label={t.creatorUsername} />
                  <Info icon={<Clock size={11} />} label={TC_LABELS[t.timeControl] ?? t.timeControl} />
                  <Info icon={<Users size={11} />} label={`${t.participantCount} players`} />
                  {t.startTime && <Info icon={<Calendar size={11} />} label={new Date(t.startTime).toLocaleDateString()} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", textTransform: "capitalize" }}>{t.format} format</span>
                  <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <Modal onClose={() => setSelected(null)} title={selected.name}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <Chip label={STATUS_STYLE[selected.status]?.label ?? selected.status} color={STATUS_STYLE[selected.status]?.text ?? "#fff"} />
            <Chip label={TC_LABELS[selected.timeControl] ?? selected.timeControl} color="#f59e0b" />
            <Chip label={`${selected.format} format`} color="#60a5fa" />
          </div>

          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "16px" }}>
            Created by <strong style={{ color: "white" }}>{selected.creatorUsername}</strong>
            {selected.startTime && ` · Starts ${new Date(selected.startTime).toLocaleString()}`}
          </div>

          {/* Leaderboard */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Participants ({selected.participants.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto" }}>
              {selected.participants.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>No participants yet</div>
              ) : selected.participants.map((p, i) => (
                <div key={p.userId} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px", borderRadius: "8px",
                  background: p.userId === user?.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                  border: p.userId === user?.id ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent",
                }}>
                  <span style={{ width: "20px", color: i < 3 ? ["#f59e0b","#9ca3af","#b45309"][i] : "rgba(255,255,255,0.3)", fontWeight: 700, fontSize: "12px" }}>
                    {p.rank ?? i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: "13px", fontWeight: p.userId === user?.id ? 700 : 400 }}>{p.username}</span>
                  <span style={{ fontSize: "12px", color: "#a855f7", fontWeight: 600 }}>{p.points} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {user && (
            <div style={{ display: "flex", gap: "8px" }}>
              {isJoined(selected) ? (
                <>
                  {selected.status === "upcoming" && selected.creatorId === user.id && (
                    <button onClick={() => handleStart(selected.id)} disabled={!!actionLoading}
                      style={{ flex: 1, padding: "10px", borderRadius: "9px", fontWeight: 700, fontSize: "13px", cursor: "pointer", border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "white" }}>
                      <Play size={14} style={{ display: "inline", marginRight: "6px" }} />
                      Start Tournament
                    </button>
                  )}
                  {selected.status === "upcoming" && (
                    <button onClick={() => handleLeave(selected.id)} disabled={!!actionLoading}
                      style={{ flex: 1, padding: "10px", borderRadius: "9px", fontWeight: 700, fontSize: "13px", cursor: "pointer", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                      <LogOut size={14} style={{ display: "inline", marginRight: "6px" }} />
                      Leave
                    </button>
                  )}
                </>
              ) : selected.status === "upcoming" ? (
                <button onClick={() => handleJoin(selected.id)} disabled={!!actionLoading}
                  style={{ flex: 1, padding: "10px", borderRadius: "9px", fontWeight: 700, fontSize: "13px", cursor: "pointer", border: "none", background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "white" }}>
                  <LogIn size={14} style={{ display: "inline", marginRight: "6px" }} />
                  Join Tournament
                </button>
              ) : null}
            </div>
          )}
        </Modal>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Create Tournament">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Field label="Tournament Name">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Weekend Blitz Open" style={inputStyle} />
            </Field>
            <Field label="Format">
              <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} style={inputStyle}>
                <option value="swiss">Swiss</option>
                <option value="round_robin">Round Robin</option>
                <option value="elimination">Single Elimination</option>
              </select>
            </Field>
            <Field label="Time Control">
              <select value={form.timeControl} onChange={e => setForm(f => ({ ...f, timeControl: e.target.value }))} style={inputStyle}>
                {Object.entries(TC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Start Time (optional)">
              <input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={inputStyle} />
            </Field>
            <button onClick={handleCreate} disabled={actionLoading === "create"} style={{
              padding: "12px", borderRadius: "10px", fontWeight: 700, fontSize: "14px",
              cursor: "pointer", border: "none", background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "white",
              opacity: actionLoading === "create" ? 0.6 : 1,
            }}>
              {actionLoading === "create" ? "Creating..." : "Create Tournament"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "8px", color: "white", padding: "9px 12px", fontSize: "13px", outline: "none",
  boxSizing: "border-box",
};

function Info({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>
      {icon} {label}
    </span>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color + "20", color, borderRadius: "8px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "min(480px, 95vw)", maxHeight: "85vh", overflowY: "auto", zIndex: 1001,
        background: "linear-gradient(135deg,#0f0f1a,#1a1025)", border: "1px solid rgba(168,85,247,0.3)",
        borderRadius: "18px", padding: "24px", boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "5px" }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

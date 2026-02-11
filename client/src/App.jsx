 import React, { useEffect, useState } from "react";
 import { Timer } from "./Timer";
import { initEventLogger, logEvent, shutdownEventLogger } from "./eventLogger";
 
 const API_BASE = `${process.env.REACT_APP_API_URL}/api`;
 
 async function startAttempt(candidateId, durationSeconds) {
   const res = await fetch(`${API_BASE}/attempts/start`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ candidateId, durationSeconds })
   });
   if (!res.ok) throw new Error("Failed to start attempt");
   return res.json();
 }
 
 async function fetchTimer(attemptId) {
   const res = await fetch(`${API_BASE}/attempts/${attemptId}/timer`);
   if (!res.ok) throw new Error("Failed to fetch timer");
   return res.json();
 }
 
 async function submitAttempt(attemptId, reason) {
   const res = await fetch(`${API_BASE}/attempts/${attemptId}/submit`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ reason })
   });
   if (!res.ok) throw new Error("Failed to submit");
   return res.json();
 }
 
function useBrowserEnforcement(attemptId, enabled) {
   useEffect(() => {
    if (!attemptId || !enabled) return;
 
     function handleVisibilityChange() {
       logEvent("TAB_VISIBILITY_CHANGED", { visibilityState: document.visibilityState });
     }
 
     function handleFocus() {
       logEvent("WINDOW_FOCUS_GAINED");
     }
 
     function handleBlur() {
       logEvent("WINDOW_FOCUS_LOST");
     }
 
     function handleFullscreenChange() {
       const isFs = !!document.fullscreenElement;
       logEvent("FULLSCREEN_CHANGED", { isFullscreen: isFs });
     }
 
     function handleCopy(e) {
       logEvent("COPY_ATTEMPT", { selectedTextLength: window.getSelection()?.toString().length || 0 });
     }
 
     function handlePaste(e) {
       logEvent("PASTE_ATTEMPT");
     }
 
     function handleKeydown(e) {
       if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "v")) {
         logEvent("COPY_PASTE_KEYBOARD_SHORTCUT", { key: e.key });
       }
     }
 
     document.addEventListener("visibilitychange", handleVisibilityChange);
     window.addEventListener("focus", handleFocus);
     window.addEventListener("blur", handleBlur);
     document.addEventListener("fullscreenchange", handleFullscreenChange);
     document.addEventListener("copy", handleCopy);
     document.addEventListener("paste", handlePaste);
     document.addEventListener("keydown", handleKeydown);
 
     logEvent("ASSESSMENT_VIEW_LOADED");
 
     return () => {
       document.removeEventListener("visibilitychange", handleVisibilityChange);
       window.removeEventListener("focus", handleFocus);
       window.removeEventListener("blur", handleBlur);
       document.removeEventListener("fullscreenchange", handleFullscreenChange);
       document.removeEventListener("copy", handleCopy);
       document.removeEventListener("paste", handlePaste);
       document.removeEventListener("keydown", handleKeydown);
     };
  }, [attemptId, enabled]);
 }
 
 export function App() {
   const [attemptId, setAttemptId] = useState(null);
   const [remainingMs, setRemainingMs] = useState(null);
   const [status, setStatus] = useState("idle");
   const [candidateId, setCandidateId] = useState("candidate-123");
   const [durationMinutes, setDurationMinutes] = useState(30);
   const [submitted, setSubmitted] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logCandidates, setLogCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateEvents, setCandidateEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
 
  useBrowserEnforcement(attemptId, !submitted);
 
   useEffect(() => {
     if (!attemptId) return;
     initEventLogger(attemptId);
   }, [attemptId]);
 
   async function handleStart(e) {
     e.preventDefault();
     try {
       setStatus("starting");
       const durationSeconds = Number(durationMinutes) * 60;
       const data = await startAttempt(candidateId, durationSeconds);
       setAttemptId(data.attemptId);
       setRemainingMs(data.remainingMs);
       logEvent("ASSESSMENT_STARTED", {
         attemptId: data.attemptId,
         durationSeconds
       });
 
       // Initial fullscreen request for stricter mode
       if (document.documentElement.requestFullscreen) {
         try {
           await document.documentElement.requestFullscreen();
           logEvent("FULLSCREEN_REQUESTED_ON_START", { success: true });
         } catch {
           logEvent("FULLSCREEN_REQUESTED_ON_START", { success: false });
         }
       }
     } catch (err) {
       console.error(err);
       setStatus("error");
     } finally {
       setStatus("in_progress");
     }
   }
 
   async function syncTimer() {
     if (!attemptId) return;
     try {
       const data = await fetchTimer(attemptId);
       setRemainingMs(data.remainingMs);
       setStatus(data.status);
     } catch (e) {
       console.error("Timer sync failed", e);
     }
    }

  async function loadLogCandidates() {
    setLoadingCandidates(true);
    try {
      const res = await fetch(`${API_BASE}/admin/logs/candidates`);
      if (!res.ok) throw new Error("Failed to load candidates");
      const data = await res.json();
      setLogCandidates(data.candidates || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCandidates(false);
    }
  }

  async function loadCandidateEvents(candidate) {
    setLoadingEvents(true);
    try {
      const res = await fetch(
        `${API_BASE}/admin/logs/candidates/${encodeURIComponent(candidate)}/events`
      );
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      setCandidateEvents(data.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function handleToggleLogs() {
    const next = !showLogs;
    setShowLogs(next);
    if (next && logCandidates.length === 0) {
      await loadLogCandidates();
    }
  }

  async function handleCandidateClick(id) {
    setSelectedCandidate(id);
    await loadCandidateEvents(id);
    setShowEventsModal(true);
  }
 
   async function handleManualSubmit() {
     if (!attemptId) return;
     try {
       logEvent("MANUAL_SUBMIT_CLICKED");
       const res = await submitAttempt(attemptId, "candidate_clicked_submit");
       setStatus(res.status);
       setSubmitted(true);
      shutdownEventLogger();
     } catch (e) {
       console.error(e);
     }
   }
 
   async function handleAutoSubmit() {
     if (!attemptId) return;
     return submitAttempt(attemptId, "timer_expired_auto_submit").then((res) => {
       setStatus(res.status);
       setSubmitted(true);
      shutdownEventLogger();
     });
   }
 
   useEffect(() => {
    if (!attemptId || submitted) return;
     const id = window.setInterval(syncTimer, 30_000);
     return () => window.clearInterval(id);
  }, [attemptId, submitted]);
 
   const disabled = status === "starting" || submitted;
 
   return (
     <div
       style={{
         minHeight: "100vh",
         fontFamily: "system-ui, sans-serif",
         background: "#0f172a",
         color: "white",
         padding: "32px"
       }}
     >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          background: "#020617",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          border: "1px solid rgba(148,163,184,0.3)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            gap: "12px"
          }}
        >
          <div>
            <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>
              Secure Assessment Environment
            </h1>
            <p style={{ color: "#9ca3af", marginBottom: 0 }}>
              Timer-enforced, monitored test session. Events are logged for employer review.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLogs}
            style={{
              padding: "8px 14px",
              borderRadius: "999px",
              border: "1px solid #4b5563",
              backgroundColor: showLogs ? "#111827" : "#020617",
              color: "white",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            {showLogs ? "Hide Logs" : "View Logs"}
          </button>
        </div>

        {showLogs && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px",
              borderRadius: "12px",
              border: "1px solid #4b5563",
              backgroundColor: "#020617"
            }}
          >
            <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>Candidates</h2>
            {loadingCandidates && (
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>Loading candidates...</p>
            )}
            {!loadingCandidates && logCandidates.length === 0 && (
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>No candidates found yet.</p>
            )}
            {!loadingCandidates && logCandidates.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {logCandidates.map((c) => (
                  <li
                    key={c.candidate_id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom: "1px solid rgba(55,65,81,0.6)"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleCandidateClick(c.candidate_id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#38bdf8",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      {c.candidate_id}
                    </button>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                      {c.attempts} attempt{c.attempts !== 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
 
         {!attemptId && (
           <form onSubmit={handleStart} style={{ marginBottom: "24px" }}>
             <div style={{ marginBottom: "12px" }}>
               <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                 Candidate ID
               </label>
               <input
                 type="text"
                 value={candidateId}
                 onChange={(e) => setCandidateId(e.target.value)}
                 required
                 style={{
                   width: "100%",
                   padding: "8px 10px",
                   borderRadius: "8px",
                   border: "1px solid #4b5563",
                   background: "#020617",
                   color: "white"
                 }}
               />
             </div>
             <div style={{ marginBottom: "16px" }}>
               <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                 Duration (minutes)
               </label>
               <input
                 type="number"
                 min="1"
                 max="240"
                 value={durationMinutes}
                 onChange={(e) => setDurationMinutes(e.target.value)}
                 style={{
                   width: "100%",
                   padding: "8px 10px",
                   borderRadius: "8px",
                   border: "1px solid #4b5563",
                   background: "#020617",
                   color: "white"
                 }}
               />
             </div>
             <button
               type="submit"
               style={{
                 padding: "10px 16px",
                 borderRadius: "999px",
                 border: "none",
                 background:
                   "linear-gradient(135deg, rgba(56,189,248,1), rgba(59,130,246,1), rgba(236,72,153,1))",
                 color: "white",
                 fontWeight: 600,
                 cursor: "pointer"
               }}
             >
               Start Assessment
             </button>
           </form>
         )}
 
         {attemptId && (
           <>
             <div style={{ marginBottom: "16px", fontSize: "14px", color: "#9ca3af" }}>
               Attempt ID: <code>{attemptId}</code>
             </div>
             <div style={{ marginBottom: "24px" }}>
               <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Question 1</h2>
               <p style={{ color: "#e5e7eb", marginBottom: "12px" }}>
                 Assume this is an assessment question shown on `https://example.com/`. Your actions
                 (tab changes, copy/paste, fullscreen, timer) are being logged.
               </p>
               <textarea
                 disabled={disabled}
                 rows={8}
                 style={{
                   width: "100%",
                   padding: "10px",
                   borderRadius: "12px",
                   border: "1px solid #4b5563",
                   background: "#020617",
                   color: "white",
                   resize: "vertical"
                 }}
                 onChange={(e) => {
                   logEvent("ANSWER_CHANGED", { questionId: "q1", length: e.target.value.length });
                 }}
               />
             </div>
             <button
               onClick={handleManualSubmit}
               disabled={disabled}
               style={{
                 padding: "10px 16px",
                 borderRadius: "999px",
                 border: "none",
                 backgroundColor: disabled ? "#4b5563" : "#22c55e",
                 color: "white",
                 fontWeight: 600,
                 cursor: disabled ? "not-allowed" : "pointer"
               }}
             >
               Submit Assessment
             </button>
             {submitted && (
               <p style={{ marginTop: "12px", color: "#22c55e", fontSize: "14px" }}>
                 Assessment submitted. Further edits are disabled.
               </p>
             )}
           </>
         )}
      </div>

      {attemptId && remainingMs != null && !submitted && (
        <Timer
          attemptId={attemptId}
          durationMs={remainingMs}
          onExpire={() => {
            // can show UI notification if desired
          }}
          onAutoSubmit={handleAutoSubmit}
        />
      )}

      {showEventsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000
          }}
        >
          <div
            style={{
              width: "90%",
              maxWidth: "900px",
              maxHeight: "80vh",
              backgroundColor: "#020617",
              borderRadius: "16px",
              border: "1px solid #4b5563",
              padding: "16px",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px"
              }}
            >
              <h2 style={{ fontSize: "18px" }}>
                Events for candidate: <span style={{ color: "#38bdf8" }}>{selectedCandidate}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowEventsModal(false)}
                style={{
                  border: "none",
                  borderRadius: "999px",
                  padding: "6px 10px",
                  backgroundColor: "#4b5563",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "13px"
                }}
              >
                Close
              </button>
            </div>

            {loadingEvents && (
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>Loading events...</p>
            )}

            {!loadingEvents && candidateEvents.length === 0 && (
              <p style={{ fontSize: "14px", color: "#9ca3af" }}>No events for this candidate.</p>
            )}

            {!loadingEvents && candidateEvents.length > 0 && (
              <div
                style={{
                  marginTop: "8px",
                  overflowY: "auto",
                  paddingRight: "4px"
                }}
              >
                {candidateEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      padding: "8px 6px",
                      borderBottom: "1px solid rgba(55,65,81,0.6)",
                      fontSize: "13px"
                    }}
                  >
                    <div style={{ marginBottom: "2px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          backgroundColor: "#0f172a",
                          color: "#f97316",
                          fontSize: "11px",
                          marginRight: "6px"
                        }}
                      >
                        {ev.event_type}
                      </span>
                      <span style={{ color: "#9ca3af" }}>
                        {new Date(ev.event_ts).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: "#9ca3af" }}>
                      Attempt: <code>{ev.attempt_id}</code>
                    </div>
                    {ev.metadata && (
                      <div
                        style={{
                          marginTop: "2px",
                          color: "#9ca3af",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                          fontSize: "12px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word"
                        }}
                      >
                        {(() => {
                          try {
                            const parsed =
                              typeof ev.metadata === "string"
                                ? JSON.parse(ev.metadata)
                                : ev.metadata;
                            return JSON.stringify(parsed, null, 2);
                          } catch {
                            return String(ev.metadata);
                          }
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

}
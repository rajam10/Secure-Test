 import React, { useEffect, useState } from "react";
 import { Timer } from "./Timer";
import { initEventLogger, logEvent, shutdownEventLogger } from "./eventLogger";
 
 const API_BASE = "/api";
 
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
           maxWidth: "800px",
           margin: "0 auto",
           background: "#020617",
           borderRadius: "16px",
           padding: "24px",
           boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
           border: "1px solid rgba(148,163,184,0.3)"
         }}
       >
         <h1 style={{ fontSize: "24px", marginBottom: "8px" }}>Secure Assessment Environment</h1>
         <p style={{ color: "#9ca3af", marginBottom: "24px" }}>
           Timer-enforced, monitored test session. Events are logged for employer review.
         </p>
 
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
     </div>
   );
 }
 

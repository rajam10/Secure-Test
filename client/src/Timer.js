 import React, { useEffect, useState } from "react";
 import { logEvent } from "./eventLogger";
 
 const STORAGE_KEY_TIMER = "secureTest_timerState";
 
 function loadTimerState(attemptId) {
   try {
     const raw = window.localStorage.getItem(STORAGE_KEY_TIMER);
     if (!raw) return null;
     const parsed = JSON.parse(raw);
     if (parsed.attemptId !== attemptId) return null;
     return parsed;
   } catch {
     return null;
   }
 }
 
 function saveTimerState(state) {
   try {
     window.localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify(state));
   } catch {
     // ignore
   }
 }
 
 function formatMs(ms) {
   const totalSeconds = Math.max(0, Math.floor(ms / 1000));
   const h = Math.floor(totalSeconds / 3600);
   const m = Math.floor((totalSeconds % 3600) / 60);
   const s = totalSeconds % 60;
   const pad = (n) => n.toString().padStart(2, "0");
   if (h > 0) {
     return `${pad(h)}:${pad(m)}:${pad(s)}`;
   }
   return `${pad(m)}:${pad(s)}`;
 }
 
 export function Timer({ attemptId, durationMs, warningThresholdMs = 5 * 60 * 1000, onExpire, onAutoSubmit }) {
   const [remainingMs, setRemainingMs] = useState(durationMs);
   const [warningFired, setWarningFired] = useState(false);
 
   useEffect(() => {
     // Try to restore timer state
     const restored = loadTimerState(attemptId);
     if (restored) {
       const now = Date.now();
       const drift = now - restored.clientNow;
       const newRemaining = Math.max(0, restored.remainingMs - drift);
       setRemainingMs(newRemaining);
       if (newRemaining <= warningThresholdMs && !warningFired) {
         setWarningFired(true);
       }
     }
     logEvent("TIMER_STARTED", { durationMs });
   }, [attemptId]);
 
   useEffect(() => {
     if (remainingMs <= 0) {
       logEvent("TIMER_EXPIRED");
       onExpire && onExpire();
       (async () => {
         try {
           await onAutoSubmit?.();
           logEvent("TIMER_AUTO_SUBMISSION_TRIGGERED");
         } catch (e) {
           // swallow
         }
       })();
       return;
     }
 
     const interval = window.setInterval(() => {
       setRemainingMs((prev) => {
         const next = Math.max(0, prev - 1000);
         const state = {
           attemptId,
           remainingMs: next,
           clientNow: Date.now()
         };
         saveTimerState(state);
         if (!warningFired && next <= warningThresholdMs && next > 0) {
           setWarningFired(true);
           logEvent("TIMER_WARNING_THRESHOLD_REACHED", { remainingMs: next });
           window.alert("Warning: 5 minutes remaining!");
         }
         return next;
       });
     }, 1000);
 
     return () => window.clearInterval(interval);
   }, [remainingMs, attemptId, warningFired, warningThresholdMs, onExpire, onAutoSubmit]);
 
   return (
     <div
       style={{
         position: "fixed",
         top: 0,
         right: 0,
         padding: "8px 12px",
         backgroundColor: remainingMs <= warningThresholdMs ? "#b91c1c" : "#111827",
         color: "white",
         fontFamily: "system-ui, sans-serif",
         zIndex: 9999,
         borderBottomLeftRadius: "8px",
         boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
       }}
     >
       <span style={{ fontSize: "12px", opacity: 0.8 }}>Time Remaining</span>
       <div style={{ fontSize: "18px", fontWeight: "bold" }}>{formatMs(remainingMs)}</div>
     </div>
   );
 }
 

 const STORAGE_KEY_QUEUE = "secureTest_eventQueue";
 
 function loadQueue() {
   try {
     const raw = window.localStorage.getItem(STORAGE_KEY_QUEUE);
     return raw ? JSON.parse(raw) : [];
   } catch {
     return [];
   }
 }
 
 function saveQueue(queue) {
   try {
     window.localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
   } catch {
     // ignore
   }
 }
 
 let queue = [];
 let attemptIdGlobal = null;
 let batchIntervalId = null;
let enabled = true;
let beforeUnloadHandler = null;
 
 export function initEventLogger(attemptId) {
   attemptIdGlobal = attemptId;
  enabled = true;
   // Restore any pending events from previous sessions
   queue = loadQueue();
   startBatching();
 }
 
export function shutdownEventLogger() {
  enabled = false;
  attemptIdGlobal = null;
  queue = [];
  saveQueue(queue);
  if (batchIntervalId) {
    window.clearInterval(batchIntervalId);
    batchIntervalId = null;
  }
  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
}

 export function buildBaseMetadata() {
   return {
     userAgent: navigator.userAgent,
     language: navigator.language,
     platform: navigator.platform,
     screen: {
       width: window.screen.width,
       height: window.screen.height
     },
     viewport: {
       width: window.innerWidth,
       height: window.innerHeight
     },
     focusState: document.visibilityState,
     isFullscreen: !!document.fullscreenElement
   };
 }
 
 export function logEvent(type, payload = {}) {
  if (!enabled || !attemptIdGlobal) return;
   const event = {
     attemptId: attemptIdGlobal,
     type,
     timestamp: new Date().toISOString(),
     metadata: {
       ...buildBaseMetadata(),
       ...payload
     }
   };
   queue.push(event);
   saveQueue(queue);
 }
 
 async function flushQueue() {
  if (!enabled || !attemptIdGlobal || queue.length === 0) return;
   const toSend = [...queue];
   try {
     // Prefer sendBeacon for reliability on unload
     const url = `${process.env.REACT_APP_API_URL}/api/attempts/${encodeURIComponent(attemptIdGlobal)}/events/batch`;
     const body = JSON.stringify({ events: toSend });
     const headers = { type: "application/json" };
 
     let ok = false;
     if (navigator.sendBeacon) {
       const blob = new Blob([body], { type: "application/json" });
       ok = navigator.sendBeacon(url, blob);
     }
 
     if (!ok) {
       const res = await fetch(url, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body
       });
       ok = res.ok;
     }
 
     if (ok) {
       queue = [];
       saveQueue(queue);
     }
   } catch {
     // keep queue; will retry later
   }
 }
 
 function startBatching() {
   if (batchIntervalId) return;
   batchIntervalId = window.setInterval(() => {
     flushQueue();
   }, 5000);
 
  beforeUnloadHandler = () => {
    flushQueue();
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);
 }
 

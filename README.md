 # Secure Test Environment
 
 React + Node.js + MySQL based secure assessment environment with:
 - Enforced assessment timer
 - Unified event logging and audit trail
 - Browser/focus/fullscreen/copy-paste enforcement hooks
 
 ## Structure
 - `server/` - Node.js + Express API and MySQL persistence
 - `client/` - React SPA front-end
 
 ## Getting Started (local dev)
 
 ### Prerequisites
 - Node.js 18+
 - MySQL 8+ running locally
 
 ### Backend
 ```bash
 cd server
 npm install
 npm run dev
 ```
 
 ### Frontend
 ```bash
 cd client
 npm install
 npm start
 ```
 
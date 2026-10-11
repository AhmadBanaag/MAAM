# Classroom Quiz Battle 🎮

**Classroom Quiz Battle** is a local-network multiplayer quiz competition platform designed for university classroom presentations. One administrator controls the presentation game from a laptop, while 5 team leaders participate in real time using their smartphones over local Wi-Fi without requiring internet access.

---

## 🏗️ Architecture Overview

The system is built to run entirely offline on a host laptop:

```text
       ┌────────────────────────────────────────────────────────┐
       │               Host Laptop (Local Server)               │
       │                                                        │
       │   [0.0.0.0:3000 Node.js HTTP Server (server.ts)]       │
       │   ├── Next.js App Router (UI & SSR Routes)             │
       │   ├── Socket.IO Server (Authoritative Real-Time Engine)│
       │   └── SQLite Database (Local Persistent Storage)       │
       └───────────────────────────┬────────────────────────────┘
                                   │ Local Wi-Fi Network
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
   Presenter Laptop       Team 1 Smartphone         Team 2-5 Smartphones
  (Admin: /admin)          (Player: /player)          (Player: /player)
```

### Key Technical Highlights:
1. **Unified Server Architecture (`server.ts`)**:
   - A single Node.js HTTP server binds to `0.0.0.0:3000`.
   - Next.js (App Router) and Socket.IO share the exact same port (`3000`).
   - Phones simply connect to `http://<laptop-ip>:3000` with no separate backend port or CORS firewall complications.
2. **Zero External Dependencies**:
   - No Firebase, Supabase, external APIs, cloud auth, or CDN assets.
   - All fonts, styling, icons, and QR code generation are bundled and executed locally.
3. **Local SQLite Persistence**:
   - Stores game sessions and team records locally in `./data/quiz-battle.db` with WAL mode enabled.
4. **Authoritative Real-time Layer**:
   - Low-latency WebSocket connections with automatic fallback to polling.
   - Built-in ping/pong round-trip latency tracking (< 5ms on local Wi-Fi).
5. **Session Safety & Browser Refresh Protection**:
   - Registered teams receive a secret reconnect token stored in `localStorage`.
   - Refreshing the phone browser automatically re-authenticates the team without creating duplicate records or losing identity.

---

## 📦 Tech Stack

- **Framework**: Next.js (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with dark presentation palette
- **Real-Time Communication**: Socket.IO & Socket.IO Client
- **Icons**: Lucide React
- **Database**: SQLite (`better-sqlite3`)
- **QR Code**: `qrcode.react` (client-side SVG)
- **Runtime**: Node.js v20+

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v20 or higher installed on the laptop)
- Laptop connected to a Wi-Fi router or mobile hotspot

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Test Suites
```bash
# Verify Foundation (HTTP & WebSocket connectivity)
npx tsx scripts/verify-foundation.ts

# Verify Team Registration & Lobby (All 6 core test cases)
npx tsx scripts/test-registration-lobby.ts
```

---

## ⚡ Starting the Server

### Development Mode (Recommended for testing):
```bash
npm run dev
```

### Production Mode (Fastest performance for presentations):
```bash
npm run build
npm start
```

When started, the terminal will display your laptop's local access and Wi-Fi addresses:
```text
=======================================================
  🎮 CLASSROOM QUIZ BATTLE - LOCAL SERVER ONLINE
=======================================================
  Localhost (laptop):    http://localhost:3000
  Wi-Fi IP (for phones): http://192.168.1.6:3000  <-- USE THIS ON SMARTPHONES
-------------------------------------------------------
  Admin URL:             /admin
  Player URL:            /player
=======================================================
```

---

## 📱 Team Registration & Lobby Workflow

### 1. Presenter Starts Session (`/admin`)
- The administrator opens `/admin` on the laptop.
- The dashboard displays a unique session code (e.g. `SESSION-EFA8E5`).
- An on-screen QR code and copyable registration link pointing to `http://<laptop-ip>:3000/player?session=<sessionId>` are displayed.
- The QR code **never points to localhost** and automatically uses the laptop's reachable local Wi-Fi address.

### 2. Team Leaders Register on Smartphones
- Up to 5 team leaders scan the QR code or open `http://<laptop-ip>:3000/player`.
- Leaders input:
  - **Team Name** (e.g. `Quantum Quizzers`)
  - **Team Leader Name** (e.g. `Alice`)
- Real-time server-side validation:
  - Duplicate team names (case-insensitive and trimmed) are rejected.
  - Registrations after 5 teams are rejected (`Lobby is full`).
  - Registrations while registration is closed are rejected.

### 3. Real-Time 5-Slot Lobby
- The administrator dashboard and home screen show 5 distinct slots (Slots 1 to 5).
- Each slot displays:
  - Assigned Slot Number & Color
  - Team Name & Leader Name
  - Real-time Connection Indicator: **Online (Green)** or **Offline / Reconnecting (Red)**
- The administrator can toggle registration open/closed at any time.
- The administrator can remove/kick a team to reopen a slot if needed.

### 4. Player Waiting Room & Refresh Safety
- Once registered, the phone enters the **Waiting Room**.
- The assigned slot number, color, team name, and leader name are displayed.
- **Refresh Resilient**: If a phone refreshes or disconnects, its secret token re-establishes the connection immediately without re-registering or creating duplicate entries.
- Players can test buzzer connectivity with instant visual confirmation.

---

## 📁 Project Structure

```text
ac-presentation-game/
├── data/                      # Local SQLite database files
│   └── quiz-battle.db
├── scripts/
│   ├── verify-foundation.ts        # Phase 1 integration test
│   └── test-registration-lobby.ts  # Phase 2 registration & lobby test suite
├── src/
│   ├── app/
│   │   ├── admin/             # Administrator control dashboard & lobby
│   │   │   └── page.tsx
│   │   ├── api/               # Local network diagnostic endpoint
│   │   │   └── server-info/
│   │   │       └── route.ts
│   │   ├── player/            # Mobile-first registration & waiting room
│   │   │   └── page.tsx
│   │   ├── globals.css        # Presentation dark theme tokens
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home presentation hub & live lobby roster
│   ├── components/
│   │   ├── admin-registration-qr.tsx # Admin session QR & link controller
│   │   ├── lobby-slots.tsx           # Visual 5-slot team lobby grid
│   │   ├── network-info-card.tsx     # LAN IP display & QR code
│   │   └── server-status-badge.tsx   # Latency & socket health indicator
│   ├── hooks/
│   │   ├── use-is-mounted.ts  # React 19 SSR hydration guard
│   │   └── use-socket.ts      # Reactive Socket.IO client hook with lobby state
│   ├── lib/
│   │   ├── db.ts              # SQLite session & team registration queries
│   │   ├── network.ts         # Wi-Fi network interface prioritizer
│   │   ├── socket-client.ts   # Dynamic-origin socket singleton
│   │   └── utils.ts           # Classnames & Tailwind utilities
│   └── types/
│       └── socket.ts          # Typed client-server socket events
├── next.config.ts
├── package.json
├── server.ts                  # Authoritative Node.js 0.0.0.0 server
├── tsconfig.json
└── README.md
```

---

## 🧪 Phase 2 Verification Checklist

- [x] **Admin Session Creation**: Unique session identifier generated with status tracking and "New Session" capability.
- [x] **Non-Localhost QR Code**: Registration QR code strictly uses the reachable local Wi-Fi IPv4 address (`192.168.1.6`), never `localhost`.
- [x] **Copyable Registration URL**: Built-in 1-click clipboard copy for the registration link.
- [x] **Registration Status & Toggle**: Administrator can close or reopen registration at any point.
- [x] **Input Validation**: Whitespace trimming and 2-30 character length checks on both team and leader names.
- [x] **Duplicate Prevention**: Case-insensitive and trimmed duplicate team names rejected server-side.
- [x] **5-Team Limit**: Exactly 5 slots supported; 6th team rejected with "Session is full" notice.
- [x] **Real-Time 5-Slot Lobby**: Shows live slots on Admin dashboard and Home screen with auto-updating roster.
- [x] **Online vs Offline Status**: Distinguishes registered teams that are currently connected vs disconnected.
- [x] **Session Safety**: Secret token reconnection preserves team identity across browser refreshes without duplicate registration.
- [x] **Automated Test Suite**: All 6 tests passing in `scripts/test-registration-lobby.ts`.

---

## 🎯 Phase 3: Real-Time Quiz Engine & Question Management

### Features Implemented:
1. **Question Bank CRUD**:
   - Create, edit, and delete questions with 4 choices (A, B, C, D), correct answer, configurable time limit (15s–60s), and point values.
   - Pre-seeded with 5 standard computer science/networking questions for immediate testing.
2. **Activate Surprise Quiz**:
   - Administrator can trigger a surprise quiz anytime with the prominent **"Activate Surprise Quiz"** button.
   - Server broadcasts the question text and 4 choices to all connected clients simultaneously.
3. **Anti-Cheat Guarantee**:
   - The server **NEVER** sends the correct answer to player smartphones before the question deadline expires.
4. **Single-Submission Lockout**:
   - Teams can submit once per question.
   - After submission, choices are locked immediately with visual confirmation. Duplicate submissions and changing answers are rejected on the server.
5. **Synchronized Countdown**:
   - Synchronized countdown timer driven by server timestamps (`deadline = startedAt + timeLimit * 1000`).
6. **Automatic Expiration & Server Scoring**:
   - When the question timer expires (or if the admin ends the quiz early), the server automatically grades all answers:
     - Correct answer: +100 points
     - Incorrect or no answer: +0 points
   - Scores are updated in SQLite and broadcast to the leaderboard.
7. **Reconnection & Refresh Safety**:
   - If a player refreshes during an active question, their locked-in submission choice is preserved and displayed with the remaining timer.

---

## 🧪 Testing a Surprise Quiz with Two Browser Windows

Before involving all five smartphones, you can test the entire surprise quiz flow directly on your laptop using two browser windows:

1. **Window 1 (Presenter Admin Dashboard)**:
   - Open a browser window to [http://localhost:3000/admin](http://localhost:3000/admin).
   - Click **"New Session"** to create a fresh session.
   - Note the Session ID (e.g., `SESSION-XXXXXX`).

2. **Window 2 (Team Leader Player Portal)**:
   - Open an **Incognito / Private browser window** to [http://localhost:3000/player](http://localhost:3000/player).
     *(Using Incognito ensures the player has an independent `localStorage` session distinct from the presenter).*
   - Enter Team Name (e.g. `Quantum Quizzers`) and Leader Name (e.g. `Alice`).
   - Click **"Join Battle Lobby"**.
   - Notice Window 1 immediately updates to **1/5 Teams Registered** in Slot 1!

3. **Trigger the Surprise Quiz**:
   - In Window 1 (Admin Dashboard), click the pulsing **"Activate Surprise Quiz"** button.
   - In Window 2 (Player Portal), observe:
     - The banner changes immediately to **"🚨 SURPRISE QUIZ ACTIVE"**.
     - The synchronized countdown timer begins ticking down.
     - Four large buttons for **A**, **B**, **C**, and **D** appear.

4. **Submit an Answer & Test Single Submission**:
   - In Window 2 (Player), click an answer option (e.g., **B**).
   - Notice the button locks in with a green lock badge: **"Choice [B] Locked In!"**.
   - In Window 1 (Admin), notice the live progress tracker updates: **"1 / 1 Teams Answered"**.
   - Try refreshing Window 2: notice it immediately reconnects and preserves your locked-in Choice [B] without allowing resubmission.

5. **Question Expiration & Results**:
   - Let the countdown expire, or click **"End Active Quiz"** in Window 1.
   - In Window 2 (Player), the correct answer is revealed along with your result:
     - **🎉 CORRECT! +100 PTS** (if correct) or **❌ INCORRECT (+0 PTS)**.
     - Your updated team score is displayed.
   - In Window 1 (Admin) and on the Home screen ([http://localhost:3000](http://localhost:3000)), the live scoreboard reflects the updated points!

# Classroom Quiz Battle 🎮

Classroom Quiz Battle is a local-network multiplayer quiz game built for university classroom presentations. One presenter controls the game from a laptop, while up to five student teams participate in real time using their smartphones over local Wi-Fi without requiring internet connectivity.

---

## Accessing the System

| User Role | URL | Screen Purpose |
| :--- | :--- | :--- |
| **Presenter (Admin)** | `http://localhost:3000/admin` | Controls questions, activates surprise quizzes, manages team registration, assigns spells, and triggers clincher rounds. |
| **Projector (Spectator)** | `http://localhost:3000` | Displays on the classroom projector screen. Shows live 5-slot lobby rosters, active question choices, live submission counters, and podium standings. |
| **Student Teams (Player)** | `http://<laptop-ip>:3000/player` | Mobile interface for team leaders. Used to join a team slot, view questions, trigger team spells, and lock in answer choices. |

> Note: Students can also join by scanning the dynamic QR code displayed on the presenter screen or the projector screen.

---

## Network Setup & Connecting Phones

The entire application runs locally on the host laptop. No internet connection, cloud services, or external APIs are required.

### 1. Connect All Devices to the Same Local Network
- **Option A (Wi-Fi Router)**: Connect both the host laptop and the smartphones to the same classroom Wi-Fi network.
- **Option B (Mobile Hotspot)**: Turn on a personal hotspot on a smartphone or laptop, then connect all devices to it.

### 2. Identify the Laptop Wi-Fi IP Address
When you run the server, the terminal automatically detects and prints the reachable Wi-Fi address:

```text
=======================================================
  🎮 CLASSROOM QUIZ BATTLE - LOCAL SERVER ONLINE
=======================================================
  Localhost (laptop):    http://localhost:3000
  Wi-Fi IP (for phones): http://10.0.0.58:3000  <-- USE THIS ON SMARTPHONES
  Other adapter [Ethernet 4]: http://192.168.56.1:3000 (virtual adapter - DO NOT USE)
-------------------------------------------------------
  Admin URL:             /admin
  Player URL:            /player
=======================================================
```

- Use the address labeled **Wi-Fi IP (for phones)**.
- Do not use virtual adapter addresses (such as WSL, VirtualBox, or Hyper-V adapters) on phones.

### 3. Windows Firewall Configuration
If student smartphones cannot load the URL:
1. Open Windows Defender Firewall -> **Allow an app or feature through Windows Defender Firewall**.
2. Locate `Node.js JavaScript Runtime`.
3. Check both **Private** and **Public** checkboxes.
4. Alternatively, run PowerShell as Administrator to allow port 3000:
   ```powershell
   New-NetFirewallRule -DisplayName "Quiz Battle Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

---

## Quick Start Guide

### Prerequisites
- Node.js version 20 or higher installed on the host laptop.
- Git repository cloned locally.

### 1. Installation
Install project dependencies:
```bash
npm install
```

### 2. Running the Server

#### Production Mode (Recommended for presentations):
```bash
npm run build
npm start
```

#### Development Mode:
```bash
npm run dev
```

### 3. First-Time Administrator Setup
1. Open `http://localhost:3000/admin` in your laptop browser.
2. If this is a fresh database, the setup screen prompts you to create the initial administrator account.
3. Choose an administrator username (at least 3 characters) and password (at least 8 characters).
4. Upon submission, an authenticated session cookie is set and you are redirected to the dashboard.

---

## Operating Workflow

### Step 1: Manage the Question Bank (`/admin/questions`)
- The Question Bank starts fresh with zero questions, ready for your presentation topics.
- **Add Questions**: Enter question text, choices A through D, the correct option letter, the time limit in seconds (15s to 60s), and the point value.
- **Global Persistence**: Questions are saved globally in the SQLite repository. Creating new game sessions, restarting the server, or switching tabs will never wipe or hide your saved questions.
- **Reordering**: Adjust the sequence using the order controls so questions appear in your preferred presentation order.
- **Clear Question Bank**: To remove all questions and start completely fresh, click "Clear Question Bank" in the header and confirm.

### Step 2: Start a Game Session & Open Registration (`/admin/registration`)
- Click **"New Session"** to create a fresh session identifier (e.g. `SESSION-DBEEB5`).
- The dashboard generates a registration QR code pointing directly to `http://<laptop-ip>:3000/player?session=<sessionId>`.
- Keep registration **OPEN** while students join.
- Up to 5 teams can register. Each team provides a **Team Name** and a **Leader Name**.
- Duplicate names and attempts to exceed the 5-team limit are automatically rejected.
- Once all 5 slots are filled, click **"Close Registration"** to lock the roster.

### Step 3: Assign Team Power-Ups (`/admin`)
Each registered team receives one unique spell:
1. **Invisibility Spell**: Hides option text (A, B, C, D text is blanked out) for opposing teams, forcing them to guess blindly.
2. **Lockdown Spell**: Freezes an opposing team out of the upcoming question entirely.
3. **Back to Sender Shield**: Places a reflective barrier on the team. Any offensive spell cast on them bounces back to the attacking team.
4. **Riddle Gatekeeper**: Locks opposing teams behind a riddle. They must solve the riddle text input before the question choices unlock.
5. **Answer Reveal**: Highlights the correct answer letter directly on the team's mobile screen.

Click **"Shuffle Power-Ups"** to randomize spell distribution across teams.

### Step 4: Present Surprise Quizzes
1. When your presentation reaches a quiz slide, click **"Activate Surprise Quiz"** on `/admin`.
2. The server broadcasts the question to the projector and all player devices simultaneously.
3. **Anti-Cheat Guarantee**: Correct answers are never sent to player phones during an active question.
4. **Optimistic Locking**: When a student taps an option, their device locks the answer with zero visual latency and haptic feedback.
5. **Single Submission**: Once locked, choices cannot be changed or resubmitted.
6. When the timer hits zero (or if ended manually), the server reveals the correct choice, calculates points, and updates the leaderboard.

### Step 5: Sudden-Death Clincher Tie-Breaker
- If the final question ends with multiple teams tied for 1st place, the system enters the **Clincher Arena**.
- Only the tied teams can answer the tie-breaker questions. Other teams spectate.
- Rounds continue until a single champion emerges.
- The administrator can also trigger a clincher round manually from the admin controls.

### Step 6: Presentation Finale
- End the game from `/admin` to display the final presentation podium on the projector (`http://localhost:3000`).
- The podium showcases 1st, 2nd, and 3rd place winners with final point totals and statistics.

---

## Reliability & Performance Features

### 1. Browser Refresh & Reconnection Protection
If a student's phone refreshes, disconnects, or locks its screen during the game:
- Reconnect credentials saved in `localStorage` re-authenticate the team automatically.
- Their team slot, assigned spell, locked-in choices, and point scores remain intact.
- The server rejects duplicate registrations while preserving legitimate reconnects.

### 2. NTP-Style Clock Drift Calibration
Mobile devices often have internal clocks that drift by several seconds:
- Every socket ping/pong measures round-trip latency and calculates `serverTimeOffset`.
- Countdown timers calibrate against `Date.now() + serverTimeOffset`.
- The presenter laptop, the projector, and all student phones tick down in millisecond synchronization.

### 3. Isolated Timer Components
- High-frequency countdown tickers run inside an isolated `<CountdownTimer />` component.
- The parent dashboard, spectator screen, and player pages do not trigger full React re-renders during active timer ticks.

### 4. Database Optimization
- SQLite runs with `journal_mode = WAL`, `synchronous = NORMAL`, and memory caching.
- Compound indexes ensure team lookups, session queries, and submissions execute in sub-millisecond time.

### 5. Web Audio Touch Auto-Unlock
- Mobile browsers restrict Web Audio playback until a user gesture occurs.
- The audio engine auto-unlocks on the first touch event so game sound effects play cleanly on mobile devices.

---

## Automated Verification Tests

Run the included verification scripts to validate system functionality:

```bash
# 1. Verify Socket Deduplication (50 redundant calls produce 0 broadcast storms)
npx tsx scripts/test-registration-dedup.ts

# 2. Verify Database PRAGMAs, Compound Indexes, and Cache Invalidation
npx tsx scripts/test-database-optimization.ts

# 3. Verify Fresh Question Bank & Cross-Session Persistence
npx tsx scripts/test-fresh-question-bank.ts

# 4. Verify Step 4 Optimistic Submissions & NTP Clock Drift
npx tsx scripts/test-step4-optimizations.ts

# 5. Full Production Build Verification
npm run build
```

---

## Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Phone shows "Site can't be reached"** | Phone is not on the same network or Windows Firewall is blocking inbound connections. | Verify phone is connected to the same Wi-Fi router or hotspot. Ensure port 3000 is allowed in Windows Firewall. |
| **Phone connects to wrong IP** | Multiple network adapters are active (e.g. WSL, VirtualBox). | Use the IP specifically labeled **Wi-Fi IP** in the startup terminal banner. |
| **Port 3000 is already in use** | An older instance of Node.js is still running in the background. | In PowerShell run: `Get-Process -Name node | Stop-Process -Force` and restart with `npm start`. |
| **Sound effects do not play on phone** | Mobile browser blocked audio before the first user tap. | Tap anywhere on the player screen to unlock audio playback. |
| **Forgot Admin Password** | Initial credentials need to be reset. | Delete or clear the administrator record in `./data/quiz-battle.db` and visit `/admin` to run initial setup again. |

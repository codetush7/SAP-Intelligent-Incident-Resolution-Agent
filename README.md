# SAP CPI AI Ticketing Integration Agent

An AI-powered operational support agent that **automatically detects, diagnoses, and creates tickets** for SAP Cloud Platform Integration (CPI) failures — powered by Claude AI (Anthropic).

---

## 🚀 Features

| Capability | Description |
|---|---|
| 🔍 Auto Detection | Monitors iFlows, JMS queues, SFTP, APIs, Certificates 24×7 |
| 🤖 AI Root Cause Analysis | Claude AI analyzes logs and identifies root causes in seconds |
| 🎫 Auto Ticket Creation | Creates tickets in ServiceNow / Jira automatically |
| 📊 Smart Priority | Assigns CRITICAL/HIGH/MEDIUM/LOW based on business impact |
| 👥 Auto Assignment | Routes tickets to correct team (SAP, CRM, Middleware, Vendor) |
| 💬 AI Chat Agent | Chat with the AI for diagnosis and resolution guidance |
| 📡 Real-Time Updates | WebSocket live feed for instant event notifications |
| 🔔 Proactive Alerts | Detects certificate expiry, queue buildup before business impact |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  Dashboard | Tickets | Monitoring | Agent | Analysis │
└──────────────────────┬──────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────┐
│              Node.js / Express Backend               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ AI Agent    │  │  Monitoring  │  │  Ticketing │  │
│  │ (Claude AI) │  │  Service     │  │  Service   │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                │                │          │
│  ┌──────▼────────────────▼────────────────▼──────┐   │
│  │           In-Memory Data Store                │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
         │                    │
┌────────▼───────┐   ┌────────▼──────────┐
│  Anthropic API │   │ ServiceNow / Jira  │
│  (Claude AI)   │   │  (External ITSM)   │
└────────────────┘   └───────────────────┘
```

---

## 📁 Project Structure

```
sap-cpi-ticketing-agent/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   └── cpiAgent.js          # Core AI agent (Claude integration)
│   │   ├── routes/
│   │   │   ├── agent.js             # AI chat & incident processing
│   │   │   ├── analysis.js          # Root cause analysis API
│   │   │   ├── dashboard.js         # Stats & trends
│   │   │   ├── monitoring.js        # Monitoring status & alerts
│   │   │   ├── tickets.js           # Full ticket CRUD
│   │   │   └── webhooks.js          # SAP CPI push alerts
│   │   ├── services/
│   │   │   ├── monitoringService.js # Background polling & checks
│   │   │   ├── ticketingService.js  # ServiceNow / Jira integration
│   │   │   └── websocketService.js  # Real-time WebSocket server
│   │   ├── utils/
│   │   │   ├── dataStore.js         # In-memory data store (seed data)
│   │   │   └── logger.js            # Winston logger
│   │   └── server.js                # Express app entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── Dashboard/
│   │   │       └── Sidebar.js       # Navigation sidebar
│   │   ├── hooks/
│   │   │   └── useWebSocket.js      # WS connection hook
│   │   ├── pages/
│   │   │   ├── DashboardPage.js     # Main dashboard with charts
│   │   │   ├── TicketsPage.js       # Ticket management
│   │   │   ├── MonitoringPage.js    # System monitoring
│   │   │   ├── AgentPage.js         # AI chat + incident simulation
│   │   │   └── AnalysisPage.js      # Root cause analysis tool
│   │   ├── services/
│   │   │   └── api.js               # Axios API client
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
├── start.sh
└── README.md
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- npm 9+
- Anthropic API Key ([get one here](https://console.anthropic.com))

### 1. Clone & Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

**Minimum required in `backend/.env`:**
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=5000
FRONTEND_URL=http://localhost:3000
```

**Optional (for external ITSM sync):**
```env
SERVICENOW_INSTANCE=https://your-instance.service-now.com
SERVICENOW_USERNAME=admin
SERVICENOW_PASSWORD=your-password

JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=your@email.com
JIRA_API_TOKEN=your-jira-token
JIRA_PROJECT_KEY=CPI
```

```bash
# Frontend
cd frontend
cp .env.example .env
# Default values work for local development
```

### 3. Start

**Option A — Manual (two terminals):**
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm start
```

**Option B — Single script:**
```bash
chmod +x start.sh
./start.sh
```

**Option C — Docker:**
```bash
docker-compose up
```

### 4. Open
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/health

---

## 🎮 How to Use

### Dashboard
View live ticket stats, trend charts, category breakdowns and real-time event feed.

### Tickets
- Browse all auto-created and manual tickets
- Filter by priority, status, category
- Click any ticket for full AI analysis detail
- Sync tickets to ServiceNow or Jira

### Monitoring
- View real-time iFlow health status
- See active alerts and monitoring logs
- Trigger manual scan at any time
- Acknowledge alerts

### AI Agent
- Chat with the SAP CPI expert AI
- Click **Simulate Incidents** to trigger demo scenarios:
  - 🔐 API Auth Failure (HTTP 401)
  - 📦 JMS Queue Buildup (6500 messages)
  - 🔒 Certificate Expiry (5 days)
  - 📁 SFTP Auth Failure
  - 🗺️ Message Mapping Error

### Analysis
- Select an error scenario from the library
- Fill in error details and click **Run AI Analysis**
- Get instant: Root Cause, Evidence, Impact, Recommendation
- Optionally auto-create a ticket from the analysis

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/dashboard/trends` | 7-day ticket trends |
| GET | `/api/tickets` | List all tickets |
| POST | `/api/tickets` | Create ticket manually |
| PATCH | `/api/tickets/:id` | Update ticket |
| POST | `/api/agent/simulate` | Simulate an incident |
| POST | `/api/agent/chat` | AI chat endpoint |
| POST | `/api/agent/process-incident` | Process incident with AI |
| POST | `/api/analysis/analyze` | Run root cause analysis |
| GET | `/api/monitoring/status` | Monitoring status |
| POST | `/api/monitoring/trigger-scan` | Trigger manual scan |
| GET | `/api/monitoring/alerts` | List alerts |
| POST | `/api/webhooks/cpi-alert` | Receive CPI alerts (push) |

---

## 🩺 Supported Error Types

| Error Code | Category | Auto-Handled |
|---|---|---|
| HTTP_401, HTTP_403 | API Connectivity | ✅ |
| HTTP_500, HTTP_503 | API Connectivity | ✅ |
| SFTP_AUTH_FAILURE | SFTP Connection | ✅ |
| MAPPING_EXCEPTION | Message Mapping | ✅ |
| QUEUE_THRESHOLD_EXCEEDED | JMS Queue | ✅ |
| DATA_STORE_FAILURE | Data Store | ✅ |
| CERT_EXPIRY_WARNING | Certificate | ✅ |
| PKIX_CERT_ERROR | Certificate | ✅ |
| OAUTH_TOKEN_EXPIRED | OAuth Token | ✅ |

---

## 🏭 Production Notes

- Replace `dataStore.js` with PostgreSQL / MongoDB
- Add authentication (JWT) to all API routes
- Configure real SAP CPI OData API credentials
- Set up proper logging with log aggregation
- Use PM2 or container orchestration for process management

---

## 📄 License
MIT

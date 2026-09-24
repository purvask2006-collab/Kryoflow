# KryoFlo — PumpPulse AI

### Intelligent Pump Condition Monitoring & Predictive Maintenance Platform
**Sense. Predict. Protect.**

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Prototype-orange)]()

**Team Garun**
- Purva Khanapurkar
- Bhumika Tiwari
- Arya Salunkhe
- Sai Patil

---

## 📌 Overview

KryoFlo is an AI-powered pump health monitoring platform that predicts failures before they happen.  
It uses **dynamic fingerprinting** — each pump has a unique vibration/current/temperature/pressure signature.  
The AI learns the pump’s normal rhythm and detects **0.5% micro-deviations**, warning weeks before failure.

> Traditional: `Temp > 70°C = Alert` → too late, too generic.  
> KryoFlo: AI learns each pump’s normal behaviour → early, pump-specific alerts.

---

## ❗ Problem — The Invisible Failure Economy

Based on real-world research:

- Sudden pump failures
- Calendar-based maintenance
- Fixed threshold alerts
- No visibility into rural / remote pumps
- Repeated service visits
- Service is a cost center
- No pump-specific baseline
- Downtime is expensive
- Fleet learning is impossible
- Retrofitting legacy pumps is difficult

| Reactive Today | Predictive Future |
|---|---|
| Calendar-based = wasteful | AI detects warning signals |
| Breakdown-based = expensive | Exact fault + time to fail |
| Technician visits blindly | Right part + right technician |
| Repeat visits, angry customers | Zero surprise breakdowns |

---

## 💡 Solution — The Pump Fingerprint

**Dynamic Fingerprinting**

- Each pump has a unique signature
- AI learns its normal rhythm
- Detects **0.5% micro-deviations**
- Warns **weeks before failure**

**Core Capabilities**

- Real-time monitoring
- Smart anomaly detection
- Fault diagnosis
- Predictive maintenance
- Multi-channel alerts
- Digital service tickets
- Fleet analytics

**Value Proposition**

- Reduced downtime
- Extended pump life
- Data-driven decisions

---

## 🏗️ System Architecture

### 1. Physical Asset Layer
- Vibration sensors
- Temperature sensors
- Current sensors
- Pressure sensors
- Emergency stop

### 2. Edge Intelligence Layer
- Edge computing node: ESP32 / Raspberry Pi
- Local AI processing
- Critical fault response: **<10 ms**
- Offline-first architecture
- Store-and-forward buffer

### 3. Connectivity Layer
- MQTT
- 4G / 5G
- LoRaWAN mesh network (rural)
- Protocol conversion

### 4. Intelligence & Analytics Layer
- Anomaly detection engine
- Fault classification AI
- Remaining Useful Life (RUL) calculator
- Health score calculator
- Prescriptive maintenance recommender
- Digital twin / virtual pump model
- Time-series database
- Feature engineering engine
- ML model repository
- Cloud platform

### 5. Application & Service Layer
- Customer mobile app
- Technician tablet
- Admin dashboard (Crompton)
- SMS / WhatsApp / email notifications
- Security & governance:
  - End-to-end encryption
  - Authentication
  - Role-based access control
  - Data privacy compliance (India DPDP Act)

---

## 🚀 Features

- **Real-time Monitoring** — vibration, temperature, current, pressure, flow
- **Smart Anomaly Detection** — learns normal, flags deviations
- **Fault Diagnosis** — bearing wear, dry run, cavitation, overload
- **Predictive Maintenance** — RUL forecast and failure probability
- **Multi-channel Alerts** — SMS, WhatsApp, email, dashboard
- **Digital Service Tickets** — automated work orders
- **Fleet Analytics** — learn across all pumps
- **Offline & Rural Ready** — edge AI works without internet
- **Retrofittable** — works with 1M+ existing pumps

---

## 📈 Impact & Benefits

### Technical Edge
- Fingerprint AI learns every pump
- Edge computing works offline
- Rural India ready — no internet needed
- Multi-sensor fusion
- Advanced signal analysis

### Scale Edge
- Retrofittable to 1M+ existing pumps
- Instant market — no waiting for new sales
- Immediate impact

### Business Edge
- Service cost center becomes revenue platform
- Pump-as-a-Service recurring income
- Higher margins

### Benefits
- AI-Powered
- Predictive
- Cost Saving
- Higher Uptime
- Scalable
- Crompton-Ready

---

## 📊 Scalability Roadmap

| Phase | Segment | Scale |
|---|---|---|
| 1. Single Pump | Pilot & validation | 1–10 pumps (Homes / Small Users) |
| 2. Residential | Individual homes & societies | 10–1,000 pumps (Urban residential) |
| 3. Agriculture | Farms & rural deployments | 1,000–10,000 pumps (Rural & agri sector) |
| 4. Commercial / Industrial | Large facilities & OEM partnerships | 10,000–100,000 pumps (Commercial / Industrial) |
| 5. Fleet-Wide Deployment | Crompton ecosystem & global markets | 100,000+ pumps (Nationwide / Global) |

**Validate → Expand → Diversify → Scale Impact**

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Hardware | Vibration, temperature, current, pressure sensors |
| Edge | ESP32, Raspberry Pi, Python / C++ |
| Communication | MQTT, LoRaWAN, 4G/5G |
| Backend | FastAPI / Node.js |
| Database | PostgreSQL / TimescaleDB / InfluxDB |
| ML | Python, scikit-learn, TensorFlow / PyTorch, SVM |
| Digital Twin | Custom simulation / virtual pump model |
| Frontend | React / Next.js, Tailwind CSS, Recharts |
| Mobile | React Native / Flutter (planned) |
| Deployment | Vercel (dashboard), Docker |
| Security | E2E encryption, RBAC, DPDP compliance |

---

## 📁 Project Structure

```text
Kryoflow/
├── backend/            # FastAPI backend, ML inference
│   ├── main.py
│   └── requirements.txt
├── ml/                 # Training scripts and models
│   ├── model.py
│   └── train.py
├── edge/               # ESP32 / Raspberry Pi firmware
│   └── esp32_sensor.ino
├── frontend/           # Dashboard UI
│   ├── index.html
│   ├── style.css
│   └── script.js
├── docs/               # Architecture diagrams, references
├── .gitignore
└── README.md

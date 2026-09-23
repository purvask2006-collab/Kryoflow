import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  Gauge,
  Zap,
  Droplets,
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Radio,
  FileCode,
  Layers,
  ArrowRight,
  RefreshCw,
  Play,
  Pause,
  Sliders,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  ShieldAlert,
  Server,
  Smartphone,
  Cloud,
  Wifi,
  Database,
  Eye,
  Settings
} from 'lucide-react';

export type ScenarioType =
  | 'NORMAL'
  | 'BEARING_WEAR'
  | 'DRY_RUN'
  | 'BLOCKAGE'
  | 'ELECTRICAL_FAULT';

interface SensorMetric {
  value: number;
  normalRange: [number, number];
  warnThreshold: number | [number, number];
  unit: string;
  history: number[];
  status: 'normal' | 'warning' | 'critical';
}

interface AlertLog {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  recommendation: string;
}

export default function App() {
  // --- Simulation Controls ---
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1); // 1x, 2x, 4x
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('NORMAL');
  const [scenarioElapsed, setScenarioElapsed] = useState<number>(0);
  const [isAutoShutdown, setIsAutoShutdown] = useState<boolean>(false);
  const [dryRunTimer, setDryRunTimer] = useState<number>(0);

  // --- Historical Chart Selection ---
  const [selectedChartMetric, setSelectedChartMetric] = useState<'vibration' | 'temperature' | 'current' | 'pressure' | 'flow' | 'all'>('vibration');

  // --- Collapsible Sections ---
  const [showTechSpecs, setShowTechSpecs] = useState<boolean>(false);
  const [hoveredArchNode, setHoveredArchNode] = useState<string | null>(null);
  const [selectedArchNode, setSelectedArchNode] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // --- Live Sensor Readings ---
  const [vibration, setVibration] = useState<number>(2.8); // mm/s
  const [temperature, setTemperature] = useState<number>(48.5); // °C
  const [current, setCurrent] = useState<number>(6.4); // A
  const [pressure, setPressure] = useState<number>(3.2); // bar
  const [flowRate, setFlowRate] = useState<number>(128); // L/min

  // 60-second time series buffers (updated every ~1-2 sec)
  const [historyVib, setHistoryVib] = useState<number[]>(Array(30).fill(2.8));
  const [historyTemp, setHistoryTemp] = useState<number[]>(Array(30).fill(48.5));
  const [historyCurr, setHistoryCurr] = useState<number[]>(Array(30).fill(6.4));
  const [historyPress, setHistoryPress] = useState<number[]>(Array(30).fill(3.2));
  const [historyFlow, setHistoryFlow] = useState<number[]>(Array(30).fill(128));

  // --- Alert Logs ---
  const [alerts, setAlerts] = useState<AlertLog[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      severity: 'info',
      title: 'Telemetry Initialized',
      recommendation: 'ESP32 Edge Gateway online. Sampling at 10 kHz with TinyML model v2.1.'
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      severity: 'info',
      title: 'Digital Twin Synchronized',
      recommendation: 'Physics model calibrated. Estimated baseline RUL is 142 operating days.'
    }
  ]);
  const alertEndRef = useRef<HTMLDivElement>(null);

  const addAlert = (severity: 'info' | 'warning' | 'critical', title: string, recommendation: string) => {
    const newAlert: AlertLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      severity,
      title,
      recommendation
    };
    setAlerts((prev) => [...prev.slice(-40), newAlert]);
  };

  // --- Scenario Trigger Handler ---
  const switchScenario = (scenario: ScenarioType) => {
    setActiveScenario(scenario);
    setScenarioElapsed(0);
    setIsAutoShutdown(false);
    setDryRunTimer(0);

    if (scenario === 'NORMAL') {
      addAlert('info', 'Normal Mode Activated', 'System restored to baseline conditions. All metrics nominal.');
    } else if (scenario === 'BEARING_WEAR') {
      addAlert('warning', 'Bearing Wear Injected', 'Simulating gradual sub-surface raceway spalling. Vibration ramping over 30s.');
    } else if (scenario === 'DRY_RUN') {
      addAlert('critical', 'Dry Run Simulation Initiated', 'Suction supply cut. Flow dropping to zero. Auto-shutdown watch active (5s limit).');
    } else if (scenario === 'BLOCKAGE') {
      addAlert('warning', 'Discharge Blockage Injected', 'Discharge valve throttling simulated. Head pressure increasing, flow throttled.');
    } else if (scenario === 'ELECTRICAL_FAULT') {
      addAlert('critical', 'Electrical Fault Injected', 'Simulating winding insulation breakdown & phase current imbalance.');
    }
  };

  // --- Real-time Simulation Engine ---
  useEffect(() => {
    if (!isPlaying) return;

    const baseInterval = 1000 / simSpeed;
    const interval = setInterval(() => {
      setScenarioElapsed((prev) => prev + 1);

      // 1. If Auto-Shutdown has occurred (from Dry Run or manual trip)
      if (isAutoShutdown) {
        setVibration((v) => Math.max(0.1, Number((v * 0.7).toFixed(2))));
        setFlowRate(0);
        setPressure((p) => Math.max(0.2, Number((p * 0.8).toFixed(2))));
        setCurrent(0);
        setTemperature((t) => Math.max(32, Number((t - 0.4).toFixed(1))));
        return;
      }

      // 2. Scenario-specific state evolution
      if (activeScenario === 'NORMAL') {
        // Subtle realistic noise
        setVibration(Number((2.8 + (Math.random() * 0.4 - 0.2)).toFixed(2)));
        setTemperature(Number((48.5 + (Math.random() * 0.8 - 0.4)).toFixed(1)));
        setCurrent(Number((6.4 + (Math.random() * 0.3 - 0.15)).toFixed(2)));
        setPressure(Number((3.2 + (Math.random() * 0.2 - 0.1)).toFixed(2)));
        setFlowRate(Math.round(128 + (Math.random() * 6 - 3)));
      } else if (activeScenario === 'BEARING_WEAR') {
        // Gradually ramps over ~30 seconds
        const progress = Math.min(1, scenarioElapsed / 30);
        const targetVib = 2.8 + progress * 6.8; // up to 9.6 mm/s (Critical)
        const targetTemp = 48.5 + progress * 32.0; // up to 80.5 °C (Critical)
        const targetCurr = 6.4 + progress * 2.8; // up to 9.2 A (Warning)

        setVibration(Number((targetVib + (Math.random() * 0.3 - 0.15)).toFixed(2)));
        setTemperature(Number((targetTemp + (Math.random() * 0.4 - 0.2)).toFixed(1)));
        setCurrent(Number((targetCurr + (Math.random() * 0.2 - 0.1)).toFixed(2)));
        setPressure(Number((3.1 + (Math.random() * 0.2 - 0.1)).toFixed(2)));
        setFlowRate(Math.round(124 + (Math.random() * 6 - 3)));

        if (scenarioElapsed === 15) {
          addAlert('warning', 'High Frequency Harmonics Detected', 'FFT peak detected at BPFO (Outer Race defect frequency). Schedule inspection.');
        }
        if (scenarioElapsed === 28) {
          addAlert('critical', 'Severe Mechanical Degradation', 'Vibration exceeding ISO 10816-3 Zone D (>7.1 mm/s). Immediate shutdown recommended.');
        }
      } else if (activeScenario === 'DRY_RUN') {
        // Immediate flow loss & cavitation, rapid thermal ramp, 5-second shutdown
        setFlowRate(0);
        setPressure((p) => Math.max(0.3, Number((p * 0.5).toFixed(2))));
        setCurrent(Number((12.8 + (Math.random() * 1.2 - 0.6)).toFixed(2))); // motor current surge from loss of fluid resistance & friction
        setTemperature((t) => Number((t + 4.2).toFixed(1))); // fast thermal spike
        setVibration(Number((7.8 + (Math.random() * 1.5 - 0.75)).toFixed(2)));

        setDryRunTimer((t) => {
          const next = t + 1;
          if (next >= 5 && !isAutoShutdown) {
            setIsAutoShutdown(true);
            addAlert('critical', 'DRY RUN EMERGENCY TRIP ACTIVATED', 'Auto-shutdown relay energized after 5s dry run threshold. Pump motor de-energized.');
          }
          return next;
        });
      } else if (activeScenario === 'BLOCKAGE') {
        // Discharge pressure increases, flow drops, current fluctuates
        setPressure(Number((5.8 + (Math.random() * 0.3 - 0.15)).toFixed(2))); // > 5 bar Warning
        setFlowRate(Math.round(38 + (Math.random() * 8 - 4))); // < 80 L/min Warning
        setCurrent(Number((8.9 + (Math.random() * 0.8 - 0.4)).toFixed(2))); // higher current
        setTemperature((t) => Math.min(68, Number((t + 0.6).toFixed(1))));
        setVibration(Number((4.8 + (Math.random() * 0.6 - 0.3)).toFixed(2)));

        if (scenarioElapsed === 10) {
          addAlert('warning', 'Discharge Over-Pressure Detected', 'System operating near shutoff head. Check intake strainer and discharge butterfly valve.');
        }
      } else if (activeScenario === 'ELECTRICAL_FAULT') {
        // Current spikes erratically, voltage fluctuations, electromagnetic vibration
        const spike = Math.random() > 0.4 ? 14.5 + Math.random() * 3.0 : 6.8;
        setCurrent(Number(spike.toFixed(2)));
        setVibration(Number((5.6 + (Math.random() * 1.8 - 0.9)).toFixed(2)));
        setTemperature((t) => Math.min(76, Number((t + 0.8).toFixed(1))));
        setPressure(Number((2.9 + (Math.random() * 0.4 - 0.2)).toFixed(2)));
        setFlowRate(Math.round(112 + (Math.random() * 10 - 5)));

        if (scenarioElapsed === 8) {
          addAlert('critical', 'Motor Phase Imbalance Detected', 'Current unbalance > 18%. Risk of winding insulation breakdown. Inspect contactor & VFD.');
        }
      }
    }, baseInterval);

    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, activeScenario, scenarioElapsed, isAutoShutdown]);

  // Buffer updates for sparklines & historical charts
  useEffect(() => {
    setHistoryVib((h) => [...h.slice(1), vibration]);
    setHistoryTemp((h) => [...h.slice(1), temperature]);
    setHistoryCurr((h) => [...h.slice(1), current]);
    setHistoryPress((h) => [...h.slice(1), pressure]);
    setHistoryFlow((h) => [...h.slice(1), flowRate]);
  }, [vibration, temperature, current, pressure, flowRate]);

  // Auto-scroll alerts
  useEffect(() => {
    alertEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [alerts]);

  // --- Sensor Statuses ---
  const getVibrationStatus = (): 'normal' | 'warning' | 'critical' => {
    if (vibration > 8.0) return 'critical';
    if (vibration >= 4.0) return 'warning';
    return 'normal';
  };

  const getTemperatureStatus = (): 'normal' | 'warning' | 'critical' => {
    if (temperature > 75.0) return 'critical';
    if (temperature >= 60.0) return 'warning';
    return 'normal';
  };

  const getCurrentStatus = (): 'normal' | 'warning' | 'critical' => {
    if (current > 12.0) return 'critical';
    if (current >= 8.0) return 'warning';
    return 'normal';
  };

  const getPressureStatus = (): 'normal' | 'warning' | 'critical' => {
    if (pressure > 5.0 || pressure < 1.5) return 'warning';
    return 'normal';
  };

  const getFlowStatus = (): 'normal' | 'warning' | 'critical' => {
    if (flowRate < 30) return 'critical';
    if (flowRate < 80) return 'warning';
    return 'normal';
  };

  // --- AI Health Score Calculation ---
  // Health: 0 - 100 based on weighted normalization of all 5 sensors
  const healthScore = useMemo(() => {
    if (isAutoShutdown) return 12;

    let score = 100;

    // Vibration penalty (normal 2-4, warn 4-8, crit >8)
    if (vibration > 8) score -= 40;
    else if (vibration > 4) score -= (vibration - 4) * 8;

    // Temperature penalty (normal 40-60, warn 60-75, crit >75)
    if (temperature > 75) score -= 35;
    else if (temperature > 60) score -= (temperature - 60) * 1.8;

    // Current penalty (normal 5-8, warn 8-12, crit >12)
    if (current > 12) score -= 30;
    else if (current > 8) score -= (current - 8) * 6;

    // Pressure penalty (normal 2-4, warn <1.5 or >5)
    if (pressure > 5) score -= (pressure - 5) * 15;
    else if (pressure < 1.5) score -= (1.5 - pressure) * 20;

    // Flow penalty (normal 100-150, warn <80)
    if (flowRate < 80) score -= Math.max(0, (80 - flowRate) * 0.45);

    return Math.max(5, Math.min(99, Math.round(score)));
  }, [vibration, temperature, current, pressure, flowRate, isAutoShutdown]);

  // Health Score Status & Tone
  const healthMeta = useMemo(() => {
    if (healthScore >= 80) {
      return {
        label: 'Healthy',
        color: '#10b981',
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/40',
        text: 'text-emerald-400',
        action: 'Optimal Operation'
      };
    } else if (healthScore >= 65) {
      return {
        label: 'Monitor',
        color: '#06b6d4',
        bg: 'bg-cyan-500/15',
        border: 'border-cyan-500/40',
        text: 'text-cyan-400',
        action: 'Routine Observation'
      };
    } else if (healthScore >= 50) {
      return {
        label: 'Service Soon',
        color: '#f59e0b',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/40',
        text: 'text-amber-400',
        action: 'Preventive Maintenance Due'
      };
    } else {
      return {
        label: 'Critical',
        color: '#ef4444',
        bg: 'bg-red-500/20',
        border: 'border-red-500/50',
        text: 'text-red-400',
        action: 'Immediate Intervention'
      };
    }
  }, [healthScore]);

  // --- Digital Twin Metrics ---
  const digitalTwinMetrics = useMemo(() => {
    // Failure probability inverse of health score
    const failProb = Math.min(98.5, Math.max(1.8, Number(((100 - healthScore) * 1.15).toFixed(1))));

    // Remaining Useful Life (RUL) in days
    let rulDays = 142;
    if (activeScenario === 'BEARING_WEAR') {
      const progress = Math.min(1, scenarioElapsed / 30);
      rulDays = Math.max(3, Math.round(120 - progress * 114));
    } else if (activeScenario === 'DRY_RUN') {
      rulDays = isAutoShutdown ? 0 : Math.max(1, 4 - dryRunTimer);
    } else if (activeScenario === 'BLOCKAGE') {
      rulDays = 28;
    } else if (activeScenario === 'ELECTRICAL_FAULT') {
      rulDays = 9;
    }

    // Diagnostic confidence
    const confidence = 94.2 + (Math.sin(scenarioElapsed) * 1.5);

    return {
      failProb,
      rulDays,
      confidence: Number(confidence.toFixed(1))
    };
  }, [healthScore, activeScenario, scenarioElapsed, dryRunTimer, isAutoShutdown]);

  // --- Pump Motor RPM Calculation for Animation Speed ---
  const motorRPM = useMemo(() => {
    if (isAutoShutdown) return 0;
    if (activeScenario === 'NORMAL') return 1450;
    if (activeScenario === 'BEARING_WEAR') return 1410;
    if (activeScenario === 'BLOCKAGE') return 1475;
    if (activeScenario === 'DRY_RUN') return 1520;
    if (activeScenario === 'ELECTRICAL_FAULT') return 1380 + Math.sin(scenarioElapsed * 3) * 120;
    return 1450;
  }, [isAutoShutdown, activeScenario, scenarioElapsed]);

  // Sparkline renderer
  const renderSparkline = (data: number[], min: number, max: number, color: string) => {
    if (!data || data.length < 2) return null;
    const w = 180;
    const h = 32;
    const pad = 2;
    const effH = h - pad * 2;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const normalized = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
      const y = h - pad - normalized * effH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `M ${points[0]} L ${points.join(' L ')} L ${w},${h} L 0,${h} Z`;

    return (
      <svg className="w-full h-8 overflow-visible" viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // Standalone Single-File HTML exporter code
  const standaloneHtmlCode = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PumpPulse AI - IoT Pump Condition Monitoring</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #0f172a; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; padding: 16px; }
    .header { background: #1e293b; border: 1px solid #334155; padding: 14px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 2fr 3fr; gap: 16px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .panel { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .btn { background: #334155; color: #fff; border: 1px solid #475569; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s; }
    .btn:hover { background: #475569; }
    .btn-active { background: #06b6d4; border-color: #06b6d4; color: #0f172a; }
    .gauge { width: 130px; height: 130px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto; border: 6px solid #10b981; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .rotating { animation: spin 1.2s linear infinite; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="font-size: 1.25rem; font-weight:700; color:#38bdf8;">PumpPulse AI - IoT Condition Monitoring System</h1>
      <div style="font-size: 0.8rem; color: #94a3b8; font-family: 'JetBrains Mono';">Digital Twin &amp; Edge Condition Monitoring · ESP32 + TinyML</div>
    </div>
    <div id="stateBadge" style="background:#10b98122; color:#10b981; border:1px solid #10b98166; padding:6px 14px; border-radius:6px; font-weight:700;">HEALTHY (98%)</div>
  </div>

  <div class="grid">
    <div class="panel">
      <h3>VIRTUAL PUMP &amp; SENSORS</h3>
      <div style="text-align: center; margin: 20px 0;">
        <svg width="120" height="120" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="#0f172a" stroke="#334155" stroke-width="4"/>
          <g id="pumpImpeller" class="rotating" style="transform-origin: 50px 50px;">
            <circle cx="50" cy="50" r="14" fill="#06b6d4" />
            <path d="M50 20 L50 50 M80 50 L50 50 M50 80 L50 50 M20 50 L50 50" stroke="#06b6d4" stroke-width="6" stroke-linecap="round"/>
          </g>
        </svg>
        <div id="motorRpm" style="font-family:'JetBrains Mono'; font-size:0.9rem; margin-top:6px; color:#38bdf8;">1450 RPM · BEP 94.2%</div>
      </div>

      <div style="font-family:'JetBrains Mono'; font-size:0.85rem; display:grid; gap:8px;">
        <div style="background:#0f172a; padding:10px; border-radius:6px;">Vibration: <span id="valVib" style="color:#10b981; font-weight:bold;">2.8 mm/s</span> (Norm: 2-4)</div>
        <div style="background:#0f172a; padding:10px; border-radius:6px;">Temperature: <span id="valTemp" style="color:#10b981; font-weight:bold;">48.5 °C</span> (Norm: 40-60)</div>
        <div style="background:#0f172a; padding:10px; border-radius:6px;">Current: <span id="valCurr" style="color:#10b981; font-weight:bold;">6.4 A</span> (Norm: 5-8)</div>
        <div style="background:#0f172a; padding:10px; border-radius:6px;">Pressure: <span id="valPress" style="color:#10b981; font-weight:bold;">3.2 bar</span> (Norm: 2-4)</div>
        <div style="background:#0f172a; padding:10px; border-radius:6px;">Flow Rate: <span id="valFlow" style="color:#10b981; font-weight:bold;">128 L/min</span> (Norm: 100-150)</div>
      </div>
    </div>

    <div class="panel">
      <h3>AI HEALTH &amp; DIGITAL TWIN</h3>
      <div style="text-align:center; margin: 15px 0;">
        <div class="gauge" id="healthGauge">
          <div id="gaugeScore" style="font-size: 1.8rem; font-weight:bold; font-family:'JetBrains Mono'; color:#10b981;">98</div>
          <div id="gaugeLabel" style="font-size: 0.75rem; color:#94a3b8;">HEALTHY</div>
        </div>
      </div>
      <div style="background:#0f172a; padding:12px; border-radius:6px; font-family:'JetBrains Mono'; font-size:0.8rem; margin-bottom:12px;">
        <div>Predicted Failure Prob: <span id="valFail" style="color:#10b981;">2.4%</span></div>
        <div>Remaining Useful Life (RUL): <span id="valRul" style="color:#38bdf8; font-weight:bold;">142 Days</span></div>
        <div>Diagnosis Confidence: <span style="color:#a855f7;">96.8%</span></div>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        <button class="btn btn-active" onclick="setScenario('NORMAL', this)">Normal</button>
        <button class="btn" onclick="setScenario('BEARING_WEAR', this)">Bearing Wear</button>
        <button class="btn" onclick="setScenario('DRY_RUN', this)">Dry Run</button>
        <button class="btn" onclick="setScenario('BLOCKAGE', this)">Blockage</button>
        <button class="btn" onclick="setScenario('ELECTRICAL_FAULT', this)">Electrical Fault</button>
      </div>
      <div id="alertBox" style="margin-top:12px; background:#0f172a; padding:10px; border-radius:6px; font-family:'JetBrains Mono'; font-size:0.75rem; height:120px; overflow-y:auto;">
        <div style="color:#10b981;">[SYSTEM READY] ESP32 edge condition monitoring active. All channels nominal.</div>
      </div>
    </div>
  </div>

  <script>
    let mode = 'NORMAL';
    let vib = 2.8, temp = 48.5, curr = 6.4, press = 3.2, flow = 128;
    let t = 0;

    function setScenario(sc, btn) {
      mode = sc;
      t = 0;
      document.querySelectorAll('.btn').forEach(b => b.classList.remove('btn-active'));
      btn.classList.add('btn-active');
      logAlert('Scenario engaged: ' + sc);
    }

    function logAlert(msg) {
      const b = document.getElementById('alertBox');
      const d = document.createElement('div');
      d.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
      b.appendChild(d);
      b.scrollTop = b.scrollHeight;
    }

    setInterval(() => {
      t++;
      if (mode === 'NORMAL') {
        vib = 2.8 + (Math.random() * 0.4 - 0.2);
        temp = 48.5 + (Math.random() * 0.6 - 0.3);
        curr = 6.4 + (Math.random() * 0.3 - 0.15);
        press = 3.2 + (Math.random() * 0.2 - 0.1);
        flow = 128 + Math.round(Math.random() * 4 - 2);
      } else if (mode === 'BEARING_WEAR') {
        vib = Math.min(9.4, 2.8 + t * 0.22);
        temp = Math.min(78, 48.5 + t * 0.8);
      } else if (mode === 'DRY_RUN') {
        flow = 0;
        press = 0.4;
        curr = 13.2;
        temp += 3.5;
        if (t >= 5) {
          logAlert('AUTO-SHUTDOWN ENGAGED: Dry Run Threshold Exceeded');
        }
      } else if (mode === 'BLOCKAGE') {
        press = 5.8; flow = 42; curr = 9.1;
      } else if (mode === 'ELECTRICAL_FAULT') {
        curr = Math.random() > 0.4 ? 14.8 : 6.4;
      }

      document.getElementById('valVib').textContent = vib.toFixed(2) + ' mm/s';
      document.getElementById('valTemp').textContent = temp.toFixed(1) + ' °C';
      document.getElementById('valCurr').textContent = curr.toFixed(2) + ' A';
      document.getElementById('valPress').textContent = press.toFixed(2) + ' bar';
      document.getElementById('valFlow').textContent = Math.round(flow) + ' L/min';

      let score = Math.max(10, Math.round(100 - (vib > 4 ? (vib-4)*10 : 0) - (temp > 60 ? (temp-60)*1.8 : 0) - (curr > 8 ? (curr-8)*6 : 0)));
      document.getElementById('gaugeScore').textContent = score;
      document.getElementById('healthGauge').style.borderColor = score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444';
      document.getElementById('gaugeScore').style.color = score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444';
    }, 1000);
  </script>
</body>
</html>`;
  }, []);

  const downloadHtml = () => {
    const blob = new Blob([standaloneHtmlCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pumppulse_ai_monitor.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(standaloneHtmlCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans antialiased flex flex-col selection:bg-cyan-500/25">
      {/* Top SCADA Navigation Bar */}
      <header className="border-b border-slate-800 bg-[#1e293b]/95 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-[1780px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.3)]">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                    <span>PumpPulse AI</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold tracking-wider">
                      Edge + Digital Twin
                    </span>
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Asset: Centrifugal CP-300 #4
                  </span>
                  <span>·</span>
                  <span>Crompton 5.5kW Motor</span>
                  <span>·</span>
                  <span className="hidden sm:inline text-slate-500">Sampling: 10 kHz TinyML</span>
                </div>
              </div>
            </div>

            {/* Quick State Tag for Mobile */}
            <div className="md:hidden">
              <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded border ${healthMeta.bg} ${healthMeta.text} ${healthMeta.border}`}>
                {healthScore}% {healthMeta.label}
              </span>
            </div>
          </div>

          {/* Controls: Play/Pause, Speed, Standalone Export */}
          <div className="flex items-center gap-2 flex-wrap justify-end w-full md:w-auto">
            {/* Play / Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                isPlaying
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isPlaying ? 'Pause Sim' : 'Resume Sim'}</span>
            </button>

            {/* Speed Selector (1x, 2x, 4x) */}
            <div className="flex items-center p-0.5 bg-slate-900 rounded-md border border-slate-800 text-xs font-mono">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-1 rounded transition-colors ${
                    simSpeed === spd
                      ? 'bg-cyan-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Reset Baseline */}
            <button
              onClick={() => switchScenario('NORMAL')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Reset to Normal Conditions"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Single HTML Export */}
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-cyan-950/60 border border-cyan-600/50 text-cyan-300 hover:bg-cyan-900/50 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export HTML</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1780px] w-full mx-auto flex flex-col gap-4">
        {/* ================= SECTION 1: INTERACTIVE SYSTEM ARCHITECTURE DIAGRAM ================= */}
        <section className="bg-[#1e293b] border border-slate-700/80 rounded-xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-700/60 mb-4 gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                End-to-End System Architecture &amp; Data Pipeline
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Live Data Stream (10 kHz FFT)
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Dashed lines = Active MQTT Packets
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Hover or click nodes for technical specs</span>
            </div>
          </div>

          {/* Architecture Flowchart: Sensors -> Edge -> Cloud -> App */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {/* Column 1: Sensors */}
            <div
              onMouseEnter={() => setHoveredArchNode('sensors')}
              onMouseLeave={() => setHoveredArchNode(null)}
              onClick={() => setSelectedArchNode(selectedArchNode === 'sensors' ? null : 'sensors')}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer relative ${
                hoveredArchNode === 'sensors' || selectedArchNode === 'sensors'
                  ? 'bg-slate-800/90 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">Layer 01 · Transducers</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Physical Sensors</span>
              </div>
              <ul className="mt-2 text-xs font-mono text-slate-300 space-y-1">
                <li>· ADXL345: 3-Axis Vibration (10kHz)</li>
                <li>· PT100 RTD: Bearing Winding Temp</li>
                <li>· Current CT: Motor Phase Amperage</li>
                <li>· 4-20mA: Suction/Head Pressure</li>
                <li>· Hall Meter: Volumetric Flow Rate</li>
              </ul>
              <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                Transducing raw mechanical/electrical waveforms into analog &amp; SPI/I2C signals.
              </div>
            </div>

            {/* Column 2: Edge Device */}
            <div
              onMouseEnter={() => setHoveredArchNode('edge')}
              onMouseLeave={() => setHoveredArchNode(null)}
              onClick={() => setSelectedArchNode(selectedArchNode === 'edge' ? null : 'edge')}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer relative ${
                hoveredArchNode === 'edge' || selectedArchNode === 'edge'
                  ? 'bg-slate-800/90 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">Layer 02 · Edge Compute</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>ESP32 Edge Gateway</span>
              </div>
              <ul className="mt-2 text-xs font-mono text-slate-300 space-y-1">
                <li>· Dual-core Xtensa @ 240 MHz</li>
                <li>· TinyML Fast Fourier Transform (FFT)</li>
                <li>· Real-time Peak-to-Peak &amp; Kurtosis</li>
                <li>· Store-and-Forward Flash Buffer</li>
                <li>· Sub-50ms Dry Run Trip Logic</li>
              </ul>
              <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                Executes localized inference &amp; fault trip before uplink to avoid latency hazards.
              </div>
            </div>

            {/* Column 3: Cloud AI & Storage */}
            <div
              onMouseEnter={() => setHoveredArchNode('cloud')}
              onMouseLeave={() => setHoveredArchNode(null)}
              onClick={() => setSelectedArchNode(selectedArchNode === 'cloud' ? null : 'cloud')}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer relative ${
                hoveredArchNode === 'cloud' || selectedArchNode === 'cloud'
                  ? 'bg-slate-800/90 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">Layer 03 · Cloud Intelligence</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <span>InfluxDB &amp; ML Cloud</span>
              </div>
              <ul className="mt-2 text-xs font-mono text-slate-300 space-y-1">
                <li>· InfluxDB Time-Series Engine</li>
                <li>· Random Forest Fault Classifier</li>
                <li>· LSTM Remaining Useful Life (RUL)</li>
                <li>· Digital Twin Degradation Model</li>
                <li>· TLS 1.3 MQTT / CoAP Broker</li>
              </ul>
              <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                Predicts equipment breakdown probability &amp; optimizes predictive maintenance schedules.
              </div>
            </div>

            {/* Column 4: Mobile & SCADA Application */}
            <div
              onMouseEnter={() => setHoveredArchNode('app')}
              onMouseLeave={() => setHoveredArchNode(null)}
              onClick={() => setSelectedArchNode(selectedArchNode === 'app' ? null : 'app')}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer relative ${
                hoveredArchNode === 'app' || selectedArchNode === 'app'
                  ? 'bg-slate-800/90 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">Layer 04 · Operations</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Mobile App &amp; SCADA</span>
              </div>
              <ul className="mt-2 text-xs font-mono text-slate-300 space-y-1">
                <li>· React Native Field Technician App</li>
                <li>· Push Alarms (SMS &amp; Webhook)</li>
                <li>· Acoustic Vibration Stethoscope</li>
                <li>· Crompton Central Fleet SCADA</li>
                <li>· Auto Work-Order Dispatch</li>
              </ul>
              <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                Presents actionable diagnostics with maintenance countdowns for plant engineers.
              </div>
            </div>
          </div>

          {/* Animated SVG Data Flow Ribbon Between Nodes */}
          <div className="hidden md:block mt-3 pt-2">
            <svg className="w-full h-7" viewBox="0 0 1000 24" preserveAspectRatio="none">
              <line x1="120" y1="12" x2="880" y2="12" stroke="#334155" strokeWidth="3" />
              <line
                x1="120"
                y1="12"
                x2="880"
                y2="12"
                stroke="#06b6d4"
                strokeWidth="3"
                className="animate-data-flow"
              />
              <circle cx="120" cy="12" r="5" fill="#10b981" />
              <circle cx="370" cy="12" r="5" fill="#06b6d4" />
              <circle cx="630" cy="12" r="5" fill="#06b6d4" />
              <circle cx="880" cy="12" r="5" fill="#a855f7" />
            </svg>
          </div>
        </section>

        {/* ================= SECTION 2: SCENARIO SIMULATOR CONTROLS ================= */}
        <div className="bg-[#1e293b] border border-slate-700/80 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold font-mono tracking-wider uppercase text-slate-300">
              Scenario Injection Bench:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            {/* Normal */}
            <button
              onClick={() => switchScenario('NORMAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeScenario === 'NORMAL'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-850'
              }`}
            >
              Normal Operation
            </button>

            {/* Bearing Wear */}
            <button
              onClick={() => switchScenario('BEARING_WEAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeScenario === 'BEARING_WEAR'
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-850'
              }`}
            >
              Bearing Wear Simulation (30s)
            </button>

            {/* Dry Run */}
            <button
              onClick={() => switchScenario('DRY_RUN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeScenario === 'DRY_RUN'
                  ? 'bg-red-500/25 border-red-400 text-red-300 shadow-[0_0_14px_rgba(239,68,68,0.3)]'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-850'
              }`}
            >
              Dry Run Simulation (5s Trip)
            </button>

            {/* Blockage */}
            <button
              onClick={() => switchScenario('BLOCKAGE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeScenario === 'BLOCKAGE'
                  ? 'bg-orange-500/25 border-orange-400 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-850'
              }`}
            >
              Blockage Simulation
            </button>

            {/* Electrical Fault */}
            <button
              onClick={() => switchScenario('ELECTRICAL_FAULT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeScenario === 'ELECTRICAL_FAULT'
                  ? 'bg-purple-500/25 border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-850'
              }`}
            >
              Electrical Fault Simulation
            </button>
          </div>

          {/* Quick status text */}
          <div className="text-[11px] font-mono text-slate-400 hidden lg:block">
            Mode: <span className="font-bold text-white">{activeScenario}</span> ({scenarioElapsed}s)
          </div>
        </div>

        {/* ================= SECTION 3: CORE DASHBOARD GRID ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT 4 COLS: Virtual Pump Interface & Actuator */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Pump Visualizer Card */}
            <div className="bg-[#1e293b] border border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
              {/* Trip alert banner */}
              {isAutoShutdown && (
                <div className="w-full bg-red-600/90 text-white font-mono font-bold text-xs py-1.5 px-3 rounded-md mb-3 animate-pulse flex items-center justify-center gap-1.5 shadow-md">
                  <AlertTriangle className="w-4 h-4" />
                  <span>EMERGENCY AUTO-SHUTDOWN ACTIVATED</span>
                </div>
              )}

              <div className="w-full flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-200">CENTRIFUGAL PUMP UNIT</span>
                <span className={isAutoShutdown ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                  {isAutoShutdown ? 'TRIPPED (OFF)' : 'RUNNING (ON)'}
                </span>
              </div>

              {/* Pump Motor SVG Graphic with Dynamic Rotation */}
              <div className="relative w-44 h-44 my-3 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 160 160">
                  {/* Outer Mounting Bracket & Piping */}
                  <rect x="10" y="68" width="34" height="24" fill="#0f172a" stroke="#334155" strokeWidth="2.5" />
                  <rect x="98" y="10" width="24" height="34" fill="#0f172a" stroke="#334155" strokeWidth="2.5" />

                  {/* Fluid flow particles when running */}
                  {!isAutoShutdown && flowRate > 0 && (
                    <>
                      <line x1="12" y1="80" x2="40" y2="80" stroke="#06b6d4" strokeWidth="3" className="animate-flow" />
                      <line x1="110" y1="40" x2="110" y2="14" stroke="#06b6d4" strokeWidth="3" className="animate-flow" />
                    </>
                  )}

                  {/* Volute / Pump Casing */}
                  <circle
                    cx="80"
                    cy="80"
                    r="56"
                    fill="#0f172a"
                    stroke={isAutoShutdown ? '#ef4444' : healthScore < 50 ? '#f59e0b' : '#06b6d4'}
                    strokeWidth="4"
                    className="transition-colors duration-500"
                  />

                  {/* Bolt pattern */}
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => {
                    const rad = (ang * Math.PI) / 180;
                    const bx = 80 + 46 * Math.cos(rad);
                    const by = 80 + 46 * Math.sin(rad);
                    return <circle key={ang} cx={bx} cy={by} r="2.5" fill="#475569" />;
                  })}

                  {/* Rotating Impeller & Drive Shaft */}
                  <g
                    style={{
                      transformOrigin: '80px 80px',
                      transform: isAutoShutdown ? 'rotate(15deg)' : undefined,
                      animation: isAutoShutdown ? 'none' : `spinClockwise ${Math.max(0.4, 2000 / (motorRPM || 1450))}s linear infinite`
                    }}
                  >
                    {/* Rotor Hub */}
                    <circle
                      cx="80"
                      cy="80"
                      r="18"
                      fill={isAutoShutdown ? '#ef4444' : healthScore < 50 ? '#f59e0b' : '#06b6d4'}
                    />
                    {/* Impeller Curved Vanes */}
                    <path d="M80 32 Q92 56 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d="M128 80 Q104 92 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d="M80 128 Q68 104 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d="M32 80 Q56 68 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                  </g>
                </svg>

                {/* Vibration ripple effect when vibration is high */}
                {vibration >= 4.0 && !isAutoShutdown && (
                  <div
                    className={`absolute inset-0 rounded-full border-2 border-dashed pointer-events-none ${
                      vibration > 8 ? 'border-red-500 animate-ping' : 'border-amber-400 animate-pulse'
                    }`}
                  />
                )}
              </div>

              {/* Dynamic Operational Readout */}
              <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-slate-800 text-xs font-mono">
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">OPERATING SPEED</div>
                  <div className="text-base font-bold text-white tabular-nums">
                    {motorRPM} <span className="text-[10px] text-slate-400">RPM</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-slate-400">EFFICIENCY (BEP)</div>
                  <div className="text-base font-bold text-cyan-400 tabular-nums">
                    {isAutoShutdown ? '0%' : `${Math.max(45, Math.round(94.2 - (100 - healthScore) * 0.45))}%`}
                  </div>
                </div>
              </div>

              {/* Status Action Banner */}
              <div className="w-full mt-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Control State:</span>
                <span className={`font-mono font-bold ${healthMeta.text}`}>
                  {isAutoShutdown ? 'EMERGENCY SHUTOFF' : activeScenario === 'NORMAL' ? 'NOMINAL CONTINUOUS' : 'ANOMALY DETECTED'}
                </span>
              </div>
            </div>

            {/* AI Health Score Gauge Card */}
            <div className="bg-[#1e293b] border border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col items-center text-center shadow-lg">
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
                <span className="font-semibold text-slate-200">AI HEALTH SCORE</span>
                <span className="text-cyan-400">Weighted TinyML</span>
              </div>

              {/* Circular Gauge */}
              <div className="relative w-36 h-36 my-3 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#0f172a" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={healthMeta.color}
                    strokeWidth="10"
                    strokeDasharray={314}
                    strokeDashoffset={314 - (314 * healthScore) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black font-mono tracking-tight tabular-nums text-white">
                    {healthScore}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                    / 100
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className={`px-3 py-1 rounded-full border text-xs font-bold font-mono uppercase tracking-wider ${healthMeta.bg} ${healthMeta.text} ${healthMeta.border}`}>
                {healthMeta.label} · {healthMeta.action}
              </div>

              <div className="w-full mt-4 text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-left">
                <div className="flex justify-between">
                  <span>Vibration Weight:</span> <span className="text-slate-200">35%</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Thermal Weight:</span> <span className="text-slate-200">25%</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Hydraulic/Pressure:</span> <span className="text-slate-200">20%</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Current/Electrical:</span> <span className="text-slate-200">20%</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER 4 COLS: Real-Time Sensor Telemetry (5 Cards) */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                Live Sensor Readouts (5 Channels)
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Scan: 2.0s</span>
            </div>

            {/* Sensor 1: Vibration */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                getVibrationStatus() === 'critical'
                  ? 'bg-red-950/25 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
                  : getVibrationStatus() === 'warning'
                  ? 'bg-amber-950/25 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-[#1e293b] border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Vibration Velocity</div>
                    <div className="text-[10px] font-mono text-slate-400">ADXL345 · ISO 10816</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    getVibrationStatus() === 'critical'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                      : getVibrationStatus() === 'warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {getVibrationStatus()}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {vibration.toFixed(2)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">mm/s</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 2-4 · Warn: 4-8 · Crit: &gt;8
                </div>
              </div>

              <div className="mt-1.5 pt-1 border-t border-slate-800/80">
                {renderSparkline(
                  historyVib,
                  0,
                  12,
                  getVibrationStatus() === 'critical' ? '#ef4444' : getVibrationStatus() === 'warning' ? '#f59e0b' : '#10b981'
                )}
              </div>
            </div>

            {/* Sensor 2: Temperature */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                getTemperatureStatus() === 'critical'
                  ? 'bg-red-950/25 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
                  : getTemperatureStatus() === 'warning'
                  ? 'bg-amber-950/25 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-[#1e293b] border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Bearing Temperature</div>
                    <div className="text-[10px] font-mono text-slate-400">PT100 RTD Sensor</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    getTemperatureStatus() === 'critical'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                      : getTemperatureStatus() === 'warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {getTemperatureStatus()}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {temperature.toFixed(1)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">°C</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 40-60 · Warn: 60-75 · Crit: &gt;75
                </div>
              </div>

              <div className="mt-1.5 pt-1 border-t border-slate-800/80">
                {renderSparkline(
                  historyTemp,
                  20,
                  95,
                  getTemperatureStatus() === 'critical' ? '#ef4444' : getTemperatureStatus() === 'warning' ? '#f59e0b' : '#10b981'
                )}
              </div>
            </div>

            {/* Sensor 3: Current */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                getCurrentStatus() === 'critical'
                  ? 'bg-red-950/25 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
                  : getCurrentStatus() === 'warning'
                  ? 'bg-amber-950/25 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-[#1e293b] border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Motor Load Current</div>
                    <div className="text-[10px] font-mono text-slate-400">Hall Current CT Transducer</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    getCurrentStatus() === 'critical'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                      : getCurrentStatus() === 'warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {getCurrentStatus()}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {current.toFixed(2)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">AMPS</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 5-8 · Warn: 8-12 · Crit: &gt;12
                </div>
              </div>

              <div className="mt-1.5 pt-1 border-t border-slate-800/80">
                {renderSparkline(
                  historyCurr,
                  0,
                  20,
                  getCurrentStatus() === 'critical' ? '#ef4444' : getCurrentStatus() === 'warning' ? '#f59e0b' : '#10b981'
                )}
              </div>
            </div>

            {/* Sensor 4: Pressure */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                getPressureStatus() === 'warning'
                  ? 'bg-amber-950/25 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-[#1e293b] border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Discharge Pressure</div>
                    <div className="text-[10px] font-mono text-slate-400">Piezoresistive 4-20mA</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    getPressureStatus() === 'warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {getPressureStatus()}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {pressure.toFixed(2)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">BAR</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 2-4 · Warn: &lt;1.5 or &gt;5.0
                </div>
              </div>

              <div className="mt-1.5 pt-1 border-t border-slate-800/80">
                {renderSparkline(
                  historyPress,
                  0,
                  7.0,
                  getPressureStatus() === 'warning' ? '#f59e0b' : '#10b981'
                )}
              </div>
            </div>

            {/* Sensor 5: Flow Rate */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                getFlowStatus() === 'critical'
                  ? 'bg-red-950/25 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
                  : getFlowStatus() === 'warning'
                  ? 'bg-amber-950/25 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'bg-[#1e293b] border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Volumetric Flow Rate</div>
                    <div className="text-[10px] font-mono text-slate-400">Magnetic Flowmeter</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    getFlowStatus() === 'critical'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                      : getFlowStatus() === 'warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {getFlowStatus()}
                </span>
              </div>

              <div className="mt-2 flex items-baseline justify-between">
                <div className="text-2xl font-bold font-mono text-white tabular-nums">
                  {Math.round(flowRate)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">L/MIN</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 100-150 · Warn: &lt;80
                </div>
              </div>

              <div className="mt-1.5 pt-1 border-t border-slate-800/80">
                {renderSparkline(
                  historyFlow,
                  0,
                  180,
                  getFlowStatus() === 'critical' ? '#ef4444' : getFlowStatus() === 'warning' ? '#f59e0b' : '#10b981'
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLS: Digital Twin & Alert Recommendations */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Digital Twin Visualization Card */}
            <div className="bg-[#1e293b] border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-lg relative digital-twin-grid">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/80">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-200">
                    Digital Twin Telemetry
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  SYNCED (1:1)
                </span>
              </div>

              {/* Side-by-Side: Physical Pump vs Digital Twin */}
              <div className="grid grid-cols-2 gap-3 my-3">
                {/* Physical Pump Box */}
                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                  <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold mb-1">
                    Physical Asset
                  </div>
                  <div className="text-xs font-bold text-slate-200">Crompton CP-300</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">S/N: 2026-IND-0941</div>
                  <div className="mt-2 text-xs font-mono">
                    <span className="text-slate-400">State: </span>
                    <span className={healthMeta.text}>{healthMeta.label}</span>
                  </div>
                </div>

                {/* Digital Twin Box */}
                <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/40 text-center relative overflow-hidden">
                  <div className="text-[11px] font-mono text-cyan-400 uppercase font-semibold mb-1 flex items-center justify-center gap-1">
                    <span>Digital Twin</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  </div>
                  <div className="text-xs font-bold text-cyan-200">LSTM RUL Model</div>
                  <div className="text-[10px] text-cyan-400/80 font-mono mt-0.5">Physics + ML Sync</div>
                  <div className="mt-2 text-xs font-mono text-cyan-300">
                    Confidence: <b>{digitalTwinMetrics.confidence}%</b>
                  </div>
                </div>
              </div>

              {/* Twin Telemetry Stats */}
              <div className="space-y-2.5 text-xs font-mono pt-1">
                {/* Failure Probability */}
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">Predicted Failure Probability:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        digitalTwinMetrics.failProb > 50
                          ? 'text-red-400'
                          : digitalTwinMetrics.failProb > 20
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {digitalTwinMetrics.failProb}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        digitalTwinMetrics.failProb > 50
                          ? 'bg-red-500'
                          : digitalTwinMetrics.failProb > 20
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${digitalTwinMetrics.failProb}%` }}
                    />
                  </div>
                </div>

                {/* Remaining Useful Life (RUL) */}
                <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-slate-400">Remaining Useful Life (RUL):</div>
                    <div className="text-[10px] text-slate-500 font-mono">Degradation Curve Projection</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold tabular-nums ${
                        digitalTwinMetrics.rulDays < 10
                          ? 'text-red-400'
                          : digitalTwinMetrics.rulDays < 30
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {digitalTwinMetrics.rulDays} <span className="text-xs font-normal">DAYS</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alert & AI Recommendations Panel */}
            <div className="bg-[#1e293b] border border-slate-700/80 rounded-xl p-4 flex flex-col flex-1 shadow-lg max-h-[380px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/80 mb-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-200">
                    Live Alerts &amp; AI Directives
                  </h3>
                </div>
                <button
                  onClick={() => setAlerts([])}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors text-xs"
                  title="Clear alert feed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Alerts Stream */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 font-mono text-xs">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No active alerts in buffer.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-lg border transition-all ${
                        alert.severity === 'critical'
                          ? 'bg-red-950/30 border-red-500/50 text-red-200'
                          : alert.severity === 'warning'
                          ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="tabular-nums">[{alert.timestamp}]</span>
                        <span
                          className={`font-bold uppercase px-1.5 py-0.5 rounded text-[9px] ${
                            alert.severity === 'critical'
                              ? 'bg-red-500/20 text-red-400'
                              : alert.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-cyan-500/20 text-cyan-400'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <div className="font-semibold text-white mb-0.5">{alert.title}</div>
                      <div className="text-[11px] text-slate-400 leading-snug">{alert.recommendation}</div>
                    </div>
                  ))
                )}
                <div ref={alertEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* ================= SECTION 4: HISTORICAL GRAPH (LAST 60 SECONDS) ================= */}
        <section className="bg-[#1e293b] border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-700/80 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-200">
                Time-Series Trend History (Last 60 Seconds Buffer)
              </h3>
            </div>

            {/* Metric Selector Tabs */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs font-mono overflow-x-auto">
              {(
                [
                  { id: 'vibration', label: 'Vib (mm/s)' },
                  { id: 'temperature', label: 'Temp (°C)' },
                  { id: 'current', label: 'Current (A)' },
                  { id: 'pressure', label: 'Pressure (bar)' },
                  { id: 'flow', label: 'Flow (L/m)' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedChartMetric(tab.id)}
                  className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    selectedChartMetric === tab.id
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Chart Area */}
          <div className="w-full h-36 bg-[#0f172a] rounded-lg p-3 border border-slate-800 flex flex-col justify-between relative overflow-hidden">
            {/* Grid coordinate lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none opacity-20">
              <div className="w-full border-b border-slate-700" />
              <div className="w-full border-b border-slate-700" />
              <div className="w-full border-b border-slate-700" />
            </div>

            {/* Dynamic Active Trend Curve */}
            <div className="w-full h-full relative z-10 flex items-center">
              {selectedChartMetric === 'vibration' && renderSparkline(historyVib, 0, 12, '#38bdf8')}
              {selectedChartMetric === 'temperature' && renderSparkline(historyTemp, 20, 95, '#fb923c')}
              {selectedChartMetric === 'current' && renderSparkline(historyCurr, 0, 20, '#facc15')}
              {selectedChartMetric === 'pressure' && renderSparkline(historyPress, 0, 7, '#06b6d4')}
              {selectedChartMetric === 'flow' && renderSparkline(historyFlow, 0, 180, '#4ade80')}
            </div>

            {/* X-Axis labels */}
            <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80 z-10">
              <span>-60 sec</span>
              <span>-45 sec</span>
              <span>-30 sec</span>
              <span>-15 sec</span>
              <span className="text-cyan-400">NOW (Live)</span>
            </div>
          </div>
        </section>

        {/* ================= SECTION 5: COLLAPSIBLE TECHNICAL SPECIFICATIONS ================= */}
        <section className="bg-[#1e293b] border border-slate-700/80 rounded-xl overflow-hidden shadow-lg">
          <button
            onClick={() => setShowTechSpecs(!showTechSpecs)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold font-mono tracking-wider uppercase text-slate-200">
                PumpPulse AI Engineering &amp; Hardware Specifications
              </span>
            </div>
            {showTechSpecs ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showTechSpecs && (
            <div className="p-4 pt-0 border-t border-slate-800 text-xs font-mono grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300">
              <div className="p-3 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-cyan-400 font-bold mb-1.5 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" /> Edge Layer
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <b>Processor:</b> ESP32-WROOM-32 (240MHz)<br />
                  <b>TinyML:</b> TensorFlow Lite for Microcontrollers executing vibration FFT.<br />
                  <b>Buffer:</b> Store-and-forward SPIFFS flash buffer prevents packet loss during network drops.
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-emerald-400 font-bold mb-1.5 flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> Connectivity Layer
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <b>Protocol:</b> MQTT over TLS 1.3 with QoS 1.<br />
                  <b>Cellular:</b> SIMCOM 4G LTE-M modem with fallback to LoRaWAN (868/915 MHz).<br />
                  <b>Cycle:</b> 2-second telemetry heartbeat with sub-50ms priority alarm interrupt.
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-amber-400 font-bold mb-1.5 flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5" /> Cloud AI Engine
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <b>Database:</b> InfluxDB 2.x high-throughput time-series store.<br />
                  <b>Inference:</b> Random Forest for fault classification (bearing, cavitation, misalignment).<br />
                  <b>Prognostics:</b> Bidirectional LSTM regression predicting Remaining Useful Life (RUL).
                </p>
              </div>

              <div className="p-3 rounded bg-slate-900/80 border border-slate-800">
                <div className="text-purple-400 font-bold mb-1.5 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> Application Layer
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <b>Technician App:</b> React Native with acoustic frequency analyzer.<br />
                  <b>SCADA Bridge:</b> Modbus TCP / OPC-UA gateway for Crompton plant integration.<br />
                  <b>Notifications:</b> Push alarms, SMS broadcast &amp; auto-generated work tickets.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ================= MODAL: COPY / DOWNLOAD SINGLE-FILE HTML ================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl max-w-3xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">
                  PumpPulse AI - Standalone Single-File HTML Artifact
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-300">
              Complete, self-contained HTML file embedding all CSS styles, JS simulation logic, SVG pump animations, and scenario controls in a single copy-pasteable file with zero dependencies:
            </p>

            <div className="mt-3 flex-1 min-h-[260px] bg-[#0f172a] border border-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-[11px] text-slate-300 custom-scrollbar">
              <pre>{standaloneHtmlCode}</pre>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                Ready for offline college hackathon demonstrations and laptop presentations.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                </button>
                <button
                  onClick={downloadHtml}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .HTML</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

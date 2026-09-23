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
  Settings,
  Box,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Wrench,
  HelpCircle,
  Sparkles,
  TrendingUp,
  Filter
} from 'lucide-react';
import { Pump3DSimulator } from './components/Pump3DSimulator';

export type ScenarioType =
  | 'NORMAL'
  | 'BEARING_WEAR'
  | 'DRY_RUN'
  | 'BLOCKAGE'
  | 'ELECTRICAL_FAULT';

interface AlertLog {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  recommendation: string;
}

const SCENARIO_GUIDES: Record<
  ScenarioType,
  { title: string; summary: string; expected: string; maintenance: string }
> = {
  NORMAL: {
    title: 'Normal Continuous Operation',
    summary:
      'Pump operates at rated Best Efficiency Point (BEP). All mechanical, electrical, and hydraulic parameters are within ISO 10816 Zone A/B.',
    expected:
      'Vibration ~2.8 mm/s · Temperature ~48.5°C · Current ~6.4A · Pressure ~3.2 bar · Flow ~128 L/min',
    maintenance:
      'Routine inspection every 90 days. Check oil level in bearing pedestal sight glass.'
  },
  BEARING_WEAR: {
    title: 'Progressive Bearing Degradation',
    summary:
      'Simulates raceway fatigue spalling over 30 seconds. Friction creates high-frequency micro-vibration and localized thermal build-up.',
    expected:
      'Vibration ramps from 2.8 to 9.4 mm/s · Temperature rises from 48.5°C to 78°C · RUL drops to 6 days.',
    maintenance:
      'ISO 10816 Zone D alarm tripped. Schedule urgent SKF deep-groove ball bearing replacement.'
  },
  DRY_RUN: {
    title: 'Dry Run / Loss of Prime (5s Auto-Trip)',
    summary:
      'Suction water drops to zero. Mechanical seal runs dry. The automated safety system detects flow collapse and triggers emergency trip.',
    expected:
      'Flow collapses to 0 L/min · Pressure drops to 0.4 bar · Current spikes · Automatic shutdown trips in 5s.',
    maintenance:
      'Safety interlock engaged. Inspect suction foot valve, vent air from casing priming port before restarting.'
  },
  BLOCKAGE: {
    title: 'Suction Line Blockage / Cavitation',
    summary:
      'Inlet strainer obstructed. Net Positive Suction Head Required (NPSHr) exceeds available NPSH, causing vapor bubble cavitation.',
    expected:
      'Discharge pressure spikes to 5.8 bar · Flow throttled to 42 L/min · High motor load current ~9.1A.',
    maintenance:
      'Clean suction basket filter, check inlet butterfly valve position, verify suction head level.'
  },
  ELECTRICAL_FAULT: {
    title: 'Motor Phase Voltage Imbalance',
    summary:
      'Simulates supply voltage unbalance causing negative sequence currents and stator winding thermal stress.',
    expected:
      'Motor current surges erratically (6.4A to 14.8A) · Motor housing heats up · RPM fluctuates.',
    maintenance:
      'Check motor starter contactor, verify 3-phase line voltages within 2% balance standard.'
  }
};

export default function App() {
  // --- Theme Mode ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // --- Audio Sound Synthesizer ---
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const motorOscRef = useRef<OscillatorNode | null>(null);
  const motorGainRef = useRef<GainNode | null>(null);

  // --- Simulation Controls ---
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1); // 1x, 2x, 4x
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('NORMAL');
  const [scenarioElapsed, setScenarioElapsed] = useState<number>(0);
  const [isAutoShutdown, setIsAutoShutdown] = useState<boolean>(false);
  const [dryRunTimer, setDryRunTimer] = useState<number>(0);

  // --- 3D Digital Twin View State ---
  const [pumpViewMode, setPumpViewMode] = useState<'3d' | '2d'>('3d');
  const [is3DExpanded, setIs3DExpanded] = useState<boolean>(false);
  const [showManualTuning, setShowManualTuning] = useState<boolean>(false);

  // --- Manual Tuning Overrides ---
  const [rpmManualOffset, setRpmManualOffset] = useState<number>(0);
  const [throttleValvePct, setThrottleValvePct] = useState<number>(100);

  // --- Historical Chart Selection ---
  const [selectedChartMetric, setSelectedChartMetric] = useState<
    'vibration' | 'temperature' | 'current' | 'pressure' | 'flow'
  >('vibration');

  // --- Collapsible Sections ---
  const [showTechSpecs, setShowTechSpecs] = useState<boolean>(false);
  const [showScenarioGuide, setShowScenarioGuide] = useState<boolean>(true);
  const [hoveredArchNode, setHoveredArchNode] = useState<string | null>(null);
  const [selectedArchNode, setSelectedArchNode] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning'>('all');

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
      title: 'Telemetry Stream Initialized',
      recommendation:
        'ESP32 Edge Gateway online. ISO 10816 vibration classifier active. Digital twin model synced.'
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      severity: 'info',
      title: 'Automated Safety System Armed',
      recommendation:
        'Centrifugal pump protection relays active. Sub-50ms dry-run auto-shutdown monitoring armed.'
    }
  ]);

  const alertEndRef = useRef<HTMLDivElement>(null);

  // --- Audio Engine Setup ---
  const initAudioEngine = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (audioCtxRef.current && !motorOscRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        motorOscRef.current = osc;
        motorGainRef.current = gain;
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    if (next) {
      initAudioEngine();
    } else if (motorGainRef.current && audioCtxRef.current) {
      motorGainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
    }
  };

  const playChime = (freq = 880, dur = 0.3) => {
    if (!audioEnabled || !audioCtxRef.current) return;
    try {
      const osc = audioCtxRef.current.createOscillator();
      const g = audioCtxRef.current.createGain();
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      g.gain.setValueAtTime(0.08, audioCtxRef.current.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + dur);
      osc.connect(g);
      g.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + dur);
    } catch {
      // Fallback
    }
  };

  // --- Calculated Motor RPM ---
  const motorRPM = useMemo(() => {
    if (isAutoShutdown) return 0;
    let base = 1450;
    if (activeScenario === 'NORMAL') base = 1450;
    else if (activeScenario === 'BEARING_WEAR') base = 1410;
    else if (activeScenario === 'BLOCKAGE') base = 1475;
    else if (activeScenario === 'DRY_RUN') base = 1520;
    else if (activeScenario === 'ELECTRICAL_FAULT')
      base = 1380 + Math.sin(scenarioElapsed * 3) * 120;

    return Math.max(0, Math.min(1850, Math.round(base + rpmManualOffset)));
  }, [isAutoShutdown, activeScenario, scenarioElapsed, rpmManualOffset]);

  // Update Audio Drone
  useEffect(() => {
    if (!audioEnabled || !motorOscRef.current || !motorGainRef.current || !audioCtxRef.current)
      return;
    if (isAutoShutdown || motorRPM === 0) {
      motorGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.1);
    } else {
      const freq = 50 + (motorRPM / 1450) * 35;
      motorOscRef.current.frequency.setTargetAtTime(freq, audioCtxRef.current.currentTime, 0.1);
      const targetGain = Math.min(0.045, 0.02 + (vibration / 12) * 0.02);
      motorGainRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.1);
    }
  }, [audioEnabled, motorRPM, isAutoShutdown, vibration]);

  // Switch Scenario Handler
  const switchScenario = (scenario: ScenarioType) => {
    setActiveScenario(scenario);
    setScenarioElapsed(0);
    setDryRunTimer(0);
    setIsAutoShutdown(false);

    const now = new Date().toLocaleTimeString();
    if (scenario === 'NORMAL') {
      playChime(660, 0.2);
      setAlerts((prev) => [
        ...prev,
        {
          id: `alert-${Date.now()}`,
          timestamp: now,
          severity: 'info',
          title: 'Normal Operating Mode Engaged',
          recommendation: 'Baseline calibration restored. All 5 telemetry channels nominal.'
        }
      ]);
    } else if (scenario === 'BEARING_WEAR') {
      playChime(520, 0.3);
      setAlerts((prev) => [
        ...prev,
        {
          id: `alert-${Date.now()}`,
          timestamp: now,
          severity: 'warning',
          title: 'Bearing Wear Fault Injected',
          recommendation:
            'Simulating 30-second progressive raceway spalling. Watch ADXL345 vibration & PT100 temperature climb.'
        }
      ]);
    } else if (scenario === 'DRY_RUN') {
      playChime(440, 0.4);
      setAlerts((prev) => [
        ...prev,
        {
          id: `alert-${Date.now()}`,
          timestamp: now,
          severity: 'critical',
          title: 'Dry Run Hazard Injected',
          recommendation:
            'Suction fluid flow dropped to 0 L/min. Automated safety system countdown initiated (5s auto-shutdown).'
        }
      ]);
    } else if (scenario === 'BLOCKAGE') {
      playChime(580, 0.25);
      setAlerts((prev) => [
        ...prev,
        {
          id: `alert-${Date.now()}`,
          timestamp: now,
          severity: 'warning',
          title: 'Suction Blockage Simulated',
          recommendation:
            'Inlet strainer restricted. Pressure head increasing; flow rate severely throttled.'
        }
      ]);
    } else if (scenario === 'ELECTRICAL_FAULT') {
      playChime(480, 0.3);
      setAlerts((prev) => [
        ...prev,
        {
          id: `alert-${Date.now()}`,
          timestamp: now,
          severity: 'critical',
          title: 'Motor Phase Imbalance Injected',
          recommendation:
            '3-phase current spikes detected. Stator thermal overload warning flagged.'
        }
      ]);
    }
  };

  // --- Real-time Simulation Engine Loop ---
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setScenarioElapsed((prev) => prev + 1);

      // 1. Calculate values based on scenario
      let nextVib = vibration;
      let nextTemp = temperature;
      let nextCurr = current;
      let nextPress = pressure;
      let nextFlow = flowRate;

      const throttleMult = throttleValvePct / 100;

      if (isAutoShutdown) {
        // Shutdown state
        nextVib = Math.max(0.1, Number((vibration * 0.75).toFixed(2)));
        nextTemp = Math.max(32, Number((temperature - 0.4).toFixed(1)));
        nextCurr = 0.0;
        nextPress = 0.0;
        nextFlow = 0;
      } else {
        if (activeScenario === 'NORMAL') {
          nextVib = Number((2.8 + (Math.random() * 0.4 - 0.2)).toFixed(2));
          nextTemp = Number((48.5 + (Math.random() * 0.6 - 0.3)).toFixed(1));
          nextCurr = Number((6.4 + (Math.random() * 0.3 - 0.15)).toFixed(2));
          nextPress = Number((3.2 * throttleMult + (Math.random() * 0.2 - 0.1)).toFixed(2));
          nextFlow = Math.round((128 + (Math.random() * 6 - 3)) * throttleMult);
        } else if (activeScenario === 'BEARING_WEAR') {
          // 30-sec progressive degradation ramp
          const progress = Math.min(1, scenarioElapsed / 30);
          nextVib = Number((2.8 + progress * 6.6 + (Math.random() * 0.4 - 0.2)).toFixed(2));
          nextTemp = Number((48.5 + progress * 29.5 + (Math.random() * 0.6 - 0.3)).toFixed(1));
          nextCurr = Number((6.4 + progress * 2.8 + (Math.random() * 0.3 - 0.15)).toFixed(2));
          nextPress = Number((3.2 * throttleMult + (Math.random() * 0.3 - 0.15)).toFixed(2));
          nextFlow = Math.max(70, Math.round((128 - progress * 40) * throttleMult));

          // Log alert when crossing critical threshold
          if (nextVib >= 4.0 && vibration < 4.0) {
            playChime(580, 0.3);
            setAlerts((prev) => [
              ...prev,
              {
                id: `vib-warn-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                severity: 'warning',
                title: 'ISO 10816 Zone C Warning',
                recommendation:
                  'Vibration velocity exceeded 4.0 mm/s. Bearing lubrication required.'
              }
            ]);
          } else if (nextVib >= 8.0 && vibration < 8.0) {
            playChime(880, 0.5);
            setAlerts((prev) => [
              ...prev,
              {
                id: `vib-crit-${Date.now()}`,
                timestamp: new Date().toLocaleTimeString(),
                severity: 'critical',
                title: 'ISO 10816 Zone D Danger Threshold',
                recommendation:
                  'Vibration velocity > 8.0 mm/s. Catastrophic bearing failure imminent. Stop pump.'
              }
            ]);
          }
        } else if (activeScenario === 'DRY_RUN') {
          // Flow collapses to 0, pressure drops, motor runs hot
          nextFlow = 0;
          nextPress = 0.4;
          nextCurr = Number((12.8 + (Math.random() * 0.8 - 0.4)).toFixed(2));
          nextTemp = Number((temperature + 1.2).toFixed(1));
          nextVib = Number((4.5 + (Math.random() * 0.6 - 0.3)).toFixed(2));

          // Dry run 5-second automatic trip
          setDryRunTimer((prev) => {
            const nextTime = prev + 1;
            if (nextTime >= 5 && !isAutoShutdown) {
              setIsAutoShutdown(true);
              playChime(1040, 0.6);
              setAlerts((al) => [
                ...al,
                {
                  id: `trip-${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  severity: 'critical',
                  title: 'EMERGENCY AUTO-SHUTDOWN TRIPPED',
                  recommendation:
                    'Dry run condition verified for 5 consecutive seconds. Main contactor opened to prevent seal seizure.'
                }
              ]);
            }
            return nextTime;
          });
        } else if (activeScenario === 'BLOCKAGE') {
          // Pressure spikes, flow drops, cavitation vibration
          nextPress = Number((5.8 + (Math.random() * 0.4 - 0.2)).toFixed(2));
          nextFlow = Math.round(38 + Math.random() * 8);
          nextCurr = Number((9.2 + (Math.random() * 0.5 - 0.25)).toFixed(2));
          nextVib = Number((5.2 + (Math.random() * 0.8 - 0.4)).toFixed(2));
          nextTemp = Number((54.0 + (Math.random() * 0.5 - 0.25)).toFixed(1));
        } else if (activeScenario === 'ELECTRICAL_FAULT') {
          // Surge current, fluctuation
          const spike = Math.random() > 0.4;
          nextCurr = spike ? Number((14.6 + Math.random() * 1.2).toFixed(2)) : 6.8;
          nextTemp = Number((temperature + 0.6).toFixed(1));
          nextVib = Number((3.8 + (Math.random() * 0.5 - 0.25)).toFixed(2));
          nextPress = Number((3.0 * throttleMult).toFixed(2));
          nextFlow = Math.round(115 * throttleMult);
        }
      }

      setVibration(nextVib);
      setTemperature(nextTemp);
      setCurrent(nextCurr);
      setPressure(nextPress);
      setFlowRate(nextFlow);

      // Update 30-point buffers
      setHistoryVib((prev) => [...prev.slice(1), nextVib]);
      setHistoryTemp((prev) => [...prev.slice(1), nextTemp]);
      setHistoryCurr((prev) => [...prev.slice(1), nextCurr]);
      setHistoryPress((prev) => [...prev.slice(1), nextPress]);
      setHistoryFlow((prev) => [...prev.slice(1), nextFlow]);
    }, 1500 / simSpeed);

    return () => clearInterval(interval);
  }, [
    isPlaying,
    simSpeed,
    activeScenario,
    scenarioElapsed,
    isAutoShutdown,
    vibration,
    temperature,
    current,
    pressure,
    flowRate,
    throttleValvePct
  ]);

  // --- Sensor Status Evaluation ---
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
  const healthScore = useMemo(() => {
    if (isAutoShutdown) return 12;

    let score = 100;
    if (vibration > 8) score -= 40;
    else if (vibration > 4) score -= (vibration - 4) * 8;

    if (temperature > 75) score -= 35;
    else if (temperature > 60) score -= (temperature - 60) * 1.8;

    if (current > 12) score -= 30;
    else if (current > 8) score -= (current - 8) * 6;

    if (pressure > 5) score -= (pressure - 5) * 15;
    else if (pressure < 1.5) score -= (1.5 - pressure) * 20;

    if (flowRate < 80) score -= Math.max(0, (80 - flowRate) * 0.45);

    return Math.max(5, Math.min(99, Math.round(score)));
  }, [vibration, temperature, current, pressure, flowRate, isAutoShutdown]);

  const healthMeta = useMemo(() => {
    if (healthScore >= 80) {
      return {
        label: 'Healthy',
        color: '#10b981',
        bg: theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/15',
        border: theme === 'light' ? 'border-emerald-300' : 'border-emerald-500/40',
        text: theme === 'light' ? 'text-emerald-700' : 'text-emerald-400',
        action: 'Optimal Operation'
      };
    } else if (healthScore >= 65) {
      return {
        label: 'Monitor',
        color: '#0284c7',
        bg: theme === 'light' ? 'bg-sky-50' : 'bg-sky-500/15',
        border: theme === 'light' ? 'border-sky-300' : 'border-sky-500/40',
        text: theme === 'light' ? 'text-sky-700' : 'text-sky-400',
        action: 'Routine Observation'
      };
    } else if (healthScore >= 50) {
      return {
        label: 'Service Soon',
        color: '#d97706',
        bg: theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/15',
        border: theme === 'light' ? 'border-amber-300' : 'border-amber-500/40',
        text: theme === 'light' ? 'text-amber-700' : 'text-amber-400',
        action: 'Preventive Maintenance Due'
      };
    } else {
      return {
        label: 'Critical',
        color: '#e11d48',
        bg: theme === 'light' ? 'bg-rose-50' : 'bg-rose-500/20',
        border: theme === 'light' ? 'border-rose-300' : 'border-rose-500/50',
        text: theme === 'light' ? 'text-rose-700' : 'text-rose-400',
        action: 'Immediate Intervention'
      };
    }
  }, [healthScore, theme]);

  // --- Digital Twin Metrics ---
  const digitalTwinMetrics = useMemo(() => {
    const failProb = Math.min(
      98.5,
      Math.max(1.8, Number(((100 - healthScore) * 1.15).toFixed(1)))
    );

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

    const confidence = 94.2 + Math.sin(scenarioElapsed) * 1.5;

    return {
      failProb,
      rulDays,
      confidence: Number(confidence.toFixed(1))
    };
  }, [healthScore, activeScenario, scenarioElapsed, dryRunTimer, isAutoShutdown]);

  // --- Sparkline SVG Renderer ---
  const renderSparkline = (data: number[], min: number, max: number, color: string) => {
    if (!data || data.length < 2) return null;
    const w = 220;
    const h = 34;
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

    const gradId = `grad-${color.replace('#', '')}-${theme}`;

    return (
      <svg className="w-full h-9 overflow-visible" viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={theme === 'light' ? 0.28 : 0.22} />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const isLight = theme === 'light';

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'all') return alerts;
    return alerts.filter((a) => a.severity === alertFilter);
  }, [alerts, alertFilter]);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0d1117] text-[#e6edf3]'
      }`}
    >
      {/* ================= TOP NAVBAR HEADER ================= */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isLight
            ? 'bg-white/95 border-slate-200 shadow-xs'
            : 'bg-[#161b22]/95 border-slate-800 shadow-md'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>PumpPulse AI</span>
                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold tracking-wider ${
                      isLight
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    }`}
                  >
                    IoT Digital Twin
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-0.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Crompton CP-300 (5.5kW)
                </span>
                <span>·</span>
                <span className="hidden sm:inline">TinyML 10 kHz</span>
                <span>·</span>
                <span className={healthMeta.text}>
                  Status: <b>{healthMeta.label}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Play / Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                isPlaying
                  ? isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-white" />}
              <span>{isPlaying ? 'Pause' : 'Resume'}</span>
            </button>

            {/* Sim Speed (1x, 2x, 4x) */}
            <div
              className={`flex items-center p-0.5 rounded-lg border text-xs font-mono ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}
            >
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                    simSpeed === spd
                      ? 'bg-sky-600 text-white shadow-xs'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                audioEnabled
                  ? isLight
                    ? 'bg-sky-50 text-sky-700 border-sky-300'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : isLight
                  ? 'bg-slate-100 text-slate-500 border-slate-200 hover:text-slate-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={audioEnabled ? 'Mute Pump Motor Sound' : 'Enable Realistic Motor Audio'}
            >
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-sky-600 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{audioEnabled ? 'Audio ON' : 'Mute'}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-2xs'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
              title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {isLight ? <Moon className="w-3.5 h-3.5 text-slate-700" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isLight ? 'Dark' : 'Light'}</span>
            </button>

            {/* Reset Baseline */}
            <button
              onClick={() => switchScenario('NORMAL')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Reset All Sensors to Nominal"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ================= SECTION 1: INTERACTIVE SYSTEM ARCHITECTURE ================= */}
        <section
          className={`rounded-2xl border p-5 transition-all ${
            isLight
              ? 'bg-white border-slate-200/90 shadow-xs'
              : 'bg-[#161b22] border-slate-800 shadow-md'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-800 dark:text-slate-200">
                1. System Architecture &amp; Real-Time Data Pipeline
              </h2>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              MQTT TLS 1.3 Streaming
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            {/* Layer 01: Sensors */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                isLight
                  ? 'bg-slate-50/80 border-slate-200 hover:border-sky-400 hover:shadow-xs'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-sky-600">
                  Layer 01 · Transducers
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-sky-500" />
                <span>Sensors Cluster</span>
              </div>
              <ul className="mt-2.5 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
                <li>· ADXL345: 3-Axis Vib (10 kHz)</li>
                <li>· PT100 RTD: Bearing Temp</li>
                <li>· Hall CT: Phase Current</li>
                <li>· Piezoresistive: Pressure</li>
                <li>· Magnetic Flowmeter: Q</li>
              </ul>
            </div>

            {/* Layer 02: Edge AI */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                isLight
                  ? 'bg-slate-50/80 border-slate-200 hover:border-sky-400 hover:shadow-xs'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-sky-600">
                  Layer 02 · Edge Processing
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Server className="w-4 h-4 text-sky-500" />
                <span>ESP32 Gateway</span>
              </div>
              <ul className="mt-2.5 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
                <li>· Dual-Core Xtensa 240MHz</li>
                <li>· TinyML Fast Fourier FFT</li>
                <li>· SPIFFS Store &amp; Forward</li>
                <li>· Sub-50ms Dry Run Trip</li>
                <li>· ISO 10816 Zone Classifier</li>
              </ul>
            </div>

            {/* Layer 03: Cloud AI */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                isLight
                  ? 'bg-slate-50/80 border-slate-200 hover:border-sky-400 hover:shadow-xs'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-sky-600">
                  Layer 03 · Analytics
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-sky-500" />
                <span>InfluxDB &amp; LSTM Twin</span>
              </div>
              <ul className="mt-2.5 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
                <li>· High-Res Time-Series Store</li>
                <li>· Random Forest Anomaly Model</li>
                <li>· LSTM Degradation Curves</li>
                <li>· Physics-Informed Sync</li>
                <li>· Auto Maintenance Forecast</li>
              </ul>
            </div>

            {/* Layer 04: Mobile & SCADA */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                isLight
                  ? 'bg-slate-50/80 border-slate-200 hover:border-sky-400 hover:shadow-xs'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase font-bold text-sky-600">
                  Layer 04 · Operations
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-500" />
                <span>Mobile App &amp; SCADA</span>
              </div>
              <ul className="mt-2.5 text-xs font-mono text-slate-600 dark:text-slate-300 space-y-1">
                <li>· React Native Technician UI</li>
                <li>· Push Alarms (SMS/Email)</li>
                <li>· Acoustic Stethoscope Tool</li>
                <li>· Work Order Auto-Dispatch</li>
                <li>· Fleet Reliability Portal</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ================= SECTION 2: SCENARIO SELECTOR & OPERATOR GUIDE ================= */}
        <section
          className={`rounded-2xl border p-5 transition-all ${
            isLight
              ? 'bg-white border-slate-200/90 shadow-xs'
              : 'bg-[#161b22] border-slate-800 shadow-md'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-bold tracking-wider uppercase font-mono text-slate-800 dark:text-slate-200">
                2. Real-Time Condition Simulation Scenarios
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowScenarioGuide(!showScenarioGuide)}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showScenarioGuide ? 'Hide Guide' : 'Show Guide'}</span>
              </button>
              <span className="text-xs font-mono text-slate-500">
                Elapsed: <b>{scenarioElapsed}s</b>
              </span>
            </div>
          </div>

          {/* Scenario Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {[
              { id: 'NORMAL', label: '1. Normal Nominal', desc: 'Rated BEP, all safe' },
              { id: 'BEARING_WEAR', label: '2. Bearing Wear', desc: '30s vib & temp ramp' },
              { id: 'DRY_RUN', label: '3. Dry Run (Trip)', desc: '5s auto-shutdown' },
              { id: 'BLOCKAGE', label: '4. Blockage', desc: 'Cavitation & head spike' },
              { id: 'ELECTRICAL_FAULT', label: '5. Electrical Fault', desc: 'Phase surge current' }
            ].map((sc) => (
              <button
                key={sc.id}
                onClick={() => switchScenario(sc.id as ScenarioType)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  activeScenario === sc.id
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-300/50'
                    : isLight
                    ? 'bg-slate-50/90 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-xs">{sc.label}</div>
                <div
                  className={`text-[11px] mt-1 ${
                    activeScenario === sc.id
                      ? 'text-sky-100'
                      : isLight
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  {sc.desc}
                </div>
              </button>
            ))}
          </div>

          {/* User-Friendly Scenario Walkthrough Guide */}
          {showScenarioGuide && (
            <div
              className={`mt-4 p-4 rounded-xl border transition-all ${
                isLight
                  ? 'bg-sky-50/60 border-sky-200/80 text-slate-800'
                  : 'bg-slate-900/90 border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-sky-700 dark:text-sky-400 mb-1.5">
                <HelpCircle className="w-4 h-4" />
                <span>OPERATOR WALKTHROUGH: {SCENARIO_GUIDES[activeScenario].title}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                {SCENARIO_GUIDES[activeScenario].summary}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-sky-200/60 dark:border-slate-800">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Telemetry Indicators:
                  </span>{' '}
                  <span className="text-slate-600 dark:text-slate-400">
                    {SCENARIO_GUIDES[activeScenario].expected}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Maintenance Action:
                  </span>{' '}
                  <span className="text-slate-600 dark:text-slate-400">
                    {SCENARIO_GUIDES[activeScenario].maintenance}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ================= SECTION 3: CORE DASHBOARD GRID ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: 3D Virtual Pump Simulator & Actuator (5 or 12 Cols) */}
          <div
            className={`${
              is3DExpanded ? 'lg:col-span-12' : 'lg:col-span-5'
            } flex flex-col gap-5 transition-all duration-300`}
          >
            {/* 3D Pump Visualizer Card */}
            <div
              className={`rounded-2xl border p-5 shadow-xs flex flex-col transition-all relative overflow-hidden ${
                isLight ? 'bg-white border-slate-200/90' : 'bg-[#161b22] border-slate-800'
              }`}
            >
              {/* Trip alert banner */}
              {isAutoShutdown && (
                <div className="w-full bg-rose-600 text-white font-mono font-bold text-xs py-2 px-3 rounded-xl mb-3 flex items-center justify-center gap-2 shadow-sm animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                  <span>EMERGENCY AUTO-SHUTDOWN ACTIVATED · MAIN CONTACTOR OPENED</span>
                </div>
              )}

              {/* Header with 3D/2D Switcher & Workspace Expand */}
              <div className="w-full flex items-center justify-between text-xs font-mono pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    CENTRIFUGAL PUMP UNIT
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <div
                    className={`flex items-center p-0.5 rounded-lg border ${
                      isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => setPumpViewMode('3d')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-all font-semibold flex items-center gap-1 ${
                        pumpViewMode === '3d'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Box className="w-3.5 h-3.5" />
                      3D Twin
                    </button>
                    <button
                      onClick={() => setPumpViewMode('2d')}
                      className={`px-2.5 py-1 text-xs rounded-md transition-all font-semibold ${
                        pumpViewMode === '2d'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      2D Cutaway
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualTuning(!showManualTuning)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                      showManualTuning
                        ? 'bg-sky-50 text-sky-700 border-sky-300'
                        : isLight
                        ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                    title="Toggle Manual Speed & Throttle Valve Sliders"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Tuning</span>
                  </button>

                  <button
                    onClick={() => setIs3DExpanded(!is3DExpanded)}
                    className={`hidden lg:flex items-center gap-1 px-2 py-1 rounded-md text-xs border font-semibold ${
                      isLight
                        ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {is3DExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span>{is3DExpanded ? 'Compact' : 'Expand'}</span>
                  </button>

                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                      isAutoShutdown
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isAutoShutdown ? 'TRIPPED (OFF)' : 'RUNNING (ON)'}
                  </span>
                </div>
              </div>

              {/* Manual Tuning Drawer (Sliders for RPM & Throttle Valve) */}
              {showManualTuning && (
                <div
                  className={`my-3 p-3.5 rounded-xl border text-xs font-mono space-y-3 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1 text-sky-600">
                      <Sliders className="w-3.5 h-3.5" /> Manual Interactive Controls
                    </span>
                    <button
                      onClick={() => {
                        setRpmManualOffset(0);
                        setThrottleValvePct(100);
                      }}
                      className="text-[11px] text-slate-500 hover:text-sky-600 underline"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  {/* Motor RPM Slider */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Operating Speed Adjustment:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {motorRPM} RPM ({rpmManualOffset >= 0 ? `+${rpmManualOffset}` : rpmManualOffset})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-400"
                      max="350"
                      step="25"
                      value={rpmManualOffset}
                      onChange={(e) => setRpmManualOffset(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>

                  {/* Throttle Valve */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Discharge Throttle Valve:</span>
                      <span className="font-bold text-sky-600">{throttleValvePct}% OPEN</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={throttleValvePct}
                      onChange={(e) => setThrottleValvePct(parseInt(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Viewport Area */}
              <div className="w-full my-3">
                {pumpViewMode === '3d' ? (
                  <Pump3DSimulator
                    vibration={vibration}
                    temperature={temperature}
                    current={current}
                    pressure={pressure}
                    flowRate={flowRate}
                    motorRPM={motorRPM}
                    healthScore={healthScore}
                    isAutoShutdown={isAutoShutdown}
                    activeScenario={activeScenario}
                    theme={theme}
                  />
                ) : (
                  /* 2D Cutaway Schematic */
                  <div
                    className={`relative w-48 h-48 mx-auto flex items-center justify-center p-4 rounded-xl border ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <svg className="w-full h-full" viewBox="0 0 160 160">
                      <rect x="10" y="68" width="34" height="24" fill="#334155" stroke="#475569" strokeWidth="2.5" />
                      <rect x="98" y="10" width="24" height="34" fill="#334155" stroke="#475569" strokeWidth="2.5" />
                      <circle
                        cx="80"
                        cy="80"
                        r="56"
                        fill={isLight ? '#f1f5f9' : '#0f172a'}
                        stroke={isAutoShutdown ? '#e11d48' : healthScore < 50 ? '#d97706' : '#0284c7'}
                        strokeWidth="4"
                      />
                      <g
                        style={{
                          transformOrigin: '80px 80px',
                          transform: isAutoShutdown ? 'rotate(15deg)' : undefined,
                          animation: isAutoShutdown
                            ? 'none'
                            : `spinClockwise ${Math.max(0.4, 2000 / (motorRPM || 1450))}s linear infinite`
                        }}
                      >
                        <circle cx="80" cy="80" r="18" fill="#0284c7" />
                        <path d="M80 32 Q92 56 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                        <path d="M128 80 Q104 92 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                        <path d="M80 128 Q68 104 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                        <path d="M32 80 Q56 68 80 80" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
                      </g>
                    </svg>
                  </div>
                )}
              </div>

              {/* Dynamic Operational Readout */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-500">SPEED (RPM)</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                    {motorRPM}
                  </div>
                </div>
                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-500">BEP EFFICIENCY</div>
                  <div className="text-base font-bold text-sky-600 tabular-nums">
                    {isAutoShutdown ? '0%' : `${Math.max(45, Math.round(94.2 - (100 - healthScore) * 0.45))}%`}
                  </div>
                </div>
                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-500">VIBRATION</div>
                  <div className={`text-base font-bold tabular-nums ${vibration > 4 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {vibration.toFixed(2)} mm/s
                  </div>
                </div>
                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-500">BEARING TEMP</div>
                  <div className={`text-base font-bold tabular-nums ${temperature > 60 ? 'text-rose-600' : 'text-sky-600'}`}>
                    {temperature.toFixed(1)} °C
                  </div>
                </div>
              </div>

              {/* Status Action Banner */}
              <div
                className={`w-full mt-3 p-3 rounded-xl border flex items-center justify-between text-xs flex-wrap gap-2 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Control State:</span>
                  <span className={`font-mono font-bold ${healthMeta.text}`}>
                    {isAutoShutdown
                      ? 'EMERGENCY SHUTOFF'
                      : activeScenario === 'NORMAL'
                      ? 'NOMINAL CONTINUOUS'
                      : 'ANOMALY DETECTED'}
                  </span>
                </div>

                {isAutoShutdown ? (
                  <button
                    onClick={() => {
                      setIsAutoShutdown(false);
                      setDryRunTimer(0);
                      switchScenario('NORMAL');
                    }}
                    className="px-3 py-1 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all shadow-xs"
                  >
                    Reset Trip &amp; Restart
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsAutoShutdown(true);
                      playChime(1040, 0.5);
                    }}
                    className="px-2.5 py-1 text-[11px] font-mono bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-all font-semibold"
                  >
                    Emergency Trip Test
                  </button>
                )}
              </div>
            </div>

            {/* AI Health Score Gauge Card */}
            <div
              className={`rounded-2xl border p-5 shadow-xs flex flex-col items-center text-center transition-all ${
                isLight ? 'bg-white border-slate-200/90' : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-mono">
                <span className="font-bold text-slate-800 dark:text-slate-200">AI HEALTH SCORE</span>
                <span className="text-sky-600 font-semibold">Weighted TinyML</span>
              </div>

              {/* Circular Gauge */}
              <div className="relative w-36 h-36 my-4 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={isLight ? '#f1f5f9' : '#0f172a'}
                    strokeWidth="10"
                  />
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
                  <span className="text-4xl font-black font-mono tracking-tight tabular-nums text-slate-900 dark:text-white">
                    {healthScore}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                    / 100
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`px-3 py-1 rounded-full border text-xs font-bold font-mono uppercase tracking-wider ${healthMeta.bg} ${healthMeta.text} ${healthMeta.border}`}
              >
                {healthMeta.label} · {healthMeta.action}
              </div>

              {/* Weights Table */}
              <div
                className={`w-full mt-4 text-[11px] font-mono p-3 rounded-xl border text-left space-y-1 ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-600'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex justify-between">
                  <span>Vibration (ADXL345):</span> <span className="font-semibold text-slate-800 dark:text-slate-200">35%</span>
                </div>
                <div className="flex justify-between">
                  <span>Thermal (PT100 RTD):</span> <span className="font-semibold text-slate-800 dark:text-slate-200">25%</span>
                </div>
                <div className="flex justify-between">
                  <span>Hydraulic Head (Pressure/Q):</span> <span className="font-semibold text-slate-800 dark:text-slate-200">20%</span>
                </div>
                <div className="flex justify-between">
                  <span>Electrical (Current CT):</span> <span className="font-semibold text-slate-800 dark:text-slate-200">20%</span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: 5 Real-Time Sensor Cards (4 Cols) */}
          <div
            className={`${
              is3DExpanded ? 'lg:col-span-6' : 'lg:col-span-4'
            } flex flex-col gap-3.5`}
          >
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-sky-600" />
                Live Sensor Telemetry (5 Channels)
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Scan: 1.5s</span>
            </div>

            {/* Sensor 1: Vibration */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                getVibrationStatus() === 'critical'
                  ? 'bg-rose-50 border-rose-400 shadow-xs'
                  : getVibrationStatus() === 'warning'
                  ? 'bg-amber-50 border-amber-300 shadow-xs'
                  : isLight
                  ? 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                  : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Vibration Velocity
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">ADXL345 · ISO 10816</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase ${
                    getVibrationStatus() === 'critical'
                      ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                      : getVibrationStatus() === 'warning'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {getVibrationStatus()}
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                  {vibration.toFixed(2)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">mm/s</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 2-4 · Warn: 4-8 · Crit: &gt;8
                </div>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {renderSparkline(
                  historyVib,
                  0,
                  12,
                  getVibrationStatus() === 'critical'
                    ? '#e11d48'
                    : getVibrationStatus() === 'warning'
                    ? '#d97706'
                    : '#0284c7'
                )}
              </div>
            </div>

            {/* Sensor 2: Temperature */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                getTemperatureStatus() === 'critical'
                  ? 'bg-rose-50 border-rose-400 shadow-xs'
                  : getTemperatureStatus() === 'warning'
                  ? 'bg-amber-50 border-amber-300 shadow-xs'
                  : isLight
                  ? 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                  : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Bearing Temperature
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">PT100 RTD Sensor</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase ${
                    getTemperatureStatus() === 'critical'
                      ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                      : getTemperatureStatus() === 'warning'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {getTemperatureStatus()}
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                  {temperature.toFixed(1)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">°C</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 40-60 · Warn: 60-75 · Crit: &gt;75
                </div>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {renderSparkline(
                  historyTemp,
                  20,
                  95,
                  getTemperatureStatus() === 'critical'
                    ? '#e11d48'
                    : getTemperatureStatus() === 'warning'
                    ? '#d97706'
                    : '#ea580c'
                )}
              </div>
            </div>

            {/* Sensor 3: Current */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                getCurrentStatus() === 'critical'
                  ? 'bg-rose-50 border-rose-400 shadow-xs'
                  : getCurrentStatus() === 'warning'
                  ? 'bg-amber-50 border-amber-300 shadow-xs'
                  : isLight
                  ? 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                  : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Motor Load Current
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">Hall CT Transducer</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase ${
                    getCurrentStatus() === 'critical'
                      ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                      : getCurrentStatus() === 'warning'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {getCurrentStatus()}
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                  {current.toFixed(2)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">AMPS</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 5-8 · Warn: 8-12 · Crit: &gt;12
                </div>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {renderSparkline(
                  historyCurr,
                  0,
                  20,
                  getCurrentStatus() === 'critical'
                    ? '#e11d48'
                    : getCurrentStatus() === 'warning'
                    ? '#d97706'
                    : '#ca8a04'
                )}
              </div>
            </div>

            {/* Sensor 4: Pressure */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                getPressureStatus() === 'warning'
                  ? 'bg-amber-50 border-amber-300 shadow-xs'
                  : isLight
                  ? 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                  : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Discharge Head Pressure
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">Piezoresistive 4-20mA</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase ${
                    getPressureStatus() === 'warning'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {getPressureStatus()}
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                  {pressure.toFixed(2)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">BAR</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 2-4 · Warn: &lt;1.5 or &gt;5.0
                </div>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {renderSparkline(
                  historyPress,
                  0,
                  7.0,
                  getPressureStatus() === 'warning' ? '#d97706' : '#0891b2'
                )}
              </div>
            </div>

            {/* Sensor 5: Flow Rate */}
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                getFlowStatus() === 'critical'
                  ? 'bg-rose-50 border-rose-400 shadow-xs'
                  : getFlowStatus() === 'warning'
                  ? 'bg-amber-50 border-amber-300 shadow-xs'
                  : isLight
                  ? 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                  : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Volumetric Flow Rate
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">Magnetic Flowmeter</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase ${
                    getFlowStatus() === 'critical'
                      ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                      : getFlowStatus() === 'warning'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {getFlowStatus()}
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between">
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                  {Math.round(flowRate)}
                  <span className="text-xs font-mono text-slate-400 ml-1 font-normal">L/MIN</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Norm: 100-150 · Warn: &lt;80
                </div>
              </div>

              <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {renderSparkline(
                  historyFlow,
                  0,
                  180,
                  getFlowStatus() === 'critical'
                    ? '#e11d48'
                    : getFlowStatus() === 'warning'
                    ? '#d97706'
                    : '#16a34a'
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Digital Twin & Maintenance Recommendations (3 or 6 Cols) */}
          <div
            className={`${
              is3DExpanded ? 'lg:col-span-6' : 'lg:col-span-3'
            } flex flex-col gap-5`}
          >
            {/* Digital Twin Telemetry Card */}
            <div
              className={`rounded-2xl border p-5 shadow-xs transition-all ${
                isLight ? 'bg-white border-slate-200/90' : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-600" />
                  <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-800 dark:text-slate-200">
                    Digital Twin Telemetry
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-200">
                  SYNCED 1:1
                </span>
              </div>

              {/* Physical vs Twin Boxes */}
              <div className="grid grid-cols-2 gap-2.5 my-3.5">
                <div
                  className={`p-3 rounded-xl border text-center ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">
                    Physical Asset
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">CP-300 #4</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">S/N: 2026-IND-0941</div>
                </div>

                <div
                  className={`p-3 rounded-xl border text-center ${
                    isLight
                      ? 'bg-sky-50/70 border-sky-200 text-sky-900'
                      : 'bg-cyan-950/40 border-cyan-700 text-cyan-200'
                  }`}
                >
                  <div className="text-[10px] font-mono text-sky-600 dark:text-cyan-400 uppercase font-bold mb-1 flex items-center justify-center gap-1">
                    <span>LSTM Twin</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                  </div>
                  <div className="text-xs font-bold">RUL Forecast</div>
                  <div className="text-[10px] text-sky-600 dark:text-cyan-400 font-mono mt-0.5">
                    Confidence: <b>{digitalTwinMetrics.confidence}%</b>
                  </div>
                </div>
              </div>

              {/* Failure Probability Progress Bar */}
              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-500">Predicted Failure Prob:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        digitalTwinMetrics.failProb > 50
                          ? 'text-rose-600'
                          : digitalTwinMetrics.failProb > 20
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {digitalTwinMetrics.failProb}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        digitalTwinMetrics.failProb > 50
                          ? 'bg-rose-500'
                          : digitalTwinMetrics.failProb > 20
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${digitalTwinMetrics.failProb}%` }}
                    />
                  </div>
                </div>

                {/* RUL Countdown */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <span className="text-slate-500 font-medium">Remaining Useful Life:</span>
                  <span
                    className={`font-mono font-bold text-sm tabular-nums ${
                      digitalTwinMetrics.rulDays <= 7
                        ? 'text-rose-600'
                        : digitalTwinMetrics.rulDays <= 30
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {isAutoShutdown ? '0 DAYS' : `${digitalTwinMetrics.rulDays} DAYS`}
                  </span>
                </div>
              </div>
            </div>

            {/* Predictive Maintenance & Alarms Stream */}
            <div
              className={`rounded-2xl border p-5 shadow-xs flex-1 flex flex-col transition-all ${
                isLight ? 'bg-white border-slate-200/90' : 'bg-[#161b22] border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-sky-600" />
                  <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-800 dark:text-slate-200">
                    Alarms &amp; Diagnostics ({alerts.length})
                  </h3>
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-1 text-[10px] font-mono">
                  {(['all', 'critical', 'warning'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setAlertFilter(f)}
                      className={`px-2 py-0.5 rounded capitalize ${
                        alertFilter === f
                          ? 'bg-sky-100 text-sky-700 font-bold'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alert Feed List */}
              <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-mono">
                    No alarms in this category.
                  </div>
                ) : (
                  filteredAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border text-xs font-mono transition-all ${
                        alert.severity === 'critical'
                          ? 'bg-rose-50 border-rose-200 text-rose-900'
                          : alert.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-800'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400 tabular-nums">[{alert.timestamp}]</span>
                        <span
                          className={`font-bold uppercase px-1.5 py-0.5 rounded text-[9px] ${
                            alert.severity === 'critical'
                              ? 'bg-rose-100 text-rose-700'
                              : alert.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mb-0.5">
                        {alert.title}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                        {alert.recommendation}
                      </div>
                    </div>
                  ))
                )}
                <div ref={alertEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* ================= SECTION 4: 60-SECOND TIME-SERIES TREND ================= */}
        <section
          className={`rounded-2xl border p-5 shadow-xs transition-all ${
            isLight ? 'bg-white border-slate-200/90' : 'bg-[#161b22] border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-800 dark:text-slate-200">
                Time-Series Trend History (Last 60 Seconds Buffer)
              </h3>
            </div>

            {/* Metric Selector Tabs */}
            <div
              className={`flex items-center p-0.5 rounded-xl border text-xs font-mono overflow-x-auto ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}
            >
              {(
                [
                  { id: 'vibration', label: 'Vibration (mm/s)' },
                  { id: 'temperature', label: 'Temp (°C)' },
                  { id: 'current', label: 'Current (A)' },
                  { id: 'pressure', label: 'Pressure (bar)' },
                  { id: 'flow', label: 'Flow (L/min)' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedChartMetric(tab.id)}
                  className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap font-medium ${
                    selectedChartMetric === tab.id
                      ? 'bg-sky-600 text-white font-bold shadow-xs'
                      : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Chart Area */}
          <div
            className={`w-full h-36 rounded-xl p-4 border flex flex-col justify-between relative overflow-hidden ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0f172a] border-slate-800'
            }`}
          >
            {/* Grid Coordinate Lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-40">
              <div className="w-full border-b border-slate-200 dark:border-slate-800" />
              <div className="w-full border-b border-slate-200 dark:border-slate-800" />
              <div className="w-full border-b border-slate-200 dark:border-slate-800" />
            </div>

            {/* Dynamic Active Trend Curve */}
            <div className="w-full h-full relative z-10 flex items-center">
              {selectedChartMetric === 'vibration' &&
                renderSparkline(historyVib, 0, 12, isLight ? '#0284c7' : '#38bdf8')}
              {selectedChartMetric === 'temperature' &&
                renderSparkline(historyTemp, 20, 95, '#ea580c')}
              {selectedChartMetric === 'current' &&
                renderSparkline(historyCurr, 0, 20, '#ca8a04')}
              {selectedChartMetric === 'pressure' &&
                renderSparkline(historyPress, 0, 7, '#0891b2')}
              {selectedChartMetric === 'flow' &&
                renderSparkline(historyFlow, 0, 180, '#16a34a')}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800 z-10">
              <span>-60s</span>
              <span>-45s</span>
              <span>-30s</span>
              <span>-15s</span>
              <span className="font-bold text-sky-600">LIVE (0s)</span>
            </div>
          </div>
        </section>

        {/* ================= SECTION 5: TECHNICAL SPECIFICATIONS (COLLAPSIBLE) ================= */}
        <section
          className={`rounded-2xl border p-5 shadow-xs transition-all ${
            isLight ? 'bg-white border-slate-200/90' : 'bg-[#161b22] border-slate-800'
          }`}
        >
          <div
            onClick={() => setShowTechSpecs(!showTechSpecs)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-600" />
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-800 dark:text-slate-200">
                Technical Specifications &amp; Hardware Reference
              </h3>
            </div>
            <div className="text-xs font-mono font-bold text-sky-600 flex items-center gap-1">
              <span>{showTechSpecs ? 'COLLAPSE' : 'EXPAND DETAILS'}</span>
              {showTechSpecs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {showTechSpecs && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="font-bold text-sky-600 mb-2">EDGE SENSING</div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div>· ADXL345 3-Axis Accelerometer</div>
                  <div>· PT100 Platinum RTD Sensor</div>
                  <div>· ACS712 / CT Hall Ammeter</div>
                  <div>· 4-20mA 0-10 Bar Pressure</div>
                  <div>· Pulse Magnetic Flowmeter</div>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="font-bold text-emerald-600 mb-2">EDGE GATEWAY</div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div>· ESP32 Dual-Core @ 240MHz</div>
                  <div>· FreeRTOS Sensor Tasks</div>
                  <div>· TinyML FFT Vibration Binning</div>
                  <div>· Hardware Relays for Auto-Trip</div>
                  <div>· 10 kHz Burst Sampling</div>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="font-bold text-amber-600 mb-2">CLOUD &amp; ML</div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div>· InfluxDB v2.7 Time-Series</div>
                  <div>· Random Forest Classifier</div>
                  <div>· LSTM Remaining Life (RUL)</div>
                  <div>· ISO 10816 Zone Severity Engine</div>
                  <div>· TLS 1.3 MQTT Broker</div>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="font-bold text-indigo-600 mb-2">PUMP SPECIFICATIONS</div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div>· Model: Crompton CP-300</div>
                  <div>· Power: 5.5 kW (7.5 HP)</div>
                  <div>· Rated Speed: 1,450 RPM</div>
                  <div>· Best Efficiency Head: 32 m</div>
                  <div>· Rated Discharge: 130 L/min</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Maximize2,
  Minimize2,
  Layers,
  Eye,
  Activity,
  Gauge,
  Droplets,
  Flame,
  Sliders,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export type ViewMode = 'solid' | 'xray' | 'thermal' | 'exploded';
export type CameraPreset = 'isometric' | 'side' | 'front' | 'top' | 'bearing' | 'impeller';

interface Pump3DSimulatorProps {
  vibration: number; // mm/s
  temperature: number; // °C
  current: number; // A
  pressure: number; // bar
  flowRate: number; // L/min
  motorRPM: number; // RPM
  healthScore: number;
  isAutoShutdown: boolean;
  activeScenario: string;
  theme?: 'light' | 'dark';
  onSelectSensor?: (sensorId: string) => void;
  onManualRpmChange?: (rpm: number) => void;
}

export const Pump3DSimulator: React.FC<Pump3DSimulatorProps> = ({
  vibration,
  temperature,
  current,
  pressure,
  flowRate,
  motorRPM,
  healthScore,
  isAutoShutdown,
  activeScenario,
  theme = 'light',
  onSelectSensor,
  onManualRpmChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation controls state
  const [viewMode, setViewMode] = useState<ViewMode>('solid');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showStreamlines, setShowStreamlines] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // References to dynamic Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number>(0);

  // Dynamic mesh groups
  const rotatingShaftGroupRef = useRef<THREE.Group | null>(null);
  const pumpAssemblyRef = useRef<THREE.Group | null>(null);
  const motorAssemblyRef = useRef<THREE.Group | null>(null);
  const voluteAssemblyRef = useRef<THREE.Group | null>(null);
  const bearingBracketRef = useRef<THREE.Group | null>(null);
  const couplingRef = useRef<THREE.Group | null>(null);
  const suctionSpoolRef = useRef<THREE.Group | null>(null);
  const dischargeSpoolRef = useRef<THREE.Group | null>(null);

  // Fluid particles
  const particlesRef = useRef<THREE.Points | null>(null);
  const particlePositionsRef = useRef<Float32Array | null>(null);
  const particleSpeedsRef = useRef<Float32Array | null>(null);
  const cavitationParticlesRef = useRef<THREE.Points | null>(null);

  // Hotspots
  const hotspotMeshesRef = useRef<{ id: string; mesh: THREE.Mesh; label: string; desc: string; pos: THREE.Vector3 }[]>([]);

  // Orbit controls state
  const isDraggingRef = useRef<boolean>(false);
  const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 9.8,
    theta: Math.PI / 3.8,
    phi: Math.PI / 3.2
  });
  const targetCameraSphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 9.8,
    theta: Math.PI / 3.8,
    phi: Math.PI / 3.2
  });

  // Materials registry
  const materialsRegistryRef = useRef<Map<string, THREE.Material>>(new Map());

  // 1. Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();
    const isLight = theme === 'light';
    const bgCol = isLight ? 0xf8fafc : 0x090d16;
    scene.background = new THREE.Color(bgCol);
    scene.fog = new THREE.FogExp2(bgCol, isLight ? 0.035 : 0.04);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraPosition();

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLight ? 1.05 : 1.2;
    rendererRef.current = renderer;

    // Lighting (Calibrated Studio Rig)
    const ambientLight = new THREE.AmbientLight(isLight ? 0xffffff : 0x94a3b8, isLight ? 1.1 : 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, isLight ? 2.2 : 1.9);
    keyLight.position.set(7, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(isLight ? 0xbae6fd : 0x38bdf8, isLight ? 1.2 : 1.0);
    fillLight.position.set(-8, 5, -4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(isLight ? 0x0284c7 : 0x06b6d4, isLight ? 1.0 : 1.4);
    rimLight.position.set(0, 6, -8);
    scene.add(rimLight);

    // Ground Grid & Studio Shadow Plane
    const gridColor1 = isLight ? 0x0284c7 : 0x06b6d4;
    const gridColor2 = isLight ? 0xe2e8f0 : 0x1e293b;
    const gridHelper = new THREE.GridHelper(18, 24, gridColor1, gridColor2);
    gridHelper.position.y = -1.61;
    scene.add(gridHelper);

    // Ground shadow receiver disk
    const shadowPlaneGeo = new THREE.CircleGeometry(6.5, 32);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      color: isLight ? 0xdbeafe : 0x040812,
      transparent: true,
      opacity: isLight ? 0.45 : 0.65
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.60;
    scene.add(shadowPlane);

    // Root Assembly Group
    const rootAssembly = new THREE.Group();
    scene.add(rootAssembly);
    pumpAssemblyRef.current = rootAssembly;

    // Build the high-fidelity industrial pump model
    buildRefinedPumpModel(rootAssembly, isLight);

    // Build fluid streamlines
    buildRefinedFluidParticles(rootAssembly, isLight);

    // Handle Window Resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let lastTime = performance.now();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const currentTime = performance.now();
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Auto-rotation
      if (autoRotate && !isDraggingRef.current) {
        targetCameraSphericalRef.current.theta += 0.22 * delta;
      }

      // Camera Damping
      const cur = cameraSphericalRef.current;
      const tgt = targetCameraSphericalRef.current;
      cur.theta += (tgt.theta - cur.theta) * 0.12;
      cur.phi += (tgt.phi - cur.phi) * 0.12;
      cur.radius += (tgt.radius - cur.radius) * 0.12;
      updateCameraPosition();

      // Rotate Shaft & Impeller to live motor RPM
      if (rotatingShaftGroupRef.current) {
        if (!isAutoShutdown && motorRPM > 0) {
          const rps = motorRPM / 60;
          rotatingShaftGroupRef.current.rotation.x += rps * Math.PI * 2 * delta;
        }
      }

      // Natural Mechanical Harmonic Vibration Shake
      if (rootAssembly) {
        if (!isAutoShutdown && vibration > 2.8) {
          const amplitude = Math.min(0.09, (vibration / 12) * 0.045);
          const freq = currentTime * 0.04;
          rootAssembly.position.x = Math.sin(freq * 1.8) * amplitude;
          rootAssembly.position.y = Math.cos(freq * 2.2) * (amplitude * 0.6);
          rootAssembly.position.z = Math.sin(freq * 1.3) * (amplitude * 0.7);
        } else {
          rootAssembly.position.set(0, 0, 0);
        }
      }

      // Animate fluid flow particles
      animateFluidParticles(delta);

      // Animate hotspot sensor nodes
      animateHotspots(currentTime);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [theme]);

  // Update Camera
  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = cameraSphericalRef.current;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, 0.15, 0);
  };

  // Build Refined Industrial Pump & Induction Motor
  const buildRefinedPumpModel = (root: THREE.Group, isLight: boolean) => {
    materialsRegistryRef.current.clear();

    // 1. Structural Steel Baseplate (I-channel reinforced)
    const baseGeo = new THREE.BoxGeometry(6.6, 0.38, 2.5);
    const baseMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x334155 : 0x1e293b,
      metalness: 0.7,
      roughness: 0.4
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(-0.3, -1.38, 0);
    base.receiveShadow = true;
    root.add(base);
    materialsRegistryRef.current.set('baseplate', baseMat);

    // Anchor Bolt hex assemblies
    const boltGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.22, 6);
    const boltMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    [
      [-3.3, -1.18, -1.05],
      [-3.3, -1.18, 1.05],
      [2.7, -1.18, -1.05],
      [2.7, -1.18, 1.05],
      [-0.3, -1.18, -1.05],
      [-0.3, -1.18, 1.05]
    ].forEach(([x, y, z]) => {
      const b = new THREE.Mesh(boltGeo, boltMat);
      b.position.set(x, y, z);
      root.add(b);
    });

    // ================= 2. ELECTRIC INDUCTION MOTOR =================
    const motorGroup = new THREE.Group();
    motorGroup.position.set(-1.8, 0, 0);
    root.add(motorGroup);
    motorAssemblyRef.current = motorGroup;

    // Motor Stator Housing (Industrial Crompton Azure Blue)
    const motorBodyGeo = new THREE.CylinderGeometry(0.96, 0.96, 2.65, 32);
    motorBodyGeo.rotateZ(Math.PI / 2);
    const motorBodyMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x0284c7 : 0x0369a1,
      metalness: 0.45,
      roughness: 0.32
    });
    const motorBody = new THREE.Mesh(motorBodyGeo, motorBodyMat);
    motorBody.castShadow = true;
    motorBody.receiveShadow = true;
    motorGroup.add(motorBody);
    materialsRegistryRef.current.set('motorBody', motorBodyMat);

    // 16 Extruded Heat-sink Cooling Fins
    const finMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x0369a1 : 0x075985,
      metalness: 0.55,
      roughness: 0.38
    });
    materialsRegistryRef.current.set('motorFins', finMat);
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const finGeo = new THREE.BoxGeometry(2.35, 0.16, 0.04);
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.set(0, Math.cos(angle) * 1.02, Math.sin(angle) * 1.02);
      fin.rotation.x = angle;
      motorGroup.add(fin);
    }

    // Rear Fan Shroud Cowl with intake vents
    const cowlGeo = new THREE.CylinderGeometry(0.94, 0.96, 0.52, 32);
    cowlGeo.rotateZ(Math.PI / 2);
    const cowlMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
    const cowl = new THREE.Mesh(cowlGeo, cowlMat);
    cowl.position.set(-1.48, 0, 0);
    motorGroup.add(cowl);

    // Terminal Conduit Box on top (CT Current channel)
    const termBoxGeo = new THREE.BoxGeometry(0.72, 0.48, 0.62);
    const termBoxMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.3 });
    const termBox = new THREE.Mesh(termBoxGeo, termBoxMat);
    termBox.position.set(-0.25, 1.18, 0);
    motorGroup.add(termBox);

    // Motor Lifting Eyebolt
    const eyeBoltGeo = new THREE.TorusGeometry(0.12, 0.03, 12, 24);
    const eyeBolt = new THREE.Mesh(eyeBoltGeo, boltMat);
    eyeBolt.position.set(-0.25, 1.52, 0);
    motorGroup.add(eyeBolt);

    // Motor Foot Mounts
    const motorFootGeo = new THREE.BoxGeometry(1.9, 0.28, 2.15);
    const motorFoot = new THREE.Mesh(motorFootGeo, baseMat);
    motorFoot.position.set(0, -1.02, 0);
    motorGroup.add(motorFoot);

    // ================= 3. FLEXIBLE JAW COUPLING =================
    const couplingGroup = new THREE.Group();
    couplingGroup.position.set(-0.35, 0, 0);
    root.add(couplingGroup);
    couplingRef.current = couplingGroup;

    const couplingHubGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.64, 24);
    couplingHubGeo.rotateZ(Math.PI / 2);
    const couplingMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 });
    const coupling = new THREE.Mesh(couplingHubGeo, couplingMat);
    couplingGroup.add(coupling);
    materialsRegistryRef.current.set('coupling', couplingMat);

    // Yellow Perforated Safety Guard
    const guardGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.85, 24, 1, true, 0, Math.PI);
    guardGeo.rotateZ(Math.PI / 2);
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.set(0, 0.2, 0);
    couplingGroup.add(guard);

    // ================= 4. BEARING BRACKET (PEDESTAL) =================
    const bracketGroup = new THREE.Group();
    bracketGroup.position.set(0.62, 0, 0);
    root.add(bracketGroup);
    bearingBracketRef.current = bracketGroup;

    const bracketGeo = new THREE.CylinderGeometry(0.68, 0.68, 1.15, 28);
    bracketGeo.rotateZ(Math.PI / 2);
    const bracketMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x475569 : 0x334155,
      metalness: 0.7,
      roughness: 0.35
    });
    const bracket = new THREE.Mesh(bracketGeo, bracketMat);
    bracket.castShadow = true;
    bracketGroup.add(bracket);
    materialsRegistryRef.current.set('bearingBracket', bracketMat);

    // Oil Level Sight Glass
    const sightGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16);
    const sightMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, roughness: 0.1 });
    const sight = new THREE.Mesh(sightGeo, sightMat);
    sight.position.set(0, 0, 0.72);
    sight.rotateX(Math.PI / 2);
    bracketGroup.add(sight);

    // Breather cap on top
    const breatherGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.22, 16);
    const breather = new THREE.Mesh(breatherGeo, boltMat);
    breather.position.set(0, 0.78, 0);
    bracketGroup.add(breather);

    // Bearing Pedestal Foot
    const bracketFootGeo = new THREE.BoxGeometry(1.05, 0.5, 1.45);
    const bracketFoot = new THREE.Mesh(bracketFootGeo, baseMat);
    bracketFoot.position.set(0, -0.92, 0);
    bracketGroup.add(bracketFoot);

    // ================= 5. CENTRIFUGAL VOLUTE CASING =================
    const voluteGroup = new THREE.Group();
    voluteGroup.position.set(1.95, 0, 0);
    root.add(voluteGroup);
    voluteAssemblyRef.current = voluteGroup;

    // Spiral Expanding Volute Body
    const voluteGeo = new THREE.TorusGeometry(0.98, 0.52, 24, 48);
    voluteGeo.rotateY(Math.PI / 2);
    const voluteMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x0891b2 : 0x06b6d4, // Cyan Cast Iron
      metalness: 0.6,
      roughness: 0.28
    });
    const voluteCasing = new THREE.Mesh(voluteGeo, voluteMat);
    voluteCasing.castShadow = true;
    voluteGroup.add(voluteCasing);
    materialsRegistryRef.current.set('voluteCasing', voluteMat);

    // Back cover plate
    const backPlateGeo = new THREE.CylinderGeometry(1.45, 1.45, 0.26, 32);
    backPlateGeo.rotateZ(Math.PI / 2);
    const backPlateMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x0e7490 : 0x0891b2,
      metalness: 0.65,
      roughness: 0.35
    });
    const backPlate = new THREE.Mesh(backPlateGeo, backPlateMat);
    backPlate.position.set(-0.36, 0, 0);
    voluteGroup.add(backPlate);
    materialsRegistryRef.current.set('backPlate', backPlateMat);

    // Suction Nozzle (Inlet +X)
    const suctionPipeGeo = new THREE.CylinderGeometry(0.48, 0.48, 1.1, 24);
    suctionPipeGeo.rotateZ(Math.PI / 2);
    const suctionMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0x164e63 : 0x0e7490,
      metalness: 0.7,
      roughness: 0.3
    });
    const suctionPipe = new THREE.Mesh(suctionPipeGeo, suctionMat);
    suctionPipe.position.set(0.95, 0, 0);
    voluteGroup.add(suctionPipe);

    // Suction Bolt Flange Ring
    const suctionFlangeGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.16, 24);
    suctionFlangeGeo.rotateZ(Math.PI / 2);
    const suctionFlange = new THREE.Mesh(suctionFlangeGeo, suctionMat);
    suctionFlange.position.set(1.48, 0, 0);
    voluteGroup.add(suctionFlange);

    // Discharge Nozzle (Outlet +Y)
    const dischargePipeGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.15, 24);
    const dischargePipe = new THREE.Mesh(dischargePipeGeo, suctionMat);
    dischargePipe.position.set(0, 1.3, 0);
    voluteGroup.add(dischargePipe);

    // Discharge Flange Ring
    const dischargeFlangeGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.16, 24);
    const dischargeFlange = new THREE.Mesh(dischargeFlangeGeo, suctionMat);
    dischargeFlange.position.set(0, 1.86, 0);
    voluteGroup.add(dischargeFlange);

    // Priming Port Cap on top
    const primeCapGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.16, 16);
    const primeCap = new THREE.Mesh(primeCapGeo, boltMat);
    primeCap.position.set(0.35, 1.55, 0);
    voluteGroup.add(primeCap);

    // Flange Hex Bolts around perimeter
    const fBoltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.38, 6);
    fBoltGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(fBoltGeo, boltMat);
      b.position.set(-0.36, Math.cos(ang) * 1.3, Math.sin(ang) * 1.3);
      voluteGroup.add(b);
    }

    // ================= 6. ROTATING ASSEMBLY (SHAFT & IMPELLER) =================
    const rotatingGroup = new THREE.Group();
    rotatingGroup.position.set(0, 0, 0);
    root.add(rotatingGroup);
    rotatingShaftGroupRef.current = rotatingGroup;

    // Hardened Stainless Steel Drive Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.18, 0.18, 4.5, 24);
    shaftGeo.rotateZ(Math.PI / 2);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.96,
      roughness: 0.12
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(0.12, 0, 0);
    rotatingGroup.add(shaft);
    materialsRegistryRef.current.set('shaft', shaftMat);

    // Impeller Assembly (Bronze alloy)
    const impellerGroup = new THREE.Group();
    impellerGroup.position.set(1.9, 0, 0);
    rotatingGroup.add(impellerGroup);

    const shroudGeo = new THREE.CylinderGeometry(0.88, 0.88, 0.09, 28);
    shroudGeo.rotateZ(Math.PI / 2);
    const impellerMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Amber Cast Bronze
      metalness: 0.88,
      roughness: 0.22
    });
    const shroudFront = new THREE.Mesh(shroudGeo, impellerMat);
    shroudFront.position.set(0.16, 0, 0);
    impellerGroup.add(shroudFront);

    const shroudBack = new THREE.Mesh(shroudGeo, impellerMat);
    shroudBack.position.set(-0.16, 0, 0);
    impellerGroup.add(shroudBack);
    materialsRegistryRef.current.set('impeller', impellerMat);

    // 6 Logarithmic Curved Blades
    for (let i = 0; i < 6; i++) {
      const vaneAng = (i / 6) * Math.PI * 2;
      const vaneGeo = new THREE.BoxGeometry(0.26, 0.48, 0.07);
      const vane = new THREE.Mesh(vaneGeo, impellerMat);
      vane.position.set(0, Math.cos(vaneAng) * 0.48, Math.sin(vaneAng) * 0.48);
      vane.rotation.x = vaneAng + 0.6; // Backward curvature
      impellerGroup.add(vane);
    }

    // Impeller Lock Nut
    const nutGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.24, 6);
    nutGeo.rotateZ(Math.PI / 2);
    const nut = new THREE.Mesh(nutGeo, boltMat);
    nut.position.set(0.28, 0, 0);
    impellerGroup.add(nut);

    // 7. Hotspot Sensor Pins
    buildRefinedHotspots(root);
  };

  // Build 3D Sensor Hotspot Nodes
  const buildRefinedHotspots = (root: THREE.Group) => {
    hotspotMeshesRef.current = [];

    const sensors = [
      {
        id: 'vib',
        label: 'ADXL345 Vibration Sensor',
        desc: 'ISO 10816 velocity transducer on drive-end bearing',
        pos: new THREE.Vector3(0.62, 0.76, 0.38)
      },
      {
        id: 'temp',
        label: 'PT100 RTD Temperature Probe',
        desc: 'Direct-contact RTD thermowell measuring bearing outer race',
        pos: new THREE.Vector3(0.98, 0.76, -0.38)
      },
      {
        id: 'press',
        label: '4-20mA Pressure Transducer',
        desc: 'Piezoresistive gauge measuring discharge head pressure',
        pos: new THREE.Vector3(1.95, 1.68, 0.48)
      },
      {
        id: 'flow',
        label: 'Magnetic Flow Meter',
        desc: 'Electromagnetic flow sensor on inlet suction spool',
        pos: new THREE.Vector3(3.0, 0.58, 0)
      },
      {
        id: 'curr',
        label: 'Hall Effect Current CT',
        desc: 'Current transformer measuring motor 3-phase amperage',
        pos: new THREE.Vector3(-2.05, 1.5, 0.32)
      }
    ];

    sensors.forEach((s) => {
      const g = new THREE.Group();
      g.position.copy(s.pos);

      // Sensor sphere
      const sphereGeo = new THREE.SphereGeometry(0.13, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.7,
        roughness: 0.2
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      g.add(sphere);

      // Pulsing Ring
      const ringGeo = new THREE.RingGeometry(0.18, 0.26, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      g.add(ring);

      root.add(g);

      hotspotMeshesRef.current.push({
        id: s.id,
        mesh: sphere,
        label: s.label,
        desc: s.desc,
        pos: s.pos
      });
    });
  };

  // Build Fluid Streamlines Particles
  const buildRefinedFluidParticles = (root: THREE.Group, isLight: boolean) => {
    const particleCount = 360;
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const t = Math.random();
      speeds[i] = 0.6 + Math.random() * 0.8;
      const p = getFluidCoordinate(t);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: isLight ? 0x0284c7 : 0x38bdf8,
      size: 0.18,
      transparent: true,
      opacity: 0.85,
      blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    root.add(particles);
    particlesRef.current = particles;
    particlePositionsRef.current = positions;
    particleSpeedsRef.current = speeds;
  };

  // Coordinate along hydraulic passage
  const getFluidCoordinate = (t: number) => {
    let x = 0, y = 0, z = 0;
    if (t < 0.4) {
      // Suction inlet (+X into pump eye at x=1.95)
      const prog = t / 0.4;
      x = 3.3 - prog * 1.35;
      const rad = 0.34 * (1 - prog * 0.35);
      const ang = prog * 9;
      y = Math.cos(ang) * rad;
      z = Math.sin(ang) * rad;
    } else if (t < 0.76) {
      // Impeller whirling vortex
      const prog = (t - 0.4) / 0.36;
      const ang = prog * Math.PI * 3.8;
      const rad = 0.28 + prog * 0.72;
      x = 1.9 + (Math.random() - 0.5) * 0.12;
      y = Math.cos(ang) * rad;
      z = Math.sin(ang) * rad;
    } else {
      // Discharge pipe upwards (+Y)
      const prog = (t - 0.76) / 0.24;
      x = 1.95 + (Math.random() - 0.5) * 0.12;
      y = 1.05 + prog * 1.65;
      z = (Math.random() - 0.5) * 0.2;
    }
    return { x, y, z };
  };

  // Animate Fluid Particles
  const animateFluidParticles = (delta: number) => {
    if (!particlesRef.current || !particlePositionsRef.current || !particleSpeedsRef.current) return;
    const positions = particlePositionsRef.current;
    const speeds = particleSpeedsRef.current;
    const count = speeds.length;

    const isDry = activeScenario === 'DRY_RUN' || isAutoShutdown || flowRate <= 0;
    const flowVelocity = isDry ? 0 : Math.max(0.25, flowRate / 120);

    // Particle color change on Dry Run / Blockage
    const mat = particlesRef.current.material as THREE.PointsMaterial;
    if (activeScenario === 'BLOCKAGE') {
      mat.color.setHex(0xf59e0b);
    } else if (activeScenario === 'DRY_RUN') {
      mat.color.setHex(0xef4444);
    } else {
      mat.color.setHex(theme === 'light' ? 0x0284c7 : 0x38bdf8);
    }

    if (flowVelocity === 0) {
      particlesRef.current.visible = false;
      return;
    }
    particlesRef.current.visible = showStreamlines;

    for (let i = 0; i < count; i++) {
      const speed = speeds[i] * flowVelocity * delta * 1.5;

      if (positions[i * 3] > 1.95 && positions[i * 3 + 1] < 0.65) {
        // Suction inflow
        positions[i * 3] -= speed * 1.6;
      } else if (positions[i * 3 + 1] > 0.85) {
        // Discharge outflow (+Y)
        positions[i * 3 + 1] += speed * 2.3;
        if (positions[i * 3 + 1] > 2.8) {
          // Recycle
          positions[i * 3] = 3.3;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 0.32;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 0.32;
        }
      } else {
        // Swirl vortex
        const curY = positions[i * 3 + 1];
        const curZ = positions[i * 3 + 2];
        const ang = Math.atan2(curZ, curY) + speed * 6.5;
        const rad = Math.min(0.98, Math.hypot(curY, curZ) + speed * 0.45);
        positions[i * 3 + 1] = Math.cos(ang) * rad;
        positions[i * 3 + 2] = Math.sin(ang) * rad;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  };

  // Animate Hotspot Rings
  const animateHotspots = (time: number) => {
    hotspotMeshesRef.current.forEach((h, index) => {
      const pulse = 1.0 + Math.sin(time * 0.005 + index * 1.3) * 0.22;
      h.mesh.scale.set(pulse, pulse, pulse);

      const isAlert =
        (h.id === 'vib' && vibration > 4.0) ||
        (h.id === 'temp' && temperature > 60) ||
        (h.id === 'curr' && current > 8.0) ||
        (h.id === 'press' && (pressure < 1.5 || pressure > 5.0)) ||
        (h.id === 'flow' && flowRate < 80);

      const mat = h.mesh.material as THREE.MeshStandardMaterial;
      if (isAlert) {
        mat.color.setHex(0xe11d48);
        mat.emissive.setHex(0xbe123c);
      } else if (h.id === selectedPart) {
        mat.color.setHex(0xd97706);
        mat.emissive.setHex(0xb45309);
      } else {
        mat.color.setHex(0x0284c7);
        mat.emissive.setHex(0x0369a1);
      }
    });
  };

  // View Mode Transitions (Solid, X-Ray, Thermal, Exploded)
  useEffect(() => {
    const materials = materialsRegistryRef.current;
    const isLight = theme === 'light';

    // Exploded View Offsets
    const explodeDist = viewMode === 'exploded' ? 1.0 + explodedFactor : 0.0;
    if (motorAssemblyRef.current) motorAssemblyRef.current.position.x = -1.8 - explodeDist * 1.45;
    if (couplingRef.current) couplingRef.current.position.x = -0.35 - explodeDist * 0.55;
    if (bearingBracketRef.current) bearingBracketRef.current.position.x = 0.62 + explodeDist * 0.35;
    if (voluteAssemblyRef.current) voluteAssemblyRef.current.position.x = 1.95 + explodeDist * 1.65;

    // Material updates
    materials.forEach((mat, key) => {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (!stdMat) return;

      if (viewMode === 'xray') {
        if (key === 'voluteCasing' || key === 'motorBody' || key === 'bearingBracket' || key === 'backPlate') {
          stdMat.transparent = true;
          stdMat.opacity = isLight ? 0.32 : 0.26;
          stdMat.roughness = 0.1;
        } else {
          stdMat.transparent = false;
          stdMat.opacity = 1.0;
        }
      } else if (viewMode === 'thermal') {
        stdMat.transparent = false;
        stdMat.opacity = 1.0;
        if (key === 'bearingBracket') {
          const tempNorm = Math.max(0, Math.min(1, (temperature - 30) / 60));
          if (tempNorm > 0.75) {
            stdMat.color.setHex(0xe11d48);
            stdMat.emissive.setHex(0xbe123c);
          } else if (tempNorm > 0.45) {
            stdMat.color.setHex(0xd97706);
            stdMat.emissive.setHex(0x92400e);
          } else {
            stdMat.color.setHex(0x0284c7);
            stdMat.emissive.setHex(0x0369a1);
          }
        } else if (key === 'motorBody') {
          const currNorm = Math.max(0, Math.min(1, (current - 4) / 10));
          if (currNorm > 0.7) {
            stdMat.color.setHex(0xe11d48);
            stdMat.emissive.setHex(0x881337);
          } else {
            stdMat.color.setHex(isLight ? 0x0284c7 : 0x0369a1);
            stdMat.emissive.setHex(0x000000);
          }
        }
      } else {
        // Solid View
        stdMat.transparent = false;
        stdMat.opacity = 1.0;
        stdMat.emissive.setHex(0x000000);
        if (key === 'voluteCasing') stdMat.color.setHex(isLight ? 0x0891b2 : 0x06b6d4);
        if (key === 'motorBody') stdMat.color.setHex(isLight ? 0x0284c7 : 0x0369a1);
        if (key === 'bearingBracket') stdMat.color.setHex(isLight ? 0x475569 : 0x334155);
        if (key === 'coupling') stdMat.color.setHex(0xf59e0b);
        if (key === 'impeller') stdMat.color.setHex(0xd97706);
      }
      stdMat.needsUpdate = true;
    });
  }, [viewMode, explodedFactor, temperature, current, theme]);

  // Apply Camera Presets
  const applyCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    setAutoRotate(false);

    if (preset === 'isometric') {
      targetCameraSphericalRef.current = { radius: 9.8, theta: Math.PI / 3.8, phi: Math.PI / 3.2 };
    } else if (preset === 'side') {
      targetCameraSphericalRef.current = { radius: 8.8, theta: 0, phi: Math.PI / 2.05 };
    } else if (preset === 'front') {
      targetCameraSphericalRef.current = { radius: 8.8, theta: Math.PI / 2, phi: Math.PI / 2.1 };
    } else if (preset === 'top') {
      targetCameraSphericalRef.current = { radius: 10.5, theta: Math.PI / 4, phi: 0.08 };
    } else if (preset === 'bearing') {
      targetCameraSphericalRef.current = { radius: 5.2, theta: Math.PI / 4.5, phi: Math.PI / 2.7 };
    } else if (preset === 'impeller') {
      targetCameraSphericalRef.current = { radius: 5.8, theta: Math.PI / 1.8, phi: Math.PI / 2.5 };
    }
  };

  // Mouse & Touch Orbit Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    setAutoRotate(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - prevMousePosRef.current.x;
    const deltaY = e.clientY - prevMousePosRef.current.y;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    targetCameraSphericalRef.current.theta -= deltaX * 0.007;
    targetCameraSphericalRef.current.phi = Math.max(
      0.08,
      Math.min(Math.PI / 2.02, targetCameraSphericalRef.current.phi - deltaY * 0.007)
    );
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    targetCameraSphericalRef.current.radius = Math.max(
      3.5,
      Math.min(14.5, targetCameraSphericalRef.current.radius + e.deltaY * 0.005)
    );
  };

  const isLight = theme === 'light';

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden transition-all border ${
        isLight
          ? 'bg-slate-100/90 border-slate-200/90 shadow-sm'
          : 'bg-[#090d16] border-slate-800 shadow-2xl'
      } ${isFullscreen ? 'fixed inset-3 z-50 h-[calc(100vh-1.5rem)]' : 'h-[400px] sm:h-[460px]'}`}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* TOP FLOATING HUD BAR */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none flex-wrap gap-2">
        {/* Title & Live RPM Status */}
        <div
          className={`px-3 py-1.5 rounded-xl border shadow-sm pointer-events-auto flex items-center gap-2 text-xs font-mono font-semibold ${
            isLight
              ? 'bg-white/95 text-slate-800 border-slate-200/90 backdrop-blur-md'
              : 'bg-slate-900/90 text-white border-slate-700/80 backdrop-blur-md'
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isAutoShutdown ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <span className="font-bold tracking-tight">CROMPTON 5.5kW · 3D DIGITAL TWIN</span>
          <span className="text-slate-400">|</span>
          <span
            className={`font-mono font-bold ${
              isAutoShutdown
                ? 'text-rose-600'
                : motorRPM > 1400
                ? 'text-emerald-600'
                : 'text-amber-600'
            }`}
          >
            {isAutoShutdown ? 'AUTO-SHUTDOWN (0 RPM)' : `${motorRPM} RPM`}
          </span>
        </div>

        {/* View Mode Segmented Bar */}
        <div
          className={`p-1 rounded-xl border shadow-sm pointer-events-auto flex items-center gap-1 ${
            isLight
              ? 'bg-white/95 border-slate-200/90 backdrop-blur-md'
              : 'bg-slate-900/90 border-slate-700/80 backdrop-blur-md'
          }`}
        >
          <button
            onClick={() => setViewMode('solid')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
              viewMode === 'solid'
                ? 'bg-sky-600 text-white shadow-xs'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Solid
          </button>
          <button
            onClick={() => setViewMode('xray')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
              viewMode === 'xray'
                ? 'bg-sky-600 text-white shadow-xs'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            X-Ray
          </button>
          <button
            onClick={() => setViewMode('thermal')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
              viewMode === 'thermal'
                ? 'bg-amber-600 text-white shadow-xs'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Thermal
          </button>
          <button
            onClick={() => setViewMode('exploded')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
              viewMode === 'exploded'
                ? 'bg-indigo-600 text-white shadow-xs'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Exploded
          </button>
        </div>
      </div>

      {/* EXPLODED VIEW SLIDER (When exploded is active) */}
      {viewMode === 'exploded' && (
        <div
          className={`absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl border shadow-md pointer-events-auto flex items-center gap-3 text-xs font-medium z-10 ${
            isLight ? 'bg-white/95 border-slate-200 text-slate-700' : 'bg-slate-900/90 border-slate-700 text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-500" />
          <span>Explosion Distance:</span>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={explodedFactor}
            onChange={(e) => setExplodedFactor(parseFloat(e.target.value))}
            className="w-28 accent-indigo-600 cursor-pointer"
          />
          <span className="font-mono font-bold text-indigo-600">
            {Math.round((1 + explodedFactor) * 100)}%
          </span>
        </div>
      )}

      {/* BOTTOM FLOATING CONTROLS */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none flex-wrap gap-2">
        {/* Camera Presets */}
        <div
          className={`p-1 rounded-xl border shadow-sm pointer-events-auto flex items-center gap-1 text-xs ${
            isLight
              ? 'bg-white/95 border-slate-200/90 text-slate-700 backdrop-blur-md'
              : 'bg-slate-900/90 border-slate-700 text-slate-300 backdrop-blur-md'
          }`}
        >
          <span className="text-[11px] font-mono text-slate-400 px-1.5 hidden sm:inline">PRESET:</span>
          {(['isometric', 'side', 'front', 'bearing', 'impeller'] as CameraPreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => applyCameraPreset(preset)}
              className={`px-2 py-0.5 text-[11px] font-mono capitalize rounded-md transition-all ${
                cameraPreset === preset
                  ? isLight
                    ? 'bg-sky-100 text-sky-700 font-bold'
                    : 'bg-slate-800 text-cyan-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Feature Toggles */}
        <div
          className={`p-1 rounded-xl border shadow-sm pointer-events-auto flex items-center gap-1 text-xs font-mono ${
            isLight
              ? 'bg-white/95 border-slate-200/90 backdrop-blur-md'
              : 'bg-slate-900/90 border-slate-700 backdrop-blur-md'
          }`}
        >
          {/* Fluid Streamline Toggle */}
          <button
            onClick={() => setShowStreamlines(!showStreamlines)}
            className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
              showStreamlines
                ? isLight
                  ? 'bg-sky-100 text-sky-700 font-bold'
                  : 'bg-cyan-950 text-cyan-400'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Toggle Fluid Particles"
          >
            <Droplets className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flow</span>
          </button>

          {/* 360 Spin Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
              autoRotate
                ? isLight
                  ? 'bg-sky-100 text-sky-700 font-bold'
                  : 'bg-cyan-950 text-cyan-400'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Auto Rotate 360°"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Spin</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-2 py-1 rounded-md transition-all ${
              isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* LIVE TELEMETRY FLOATING CORNER HUD */}
      <div
        className={`absolute top-14 left-3 p-3 rounded-xl border text-xs font-mono pointer-events-none hidden sm:block max-w-[220px] space-y-1.5 shadow-sm ${
          isLight
            ? 'bg-white/95 border-slate-200/90 text-slate-700 backdrop-blur-md'
            : 'bg-slate-900/85 border-slate-800 text-slate-300 backdrop-blur-md'
        }`}
      >
        <div className="text-[10px] uppercase font-bold tracking-wider text-sky-600">
          SPATIAL TWIN TELEMETRY
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Vib Jitter:</span>
          <span className={`font-bold ${vibration > 4 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {vibration.toFixed(2)} mm/s
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Thermal Flux:</span>
          <span className={`font-bold ${temperature > 60 ? 'text-rose-600' : 'text-sky-600'}`}>
            {temperature.toFixed(1)} °C
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Hydraulic Q:</span>
          <span className="font-bold text-slate-800">
            {isAutoShutdown ? '0 L/min' : `${Math.round(flowRate)} L/min`}
          </span>
        </div>
      </div>

      {/* INTERACTIVE HINT */}
      <div
        className={`absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-medium pointer-events-none hidden md:block shadow-xs border ${
          isLight
            ? 'bg-white/90 border-slate-200 text-slate-500'
            : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}
      >
        Drag mouse to orbit 360° · Scroll to zoom · Mode: {viewMode.toUpperCase()}
      </div>
    </div>
  );
};

/**
 * app.js - Enterprise Orchestration for AXIOM Formal Risk Engine.
 * Features 3D Curvature Manifold (Three.js) with Dynamic Wave / Static Geometry toggle,
 * Walley Imprecise Bounds, MCTS Continuous Boundary Prober, and SHA-256 Cryptographic Certificates.
 */

const API_BASE = (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')
  ? 'http://127.0.0.1:8000'
  : window.location.origin;

// Application State
let lastFraudCert = null;
let lastCreditCert = null;
let spectralChart = null;

// Three.js 3D Wave / Manifold Globals
let scene, camera, renderer, controls;
let waveMesh, waveWireMesh, fraudPointMesh, userPointMesh, boundaryLineMesh;
let autoOrbitEnabled = true;
let waveDynamicsEnabled = true; // Toggle between Dynamic Wave & Static Curvature
let raycaster = null;
let mouse = null;
let fraudDebounceTimer = null;

// =============================================================================
// Live Sliders & Inputs Synchronization
// =============================================================================

function syncSliderToInput(inputId, val, unit = '') {
  const input = document.getElementById(inputId);
  if (input) input.value = val;

  const badge = document.getElementById(`${inputId}-val`);
  if (badge) {
    const num = parseFloat(val);
    badge.innerText = unit === '$' ? `$${num.toLocaleString()}` : `${num.toLocaleString()}${unit}`;
  }

  debouncedEvaluateFraud();
}

function syncInputToSlider(sliderId, val, unit = '', badgeId = null) {
  const slider = document.getElementById(sliderId);
  if (slider) slider.value = val;

  if (badgeId) {
    const badge = document.getElementById(badgeId);
    if (badge) {
      const num = parseFloat(val);
      badge.innerText = unit === '$' ? `$${num.toLocaleString()}` : `${num.toLocaleString()}${unit}`;
    }
  }

  debouncedEvaluateFraud();
}

function onEntropySliderChange(val) {
  const badge = document.getElementById("entropy-val");
  if (badge) badge.innerText = `${val} bits`;
  debouncedEvaluateFraud();
}

function debouncedEvaluateFraud() {
  clearTimeout(fraudDebounceTimer);
  fraudDebounceTimer = setTimeout(() => {
    evaluateFraud();
  }, 120);
}

let creditDebounceTimer = null;
function debouncedEvaluateCredit() {
  clearTimeout(creditDebounceTimer);
  creditDebounceTimer = setTimeout(() => {
    evaluateCredit();
  }, 120);
}

// 3D Toolbar Controls
function toggleAutoOrbit() {
  autoOrbitEnabled = !autoOrbitEnabled;
  const btn = document.getElementById("btn-toggle-orbit");
  const statusEl = document.getElementById("orbit-status");
  if (btn && statusEl) {
    btn.className = `hud-pill-btn ${autoOrbitEnabled ? 'active' : ''}`;
    statusEl.innerText = autoOrbitEnabled ? 'ON' : 'OFF';
  }
}

function toggleWaveDynamics() {
  waveDynamicsEnabled = !waveDynamicsEnabled;
  const btn = document.getElementById("btn-toggle-wave");
  const statusEl = document.getElementById("wave-dynamics-status");
  if (btn && statusEl) {
    btn.className = `hud-pill-btn ${waveDynamicsEnabled ? 'active' : ''}`;
    statusEl.innerText = waveDynamicsEnabled ? 'Wave (Dynamic)' : 'Static';
  }
}

function reset3DCamera() {
  if (camera && controls) {
    camera.position.set(11, 10, 13);
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

// =============================================================================
// Initialization & Tab Navigation
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initThreeJSPolytope();
  initSpectralChart();
  loadAxiomsCatalog();
  updateSystemStatus();

  // Initial evaluations
  evaluateFraud();
  evaluateCredit();
});

function initTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add("active");

      if (targetId === "fraud-tab" && renderer && camera) {
        onWindowResize();
      }
    });
  });
}

async function updateSystemStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/status`);
    if (!res.ok) return;
    const data = await res.json();
    const thmActiveCard = document.getElementById("mcts-theorems-active");
    if (thmActiveCard && data.active_dynamic_theorems !== undefined) {
      thmActiveCard.innerText = data.active_dynamic_theorems;
    }
  } catch (err) {
    console.warn("Status poll error:", err);
  }
}

// =============================================================================
// Three.js 3D Risk Curvature Manifold
// =============================================================================

function initThreeJSPolytope() {
  const container = document.getElementById("manifold-canvas-container");
  if (!container) return;

  const width = container.clientWidth || 400;
  const height = container.clientHeight || 380;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x09090b);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(11, 10, 13);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 35;
  controls.minDistance = 3;

  // Subtle clean enterprise lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xd4d4d8, 0.8);
  dirLight.position.set(15, 20, 15);
  scene.add(dirLight);

  // Subtle ground grid
  const grid = new THREE.GridHelper(16, 16, 0x27272a, 0x18181b);
  grid.position.y = -1.2;
  scene.add(grid);

  // Curvature Wave / Manifold Mesh
  const waveGeo = new THREE.PlaneGeometry(16, 16, 36, 36);
  waveGeo.rotateX(-Math.PI / 2);

  const waveMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.7,
    metalness: 0.1,
    side: THREE.DoubleSide
  });
  waveMesh = new THREE.Mesh(waveGeo, waveMat);
  scene.add(waveMesh);

  // Wireframe lines
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x3f3f46,
    wireframe: true,
    transparent: true,
    opacity: 0.55
  });
  waveWireMesh = new THREE.Mesh(waveGeo, wireMat);
  scene.add(waveWireMesh);

  // Fraud Singularity Point (Red)
  const fraudGeo = new THREE.SphereGeometry(0.35, 24, 24);
  const fraudMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.3
  });
  fraudPointMesh = new THREE.Mesh(fraudGeo, fraudMat);
  fraudPointMesh.position.set(4.2, 1.4, 4.2);
  scene.add(fraudPointMesh);

  // User State Vector (Green / Dynamic)
  const userGeo = new THREE.SphereGeometry(0.32, 24, 24);
  const userMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.3
  });
  userPointMesh = new THREE.Mesh(userGeo, userMat);
  userPointMesh.position.set(0, 0.4, 0);
  scene.add(userPointMesh);

  // Raycasting on 3D Surface
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(waveMesh);

    if (intersects && intersects.length > 0) {
      const pt = intersects[0].point;
      const dist = Math.min(4500, Math.max(5, ((pt.x + 5.5) / 11.0) * 4000));
      const vel = Math.min(30, Math.max(1, ((pt.z + 5.5) / 11.0) * 26));

      syncSliderToInput('f-distance', Math.round(dist), ' km');
      const distSlider = document.getElementById('f-distance-slider');
      if (distSlider) distSlider.value = Math.round(dist);

      syncSliderToInput('f-velocity', parseFloat(vel.toFixed(1)), ' tx/h');
      const velSlider = document.getElementById('f-velocity-slider');
      if (velSlider) velSlider.value = parseFloat(vel.toFixed(1));
    }
  });

  // Animation Loop: Handles dynamic wave vs static Riemannian manifold
  function animate() {
    requestAnimationFrame(animate);
    const time = waveDynamicsEnabled ? Date.now() * 0.0012 : 0;

    if (controls) {
      controls.autoRotate = autoOrbitEnabled;
      controls.autoRotateSpeed = 0.8;
    }

    if (waveMesh && waveMesh.geometry) {
      const pos = waveMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = waveDynamicsEnabled
          ? Math.sin(x * 0.45 + time) * Math.cos(z * 0.45 + time * 0.8) * 1.1
          : Math.sin(x * 0.35) * Math.cos(z * 0.35) * 0.85;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      waveMesh.geometry.computeVertexNormals();
    }

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  const container = document.getElementById("manifold-canvas-container");
  if (!container || !renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight || 380;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function updatePolytopeView(polytopeData, decision = null) {
  if (!userPointMesh || !scene) return;

  // Resolve decision either from parameter, or from DOM status badge
  if (!decision) {
    const badge = document.getElementById("fraud-decision-badge");
    decision = badge ? badge.innerText.trim().toUpperCase() : "ALLOW";
  } else {
    decision = String(decision).trim().toUpperCase();
  }

  if (!polytopeData) {
    polytopeData = { user_point: [0, 0, 0], is_inside_polytope: decision !== "BLOCK", distance_to_boundary: 0.0 };
  }

  const [ux, uy, uz] = polytopeData.user_point || [0, 0, 0];
  const sx = Math.min(5.5, Math.max(-5.5, (ux - 5.0) * 0.7));
  const sz = Math.min(5.5, Math.max(-5.5, (uz - 2.0) * 1.4));
  const sy = Math.max(0.3, uy * 1.4 + 0.3);

  userPointMesh.position.set(sx, sy, sz);

  const isBlocked = (decision === "BLOCK") || (decision === "REJECT") || (!polytopeData.is_inside_polytope);

  if (isBlocked) {
    userPointMesh.material.color.setHex(0xef4444);
    if (waveWireMesh) {
      waveWireMesh.material.color.setHex(0xef4444);
      waveWireMesh.material.opacity = 0.95;
    }
    if (waveMesh) waveMesh.material.color.setHex(0x271414);
  } else {
    userPointMesh.material.color.setHex(0x10b981);
    if (waveWireMesh) {
      waveWireMesh.material.color.setHex(0x3f3f46);
      waveWireMesh.material.opacity = 0.55;
    }
    if (waveMesh) waveMesh.material.color.setHex(0x18181b);
  }

  // Geodesic Trajectory
  if (boundaryLineMesh) {
    scene.remove(boundaryLineMesh);
    boundaryLineMesh.geometry.dispose();
  }

  const targetPoint = !isBlocked ? new THREE.Vector3(4.2, 1.4, 4.2) : new THREE.Vector3(sx, -0.6, sz);
  const midPoint = new THREE.Vector3(
    (sx + targetPoint.x) / 2,
    Math.max(sy, targetPoint.y) + 1.0,
    (sz + targetPoint.z) / 2
  );

  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(sx, sy, sz),
    midPoint,
    targetPoint
  );

  const points = curve.getPoints(20);
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const lineMat = new THREE.LineDashedMaterial({
    color: isBlocked ? 0xef4444 : 0x10b981,
    dashSize: 0.3,
    gapSize: 0.2,
    linewidth: 1.5
  });
  boundaryLineMesh = new THREE.Line(lineGeo, lineMat);
  boundaryLineMesh.computeLineDistances();
  scene.add(boundaryLineMesh);

  const distEl = document.getElementById("polytope-dist");
  if (distEl && polytopeData.distance_to_boundary !== undefined) {
    distEl.innerText = Number(polytopeData.distance_to_boundary).toFixed(2);
  }
}

// =============================================================================
// Graph Laplacian Spectral Chart (Chart.js)
// =============================================================================

function initSpectralChart() {
  const ctx = document.getElementById("spectralChart");
  if (!ctx) return;

  spectralChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['λ₁', 'λ₂', 'λ₃', 'λ₄', 'λ₅', 'λ₆'],
      datasets: [{
        label: 'Laplacian Spectrum',
        data: [1.2, 0.9, 0.6, 0.4, 0.2, 0.0],
        backgroundColor: '#3f3f46',
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 2.0,
          grid: { color: '#27272a' },
          ticks: { color: '#71717a', font: { family: 'JetBrains Mono', size: 9 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#71717a', font: { family: 'JetBrains Mono', size: 9 } }
        }
      }
    }
  });
}

function updateSpectralView(spectralData) {
  if (!spectralData || !spectralChart) return;

  const vals = spectralData.laplacian_eigenvalues || [];
  spectralChart.data.labels = vals.map((_, i) => `λ${i+1}`);
  spectralChart.data.datasets[0].data = vals;

  const isAnomalous = spectralData.is_ring_anomalous;
  spectralChart.data.datasets[0].backgroundColor = isAnomalous ? '#ef4444' : '#52525b';
  spectralChart.update();

  const statusEl = document.getElementById("spectral-status");
  if (statusEl) {
    if (isAnomalous) {
      statusEl.className = "spectral-alert";
      statusEl.innerText = "Dense Bipartite Ring Detected";
    } else {
      statusEl.className = "spectral-pass";
      statusEl.innerText = "Normal";
    }
  }
}

// =============================================================================
// Sub-Engine 1: Fraud Invariant Evaluation
// =============================================================================

async function evaluateFraud() {
  const btn = document.getElementById("btn-prove-fraud");
  if (btn) btn.disabled = true;

  const payload = {
    amount: parseFloat(document.getElementById("f-amount").value || 250),
    balance_before: parseFloat(document.getElementById("f-balance").value || 1500),
    t_prev: 1000.0,
    t_now: 1000.0 + parseFloat(document.getElementById("f-dt").value || 60),
    geo_change_km: parseFloat(document.getElementById("f-distance").value || 5),
    active_devices: parseInt(document.getElementById("f-devices").value || 1),
    active_geos: parseInt(document.getElementById("f-geos") ? document.getElementById("f-geos").value : 1),
    velocity: parseFloat(document.getElementById("f-velocity").value || 2.0),
    device_age_days: parseFloat(document.getElementById("f-dev-age").value || 45),
    entropy: parseFloat(document.getElementById("f-entropy").value || 1.8)
  };

  try {
    const res = await fetch(`${API_BASE}/api/v1/fraud/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === "SUCCESS") {
      updateFraudUI(data.evaluation, data.certificate);
    }
  } catch (err) {
    console.error("Fraud evaluation error:", err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function updateFraudUI(evaluation, certificate) {
  lastFraudCert = certificate;

  const badge = document.getElementById("fraud-decision-badge");
  const score = document.getElementById("fraud-risk-score");
  if (badge) {
    badge.innerText = evaluation.decision;
    badge.className = `decision-badge badge-${evaluation.decision.toLowerCase()}`;
  }
  if (score) {
    score.innerText = evaluation.risk_score.toFixed(3);
  }

  const axiomMap = {};
  if (evaluation.axioms_evaluated) {
    evaluation.axioms_evaluated.forEach(ax => { axiomMap[ax.axiom] = ax.satisfied; });
  }

  setLedStatus("inv-a1", axiomMap["A1"] !== undefined ? axiomMap["A1"] : true);
  setLedStatus("inv-a2", axiomMap["A2"] !== undefined ? axiomMap["A2"] : true);
  setLedStatus("inv-a3", axiomMap["A3"] !== undefined ? axiomMap["A3"] : true);
  setLedStatus("inv-a4", axiomMap["A4"] !== undefined ? axiomMap["A4"] : true);
  setLedStatus("inv-a7", axiomMap["A7"] !== undefined ? axiomMap["A7"] : true);

  updatePolytopeView(evaluation.polytope, evaluation.decision);
  updateSpectralView(evaluation.spectral);

  const certIdEl = document.getElementById("f-cert-id");
  const certSigEl = document.getElementById("f-cert-sig");
  if (certIdEl && certificate) certIdEl.innerText = certificate.certificate_id;
  if (certSigEl && certificate) certSigEl.innerText = certificate.digital_signature_sha256;
}

function setLedStatus(elementId, isPassed) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const led = el.querySelector(".inv-led");
  if (led) {
    led.className = `inv-led ${isPassed ? "pass" : "fail"}`;
  }
}

function loadFraudPreset(presetKey, btnEl = null) {
  document.querySelectorAll("#fraud-tab .preset-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) {
    btnEl.classList.add("active");
  } else if (window.event && window.event.target) {
    window.event.target.classList.add("active");
  }

  const presets = {
    normal: {
      amount: 250, balance: 1500, dt: 60, dist: 5, devices: 1, geos: 1, velocity: 2.0, age: 45, entropy: 1.8
    },
    impossible_travel: {
      amount: 500, balance: 3500, dt: 60, dist: 3500, devices: 1, geos: 1, velocity: 2.0, age: 30, entropy: 1.8
    },
    clock_replay: {
      amount: 300, balance: 2000, dt: -45, dist: 0, devices: 1, geos: 1, velocity: 1.5, age: 20, entropy: 1.5
    },
    bot_burst: {
      amount: 1500, balance: 8000, dt: 120, dist: 5, devices: 5, geos: 1, velocity: 2.5, age: 30, entropy: 1.8
    },
    entropy_spike: {
      amount: 600, balance: 4000, dt: 60, dist: 5, devices: 1, geos: 1, velocity: 2.0, age: 30, entropy: 4.8
    }
  };

  const p = presets[presetKey];
  if (!p) return;

  const setField = (id, sliderId, badgeId, val, unit) => {
    const input = document.getElementById(id);
    if (input) input.value = val;
    const slider = document.getElementById(sliderId);
    if (slider) slider.value = val;
    const badge = document.getElementById(badgeId);
    if (badge) {
      const num = Number(val);
      badge.innerText = unit === '$' ? `$${num.toLocaleString()}` : `${num.toLocaleString()}${unit}`;
    }
  };

  setField("f-amount", "f-amount-slider", "f-amount-val", p.amount, "$");
  setField("f-balance", "f-balance-slider", "f-balance-val", p.balance, "$");
  setField("f-dt", "f-dt-slider", "f-dt-val", p.dt, "s");
  setField("f-distance", "f-distance-slider", "f-distance-val", p.dist, " km");
  setField("f-devices", "f-devices-slider", "f-devices-val", p.devices, "");
  setField("f-velocity", "f-velocity-slider", "f-velocity-val", p.velocity, " tx/h");
  setField("f-dev-age", "f-dev-age-slider", "f-dev-age-val", p.age, " d");

  const entSlider = document.getElementById("f-entropy");
  if (entSlider) entSlider.value = p.entropy;
  const entBadge = document.getElementById("entropy-val");
  if (entBadge) entBadge.innerText = `${p.entropy} bits`;

  evaluateFraud();
}

function exportFraudCertificateJSON() {
  if (!lastFraudCert) return;
  downloadJSON(lastFraudCert, `fraud_certificate_${lastFraudCert.certificate_id}.json`);
}

function openPrintableCertificate(certId) {
  window.open(`${API_BASE}/api/v1/certificate/print?cert_id=${certId}`, '_blank');
}

// =============================================================================
// Sub-Engine 2: Credit Solvency & Bounds
// =============================================================================

async function evaluateCredit() {
  const payload = {
    monthly_income: parseFloat(document.getElementById("c-income").value || 6500),
    monthly_debt_obligations: parseFloat(document.getElementById("c-obligations").value || 1200),
    essential_living_costs: parseFloat(document.getElementById("c-living").value || 2000),
    proposed_emi: parseFloat(document.getElementById("c-emi").value || 700),
    loan_amount: parseFloat(document.getElementById("c-loan").value || 25000),
    collateral_value: parseFloat(document.getElementById("c-collateral").value || 30000),
    reputation_penalty: parseFloat(document.getElementById("c-reputation").value || 6000),
    legal_sanction_penalty: parseFloat(document.getElementById("c-legal").value || 4000),
    assumed_lgd: 0.45
  };

  try {
    const res = await fetch(`${API_BASE}/api/v1/credit/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === "SUCCESS") {
      updateCreditUI(data.evaluation, data.certificate);
    }
  } catch (err) {
    console.error("Credit evaluation error:", err);
  }
}

function updateCreditUI(evaluation, certificate) {
  lastCreditCert = certificate;

  const badge = document.getElementById("credit-decision-badge");
  if (badge) {
    badge.innerText = evaluation.decision;
    badge.className = `decision-badge badge-${evaluation.decision === "APPROVE" ? "allow" : "block"}`;
  }

  const elNum = document.getElementById("credit-el");
  if (elNum) {
    const elVal = evaluation.expected_loss !== undefined ? evaluation.expected_loss : 250;
    elNum.innerText = `$${Number(elVal).toFixed(2)}`;
  }

  // Safe extraction of Imprecise Bounds
  const intv = evaluation.imprecise_pd_interval || {};
  const pdMin = intv.pd_min !== undefined ? intv.pd_min : (evaluation.pd_interval ? evaluation.pd_interval[0] : 0.005);
  const pdMax = intv.pd_max !== undefined ? intv.pd_max : (evaluation.pd_interval ? evaluation.pd_interval[1] : 0.042);
  const elMin = intv.el_min !== undefined ? intv.el_min : (evaluation.expected_loss_interval ? evaluation.expected_loss_interval[0] : 56);
  const elMax = intv.el_max !== undefined ? intv.el_max : (evaluation.expected_loss_interval ? evaluation.expected_loss_interval[1] : 472);

  const pdIntvEl = document.getElementById("c-pd-interval");
  if (pdIntvEl) pdIntvEl.innerText = `[${(pdMin * 100).toFixed(1)}%, ${(pdMax * 100).toFixed(1)}%]`;

  const elIntvEl = document.getElementById("c-el-interval");
  if (elIntvEl) elIntvEl.innerText = `[$${Math.round(elMin).toLocaleString()}, $${Math.round(elMax).toLocaleString()}]`;

  // Safe extraction of Solvency Metrics
  const sm = evaluation.solvency_metrics || {};
  const pdVal = sm.probability_of_default !== undefined ? sm.probability_of_default : (evaluation.probability_of_default || 0.023);
  const dtiVal = sm.debt_to_income_ratio !== undefined ? sm.debt_to_income_ratio : (evaluation.debt_to_income || 0.292);
  const slackVal = sm.discretionary_slack !== undefined ? sm.discretionary_slack : (evaluation.discretionary_slack || 2600);

  const csPd = document.getElementById("cs-pd");
  if (csPd) csPd.innerText = `${(pdVal * 100).toFixed(1)}%`;

  const csDti = document.getElementById("cs-dti");
  if (csDti) csDti.innerText = `${(dtiVal * 100).toFixed(1)}%`;

  const csSlack = document.getElementById("cs-slack");
  if (csSlack) csSlack.innerText = `${slackVal >= 0 ? '+' : ''}$${Math.round(slackVal).toLocaleString()}`;

  // Invariant LED checks
  if (evaluation.axioms_evaluated) {
    const a8 = evaluation.axioms_evaluated.find(a => a.axiom === "A8");
    if (a8) setLedStatus("inv-c-a8", a8.satisfied);

    const a9 = evaluation.axioms_evaluated.find(a => a.axiom === "A9");
    if (a9) {
      setLedStatus("inv-c-a9", a9.satisfied);
      const csGap = document.getElementById("cs-gap");
      if (csGap && a9.witness && a9.witness.underwater_gap !== undefined) {
        csGap.innerText = `$${Number(a9.witness.underwater_gap).toLocaleString()}`;
      }
    }
  }

  // Render LaTeX formulas crisp with KaTeX
  if (window.katex) {
    try {
      const mathPdEl = document.getElementById("math-pd");
      if (mathPdEl) {
        katex.render("PD_{\\max} \\le \\frac{\\sigma^2}{\\sigma^2 + \\text{Slack}_{\\min}^2}", mathPdEl, { throwOnError: false });
      }
      const mathElEl = document.getElementById("math-el");
      if (mathElEl) {
        katex.render("EL \\in [PD_{\\min} \\times LGD \\times EAD, \\; PD_{\\max} \\times LGD \\times EAD]", mathElEl, { throwOnError: false });
      }
    } catch (e) {
      console.warn("KaTeX render error:", e);
    }
  }

  const certIdEl = document.getElementById("c-cert-id");
  const certSigEl = document.getElementById("c-cert-sig");
  if (certIdEl && certificate) certIdEl.innerText = certificate.certificate_id;
  if (certSigEl && certificate) certSigEl.innerText = certificate.digital_signature_sha256;
}

function loadCreditPreset(presetKey, btnEl = null) {
  document.querySelectorAll("#credit-tab .preset-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) {
    btnEl.classList.add("active");
  } else if (window.event && window.event.target) {
    window.event.target.classList.add("active");
  }

  const presets = {
    prime: {
      income: 8500, obligations: 1100, living: 2200, emi: 650, loan: 20000, collateral: 28000, rep: 8000, leg: 5000
    },
    subprime: {
      income: 3200, obligations: 1600, living: 1400, emi: 700, loan: 18000, collateral: 8000, rep: 2000, leg: 1000
    },
    strategic_default: {
      income: 9000, obligations: 1200, living: 2500, emi: 2200, loan: 120000, collateral: 40000, rep: 5000, leg: 4000
    },
    volatile: {
      income: 4800, obligations: 1500, living: 2000, emi: 800, loan: 25000, collateral: 25000, rep: 4000, leg: 3000
    }
  };

  const p = presets[presetKey];
  if (!p) return;

  document.getElementById("c-income").value = p.income;
  document.getElementById("c-obligations").value = p.obligations;
  document.getElementById("c-living").value = p.living;
  document.getElementById("c-emi").value = p.emi;
  document.getElementById("c-loan").value = p.loan;
  document.getElementById("c-collateral").value = p.collateral;
  document.getElementById("c-reputation").value = p.rep;
  document.getElementById("c-legal").value = p.leg;

  evaluateCredit();
}

function exportCreditCertificateJSON() {
  if (!lastCreditCert) return;
  downloadJSON(lastCreditCert, `credit_certificate_${lastCreditCert.certificate_id}.json`);
}

// =============================================================================
// Sub-Engine 3: Adversarial Arena (Continuous MCTS)
// =============================================================================

async function runMCTSAttack() {
  const btn = document.getElementById("btn-run-mcts");
  const budgetSelect = document.getElementById("mcts-budget-select");
  const budget = budgetSelect ? parseInt(budgetSelect.value, 10) : 10;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `Simulating Minimax Attack...`;
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/adversary/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: budget })
    });

    const data = await res.json();
    if (data.status === "SUCCESS") {
      renderMCTSResults(data.results);
    }
  } catch (err) {
    console.error("MCTS error:", err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Run Adversarial Test`;
    }
  }
}

function renderMCTSResults(results) {
  if (!results) return;
  const elSims = document.getElementById("mcts-sims");
  if (elSims) elSims.innerText = results.simulations_run;

  const elExploits = document.getElementById("mcts-exploits-found");
  if (elExploits) {
    elExploits.innerText = results.exploits_count;
    elExploits.style.color = results.exploits_count > 0 ? "var(--color-red)" : "var(--color-green)";
  }

  const asymp = results.asymptotic_convergence || {};
  const elEps = document.getElementById("mcts-epsilon-bound");
  if (elEps) elEps.innerText = asymp.final_epsilon_regret ? Number(asymp.final_epsilon_regret).toFixed(3) : "0.000";

  const container = document.getElementById("exploits-table-container");
  if (!container) return;

  if (!results.exploits || results.exploits.length === 0) {
    container.innerHTML = `
      <p class="empty-state" style="color: var(--color-green);">
        ✓ Invariant boundaries verified. 0 exploits discovered across ${results.simulations_run} rollouts (&epsilon; &le; ${asymp.final_epsilon_regret || '0.000'}).
      </p>`;
    return;
  }

  let html = `
    <table class="exploits-table">
      <thead>
        <tr>
          <th>Target Axiom</th>
          <th>Decision</th>
          <th>Attack Vector</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  results.exploits.forEach((exp) => {
    const st = exp.state;
    const desc = `Amt: $${st.amount}, Dist: ${st.geo_change_km}km, dt: ${st.dt_seconds}s, Devs: ${st.active_devices}, Vel: ${st.velocity}tx/h`;
    html += `
      <tr>
        <td><strong style="color: var(--color-red);">${exp.violated_axiom}</strong></td>
        <td><span style="color: var(--color-amber);">${exp.defender_decision}</span></td>
        <td><code>${desc}</code></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick='applyPatch(${JSON.stringify(exp)})'>
            Patch Invariant
          </button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

async function applyPatch(exploitObj) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/adversary/patch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exploit: exploitObj })
    });

    const data = await res.json();
    if (data.status === "PATCHED") {
      updateSystemStatus();
      const thmActiveCard = document.getElementById("mcts-theorems-active");
      if (thmActiveCard) thmActiveCard.innerText = data.total_active_theorems;
    }
  } catch (err) {
    console.error("Patch error:", err);
  }
}

async function resetTheorems() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/adversary/reset`, { method: "POST" });
    const data = await res.json();
    if (data.status === "RESET") {
      updateSystemStatus();
      const thmActiveCard = document.getElementById("mcts-theorems-active");
      if (thmActiveCard) thmActiveCard.innerText = 0;
      const container = document.getElementById("exploits-table-container");
      if (container) {
        container.innerHTML = '<p class="empty-state">Patches reset to base axioms. Click "Run Adversarial Test" to re-evaluate.</p>';
      }
    }
  } catch (err) {
    console.error("Reset error:", err);
  }
}

// =============================================================================
// Sub-Engine 4: Axioms Catalog
// =============================================================================

async function loadAxiomsCatalog() {
  const container = document.getElementById("axioms-catalog-container");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/v1/axioms`);
    if (!res.ok) return;
    const data = await res.json();

    let html = "";
    (data.axioms || []).forEach(ax => {
      const axId = ax.id || ax.axiom_id || 'AX';
      const axCat = ax.category || ax.domain || 'Invariant Axiom';
      const axName = ax.name || 'Formal Constraint';
      const axDesc = ax.description || '';
      const axFormula = ax.math_formula || ax.formula_repr || '';

      html += `
        <div class="axiom-card">
          <div class="axiom-card-header">
            <span class="axiom-id">${escapeHtml(axId)}</span>
            <span class="axiom-category">${escapeHtml(axCat)}</span>
          </div>
          <div class="axiom-name">${escapeHtml(axName)}</div>
          <p class="axiom-desc">${escapeHtml(axDesc)}</p>
          <div class="axiom-formula" id="ax-formula-${escapeHtml(axId)}"></div>
        </div>
      `;
    });
    container.innerHTML = html;

    // Render KaTeX display math for every axiom
    (data.axioms || []).forEach(ax => {
      const axId = ax.id || ax.axiom_id || 'AX';
      const axFormula = ax.math_formula || ax.formula_repr || '';
      const el = document.getElementById(`ax-formula-${axId}`);
      if (el) {
        if (window.katex) {
          try {
            katex.render(axFormula, el, { throwOnError: false, displayMode: true });
          } catch (e) {
            el.innerText = axFormula;
          }
        } else {
          el.innerText = axFormula;
        }
      }
    });
  } catch (err) {
    console.error("Failed to load axioms catalog:", err);
  }
}

// Helpers
function downloadJSON(obj, filename) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
  const el = document.createElement("a");
  el.setAttribute("href", dataStr);
  el.setAttribute("download", filename);
  document.body.appendChild(el);
  el.click();
  el.remove();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

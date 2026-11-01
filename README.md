# AXIOM — Formal Risk Verification Engine

> **A zero-data mathematical risk engine where rules are theorems, decisions carry machine-checkable SMT proofs, and self-hardening is driven by an Adversarial Twin (Continuous MCTS).**

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![Z3 Solver](https://img.shields.io/badge/Z3--Solver-4.13+-red.svg)](https://github.com/Z3Prover/z3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Why AXIOM? (First Principles vs. Black-Box ML)

Traditional machine learning (Random Forests, Gradient Boosting, Deep Neural Networks) relies on historical curve-fitting. In cold-start regimes, privacy-constrained rails, or zero-day attack vectors, statistical models fail or hallucinate.

**AXIOM replaces empirical heuristics with Deductive Mathematical Invariants:**
- **Zero-Data Soundness**: Rules are encoded as formal first-order logic theorems verified via Microsoft's **Z3 SMT Solver**.
- **Proof-Carrying Decisions**: Every transaction or credit application emits a cryptographic **SHA-256 digital certificate** carrying an immutable audit trail.
- **Dynamic Energy Landscape & Manifold**: Features an interactive 3D Risk Curvature Manifold toggleable between real-time non-stationary wave dynamics and static Riemannian geometry.
- **Continuous Self-Hardening**: An autonomous **Adversarial Twin (MCTS)** probes invariant boundaries for zero-day exploits and synthesizes patch theorems in real time.

---

## 2. Foundational Mathematical Invariants

| Axiom | Name | Formal Statement | Domain |
|---|---|---|---|
| **A1** | Value Conservation | $\sum \Delta V_a = 0$ | Transaction Physics |
| **A2** | Spacetime Relativity | $\Delta t \ge d(x_1, x_2) / c_{\text{transport}}$ | Relativistic Causality |
| **A3** | Balance Non-Negativity | $V_{\text{post}} \ge 0$ | Solvency Conservation |
| **A4** | Identity Coherence | $\|\text{Active Devices}\| \le k_1 \land \|\text{Geos}\| \le k_2$ | Graph Topology |
| **A7** | Behavioral Entropy Bound | $H(X) = -\sum p_i \log_2(p_i) \le H_{\max}$ | Information Theory |
| **A8** | Solvency Slack Non-Negativity | $\text{Income} - \text{Obligations} - \text{Living} - \text{EMI} \ge 0$ | Credit Underwriting |
| **A9** | Rational Repayment Incentive | $\max(0, \text{Loan} - \text{Collateral}) \le \text{Penalty}_{\text{rep}} + \text{Penalty}_{\text{leg}}$ | Game Theory |

---

## 3. Project Architecture

```
axiom/
├── backend/
│   ├── axioms.py             # Formal definitions of Axioms A1–A10 and Z3 SMT checkers
│   ├── prover.py             # Deductive theorem prover and UNSAT proof certificate builder
│   ├── fraud_engine.py       # Polytope feasibility distance and Laplacian spectral graph
│   ├── credit_engine.py      # Walley imprecise bounds, Cantelli inequalities, Kalman state
│   ├── adversarial_twin.py   # Continuous MCTS adversary and automatic theorem synthesizer
│   ├── certificate.py        # Cryptographic certificate issuer (SHA-256 seal & printable audit)
│   ├── api.py                # FastAPI REST endpoints and static file server
│   └── run_server.py         # Application entrypoint
├── frontend/
│   ├── index.html            # Minimalist enterprise instrument panel (100% responsive)
│   ├── styles.css            # Matte-black enterprise design system
│   └── app.js                # Three.js 3D manifold, Chart.js spectrum, KaTeX math
├── tests/
│   ├── test_engine.py        # Engine unit and mathematical verification tests
│   └── test_api.py           # FastAPI integration tests
├── requirements.txt          # Python dependencies
└── vercel.json               # 1-click Vercel deployment configuration
```

---

## 4. Quick Start & Execution

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/axiom.git
cd axiom
pip install -r requirements.txt
```

### 2. Run the Engine
```bash
python backend/run_server.py
```
Open your browser at **`http://127.0.0.1:8000/`**.

### 3. Run Automated Tests
```bash
python -m pytest tests/ -v
```
All **20/20 tests** verify formal invariant soundness, Z3 SMT UNSAT proofs, and MCTS convergence.

---

## 5. Deployment

### Deploy to Vercel (1-Click)
This repository includes a pre-configured `vercel.json`:
1. Push your repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com).
3. Vercel automatically deploys the static frontend and Python serverless endpoints.

---

## 6. License
MIT License. Open for academic and enterprise financial risk research.

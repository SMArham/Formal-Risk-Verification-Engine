"""
api.py - FastAPI Service for the Axiomatic Risk Calculus Platform.

Serves REST endpoints for real-time fraud proving, credit solvency estimation,
Z3 rule consistency checking, MCTS adversarial attacks, and printable audit certificates.
"""

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from axioms import AXIOMS_CATALOG
from fraud_engine import FraudEngine
from credit_engine import CreditRiskEngine
from adversarial_twin import AdversarialTwinMCTS
from prover import RuleConsistencyChecker
from certificate import generate_risk_certificate, generate_printable_audit_certificate_html

# Initialize Sub-Engines
fraud_engine = FraudEngine()
credit_engine = CreditRiskEngine()
adversarial_twin = AdversarialTwinMCTS(defender_fn=fraud_engine.evaluate_transaction)

# Last generated certificates cache for printing
last_certificates: Dict[str, Dict[str, Any]] = {}

app = FastAPI(
    title="Axiomatic Risk Calculus API",
    description="Formal SMT Fraud Prover & Interval Solvency Credit Engine",
    version="2.5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# Pydantic Request Models
# ==============================================================================

class TransactionRequest(BaseModel):
    amount: float = Field(default=250.0, description="Transaction monetary amount")
    balance_before: float = Field(default=1500.0, description="Pre-transaction balance")
    balance_after: Optional[float] = Field(default=None, description="Post-transaction balance")
    overdraft_limit: float = Field(default=0.0, description="Approved overdraft facility")
    t_prev: float = Field(default=1000.0, description="Previous transaction timestamp (seconds)")
    t_now: float = Field(default=1060.0, description="Current transaction timestamp (seconds)")
    geo_change_km: float = Field(default=5.0, description="Distance traveled from last transaction in km")
    active_devices: int = Field(default=1, description="Number of concurrent active devices")
    active_geos: int = Field(default=1, description="Number of distinct countries/regions")
    velocity: float = Field(default=2.0, description="Transactions per hour velocity")
    device_age_days: float = Field(default=45.0, description="Age of device in days")
    entropy: float = Field(default=1.8, description="Observed behavioral entropy")
    action_distribution: Optional[List[int]] = Field(default=None, description="Action frequency distribution")


class CreditApplicantRequest(BaseModel):
    monthly_income: float = Field(default=6500.0, description="Verified monthly gross cashflow")
    monthly_debt_obligations: float = Field(default=1400.0, description="Existing recurring debt payments")
    essential_living_costs: float = Field(default=2100.0, description="Non-discretionary living expenses")
    proposed_emi: float = Field(default=750.0, description="Proposed monthly loan installment")
    loan_amount: float = Field(default=25000.0, description="Requested principal")
    collateral_value: float = Field(default=30000.0, description="Appraised asset/collateral liquidation value")
    reputation_penalty: float = Field(default=6000.0, description="Estimated economic utility cost of default stigma")
    legal_sanction_penalty: float = Field(default=4000.0, description="Statutory legal enforcement cost")
    assumed_lgd: float = Field(default=0.45, description="Basel Loss Given Default assumption")


class AdversarialRunRequest(BaseModel):
    budget: int = Field(default=10, description="Number of continuous MCTS rollouts")


class PatchApplyRequest(BaseModel):
    exploit: Dict[str, Any] = Field(..., description="Exploit witness returned by MCTS")


class RuleSetConsistencyRequest(BaseModel):
    rules: List[Dict[str, Any]] = Field(..., description="List of rule constraint definitions to verify")


# ==============================================================================
# Endpoints
# ==============================================================================

@app.get("/api/v1/axioms")
def get_axioms_catalog():
    """Returns the 10 foundational axioms with formal mathematical notation."""
    return {
        "axioms": [ax.to_dict() for ax in AXIOMS_CATALOG.values()]
    }


@app.post("/api/v1/fraud/evaluate")
def evaluate_fraud(req: TransactionRequest):
    """
    Evaluates transaction via Z3 SMT invariants, 3D Feasibility Polytope,
    and Dynamic Bipartite Graph Laplacian. Returns proof tree and certificate.
    """
    data = req.model_dump()
    if data["balance_after"] is None:
        data["balance_after"] = data["balance_before"] - data["amount"]
    if data["action_distribution"] is None:
        data["action_distribution"] = [12, 8, 3, 1]

    evaluation = fraud_engine.evaluate_transaction(data)
    certificate = generate_risk_certificate("FRAUD_DETECTION", evaluation)

    # Store for PDF/HTML print
    last_certificates["last_fraud"] = certificate
    last_certificates[certificate["certificate_id"]] = certificate

    return {
        "status": "SUCCESS",
        "evaluation": evaluation,
        "certificate": certificate
    }


@app.post("/api/v1/credit/evaluate")
def evaluate_credit(req: CreditApplicantRequest):
    """
    Evaluates credit risk using Walley Imprecise Probability intervals,
    Cantelli bounds, Kalman latent state-space, and rational default game theory.
    """
    data = req.model_dump()
    evaluation = credit_engine.evaluate_applicant(data)
    certificate = generate_risk_certificate("CREDIT_RISK", evaluation)

    last_certificates["last_credit"] = certificate
    last_certificates[certificate["certificate_id"]] = certificate

    return {
        "status": "SUCCESS",
        "evaluation": evaluation,
        "certificate": certificate
    }


@app.post("/api/v1/rules/verify-consistency")
def verify_rule_consistency(req: RuleSetConsistencyRequest):
    """
    Z3 SMT Rule Consistency Prover.
    Tests if a candidate rule base contains mutual contradictions or deadlocks.
    """
    result = RuleConsistencyChecker.verify_consistency(req.rules)
    return {
        "status": "SUCCESS",
        "result": result
    }


@app.post("/api/v1/adversary/run")
def run_adversary(req: AdversarialRunRequest):
    """
    Runs Continuous MCTS adversarial boundary search with epsilon-Nash convergence tracking.
    """
    results = adversarial_twin.run_simulation_budget(budget=req.budget)
    return {
        "status": "SUCCESS",
        "results": results
    }


@app.post("/api/v1/adversary/patch")
def apply_adversarial_patch(req: PatchApplyRequest):
    """
    Synthesizes and registers a new dynamic theorem from an MCTS exploit witness.
    """
    theorem = adversarial_twin.synthesize_theorem_patch(req.exploit)
    fraud_engine.register_dynamic_theorem(theorem)
    return {
        "status": "PATCHED",
        "theorem_applied": {
            "id": theorem["id"],
            "name": theorem["name"],
            "parent_axiom": theorem["parent_axiom"],
            "proof": theorem["proof"]
        },
        "total_active_theorems": len(fraud_engine.dynamic_theorems)
    }


@app.post("/api/v1/adversary/reset")
def reset_theorems():
    """Clears all dynamically learned theorems."""
    fraud_engine.clear_dynamic_theorems()
    return {
        "status": "RESET",
        "total_active_theorems": 0
    }


@app.get("/api/v1/certificate/print")
def print_certificate(cert_id: str = "last_fraud"):
    """
    Renders an official, printable A4 regulatory audit certificate in HTML.
    Supports browser window.print() / Save as PDF.
    """
    cert = last_certificates.get(cert_id)
    if not cert:
        # Fallback to last_credit or generate a default sample
        cert = last_certificates.get("last_credit")
    if not cert:
        # Run a quick evaluation to populate
        eval_sample = fraud_engine.evaluate_transaction({"amount": 250, "balance_before": 1500, "t_prev": 1000, "t_now": 1060, "geo_change_km": 5})
        cert = generate_risk_certificate("FRAUD_DETECTION", eval_sample)

    html_content = generate_printable_audit_certificate_html(cert)
    return Response(content=html_content, media_type="text/html")


@app.get("/api/v1/status")
def system_status():
    """Engine health, active axioms, and active theorem counts."""
    return {
        "engine": "Axiomatic Risk Calculus",
        "version": "2.5.0-FormalSMT",
        "status": "OPERATIONAL",
        "axioms_loaded": len(AXIOMS_CATALOG),
        "active_dynamic_theorems": len(fraud_engine.dynamic_theorems),
        "data_free": True,
        "smt_engine": "Z3 Theorem Prover v5.1.0",
        "graph_nodes": fraud_engine.risk_graph.graph.number_of_nodes()
    }


# Serve Frontend Web App
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

"""
test_engine.py - Full Test Suite for Formal SMT Axioms, Polytope, Bipartite Graph & Interval Solvency.
"""

import sys
import os
import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from axioms import (
    check_a1_value_conservation,
    check_a2_temporal_and_relativistic,
    check_a3_non_negative_balance,
    check_a4_identity_coherence,
    check_a7_entropy_boundedness,
    check_a8_ability_to_pay,
    check_a9_rational_default
)
from fraud_engine import FraudEngine, DynamicBipartiteRiskGraph
from credit_engine import CreditRiskEngine
from adversarial_twin import AdversarialTwinMCTS
from prover import RuleConsistencyChecker
from certificate import generate_risk_certificate, generate_printable_audit_certificate_html


# ==============================================================================
# SMT Axiom Unit Tests (UNSAT Proofs vs SAT Counterexamples)
# ==============================================================================

def test_a1_smt_value_conservation():
    # Balanced loop: sum=0 -> Z3 checks sum > tol OR sum < -tol -> UNSAT -> Sound
    res_pass = check_a1_value_conservation([150.0, -150.0])
    assert res_pass["satisfied"] is True
    assert res_pass["smt_status"] == "UNSAT_PROOF_VALID"

    # Imbalanced loop: sum != 0 -> Z3 model extracts counterexample
    res_fail = check_a1_value_conservation([150.0, -100.0])
    assert res_fail["satisfied"] is False
    assert res_fail["smt_status"] == "SAT_COUNTEREXAMPLE_FOUND"
    assert "z3_counterexample" in res_fail["witness"]


def test_a2_smt_temporal_and_relativistic():
    # Normal transaction: 60s, 2km -> ~120 km/h <= 900 -> UNSAT proof
    res_pass = check_a2_temporal_and_relativistic(t_prev=1000.0, t_now=1060.0, distance_km=2.0)
    assert res_pass["satisfied"] is True
    assert res_pass["smt_status"] == "UNSAT_PROOF_VALID"

    # Replay attack: dt <= 0 -> SAT counterexample
    res_replay = check_a2_temporal_and_relativistic(t_prev=1000.0, t_now=950.0, distance_km=0.0)
    assert res_replay["satisfied"] is False
    assert res_replay["smt_status"] == "SAT_COUNTEREXAMPLE_FOUND"

    # Supersonic travel: 60s, 3000 km -> 180,000 km/h -> SAT counterexample
    res_supersonic = check_a2_temporal_and_relativistic(t_prev=1000.0, t_now=1060.0, distance_km=3000.0)
    assert res_supersonic["satisfied"] is False
    assert res_supersonic["smt_status"] == "SAT_COUNTEREXAMPLE_FOUND"


def test_a3_smt_balance_non_negativity():
    res_pass = check_a3_non_negative_balance(1000.0, 250.0)
    assert res_pass["satisfied"] is True
    assert res_pass["smt_status"] == "UNSAT_PROOF_VALID"

    res_fail = check_a3_non_negative_balance(200.0, 800.0, overdraft_limit=0.0)
    assert res_fail["satisfied"] is False
    assert res_fail["smt_status"] == "SAT_COUNTEREXAMPLE_FOUND"


def test_a4_smt_identity_coherence():
    res_pass = check_a4_identity_coherence(1, 1)
    assert res_pass["satisfied"] is True
    assert res_pass["smt_status"] == "UNSAT_PROOF_VALID"

    res_fail = check_a4_identity_coherence(6, 4)
    assert res_fail["satisfied"] is False
    assert res_fail["smt_status"] == "SAT_COUNTEREXAMPLE_FOUND"


def test_a8_smt_solvency_slack_interval():
    # High income, positive slack interval -> UNSAT Proof
    res_pass = check_a8_ability_to_pay(6000.0, 1000.0, 2000.0, 500.0)
    assert res_pass["satisfied"] is True
    assert res_pass["smt_status"] == "UNSAT_PROOF_VALID"
    assert res_pass["witness"]["discretionary_slack"] > 0

    # Deficit cashflow -> SAT Counterexample
    res_fail = check_a8_ability_to_pay(3000.0, 1500.0, 1800.0, 500.0)
    assert res_fail["satisfied"] is False
    assert res_fail["smt_status"] == "SAT_COUNTEREXAMPLE_FOUND"


def test_a9_smt_rational_default():
    # Collateral > Principal -> Solvent equity
    res_pass = check_a9_rational_default(25000.0, 20000.0, 5000.0, 3000.0)
    assert res_pass["satisfied"] is True
    assert res_pass["smt_status"] == "UNSAT_PROOF_VALID"

    # Heavily underwater collateral: Loan 150k on 40k asset -> Underwater 110k > 8k penalty
    res_fail = check_a9_rational_default(40000.0, 150000.0, 5000.0, 3000.0)
    assert res_fail["satisfied"] is False
    assert res_fail["smt_status"] == "SAT_COUNTEREXAMPLE_FOUND"


# ==============================================================================
# Rule Consistency Checker Tests (Z3 SMT)
# ==============================================================================

def test_z3_rule_consistency_checker():
    # Consistent rules
    sound_rules = [
        {"id": "R1", "name": "Standard Min", "amount_min": 100},
        {"id": "R2", "name": "Standard Max", "amount_max": 5000}
    ]
    res_sound = RuleConsistencyChecker.verify_consistency(sound_rules)
    assert res_sound["is_consistent"] is True
    assert res_sound["status"] == "CONSISTENT_SOUND"

    # Contradictory rules: R1 requires amt >= 10000, R2 requires amt <= 5000
    contradictory_rules = [
        {"id": "R1", "name": "High Min", "amount_min": 10000},
        {"id": "R2", "name": "Low Max", "amount_max": 5000}
    ]
    res_conflict = RuleConsistencyChecker.verify_consistency(contradictory_rules)
    assert res_conflict["is_consistent"] is False
    assert res_conflict["status"] == "CONTRADICTION_DETECTED"
    assert len(res_conflict["conflicting_rules"]) >= 1


# ==============================================================================
# Dynamic Bipartite Graph & Feasibility Polytope Tests
# ==============================================================================

def test_dynamic_bipartite_graph():
    graph = DynamicBipartiteRiskGraph()
    # Initial graph should be sound
    decomp_init = graph.compute_spectral_decomposition()
    assert decomp_init["is_anomaly"] is False
    assert len(decomp_init["eigenvalues"]) > 0

    # Inject massive dense botnet clique
    for i in range(10):
        graph.add_transaction_interaction(f"user_bot_{i}", "zombie_dev_1", "vpn_ip_1", is_burst=True)

    decomp_burst = graph.compute_spectral_decomposition()
    assert decomp_burst["spectral_radius"] >= 1.5
    assert decomp_burst["total_nodes"] > 5


def test_fraud_engine_polytope():
    engine = FraudEngine()
    txn = {
        "amount": 200.0, "balance_before": 2000.0, "balance_after": 1800.0,
        "t_prev": 1000.0, "t_now": 1060.0, "geo_change_km": 2.0,
        "active_devices": 1, "active_geos": 1, "velocity": 2.0,
        "device_age_days": 45.0, "entropy": 1.5
    }
    result = engine.evaluate_transaction(txn)
    assert result["decision"] == "ALLOW"
    assert result["polytope"]["is_inside_polytope"] is True
    assert result["polytope"]["distance_to_boundary"] >= 0.0


# ==============================================================================
# Credit Risk Interval Solvency Tests (No Magic Numbers)
# ==============================================================================

def test_credit_engine_interval_probability():
    engine = CreditRiskEngine()
    applicant = {
        "monthly_income": 8000.0,
        "monthly_debt_obligations": 1000.0,
        "essential_living_costs": 2000.0,
        "proposed_emi": 600.0,
        "loan_amount": 20000.0,
        "collateral_value": 30000.0,
        "reputation_penalty": 7000.0,
        "legal_sanction_penalty": 4000.0
    }
    result = engine.evaluate_applicant(applicant)
    assert result["decision"] == "APPROVE"
    bounds = result["imprecise_bounds"]
    # Check that PD is an interval [pd_min, pd_max]
    assert len(bounds["pd_interval"]) == 2
    assert bounds["pd_interval"][0] <= bounds["pd_interval"][1]
    assert bounds["pd_interval"][1] < 0.25  # Cantelli bound
    assert result["expected_loss_interval"][0] <= result["expected_loss_interval"][1]


# ==============================================================================
# Continuous MCTS & Convergence Tests
# ==============================================================================

def test_continuous_adversarial_twin():
    engine = FraudEngine()
    twin = AdversarialTwinMCTS(defender_fn=engine.evaluate_transaction)
    results = twin.run_simulation_budget(budget=150)

    assert results["simulations_run"] == 150
    asymp = results["asymptotic_convergence"]
    assert "final_epsilon_regret" in asymp
    assert len(asymp["convergence_curve"]) >= 2


# ==============================================================================
# Certificate & Printable HTML Tests
# ==============================================================================

def test_certificate_and_printable_audit():
    engine = FraudEngine()
    txn = {
        "amount": 100.0, "balance_before": 1000.0, "t_prev": 1000.0,
        "t_now": 1060.0, "geo_change_km": 1.0, "active_devices": 1,
        "velocity": 1.0, "device_age_days": 30.0
    }
    eval_res = engine.evaluate_transaction(txn)
    cert = generate_risk_certificate("FRAUD_DETECTION", eval_res)

    assert cert["certificate_id"].startswith("CERT-")
    assert cert["smt_unsat_proven"] is True

    # Test Printable HTML generator
    html = generate_printable_audit_certificate_html(cert)
    assert "<!DOCTYPE html>" in html
    assert cert["certificate_id"] in html
    assert "Regulatory Audit Certificate" in html

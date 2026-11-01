"""
test_api.py - Direct Verification of FastAPI Endpoints & Logic.
"""

import sys
import os
import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import api


def test_api_system_status():
    status = api.system_status()
    assert status["status"] == "OPERATIONAL"
    assert status["data_free"] is True
    assert status["axioms_loaded"] == 10
    assert "Z3" in status["smt_engine"]


def test_api_axioms_catalog():
    data = api.get_axioms_catalog()
    assert "axioms" in data
    assert len(data["axioms"]) == 10


def test_api_fraud_evaluate_allow():
    req = api.TransactionRequest(
        amount=100.0,
        balance_before=1000.0,
        t_prev=1000.0,
        t_now=1060.0,
        geo_change_km=1.0,
        active_devices=1,
        active_geos=1,
        velocity=1.0,
        device_age_days=30.0,
        entropy=1.5
    )
    res = api.evaluate_fraud(req)
    assert res["status"] == "SUCCESS"
    assert res["evaluation"]["decision"] == "ALLOW"
    assert res["certificate"]["smt_unsat_proven"] is True
    assert "polytope" in res["evaluation"]


def test_api_fraud_evaluate_block():
    req = api.TransactionRequest(
        amount=500.0,
        balance_before=2000.0,
        t_prev=1000.0,
        t_now=1030.0,
        geo_change_km=4000.0,
        active_devices=1,
        active_geos=2,
        velocity=2.0,
        device_age_days=10.0,
        entropy=2.0
    )
    res = api.evaluate_fraud(req)
    assert res["status"] == "SUCCESS"
    assert res["evaluation"]["decision"] == "BLOCK"
    assert res["certificate"]["smt_unsat_proven"] is False


def test_api_credit_evaluate_interval():
    req = api.CreditApplicantRequest(
        monthly_income=7000.0,
        monthly_debt_obligations=1000.0,
        essential_living_costs=1800.0,
        proposed_emi=500.0,
        loan_amount=15000.0,
        collateral_value=25000.0,
        reputation_penalty=6000.0,
        legal_sanction_penalty=3000.0,
        assumed_lgd=0.45
    )
    res = api.evaluate_credit(req)
    assert res["status"] == "SUCCESS"
    assert res["evaluation"]["decision"] == "APPROVE"
    assert "imprecise_bounds" in res["evaluation"]
    assert len(res["evaluation"]["pd_interval"]) == 2


def test_api_rule_consistency_checker():
    req = api.RuleSetConsistencyRequest(
        rules=[
            {"id": "R1", "name": "Min Limit", "amount_min": 100},
            {"id": "R2", "name": "Max Limit", "amount_max": 5000}
        ]
    )
    res = api.verify_rule_consistency(req)
    assert res["status"] == "SUCCESS"
    assert res["result"]["is_consistent"] is True


def test_api_adversary_and_patching():
    # Run continuous MCTS
    run_req = api.AdversarialRunRequest(budget=80)
    res_run = api.run_adversary(run_req)
    assert res_run["status"] == "SUCCESS"
    assert "asymptotic_convergence" in res_run["results"]

    # Patch synthesis
    exploit_sample = {
        "violated_axiom": "A4_EphemeralDeviceBurst",
        "defender_decision": "ALLOW",
        "state": {"device_age_days": 0.2, "velocity": 25.0}
    }
    patch_req = api.PatchApplyRequest(exploit=exploit_sample)
    patch_res = api.apply_adversarial_patch(patch_req)
    assert patch_res["status"] == "PATCHED"

    # Reset
    reset_res = api.reset_theorems()
    assert reset_res["status"] == "RESET"


def test_api_printable_certificate():
    res = api.print_certificate("last_fraud")
    assert res.status_code == 200
    assert "Regulatory Audit Certificate" in res.body.decode("utf-8")

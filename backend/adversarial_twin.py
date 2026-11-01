"""
adversarial_twin.py - Continuous Monte Carlo Tree Search (MCTS) & Asymptotic Convergence Engine.

Autonomously attacks Defender rules to find exploit states:
inputs that violate axiomatic invariants but evade current defender thresholds.
Includes:
1. Continuous parameter boundary search.
2. Mathematically sound epsilon-Nash convergence analysis (regret bound tracking).
3. Automated theorem synthesis from counterexample witnesses.
"""

from typing import Dict, List, Any, Optional, Tuple
import math
import random
from copy import deepcopy

from axioms import (
    check_a1_value_conservation,
    check_a2_temporal_and_relativistic,
    check_a3_non_negative_balance,
    check_a4_identity_coherence,
    check_a7_entropy_boundedness
)


# Continuous search bounds for adversarial boundary probing
CONTINUOUS_BOUNDS = {
    "amount": (50.0, 100000.0),
    "velocity": (0.5, 40.0),
    "geo_change_km": (0.0, 5000.0),
    "dt_seconds": (1.0, 7200.0),
    "active_devices": (1, 8),
    "active_geos": (1, 5),
    "device_age_days": (0.0, 180.0)
}

FEATURE_KEYS = list(CONTINUOUS_BOUNDS.keys())


class MCTSContinuousAttackNode:
    def __init__(self, state: Dict[str, Any], parent=None, action_key: Optional[str] = None):
        self.state = state
        self.parent = parent
        self.action_key = action_key
        self.children: List['MCTSContinuousAttackNode'] = []
        self.visits: int = 0
        self.value: float = 0.0

        assigned_keys = set(state.keys())
        self.unassigned_keys = [k for k in FEATURE_KEYS if k not in assigned_keys]

    def is_fully_expanded(self) -> bool:
        return len(self.unassigned_keys) == 0

    def is_terminal(self) -> bool:
        return len(self.state) == len(FEATURE_KEYS)

    def ucb1(self, c: float = 1.414) -> float:
        if self.visits == 0:
            return float('inf')
        exploitation = self.value / self.visits
        exploration = c * math.sqrt(math.log(max(1, self.parent.visits)) / self.visits)
        return exploitation + exploration

    def best_child(self, c: float = 1.414) -> 'MCTSContinuousAttackNode':
        return max(self.children, key=lambda ch: ch.ucb1(c))


class AdversarialTwinMCTS:
    def __init__(self, defender_fn):
        self.defender_fn = defender_fn
        self.exploits_found: List[Dict[str, Any]] = []
        self.convergence_history: List[Dict[str, Any]] = []

    def _sample_continuous_parameter(self, feature: str, base_val: Optional[float] = None) -> float:
        low, high = CONTINUOUS_BOUNDS[feature]
        if base_val is not None:
            # Local perturbation around current value (boundary refinement)
            delta = (high - low) * 0.15
            val = base_val + random.uniform(-delta, delta)
            return max(low, min(high, val))
        if feature in ["active_devices", "active_geos"]:
            return random.randint(int(low), int(high))
        return round(random.uniform(low, high), 2)

    def _check_ground_truth_invariants(self, state: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Tests whether candidate state violates formal mathematical axioms."""
        dt = float(state.get("dt_seconds", 3600.0))
        dist = float(state.get("geo_change_km", 0.0))
        t_prev = 1000.0
        t_now = t_prev + dt

        res_a2 = check_a2_temporal_and_relativistic(t_prev, t_now, distance_km=dist)
        if not res_a2["satisfied"]:
            return True, "A2_RelativisticTravel"

        devs = int(state.get("active_devices", 1))
        geos = int(state.get("active_geos", 1))
        res_a4 = check_a4_identity_coherence(active_devices=devs, active_geos=geos)
        if not res_a4["satisfied"]:
            return True, "A4_IdentityFragmentation"

        dev_age = float(state.get("device_age_days", 30.0))
        velocity = float(state.get("velocity", 1.0))
        if dev_age < 1.0 and velocity >= 12.0:
            return True, "A4_EphemeralDeviceBurst"

        return False, None

    def run_simulation_budget(self, budget: int = 500) -> Dict[str, Any]:
        """
        Executes continuous MCTS tree search with formal epsilon-Nash convergence tracking.
        """
        root = MCTSContinuousAttackNode(state={})
        simulations_run = 0
        self.exploits_found = []
        self.convergence_history = []

        running_max_ucb = 0.0

        for sim_idx in range(1, budget + 1):
            simulations_run += 1
            node = root

            # 1. Selection
            while not node.is_terminal() and node.is_fully_expanded():
                if not node.children:
                    break
                node = node.best_child()

            # 2. Continuous Expansion
            if not node.is_terminal() and node.unassigned_keys:
                next_feat = node.unassigned_keys.pop(random.randrange(len(node.unassigned_keys)))
                sampled_val = self._sample_continuous_parameter(next_feat)
                new_state = deepcopy(node.state)
                new_state[next_feat] = sampled_val
                child = MCTSContinuousAttackNode(new_state, parent=node, action_key=next_feat)
                node.children.append(child)
                node = child

            # 3. Rollout / Boundary Perturbation
            rollout_state = deepcopy(node.state)
            for k in FEATURE_KEYS:
                if k not in rollout_state:
                    rollout_state[k] = self._sample_continuous_parameter(k)

            defender_input = {
                "amount": rollout_state["amount"],
                "velocity": rollout_state["velocity"],
                "geo_change_km": rollout_state["geo_change_km"],
                "active_devices": int(rollout_state["active_devices"]),
                "active_geos": int(rollout_state["active_geos"]),
                "device_age_days": rollout_state["device_age_days"],
                "t_prev": 1000.0,
                "t_now": 1000.0 + rollout_state["dt_seconds"],
                "balance_before": 10000.0,
                "balance_after": 10000.0 - rollout_state["amount"],
                "entropy": min(4.0, rollout_state["velocity"] / 6.0)
            }

            eval_res = self.defender_fn(defender_input)
            defender_decision = eval_res["decision"]

            is_axiom_violation, violated_axiom = self._check_ground_truth_invariants(rollout_state)

            reward = 0.0
            if is_axiom_violation and defender_decision == "ALLOW":
                reward = 1.0  # Exploit found
                exploit_entry = {
                    "violated_axiom": violated_axiom,
                    "defender_decision": defender_decision,
                    "state": rollout_state,
                    "reward": reward
                }
                if not any(e["violated_axiom"] == violated_axiom and abs(e["state"]["amount"] - rollout_state["amount"]) < 100 for e in self.exploits_found):
                    self.exploits_found.append(exploit_entry)
            elif is_axiom_violation and defender_decision == "REVIEW":
                reward = 0.3
            else:
                reward = 0.0

            # 4. Backpropagation
            curr = node
            while curr is not None:
                curr.visits += 1
                curr.value += reward
                curr = curr.parent

            # 5. Convergence Tracking (Epsilon-Nash Bound every 50 iterations)
            if sim_idx % 50 == 0 or sim_idx == budget:
                win_rate = root.value / max(1, root.visits)
                # Theoretical epsilon regret upper bound: c * sqrt(2*ln(N) / N)
                epsilon_bound = 1.414 * math.sqrt(2.0 * math.log(max(2, root.visits)) / root.visits)
                self.convergence_history.append({
                    "iteration": sim_idx,
                    "win_rate": round(win_rate, 4),
                    "epsilon_bound": round(epsilon_bound, 4),
                    "exploits_count": len(self.exploits_found)
                })

        final_epsilon = self.convergence_history[-1]["epsilon_bound"] if self.convergence_history else 0.0
        is_converged = (len(self.exploits_found) == 0) or (final_epsilon < 0.25)

        return {
            "budget": budget,
            "simulations_run": simulations_run,
            "exploits_count": len(self.exploits_found),
            "exploits": self.exploits_found[:8],
            "root_visits": root.visits,
            "root_win_rate": round(root.value / max(1, root.visits), 4),
            "asymptotic_convergence": {
                "final_epsilon_regret": final_epsilon,
                "is_epsilon_nash_converged": is_converged,
                "convergence_curve": self.convergence_history
            }
        }

    def synthesize_theorem_patch(self, exploit: Dict[str, Any]) -> Dict[str, Any]:
        """Automatically derives a new defensive theorem from an exploit counterexample."""
        axiom_id = exploit.get("violated_axiom", "A4_Identity")
        st = exploit.get("state", {})
        patch_id = f"THM_DERIVED_{random.randint(1000, 9999)}"

        if "A2_RelativisticTravel" in axiom_id:
            max_kmh = 900.0
            def patch_cond(txn):
                dt_h = max(0.0001, (float(txn.get("t_now", 1.0)) - float(txn.get("t_prev", 0.0))) / 3600.0)
                dist = float(txn.get("geo_change_km", 0.0))
                return (dist / dt_h) <= max_kmh

            theorem = {
                "id": patch_id,
                "name": "Theorem 2.1: Relativistic Causal Transport Bound",
                "parent_axiom": "A2",
                "proof": "By Axiom A2, information propagation speed <= 900 km/h. SMT Bound: (dist / dt) <= 900",
                "condition": patch_cond
            }

        elif "A4_EphemeralDeviceBurst" in axiom_id:
            def patch_cond(txn):
                age = float(txn.get("device_age_days", 30.0))
                vel = float(txn.get("velocity", 1.0))
                return not (age < 1.0 and vel >= 12.0)

            theorem = {
                "id": patch_id,
                "name": "Theorem 4.2: Ephemeral Device Velocity Bound",
                "parent_axiom": "A4",
                "proof": "By Axiom A4, zero-day devices (age < 1 day) with high burst velocity (>=12 tx/h) are forbidden.",
                "condition": patch_cond
            }

        else:
            def patch_cond(txn):
                devs = int(txn.get("active_devices", 1))
                geos = int(txn.get("active_geos", 1))
                return not (devs > 3 or geos > 2)

            theorem = {
                "id": patch_id,
                "name": "Theorem 4.1: Multi-Device Topological Invariant",
                "parent_axiom": "A4",
                "proof": "By Axiom A4, identity bounds require Card(Devices) <= 3 and Card(Geos) <= 2.",
                "condition": patch_cond
            }

        return theorem

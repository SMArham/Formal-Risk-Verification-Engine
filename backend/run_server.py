"""
run_server.py - Convenience launcher for the Axiomatic Risk Calculus Engine.
"""

import uvicorn
import os
import sys

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    print("=" * 70)
    print("  AXIOMATIC RISK CALCULUS ENGINE — UNIFIED FRAUD & CREDIT AI")
    print("  Zero-Data Mathematical Risk Engine with Proof-Carrying Decisions")
    print("=" * 70)
    print("  Starting server at http://127.0.0.1:8000")
    print("  Dashboard UI available at: http://127.0.0.1:8000/")
    print("  API Docs available at:     http://127.0.0.1:8000/docs")
    print("=" * 70)
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)

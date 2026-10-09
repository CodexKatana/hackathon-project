
"""
SmartPool FastAPI Gateway
Pune–Mumbai Expressway Ride-Pooling Engine

Includes:
- Backend homepage and health checks
- Corridor optimization
- Golden corridor demo
- Rejection scenario
- Benchmark
- Sliding-window batching
- Ride booking and queue
- Dispatch operations
- WebSocket updates

Authentication is not yet implemented in this backend.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid

from datetime import datetime, timezone
from threading import RLock
from typing import Any, Dict, List, Optional

from fastapi import (
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from .engine import (
        CORRIDOR_MILESTONES,
        EXPRESSWAY_NODES,
        RiderRequest as EngineRiderRequest,
        batch_sliding_window_requests,
        run_100_commuter_benchmark,
        simulate_rejection_scenario,
        solve_complete_dispatch,
        get_direct_distance,
        get_node_km,
        normalize_node,
    )
except ImportError:
    from engine import (
        CORRIDOR_MILESTONES,
        EXPRESSWAY_NODES,
        RiderRequest as EngineRiderRequest,
        batch_sliding_window_requests,
        run_100_commuter_benchmark,
        simulate_rejection_scenario,
        solve_complete_dispatch,
        get_direct_distance,
        get_node_km,
        normalize_node,
    )


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="SmartPool Ride-Pooling Engine",
    description="Pune–Mumbai Expressway Ride-Pooling Gateway",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SNAPSHOT_FILE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "snapshot.json",
)


# ============================================================
# REQUEST MODELS
# ============================================================

class RiderRequest(BaseModel):
    rider_id: str = Field(
        ...,
        description="Unique commuter identifier",
        examples=["Rahul"],
    )
    pickup: str
    dropoff: str


class BatchDispatchRequest(BaseModel):
    riders: List[RiderRequest] = Field(..., min_length=1)
    total_fare_inr: Optional[float] = None
    max_detour_pct: Optional[float] = 15.0
    speed_kmh: Optional[float] = 60.0


class SlidingWindowBatchRequest(BaseModel):
    requests: List[RiderRequest] = Field(..., min_length=1)
    window_minutes: Optional[float] = 15.0
    max_cab_capacity: Optional[int] = 3
    max_detour_pct: Optional[float] = 15.0
    speed_kmh: Optional[float] = 60.0


class BookingRequest(BaseModel):
    request_id: str = Field(
        default_factory=lambda: uuid.uuid4().hex
    )
    passenger_name: str = Field(
        min_length=1,
        max_length=70,
    )
    passenger_phone: str = ""
    origin_name: str
    destination_name: str
    seats_requested: int = Field(default=1, ge=1, le=4)
    max_detour_percent: float = Field(
        default=15.0,
        ge=0.0,
        le=15.0,
    )


# ============================================================
# HOMEPAGE
# ============================================================

@app.get("/", tags=["System"])
def backend_home():
    return {
        "status": "ONLINE",
        "project": "SmartPool",
        "message": "SmartPool backend is running successfully",
        "version": "1.0.0",
        "frontend": "http://localhost:3000",
        "api_documentation": "/docs",
        "health_check": "/api/health",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health", tags=["System"])
def get_health() -> Dict[str, str]:
    return {
        "status": "HEALTHY",
        "service": "Pune–Mumbai Expressway Ride-Pooling Gateway",
        "version": "1.0.0",
        "timestamp": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(),
        ),
    }


@app.get("/api/system/health", tags=["Frontend"])
def frontend_health() -> Dict[str, str]:
    return get_health()


# ============================================================
# CORRIDOR NODES
# ============================================================

@app.get("/api/corridor-nodes", tags=["Topology"])
def get_corridor_nodes() -> Dict[str, Any]:
    return {
        "corridor": "Pune–Mumbai Expressway",
        "milestones": CORRIDOR_MILESTONES,
        "nodes": EXPRESSWAY_NODES,
    }


# ============================================================
# CORRIDOR OPTIMIZATION
# ============================================================

@app.post("/api/optimize-corridor", tags=["Dispatch"])
def optimize_corridor(
    request: BatchDispatchRequest,
) -> Dict[str, Any]:

    try:
        engine_riders = [
            EngineRiderRequest(
                rider_id=r.rider_id,
                pickup=r.pickup,
                dropoff=r.dropoff,
            )
            for r in request.riders
        ]

        result = solve_complete_dispatch(
            riders_list=engine_riders,
            total_fare_inr=request.total_fare_inr,
            max_detour_pct=request.max_detour_pct
            if request.max_detour_pct is not None
            else 15.0,
            speed_kmh=request.speed_kmh
            if request.speed_kmh is not None
            else 60.0,
        )

        try:
            with open(
                SNAPSHOT_FILE_PATH,
                "w",
                encoding="utf-8",
            ) as file:
                json.dump(result, file, indent=2)

        except Exception as error:
            print(
                f"[Warning] Snapshot save failed: {error}"
            )

        return result

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Engine optimization failed: {error}",
        )


# ============================================================
# GOLDEN CORRIDOR DEMO
# ============================================================

@app.get("/api/demo/golden-corridor", tags=["Demonstration"])
def get_golden_corridor_demo() -> Dict[str, Any]:

    start = time.perf_counter()

    riders = [
        EngineRiderRequest(
            "Rahul", "Pune", "Lonavala"
        ),
        EngineRiderRequest(
            "Priya", "Talegaon", "Panvel"
        ),
        EngineRiderRequest(
            "Aman", "Lonavala", "Mumbai"
        ),
    ]

    result = solve_complete_dispatch(
        riders_list=riders,
        total_fare_inr=2100.0,
        max_detour_pct=15.0,
        speed_kmh=60.0,
    )

    result["latency_ms"] = round(
        (time.perf_counter() - start) * 1000,
        3,
    )

    return result


# ============================================================
# REJECTION SCENARIO
# ============================================================

@app.get("/api/demo/rejection", tags=["Demonstration"])
def get_demo_rejection() -> Dict[str, Any]:
    return simulate_rejection_scenario(
        detour_cap_pct=15.0
    )


# ============================================================
# BENCHMARK
# ============================================================

@app.get("/api/benchmark", tags=["Benchmark"])
def get_benchmark() -> Dict[str, Any]:
    return run_100_commuter_benchmark()


# ============================================================
# SLIDING-WINDOW BATCHING
# ============================================================

@app.post("/api/batch/sliding-window", tags=["Batching"])
def run_sliding_window_batch(
    payload: SlidingWindowBatchRequest,
) -> Dict[str, Any]:

    try:
        riders = [
            EngineRiderRequest(
                rider_id=r.rider_id,
                pickup=r.pickup,
                dropoff=r.dropoff,
            )
            for r in payload.requests
        ]

        return batch_sliding_window_requests(
            requests=riders,
            window_minutes=payload.window_minutes
            if payload.window_minutes is not None
            else 15.0,
            max_cab_capacity=payload.max_cab_capacity
            if payload.max_cab_capacity is not None
            else 3,
            max_detour_pct=payload.max_detour_pct
            if payload.max_detour_pct is not None
            else 15.0,
            speed_kmh=payload.speed_kmh
            if payload.speed_kmh is not None
            else 60.0,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Sliding-window batching failed: {error}",
        )


# ============================================================
# FRONTEND NODE MAPPING
# ============================================================

UI_TO_ENGINE_NODE = {
    "Pune Kiwale Entry": "Pune",
    "Talegaon Toll Plaza": "Talegaon",
    "Urse Toll Plaza": "Talegaon",
    "Lonavala Interchange": "Lonavala",
    "Khandala Ghat": "Khandala",
    "Khalapur Toll Plaza": "Khalapur",
    "Shedung Interchange": "Panvel",
    "Panvel Highway Exit": "Panvel",
    "Vashi (Navi Mumbai)": "Vashi",
    "Mumbai Dadar TT Circle": "Mumbai",
}

ENGINE_TO_UI_NODE = {
    "Pune": "Pune Kiwale Entry",
    "Talegaon": "Talegaon Toll Plaza",
    "Lonavala": "Lonavala Interchange",
    "Khandala": "Khandala Ghat",
    "Khalapur": "Khalapur Toll Plaza",
    "Panvel": "Panvel Highway Exit",
    "Vashi": "Vashi (Navi Mumbai)",
    "Mumbai": "Mumbai Dadar TT Circle",
}


# ============================================================
# IN-MEMORY RIDE QUEUE
# ============================================================

queue_lock = RLock()

booking_queue: List[Dict[str, Any]] = []

last_dispatched: Optional[Dict[str, Any]] = None

DEMO_RIDERS = [
    {
        "request_id": "demo-rahul",
        "passenger_name": "Rahul",
        "origin_name": "Pune Kiwale Entry",
        "destination_name": "Lonavala Interchange",
        "seats_requested": 1,
        "max_detour_percent": 15.0,
    },
    {
        "request_id": "demo-priya",
        "passenger_name": "Priya",
        "origin_name": "Talegaon Toll Plaza",
        "destination_name": "Panvel Highway Exit",
        "seats_requested": 1,
        "max_detour_percent": 15.0,
    },
    {
        "request_id": "demo-aman",
        "passenger_name": "Aman",
        "origin_name": "Lonavala Interchange",
        "destination_name": "Mumbai Dadar TT Circle",
        "seats_requested": 1,
        "max_detour_percent": 15.0,
    },
]


def _canonical(name: str) -> str:
    return normalize_node(
        UI_TO_ENGINE_NODE.get(name, name)
    )


def _queue_response() -> Dict[str, Any]:
    with queue_lock:
        return {
            "queue_size": len(booking_queue),
            "requests": [
                dict(r) for r in booking_queue
            ],
            "batch_id": "DEMO_WINDOW",
        }


# ============================================================
# GET RIDE QUEUE
# ============================================================

@app.get("/api/rides/queue", tags=["Frontend"])
def get_queue() -> Dict[str, Any]:
    return _queue_response()


# ============================================================
# BOOK RIDE
# ============================================================

@app.post(
    "/api/rides/book",
    status_code=201,
    tags=["Frontend"],
)
def book_ride(
    request: BookingRequest,
) -> Dict[str, Any]:

    try:
        origin = _canonical(request.origin_name)
        destination = _canonical(
            request.destination_name
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    if get_node_km(destination) <= get_node_km(origin):
        raise HTTPException(
            status_code=400,
            detail=(
                "This demo only supports Pune to Mumbai trips. "
                "Drop-off must be after pickup."
            ),
        )

    if origin == destination:
        raise HTTPException(
            status_code=400,
            detail="Pickup and destination cannot be the same.",
        )

    direct_km = get_direct_distance(
        origin,
        destination,
    )

    rider = request.model_dump()

    rider["origin_engine"] = origin
    rider["destination_engine"] = destination
    rider["direct_distance_km"] = direct_km

    with queue_lock:

        if any(
            r["request_id"] == request.request_id
            for r in booking_queue
        ):
            raise HTTPException(
                status_code=409,
                detail="This request is already queued.",
            )

        if any(
            r["passenger_name"] == request.passenger_name
            for r in booking_queue
        ):
            raise HTTPException(
                status_code=409,
                detail="Use a different passenger name.",
            )

        booking_queue.append(rider)

        position = len(booking_queue)

    return {
        "status": "QUEUED",
        "batch_id": "DEMO_WINDOW",
        "batch_position": position,
        "corridor_validation": {
            "direct_distance_km": direct_km,
            "origin": origin,
            "destination": destination,
        },
    }


# ============================================================
# DISPATCH QUEUED RIDES
# ============================================================

@app.post(
    "/api/rides/batch/dispatch-now",
    tags=["Frontend"],
)
def dispatch_queued_rides() -> Dict[str, Any]:

    global last_dispatched

    with queue_lock:

        if not booking_queue:
            raise HTTPException(
                status_code=409,
                detail="No rides in the queue.",
            )

        selected = []

        for rider in booking_queue:

            occupied = sum(
                item["seats_requested"]
                for item in selected
            )

            if (
                occupied + rider["seats_requested"]
                <= 4
            ):
                selected.append(rider)

        if not selected:
            raise HTTPException(
                status_code=409,
                detail="No valid capacity match.",
            )

        if len(selected) > 1:

            has_overlap = any(
                min(
                    get_node_km(a["destination_engine"]),
                    get_node_km(b["destination_engine"]),
                )
                >
                max(
                    get_node_km(a["origin_engine"]),
                    get_node_km(b["origin_engine"]),
                )
                for i, a in enumerate(selected)
                for b in selected[i + 1:]
            )

            if not has_overlap:
                raise HTTPException(
                    status_code=409,
                    detail="No overlapping route found.",
                )

        riders = [
            EngineRiderRequest(
                rider["passenger_name"],
                rider["origin_engine"],
                rider["destination_engine"],
            )
            for rider in selected
        ]

        try:
            cap = min(
                15.0,
                *[
                    rider["max_detour_percent"]
                    for rider in selected
                ],
            )

            result = solve_complete_dispatch(
                riders,
                max_detour_pct=cap,
            )

        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=str(error),
            )

        if not result.get("is_feasible"):
            raise HTTPException(
                status_code=409,
                detail=(
                    "This combination breaks a "
                    "passenger detour limit."
                ),
            )

        selected_ids = {
            rider["request_id"]
            for rider in selected
        }

        booking_queue[:] = [
            rider
            for rider in booking_queue
            if rider["request_id"] not in selected_ids
        ]

        last_dispatched = result

    return {
        "status": "DISPATCHED",
        "matched_requests": len(selected),
        "vkt_savings_km": result[
            "route_summary"
        ]["distance_saved_km"],
        "dispatch": result,
        "requests": selected,
        "remaining_queue": _queue_response()[
            "requests"
        ],
    }


# ============================================================
# LOAD GOLDEN DEMO INTO QUEUE
# ============================================================

@app.post(
    "/api/demo/load-golden-queue",
    tags=["Frontend"],
)
def load_golden_queue() -> Dict[str, Any]:

    global last_dispatched

    with queue_lock:

        booking_queue[:] = [
            dict(
                rider,
                origin_engine=_canonical(
                    rider["origin_name"]
                ),
                destination_engine=_canonical(
                    rider["destination_name"]
                ),
                direct_distance_km=get_direct_distance(
                    _canonical(rider["origin_name"]),
                    _canonical(rider["destination_name"]),
                ),
            )
            for rider in DEMO_RIDERS
        ]

        last_dispatched = None

    return _queue_response()


# ============================================================
# WEBSOCKET
# ============================================================

@app.websocket("/ws/corridor")
async def ws_corridor(socket: WebSocket):

    await socket.accept()

    try:
        while True:

            with queue_lock:
                count = len(booking_queue)

            await socket.send_json({
                "event": "BATCH_TICK",
                "data": {
                    "window_seconds_remaining": 0.0,
                    "queue_size": count,
                },
            })

            try:
                await asyncio.wait_for(
                    socket.receive_text(),
                    timeout=2,
                )

            except asyncio.TimeoutError:
                pass

    except (WebSocketDisconnect, RuntimeError):
        return


# ============================================================
# DIRECT EXECUTION
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )

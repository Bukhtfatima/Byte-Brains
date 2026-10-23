"""
BloodBridge Demand Estimation Service
Internal helper for the risk engine: estimates near-term demand per blood group
from demand_history using a weighted moving average.
"""

from datetime import date, timedelta
from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.entities import DemandHistory
from app.models.enums import BloodGroup


def get_historical_demand(
    db: Session,
    blood_group: BloodGroup,
    lookback_days: int = 90,
) -> List[Tuple[date, int]]:
    """Retrieve daily aggregated demand history for a blood group."""
    cutoff = date.today() - timedelta(days=lookback_days)
    rows = (
        db.query(DemandHistory.date, func.sum(DemandHistory.units_used))
        .filter(
            DemandHistory.blood_group == blood_group,
            DemandHistory.date >= cutoff,
        )
        .group_by(DemandHistory.date)
        .order_by(DemandHistory.date.asc())
        .all()
    )
    return [(r[0], int(r[1])) for r in rows]


def weighted_moving_average_estimate(
    daily_demands: List[Tuple[date, int]],
    horizon_days: int = 7,
) -> float:
    """
    Weighted moving average: recent days get more weight.
    Uses last 28 days of data with linearly increasing weights.
    """
    if not daily_demands:
        return 0.0

    if len(daily_demands) < 2:
        return daily_demands[0][1] * horizon_days

    end_date = daily_demands[-1][0]
    demand_map = {d: u for d, u in daily_demands}

    # Build contiguous series for last 28 days
    window = 28
    series = [demand_map.get(end_date - timedelta(days=i), 0) for i in range(window)]
    series.reverse()  # oldest first

    if sum(series) == 0:
        return 0.0

    # Linear weights: [1, 2, 3, ..., n]
    weights = list(range(1, len(series) + 1))
    weighted_avg_daily = sum(s * w for s, w in zip(series, weights)) / sum(weights)

    return round(weighted_avg_daily * horizon_days, 1)


def estimate_demand(db: Session, blood_group: BloodGroup, horizon_days: int = 7) -> float:
    """Estimate demand for a blood group over the next `horizon_days`."""
    history = get_historical_demand(db, blood_group, lookback_days=90)
    return weighted_moving_average_estimate(history, horizon_days)

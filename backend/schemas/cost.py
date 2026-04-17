from pydantic import BaseModel


class BudgetUpdateRequest(BaseModel):
    daily_limit_usd: float | None = None
    monthly_limit_usd: float | None = None
    alert_threshold: float | None = None


class CostSummaryResponse(BaseModel):
    daily_usd: float
    monthly_usd: float
    total_usd: float


class BudgetResponse(BaseModel):
    daily_limit_usd: float
    monthly_limit_usd: float
    alert_threshold: float


class CostByServiceRow(BaseModel):
    service: str
    total_usd: float


class CostByJobRow(BaseModel):
    job_id: str
    total_usd: float

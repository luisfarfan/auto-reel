# Code Conventions

## Python (backend/ + src/)

- **Python 3.12**, type hints on all functions
- **FastAPI routes** — `async/await`, use `AsyncSession` from `backend/database.py`
- **Celery tasks** — synchronous, use psycopg2-based session (not asyncpg)
- **SQLAlchemy 2.0** style (`select(Model)`, not legacy `session.query()`)
- **Pydantic v2** — use `model_validator`, `field_validator` (not v1 `@validator`)
- Naming: `snake_case` functions/vars · `PascalCase` classes · `UPPER_SNAKE_CASE` constants

```python
# Good
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db)) -> JobResponse:
    result = await db.execute(select(Job).where(Job.id == job_id))
    return result.scalar_one_or_none()

# Bad
def getJob(jobId, db):
    return db.query(Job).filter(Job.id == jobId).first()
```

## TypeScript (frontend/ + remotion-service/)

- **Functional React components** only — no class components
- **Custom hooks** for WebSocket, async logic, and state that spans components
- **Tailwind** via `cn()` for conditional classes
- **Zod** for runtime validation in remotion-service (`src/types.ts`)
- No `any` types — use proper generics or `unknown`

```typescript
// Good
const { steps, status } = useJobStream(jobId)
const classes = cn("base-class", { "active-class": isActive })

// Bad
const [steps, setSteps] = useState<any>([])
```

## Comments

Write comments only for non-obvious **WHY** — hidden constraints, subtle invariants, workarounds:

```python
# DRI_PRIME=1 forces AMD GPU — NVIDIA causes silent crash on Ubuntu 24.04 dual-GPU
_svc_env.setdefault("DRI_PRIME", "1")
```

Do not write:
- Comments explaining what the code does (names do that)
- TODO comments (open a GitHub issue instead)
- References to the PR, task, or caller ("added for the connect flow")

## Error Handling

- **Validate at boundaries only** (user input, external API responses)
- **Don't add try/except for impossible cases**
- **In Celery tasks** — let exceptions propagate; the framework marks job as `failed`
- **In FastAPI routes** — raise `HTTPException` for client errors, let framework handle 500s

## Do Not Add

- Backwards-compat shims for removed code
- Feature flags
- Logging for every step (only log what's non-obvious)
- Error handling for internal code that "shouldn't fail"

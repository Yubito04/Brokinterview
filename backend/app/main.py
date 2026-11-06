from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ApplyFlow AI")


class ApplicationCreate(BaseModel):
    company: str
    position: str
    status: str = "APPLIED"


@app.get("/health")
def health():
    return {"status": "ok"}


# No database yet: we simply echo back the validated data.
@app.post("/applications", status_code=201)
def create_application(application: ApplicationCreate):
    return application

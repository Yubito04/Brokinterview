from fastapi import FastAPI

from app.routers import applications, contacts

app = FastAPI(title="ApplyFlow AI")
app.include_router(applications.router)
app.include_router(contacts.router)


@app.get("/health")
def health():
    return {"status": "ok"}

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.llm import ExtractionFailed, ExtractionUnavailable
from app.routers import applications, contacts, job_postings

app = FastAPI(title="ApplyFlow AI")
app.include_router(applications.router)
app.include_router(contacts.router)
app.include_router(job_postings.router)


@app.exception_handler(ExtractionUnavailable)
def handle_extraction_unavailable(request: Request, error: ExtractionUnavailable):
    # 503: the service cannot do this right now (no API key configured).
    return JSONResponse(status_code=503, content={"detail": str(error)})


@app.exception_handler(ExtractionFailed)
def handle_extraction_failed(request: Request, error: ExtractionFailed):
    # 502: our server is fine, but the upstream service (the model) failed.
    # The reason is deliberately not sent to the client.
    return JSONResponse(
        status_code=502, content={"detail": "AI extraction failed, try again later"}
    )


@app.get("/health")
def health():
    return {"status": "ok"}

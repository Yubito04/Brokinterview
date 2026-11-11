from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.llm import ExtractionFailed, ExtractionTimedOut, ExtractionUnavailable
from app.routers import applications, contacts, job_postings

app = FastAPI(title="ApplyFlow AI")
# CORS: tells the browser which web pages may read this API's answers.
# No cookies are used, so credentials stay off.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(applications.router)
app.include_router(contacts.router)
app.include_router(job_postings.router)


@app.exception_handler(ExtractionUnavailable)
def handle_extraction_unavailable(request: Request, error: ExtractionUnavailable):
    # 503: the service cannot do this right now (no API key configured).
    return JSONResponse(status_code=503, content={"detail": str(error)})


@app.exception_handler(ExtractionTimedOut)
def handle_extraction_timed_out(request: Request, error: ExtractionTimedOut):
    # 504: we acted as a gateway to the model, and it did not answer in time.
    return JSONResponse(
        status_code=504, content={"detail": "AI extraction timed out, try again"}
    )


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

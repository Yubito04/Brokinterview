from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.llm import ExtractedJob, JobExtractor, get_job_extractor

router = APIRouter(prefix="/job-postings", tags=["job-postings"])

# Caps the size of what we send to the model, so one request cannot cost a lot.
MAX_POSTING_LENGTH = 20000


class JobPostingText(BaseModel):
    text: str = Field(max_length=MAX_POSTING_LENGTH)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text cannot be empty")
        return value


@router.post("/extract", response_model=ExtractedJob)
def extract_job_posting(
    data: JobPostingText, extractor: JobExtractor = Depends(get_job_extractor)
):
    # Nothing is saved: the client checks the result, then creates the
    # application itself with POST /applications.
    return extractor.extract(data.text, date.today())

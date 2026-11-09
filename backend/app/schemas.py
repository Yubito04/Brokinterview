from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import ApplicationStatus, ContactState


def reject_null_fields(model: BaseModel, *names: str) -> None:
    # PATCH rule, the same everywhere: leaving a field out means "do not change it",
    # sending null on a required field is an error (422), sending null on an
    # optional field clears it.
    for name in names:
        if name in model.model_fields_set and getattr(model, name) is None:
            raise ValueError(f"{name} cannot be null")


class ApplicationCreate(BaseModel):
    # max_length matches the String(200) column, so a too long value gives a 422
    # instead of a database error.
    company: str = Field(min_length=1, max_length=200)
    position: str = Field(min_length=1, max_length=200)
    status: ApplicationStatus = ApplicationStatus.APPLIED
    location: str | None = Field(default=None, min_length=1, max_length=200)
    deadline: date | None = None


class ApplicationUpdate(BaseModel):
    # PATCH: every field is optional, only the ones sent are changed.
    company: str | None = Field(default=None, min_length=1, max_length=200)
    position: str | None = Field(default=None, min_length=1, max_length=200)
    status: ApplicationStatus | None = None
    location: str | None = Field(default=None, min_length=1, max_length=200)
    deadline: date | None = None

    @model_validator(mode="after")
    def check_required_fields(self):
        # location and deadline are optional: null clears them.
        reject_null_fields(self, "company", "position", "status")
        return self


class ApplicationRead(BaseModel):
    # from_attributes lets Pydantic read a SQLAlchemy object, not only a dict.
    model_config = ConfigDict(from_attributes=True)

    id: int
    company: str
    position: str
    status: ApplicationStatus
    location: str | None
    deadline: date | None
    created_at: datetime


class ApplicationPage(BaseModel):
    # One page of results, plus what the client needs to build the navigation.
    items: list[ApplicationRead]
    total: int
    limit: int
    offset: int


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    contacted_at: datetime | None = None
    replied_at: datetime | None = None


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    contacted_at: datetime | None = None
    replied_at: datetime | None = None

    @model_validator(mode="after")
    def check_required_fields(self):
        # contacted_at and replied_at are optional: null clears them.
        reject_null_fields(self, "name")
        return self


class ContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    application_id: int
    name: str
    contacted_at: datetime | None
    replied_at: datetime | None
    state: ContactState
    created_at: datetime

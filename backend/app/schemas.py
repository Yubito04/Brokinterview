from datetime import UTC, date, datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

from app.models import ApplicationStatus, ContactState


def reject_null_fields(model: BaseModel, *names: str) -> None:
    # PATCH rule, the same everywhere: leaving a field out means "do not change it",
    # sending null on a required field is an error (422), sending null on an
    # optional field clears it.
    for name in names:
        if name in model.model_fields_set and getattr(model, name) is None:
            # A custom error with its own code (instead of a plain ValueError, which
            # Pydantic reports as the generic "value_error" with an English sentence):
            # the client reads `type` and `ctx.field` to translate the message
            # and show it next to the right field.
            raise PydanticCustomError(
                "null_not_allowed", "{field} cannot be null", {"field": name}
            )


# Stable error codes for the contact dates rule: the frontend translates them by code.
REPLY_WITHOUT_CONTACT = "reply_without_contact"
REPLY_BEFORE_CONTACT = "reply_before_contact"
REPLY_DATE_MESSAGES = {
    REPLY_WITHOUT_CONTACT: "A reply needs a contact date",
    REPLY_BEFORE_CONTACT: "The reply cannot be earlier than the contact",
}


def _as_utc(value: datetime) -> datetime:
    # A date sent without a timezone ("2026-11-01T10:00:00") is read as UTC, the
    # convention of the whole API. Comparing a naive and an aware datetime would raise
    # a TypeError, so both are made aware first.
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def reply_date_error(contacted_at: datetime | None, replied_at: datetime | None) -> str | None:
    """The code of what is wrong with the two dates, or None if they are consistent."""
    if replied_at is None:
        return None
    if contacted_at is None:
        return REPLY_WITHOUT_CONTACT
    # Strictly earlier is an error: a reply at the very same instant is accepted.
    if _as_utc(replied_at) < _as_utc(contacted_at):
        return REPLY_BEFORE_CONTACT
    return None


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

    # A field validator (not a model one) so that the error is attached to the field
    # `replied_at` ("loc": ["body", "replied_at"]) and shown under it. It runs after
    # contacted_at, which is declared first; if that one was invalid it is absent from
    # info.data and its own error is the one reported.
    @field_validator("replied_at")
    @classmethod
    def check_reply_date(cls, value: datetime | None, info: ValidationInfo):
        if "contacted_at" not in info.data:
            return value
        code = reply_date_error(info.data["contacted_at"], value)
        if code:
            raise PydanticCustomError(code, REPLY_DATE_MESSAGES[code])
        return value


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    contacted_at: datetime | None = None
    replied_at: datetime | None = None

    @model_validator(mode="after")
    def check_required_fields(self):
        # contacted_at and replied_at are optional: null clears them. Their consistency
        # needs the saved contact, so it is checked in the endpoint, not here.
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

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ApplicationStatus(str, enum.Enum):
    APPLIED = "APPLIED"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    REJECTED = "REJECTED"


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str] = mapped_column(String(200))
    position: Mapped[str] = mapped_column(String(200))
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.APPLIED
    )
    # The database fills this itself, so the date is the same whatever the client sends.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # One application has many contacts. Deleting an application deletes its contacts.
    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class ContactState(str, enum.Enum):
    NOT_CONTACTED = "NOT_CONTACTED"
    WAITING = "WAITING"
    REPLIED = "REPLIED"


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Foreign key: this column points to the id of the application it belongs to.
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    name: Mapped[str] = mapped_column(String(200))
    contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    application: Mapped[Application] = relationship(back_populates="contacts")

    @property
    def state(self) -> ContactState:
        # Derived from the dates, not stored: the two can never contradict each other.
        if self.replied_at is not None:
            return ContactState.REPLIED
        if self.contacted_at is not None:
            return ContactState.WAITING
        return ContactState.NOT_CONTACTED

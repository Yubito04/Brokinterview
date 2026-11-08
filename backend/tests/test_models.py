import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base
from datetime import datetime, timezone

from app.models import Application, ApplicationStatus, Contact, ContactState


@pytest.fixture
def session():
    # In-memory SQLite: fast, and no PostgreSQL needed to test the model.
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_application_gets_id_default_status_and_created_at(session):
    application = Application(company="Acme", position="Backend dev")
    session.add(application)
    session.commit()

    assert application.id is not None
    assert application.status == ApplicationStatus.APPLIED
    assert application.created_at is not None


def test_application_requires_company(session):
    session.add(Application(position="Backend dev"))

    with pytest.raises(IntegrityError):
        session.commit()


def test_contact_state_is_not_contacted_without_dates():
    assert Contact(name="Sam").state == ContactState.NOT_CONTACTED


def test_contact_state_is_waiting_when_contacted_but_no_reply():
    contact = Contact(name="Sam", contacted_at=datetime.now(timezone.utc))

    assert contact.state == ContactState.WAITING


def test_contact_state_is_replied_when_reply_date_is_set():
    now = datetime.now(timezone.utc)
    contact = Contact(name="Sam", contacted_at=now, replied_at=now)

    assert contact.state == ContactState.REPLIED


def test_application_can_have_several_contacts(session):
    application = Application(company="Acme", position="Backend dev")
    application.contacts = [Contact(name="Sam (HR)"), Contact(name="Lee (manager)")]
    session.add(application)
    session.commit()

    assert len(application.contacts) == 2
    assert application.contacts[0].application_id == application.id
    assert application.contacts[0].application is application


def test_deleting_an_application_deletes_its_contacts(session):
    application = Application(company="Acme", position="Backend dev")
    application.contacts = [Contact(name="Sam")]
    session.add(application)
    session.commit()

    session.delete(application)
    session.commit()

    assert session.query(Contact).count() == 0

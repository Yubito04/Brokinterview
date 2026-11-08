from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Contact
from app.routers.applications import get_application_or_404
from app.schemas import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(tags=["contacts"])


def get_contact_or_404(contact_id: int, session: Session) -> Contact:
    contact = session.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


# A contact only exists inside an application, so it is created under its URL.
@router.post(
    "/applications/{application_id}/contacts",
    status_code=201,
    response_model=ContactRead,
)
def create_contact(
    application_id: int,
    data: ContactCreate,
    session: Session = Depends(get_session),
):
    get_application_or_404(application_id, session)
    contact = Contact(application_id=application_id, **data.model_dump())
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact


@router.get(
    "/applications/{application_id}/contacts", response_model=list[ContactRead]
)
def list_contacts(application_id: int, session: Session = Depends(get_session)):
    get_application_or_404(application_id, session)
    return session.scalars(
        select(Contact)
        .where(Contact.application_id == application_id)
        .order_by(Contact.id)
    ).all()


@router.patch("/contacts/{contact_id}", response_model=ContactRead)
def update_contact(
    contact_id: int, data: ContactUpdate, session: Session = Depends(get_session)
):
    contact = get_contact_or_404(contact_id, session)
    # Null on a date clears it; null on the name was already rejected (422).
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    session.commit()
    session.refresh(contact)
    return contact


@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: int, session: Session = Depends(get_session)):
    contact = get_contact_or_404(contact_id, session)
    session.delete(contact)
    session.commit()
    return Response(status_code=204)

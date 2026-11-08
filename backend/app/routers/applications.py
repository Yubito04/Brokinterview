from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Application
from app.schemas import ApplicationCreate, ApplicationRead, ApplicationUpdate

router = APIRouter(prefix="/applications", tags=["applications"])


def get_application_or_404(application_id: int, session: Session) -> Application:
    application = session.get(Application, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.post("", status_code=201, response_model=ApplicationRead)
def create_application(
    data: ApplicationCreate, session: Session = Depends(get_session)
):
    application = Application(**data.model_dump())
    session.add(application)
    session.commit()
    # Reload the row so the database-generated id and created_at are filled in.
    session.refresh(application)
    return application


@router.get("", response_model=list[ApplicationRead])
def list_applications(session: Session = Depends(get_session)):
    return session.scalars(select(Application).order_by(Application.id)).all()


@router.get("/{application_id}", response_model=ApplicationRead)
def read_application(application_id: int, session: Session = Depends(get_session)):
    return get_application_or_404(application_id, session)


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int,
    data: ApplicationUpdate,
    session: Session = Depends(get_session),
):
    application = get_application_or_404(application_id, session)
    # exclude_unset: only the fields the client really sent.
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(application, field, value)
    session.commit()
    session.refresh(application)
    return application


@router.delete("/{application_id}", status_code=204)
def delete_application(application_id: int, session: Session = Depends(get_session)):
    application = get_application_or_404(application_id, session)
    session.delete(application)
    session.commit()
    return Response(status_code=204)

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import Application, ApplicationStatus
from app.schemas import (
    ApplicationCreate,
    ApplicationPage,
    ApplicationRead,
    ApplicationUpdate,
)

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


def escape_like(text: str) -> str:
    # In a LIKE pattern, % and _ are wildcards and the backslash is our escape
    # character. Escape all three so the user's text is matched literally.
    # This is separate from SQL injection, which the bound parameters already prevent.
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=ApplicationPage)
def list_applications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: ApplicationStatus | None = None,
    q: str | None = Query(None, max_length=200),
    session: Session = Depends(get_session),
):
    query = select(Application)
    if status is not None:
        query = query.where(Application.status == status)
    if q is not None and q.strip():
        pattern = f"%{escape_like(q.strip())}%"
        query = query.where(
            or_(
                Application.company.ilike(pattern, escape="\\"),
                Application.position.ilike(pattern, escape="\\"),
            )
        )

    # Same filters, no limit/offset: the total is the number of matching rows,
    # not the number of rows on this page.
    total = session.scalar(select(func.count()).select_from(query.subquery()))

    # Newest first; id breaks ties, so the order is fully deterministic and
    # two pages can never overlap or skip a row.
    items = session.scalars(
        query.order_by(Application.created_at.desc(), Application.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


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

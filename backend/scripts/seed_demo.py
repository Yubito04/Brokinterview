"""Fill the DEVELOPMENT database with fictional demo data (30 applications, some contacts).

Run from the backend folder:

    python -m scripts.seed_demo            # adds the data; refuses if there are already rows
    python -m scripts.seed_demo --reset    # first DELETES every application and contact

Safety:
- it refuses to run on a database whose name ends with _test (the test suite owns those);
- it never deletes anything unless --reset is given.

All companies, people and places are invented.
"""

import argparse
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import create_db_engine
from app.models import Application, ApplicationStatus, Contact

APPLIED = ApplicationStatus.APPLIED
INTERVIEW = ApplicationStatus.INTERVIEW
OFFER = ApplicationStatus.OFFER
REJECTED = ApplicationStatus.REJECTED


@dataclass(frozen=True)
class ContactSpec:
    name: str
    # None = not done. Days before "now", so the data always looks recent.
    contacted_days_ago: int | None = None
    replied_days_ago: int | None = None


@dataclass(frozen=True)
class ApplicationSpec:
    company: str
    position: str
    status: ApplicationStatus
    location: str | None
    # Days from today: negative = already passed, None = no deadline.
    deadline_in_days: int | None
    created_days_ago: int
    contacts: list[ContactSpec] = field(default_factory=list)


DEMO_APPLICATIONS: list[ApplicationSpec] = [
    ApplicationSpec("Boréalis Logiciels", "Développeur web junior", APPLIED, "Montréal", 12, 1),
    ApplicationSpec("Nordik Data", "Analyste de données", APPLIED, "Québec", 20, 2),
    ApplicationSpec("Lumen Cloud", "Développeur back-end Python", APPLIED, "Remote", 9, 3),
    ApplicationSpec("Atelier Pixel", "Développeur front-end React", APPLIED, "Sherbrooke", None, 4),
    ApplicationSpec("Fjord Systèmes", "Programmeur analyste", APPLIED, "Laval", 30, 6),
    ApplicationSpec("Cobalt Santé", "Développeur full stack", APPLIED, "Montréal", 5, 7),
    ApplicationSpec("Maple Robotics", "Stagiaire en développement logiciel", APPLIED, "Ottawa", 15, 9),
    ApplicationSpec("Vireo Assurances", "Développeur Java", APPLIED, None, None, 10),
    ApplicationSpec("Quartz Média", "Intégrateur web", APPLIED, "Gatineau", -2, 12),
    ApplicationSpec("Sablier Technologies", "Ingénieur DevOps junior", APPLIED, "Montréal", 25, 14),
    ApplicationSpec("Hélios Énergie", "Développeur d'applications", APPLIED, "Trois-Rivières", 40, 16),
    ApplicationSpec("Ardoise Éducation", "Développeur web", APPLIED, "Remote", None, 18),
    ApplicationSpec(
        "Polaris Paiements", "Développeur back-end", INTERVIEW, "Montréal", None, 20,
        [
            ContactSpec("Camille Roy", contacted_days_ago=15, replied_days_ago=12),
            ContactSpec("Mathieu Lavoie", contacted_days_ago=9),
        ],
    ),
    ApplicationSpec(
        "Zéphyr Analytique", "Analyste BI", INTERVIEW, "Québec", None, 22,
        [ContactSpec("Sophie Gagnon", contacted_days_ago=18, replied_days_ago=16)],
    ),
    ApplicationSpec("Orchidée Numérique", "Développeur C#", INTERVIEW, "Laval", 7, 25),
    ApplicationSpec(
        "Brume Cybersécurité", "Analyste sécurité junior", INTERVIEW, "Remote", None, 27,
        [ContactSpec("Étienne Bouchard", contacted_days_ago=20, replied_days_ago=19)],
    ),
    ApplicationSpec("Tamarack Logistique", "Développeur full stack", INTERVIEW, "Longueuil", 3, 30),
    ApplicationSpec("Lys Interactif", "Développeur de jeux", INTERVIEW, "Montréal", None, 33),
    ApplicationSpec(
        "Vigie Technologies", "Développeur Python", INTERVIEW, "Sherbrooke", None, 36,
        [ContactSpec("Isabelle Tremblay", contacted_days_ago=30, replied_days_ago=28)],
    ),
    ApplicationSpec("Ciel Ouvert Média", "Développeur web", INTERVIEW, "Ottawa", None, 40),
    ApplicationSpec(
        "Rivière Bleue Logiciels", "Développeur full stack", OFFER, "Québec", 4, 45,
        [
            ContactSpec("Nathalie Pelletier", contacted_days_ago=40, replied_days_ago=38),
            ContactSpec("Olivier Fortin", contacted_days_ago=35, replied_days_ago=34),
        ],
    ),
    ApplicationSpec("Saphir Fintech", "Développeur back-end Python", OFFER, "Montréal", 10, 52),
    ApplicationSpec(
        "Cèdre Informatique", "Programmeur analyste", OFFER, None, None, 58,
        [ContactSpec("Julien Morin", contacted_days_ago=50, replied_days_ago=47)],
    ),
    ApplicationSpec("Gabarit Studio", "Développeur front-end", REJECTED, "Montréal", -20, 60),
    ApplicationSpec(
        "Épinette Réseaux", "Technicien en informatique", REJECTED, "Saguenay", None, 63,
        [ContactSpec("Valérie Côté", contacted_days_ago=55)],
    ),
    ApplicationSpec("Mosaïque Commerce", "Développeur e-commerce", REJECTED, "Remote", -12, 66),
    ApplicationSpec("Aurore Biotech", "Analyste de données", REJECTED, "Laval", None, 70),
    ApplicationSpec("Granit Ingénierie", "Développeur C++", REJECTED, "Québec", -30, 75),
    ApplicationSpec("Pivot Conseil", "Consultant TI junior", REJECTED, None, None, 80),
    ApplicationSpec(
        "Éclat Voyages", "Développeur web", REJECTED, "Montréal", None, 85,
        [ContactSpec("Pascal Bergeron")],
    ),
]


def ensure_safe_database(database_url: str) -> None:
    """Raise RuntimeError if the URL points to a database owned by the test suite."""
    name = make_url(database_url).database
    if not name:
        raise RuntimeError("DATABASE_URL has no database name")
    if name.endswith("_test"):
        raise RuntimeError(
            f"Refusing to seed '{name}': names ending with _test belong to the test suite"
        )


def _moment(now: datetime, days_ago: int | None) -> datetime | None:
    return None if days_ago is None else now - timedelta(days=days_ago)


def insert_demo_data(session: Session, now: datetime | None = None) -> None:
    """Add the demo rows to the session's transaction (the caller commits)."""
    now = now or datetime.now(timezone.utc)
    today: date = now.date()
    for spec in DEMO_APPLICATIONS:
        session.add(
            Application(
                company=spec.company,
                position=spec.position,
                status=spec.status,
                location=spec.location,
                deadline=(
                    None
                    if spec.deadline_in_days is None
                    else today + timedelta(days=spec.deadline_in_days)
                ),
                # Set explicitly (the column normally fills itself with "now") so the
                # list shows applications spread over about three months.
                created_at=now - timedelta(days=spec.created_days_ago),
                contacts=[
                    Contact(
                        name=contact.name,
                        contacted_at=_moment(now, contact.contacted_days_ago),
                        replied_at=_moment(now, contact.replied_days_ago),
                    )
                    for contact in spec.contacts
                ],
            )
        )


def count_rows(session: Session) -> tuple[int, int]:
    applications = session.scalar(select(func.count()).select_from(Application)) or 0
    contacts = session.scalar(select(func.count()).select_from(Contact)) or 0
    return applications, contacts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fill the development database with demo data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="DELETE every application and contact first (without it, nothing is deleted)",
    )
    args = parser.parse_args(argv)

    database_url = get_settings().database_url
    try:
        ensure_safe_database(database_url)
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    database = make_url(database_url).database
    engine = create_db_engine()
    with Session(engine) as session:
        applications, contacts = count_rows(session)
        if args.reset:
            # TRUNCATE empties both tables at once; RESTART IDENTITY makes ids start at 1.
            session.execute(text("TRUNCATE TABLE contacts, applications RESTART IDENTITY"))
            print(f"Deleted {applications} applications and {contacts} contacts from '{database}'.")
        elif applications or contacts:
            print(
                f"Error: '{database}' already holds {applications} applications and "
                f"{contacts} contacts. Nothing was changed. "
                "Use --reset to delete them first.",
                file=sys.stderr,
            )
            return 1
        insert_demo_data(session)
        session.commit()
        applications, contacts = count_rows(session)
    print(f"Seeded '{database}': {applications} applications, {contacts} contacts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

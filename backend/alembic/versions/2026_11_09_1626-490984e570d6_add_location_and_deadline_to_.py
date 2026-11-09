"""add location and deadline to applications

Revision ID: 490984e570d6
Revises: 8c20e896b813
Create Date: 2026-11-09 16:26:17.802411

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '490984e570d6'
down_revision: Union[str, Sequence[str], None] = '8c20e896b813'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # The table may already hold rows. A NOT NULL column without a default would
    # make PostgreSQL refuse the change, because it cannot invent a value for
    # existing rows. So both columns are nullable: old rows simply get NULL.
    # Adding a nullable column without a default is instant in PostgreSQL: it only
    # changes the table definition, it does not rewrite the rows.
    op.add_column('applications', sa.Column('location', sa.String(length=200), nullable=True))
    op.add_column('applications', sa.Column('deadline', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Destructive: every location and deadline stored since the upgrade is lost.
    # Unlike the first migration, this one can delete real user data.
    op.drop_column('applications', 'deadline')
    op.drop_column('applications', 'location')

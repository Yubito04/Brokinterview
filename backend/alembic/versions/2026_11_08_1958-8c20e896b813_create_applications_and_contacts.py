"""create applications and contacts

Revision ID: 8c20e896b813
Revises: 
Create Date: 2026-11-08 19:58:45.322076

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c20e896b813'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('applications',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('company', sa.String(length=200), nullable=False),
    sa.Column('position', sa.String(length=200), nullable=False),
    sa.Column('status', sa.Enum('APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', name='applicationstatus'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('contacts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('application_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('contacted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # contacts first: its foreign key points to applications.
    op.drop_table('contacts')
    op.drop_table('applications')
    # PostgreSQL creates the enum type together with the table in upgrade(), but
    # drop_table does not remove it. Without this line, upgrade -> downgrade -> upgrade
    # would fail with "type applicationstatus already exists".
    op.execute("DROP TYPE applicationstatus")

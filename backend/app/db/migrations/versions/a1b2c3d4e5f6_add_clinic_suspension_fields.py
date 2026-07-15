"""Add clinic suspension and archival fields

Revision ID: a1b2c3d4e5f6
Revises: bc1940b8d579
Create Date: 2026-07-15 14:20:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'bc1940b8d579'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add suspension and archival fields to clinics table
    op.add_column('clinics', sa.Column('is_suspended', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('clinics', sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clinics', sa.Column('suspended_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('clinics', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('clinics', sa.Column('archived_by', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('clinics', sa.Column('is_demo_clinic', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add foreign key constraints for suspended_by and archived_by
    op.create_foreign_key('fk_clinics_suspended_by', 'clinics', 'users', ['suspended_by'], ['id'])
    op.create_foreign_key('fk_clinics_archived_by', 'clinics', 'users', ['archived_by'], ['id'])


def downgrade() -> None:
    # Remove foreign key constraints
    op.drop_constraint('fk_clinics_archived_by', 'clinics', type_='foreignkey')
    op.drop_constraint('fk_clinics_suspended_by', 'clinics', type_='foreignkey')
    
    # Remove columns
    op.drop_column('clinics', 'is_demo_clinic')
    op.drop_column('clinics', 'archived_by')
    op.drop_column('clinics', 'archived_at')
    op.drop_column('clinics', 'suspended_by')
    op.drop_column('clinics', 'suspended_at')
    op.drop_column('clinics', 'is_suspended')

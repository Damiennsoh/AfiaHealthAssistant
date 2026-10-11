"""Add fields required for lossless clinic-scoped offline sync.

Revision ID: c7d8e9f0a1b2
Revises: a1b2c3d4e5f6
Create Date: 2026-10-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c7d8e9f0a1b2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("age_years", sa.Integer(), nullable=True))
    op.add_column("patients", sa.Column("region", sa.String(length=120), nullable=True))
    op.add_column("patients", sa.Column("community", sa.String(length=160), nullable=True))
    op.add_column("patients", sa.Column("locality", sa.String(length=255), nullable=True))
    op.add_column("encounters", sa.Column("offline_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column("encounters", "offline_payload")
    op.drop_column("patients", "locality")
    op.drop_column("patients", "community")
    op.drop_column("patients", "region")
    op.drop_column("patients", "age_years")
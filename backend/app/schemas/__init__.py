"""AFIA Health Assistant — Pydantic Schemas"""
from app.schemas.user import UserCreate, UserUpdate, UserResponse, LoginRequest, TokenResponse, PasswordChange
from app.schemas.clinic import ClinicCreate, ClinicUpdate, ClinicResponse, SubscriptionUpdate
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientSearchResult
from app.schemas.encounter import EncounterCreate, EncounterUpdate, EncounterResponse, SOAPSummary
from app.schemas.knowledge import KnowledgeQuery, KnowledgeQueryResponse, KnowledgeResult, OfflineKnowledgeBase
from app.schemas.sync import SyncPushRequest, SyncPullResponse, SyncAckRequest, SyncConflict

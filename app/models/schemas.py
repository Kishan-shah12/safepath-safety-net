from pydantic import BaseModel, Field

class LocationUpdateRequest(BaseModel):
    """Schema for location updates."""
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of the user")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of the user")
    timestamp: int = Field(..., gt=0, description="Unix timestamp of the location fix")

class PanicPayload(BaseModel):
    """Schema for panic escalation events."""
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for panic")
    context_data: dict | None = Field(default=None, description="Optional metadata about the panic event")

class ChatRequest(BaseModel):
    """Schema for AI chat requests."""
    message: str = Field(..., min_length=1, max_length=1000, description="Message from the user")
    language: str = Field(default="english", pattern="^(english|hindi|hinglish)$", description="Language preference")

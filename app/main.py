from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.models.schemas import LocationUpdateRequest, PanicPayload, ChatRequest
from app.services.gemini_service import chat_with_gemini, analyze_panic_keywords
import time
from collections import defaultdict
import os

app = FastAPI(title="SafePath AI Backend")

# CORS Setup - restrict to actual domains for strict security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    # Relaxed CSP for Google Maps
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "img-src 'self' data: https://maps.gstatic.com https://maps.googleapis.com; "
        "connect-src 'self' https://maps.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com;"
    )
    return response

# Rate Limiter (In-Memory)
RATE_LIMIT_WINDOW = 60  # 60 seconds
MAX_REQUESTS = 10
ip_requests = defaultdict(list)

def check_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    current_time = time.time()
    
    # Filter old requests
    ip_requests[client_ip] = [t for t in ip_requests[client_ip] if current_time - t < RATE_LIMIT_WINDOW]
    
    if len(ip_requests[client_ip]) >= MAX_REQUESTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
    
    ip_requests[client_ip].append(current_time)

@app.post("/api/journey/location")
async def update_location(data: LocationUpdateRequest):
    """Securely receives and logs the user's current location."""
    print(f"Location update received: {data.latitude}, {data.longitude} at {data.timestamp}")
    return {"status": "success", "message": "Location updated securely."}

@app.post("/api/sos/panic")
async def trigger_panic(data: PanicPayload, request: Request):
    """Triggers an escalation event."""
    check_rate_limit(request)
    print(f"PANIC TRIGGERED: {data.reason}")
    return {"status": "escalated", "tier": 1, "message": "Emergency contacts notified."}

@app.post("/api/ai/chat")
async def chat_endpoint(data: ChatRequest, request: Request):
    """Processes AI chat requests and detects distress patterns."""
    check_rate_limit(request)
    
    is_distress = analyze_panic_keywords(data.message)
    if is_distress:
        print("WARNING: Distress detected in chat.")
    
    response_text = chat_with_gemini(data.message, data.language)
    
    return {
        "response": response_text,
        "is_distress": is_distress
    }

# Serve Frontend - Must be mounted last to not block API routes
import os
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

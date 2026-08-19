import os
import re
# pyrefly: ignore [missing-import]
import google.generativeai as genai

# Setup API Key (fallback for local development)
api_key = os.environ.get("GEMINI_API_KEY", "mock_key")
if api_key != "mock_key":
    genai.configure(api_key=api_key)

# Initialize model
model = genai.GenerativeModel('gemini-1.5-flash')

HINGLISH_DISTRESS_KEYWORDS = [
    "bachao", "help", "dar lag", "peecha kar",
    "emergency", "police", "safe nahi", "akela", "khatra"
]

def analyze_panic_keywords(message: str) -> bool:
    """
    Analyzes the message for Hinglish and English distress keywords.
    
    Args:
        message (str): The user's input message.
        
    Returns:
        bool: True if distress keywords are detected, False otherwise.
    """
    message_lower = message.lower()
    for keyword in HINGLISH_DISTRESS_KEYWORDS:
        if keyword in message_lower:
            return True
    return False

def chat_with_gemini(message: str, language: str = "english") -> str:
    """
    Sends a message to the Gemini API, forcing the specified language response.
    
    Args:
        message (str): The prompt from the user.
        language (str): Target language for response ('english', 'hindi', 'hinglish').
        
    Returns:
        str: The AI's response text.
    """
    system_instruction = f"You are a helpful safety assistant. You must respond in {language.capitalize()}."
    prompt = f"{system_instruction}\n\nUser: {message}"
    
    try:
        if os.environ.get("GEMINI_API_KEY"):
            response = model.generate_content(prompt)
            return response.text
        else:
            # Mock mode when no API key is provided
            return f"[MOCK] Simulated {language.capitalize()} response for: {message[:20]}..."
    except Exception as e:
        return f"Error communicating with AI: {str(e)}"

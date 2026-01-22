import os
import json
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from google.oauth2 import service_account
import google.auth.transport.requests
import google.generativeai as genai
import anthropic
from dotenv import load_dotenv

# Load from project root if it exists, otherwise environment
load_dotenv(dotenv_path="../.env.local")

app = FastAPI(title="GPT Psych Profiler Backend")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "veopromptmachine")
BUCKET_NAME = os.getenv("GCP_BUCKET", "veo-prompt-machine")
CREDENTIALS_PATH = "/Users/ryanthomson/Github/VEO-Prompt-Machine-V3/veopromptmachine-2a215201031c.json"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

def get_credentials():
    if not os.path.exists(CREDENTIALS_PATH):
        raise HTTPException(status_code=500, detail=f"Credentials file not found at {CREDENTIALS_PATH}")
    return service_account.Credentials.from_service_account_info(
        CREDENTIALS_PATH,
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )

@app.get("/auth/token")
async def get_token():
    try:
        creds = get_credentials()
        request = google.auth.transport.requests.Request()
        creds.refresh(request)
        return {"access_token": creds.token}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/config")
async def get_config():
    return {"project_id": PROJECT_ID, "bucket_name": BUCKET_NAME}

@app.post("/analyze")
async def analyze_pathology(request: Request):
    body = await request.json()
    model_type = body.get('model_type', 'gemini')
    system_prompt = body.get('system_prompt')
    chat_log = body.get('chat_log')

    try:
        if model_type == 'gemini':
            if not GEMINI_API_KEY: raise HTTPException(status_code=500, detail="Gemini key missing")
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-3-flash-preview')
            
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]

            response = model.generate_content(
                contents=f"AUDIT TARGET LOG:\n{chat_log}",
                generation_config={"response_mime_type": "application/json"},
                safety_settings=safety_settings,
                system_instruction=system_prompt
            )
            
            if not response.text:
                if response.prompt_feedback:
                    raise HTTPException(status_code=500, detail=f"Gemini blocked response: {response.prompt_feedback}")
                raise HTTPException(status_code=500, detail="Gemini returned empty response")
                
            return {"text": response.text}
        else:
            if not ANTHROPIC_API_KEY: raise HTTPException(status_code=500, detail="Claude key missing")
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": f"AUDIT TARGET LOG:\n{chat_log}"}]
            )
            return {"text": response.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/narrative")
async def generate_narrative(request: Request):
    body = await request.json()
    model_type = body.get('model_type', 'gemini')
    prompt = body.get('prompt')

    try:
        if model_type == 'gemini':
            if not GEMINI_API_KEY: raise HTTPException(status_code=500, detail="Gemini key missing")
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-3-flash-preview')
            response = model.generate_content(prompt)
            return {"text": response.text}
        else:
            if not ANTHROPIC_API_KEY: raise HTTPException(status_code=500, detail="Claude key missing")
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}]
            )
            return {"text": response.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
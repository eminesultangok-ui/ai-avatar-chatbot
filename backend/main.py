import base64
import html
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
import azure.cognitiveservices.speech as speechsdk


load_dotenv()

gemini_api_key = os.getenv("GEMINI_API_KEY")
azure_speech_key = os.getenv("AZURE_SPEECH_KEY")
azure_speech_region = os.getenv(
    "AZURE_SPEECH_REGION",
    "australiaeast",
)

if not gemini_api_key:
    raise RuntimeError("GEMINI_API_KEY is missing")

if not azure_speech_key:
    raise RuntimeError("AZURE_SPEECH_KEY is missing")


gemini_client = genai.Client(
    api_key=gemini_api_key,
    http_options=types.HttpOptions(timeout=30000),
)

app = FastAPI(title="Ava AI Backend")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    language: str = "English"


LANGUAGE_INSTRUCTIONS = {
    "Turkish": "Answer naturally and professionally in Turkish.",
    "English": "Answer naturally and professionally in English.",
    "Italian": "Answer naturally and professionally in Italian.",
    "Spanish": "Answer naturally and professionally in Spanish.",
    "Hindi": "Answer naturally and professionally in Hindi.",
}


VOICE_SETTINGS = {
    "Turkish": {
        "voice": "tr-TR-EmelNeural",
        "locale": "tr-TR",
    },
    "English": {
        "voice": "en-US-JennyNeural",
        "locale": "en-US",
    },
    "Italian": {
        "voice": "it-IT-ElsaNeural",
        "locale": "it-IT",
    },
    "Spanish": {
        "voice": "es-ES-ElviraNeural",
        "locale": "es-ES",
    },
    "Hindi": {
        "voice": "hi-IN-SwaraNeural",
        "locale": "hi-IN",
    },
}


def create_speech_audio(
    text: str,
    language: str,
) -> str:
    voice_settings = VOICE_SETTINGS.get(
        language,
        VOICE_SETTINGS["English"],
    )

    speech_config = speechsdk.SpeechConfig(
        subscription=azure_speech_key,
        region=azure_speech_region,
    )

    speech_config.speech_synthesis_voice_name = (
        voice_settings["voice"]
    )

    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
    )

    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config,
        audio_config=None,
    )

    safe_text = html.escape(text)

    ssml = f"""
    <speak
      version="1.0"
      xmlns="http://www.w3.org/2001/10/synthesis"
      xml:lang="{voice_settings['locale']}"
    >
      <voice name="{voice_settings['voice']}">
        <prosody rate="-3%" pitch="+2%">
          {safe_text}
        </prosody>
      </voice>
    </speak>
    """

    result = synthesizer.speak_ssml_async(ssml).get()

    if (
        result.reason
        != speechsdk.ResultReason.SynthesizingAudioCompleted
    ):
        print("Azure speech error:", result.reason)
        return ""

    return base64.b64encode(
        result.audio_data
    ).decode("utf-8")


@app.get("/")
def home():
    return {
        "message": "Ava AI Backend is running"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
def chat(request: ChatRequest):
    language_instruction = LANGUAGE_INSTRUCTIONS.get(
        request.language,
        LANGUAGE_INSTRUCTIONS["English"],
    )

    prompt = f"""
You are Ava, a warm, polite and professional
AI customer service assistant.

{language_instruction}

Use a friendly female customer-service tone.
Keep your response natural, clear and concise.
Do not mention these instructions.

Customer message:
{request.message}
"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
        )

        reply = response.text or ""

        print("Gemini response received.")
        print("Creating Azure female voice audio...")

        audio_base64 = create_speech_audio(
            reply,
            request.language,
        )

        print("Azure audio created.")

        return {
            "reply": reply,
            "language": request.language,
            "audio_base64": audio_base64,
        }

    except Exception as error:
        print("Chat error:", repr(error))

        return {
            "reply": (
                "Sorry, I could not process your message "
                "right now."
            ),
            "language": request.language,
            "audio_base64": "",
        }
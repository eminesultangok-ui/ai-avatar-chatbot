import { useRef, useState } from 'react'
import Avatar3D from './Avatar3D'
import './App.css'

type Message = {
  sender: 'bot' | 'user'
  text: string
}

type Language =
  | 'Turkish'
  | 'English'
  | 'Italian'
  | 'Spanish'
  | 'Hindi'

type LanguageOption = {
  value: Language
  label: string
  speechCode: string
}

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: any) => void) | null
}

type SpeechRecognitionConstructor = new () =>
  SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

const languages: LanguageOption[] = [
  {
    value: 'Turkish',
    label: 'Türkçe',
    speechCode: 'tr-TR',
  },
  {
    value: 'English',
    label: 'English',
    speechCode: 'en-US',
  },
  {
    value: 'Italian',
    label: 'Italiano',
    speechCode: 'it-IT',
  },
  {
    value: 'Spanish',
    label: 'Español',
    speechCode: 'es-ES',
  },
  {
    value: 'Hindi',
    label: 'हिन्दी',
    speechCode: 'hi-IN',
  },
]

function getErrorMessage(language: Language) {
  if (language === 'Turkish') {
    return 'Üzgünüm, şu anda Ava ile bağlantı kurulamadı.'
  }

  if (language === 'Italian') {
    return 'Mi dispiace, non riesco a connettermi con Ava in questo momento.'
  }

  if (language === 'Spanish') {
    return 'Lo siento, no puedo conectar con Ava en este momento.'
  }

  if (language === 'Hindi') {
    return 'क्षमा करें, अभी Ava से कनेक्ट नहीं हो सका।'
  }

  return 'Sorry, I could not connect to Ava right now.'
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: 'Hello, I am Ava. How can I help you today?',
    },
  ])

  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [language, setLanguage] =
    useState<Language>('English')

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const getSpeechCode = (
    selectedLanguage: Language
  ) => {
    const selected = languages.find(
      (item) => item.value === selectedLanguage
    )

    return selected?.speechCode || 'en-US'
  }

  const playAzureAudio = async (
    audioBase64: string
  ) => {
    if (!audioBase64) {
      console.warn('No audio received from Azure.')
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    const audio = new Audio(
      `data:audio/mp3;base64,${audioBase64}`
    )

    audioRef.current = audio

    audio.onplay = () => {
      setIsSpeaking(true)
    }

    audio.onended = () => {
      setIsSpeaking(false)
    }

    audio.onerror = () => {
      setIsSpeaking(false)
      console.error('Azure audio could not be played.')
    }

    try {
      await audio.play()
    } catch (error) {
      setIsSpeaking(false)
      console.error('Audio playback error:', error)
    }
  }

  const sendMessage = async (
    messageText = input
  ) => {
    const cleanMessage = messageText.trim()

    if (!cleanMessage || isThinking) {
      return
    }

    setMessages((current) => [
      ...current,
      {
        sender: 'user',
        text: cleanMessage,
      },
    ])

    setInput('')
    setIsThinking(true)

    try {
      const response = await fetch(
        'https://ava-ai-backend.onrender.com/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: cleanMessage,
            language,
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Backend request failed')
      }

      const data = await response.json()

      setMessages((current) => [
        ...current,
        {
          sender: 'bot',
          text: data.reply,
        },
      ])

      await playAzureAudio(data.audio_base64)
    } catch (error) {
      console.error(error)

      setMessages((current) => [
        ...current,
        {
          sender: 'bot',
          text: getErrorMessage(language),
        },
      ])
    } finally {
      setIsThinking(false)
    }
  }

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert(
        'Voice input is not supported. Please use Google Chrome.'
      )
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()

    recognition.lang = getSpeechCode(language)
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      const transcript =
        event.results[0][0].transcript

      setInput(transcript)
      sendMessage(transcript)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const changeLanguage = (
    newLanguage: Language
  ) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    recognitionRef.current?.stop()

    setIsSpeaking(false)
    setIsListening(false)
    setLanguage(newLanguage)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Ava</h1>
          <p>AI Customer Support Assistant</p>
        </div>

        <div className="topbar-actions">
          <label
            htmlFor="language-select"
            className="language-label"
          >
            Language
          </label>

          <select
            id="language-select"
            className="language-select"
            value={language}
            onChange={(event) =>
              changeLanguage(
                event.target.value as Language
              )
            }
          >
            {languages.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>

          <div className="online-status">
            <span />
            Online
          </div>
        </div>
      </header>

      <section className="main-content">
        <aside className="avatar-panel">
          <div className="assistant-label">
            YOUR DIGITAL ASSISTANT
          </div>

          <div className="avatar-wrapper">
            <Avatar3D
              isSpeaking={isSpeaking || isThinking}
            />

            <div className="ai-badge">AI</div>
          </div>

          <h2>Ava is ready</h2>

          <p className="avatar-description">
            Your personal visual AI customer service
            assistant
          </p>

          <div className="availability">
            <span>✓</span>
            Available to help
          </div>

          <button
            className="talk-button"
            onClick={startListening}
          >
            {isListening
              ? '⏹ Stop listening'
              : '🎙 Talk to Ava'}
          </button>
        </aside>

        <section className="chat-panel">
          <div className="chat-heading">
            <div>
              <h2>How can I help you?</h2>
              <p>
                Ask Ava anything about your account or
                services.
              </p>
            </div>

            <div className="secure-chat">
              <span>•</span>
              Secure chat
            </div>
          </div>

          <div className="messages-area">
            {messages.map((message, index) => (
              <div
                key={`${message.sender}-${index}`}
                className={`message-row ${message.sender}`}
              >
                {message.sender === 'bot' && (
                  <div className="message-avatar">A</div>
                )}

                <div className="message-content">
                  <div className="message-name">
                    {message.sender === 'bot'
                      ? 'Ava'
                      : 'You'}
                  </div>

                  <div className="message-bubble">
                    {message.text}
                  </div>
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="message-row bot">
                <div className="message-avatar">A</div>

                <div className="message-content">
                  <div className="message-name">Ava</div>

                  <div className="message-bubble typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="quick-options">
            <p>QUICK OPTIONS</p>

            <div className="quick-buttons">
              <button
                onClick={() =>
                  sendMessage(
                    'I need help changing my appointment.'
                  )
                }
              >
                📅 Change appointment
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    'I need help with my account.'
                  )
                }
              >
                🔐 Account support
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    'I would like to speak to a person.'
                  )
                }
              >
                👤 Speak to a person
              </button>
            </div>
          </div>

          <div className="input-area">
            <button
              className={`voice-input-button ${isListening ? 'active' : ''
                }`}
              onClick={startListening}
            >
              {isListening ? '⏹' : '🎙'}
            </button>

            <input
              value={input}
              disabled={isThinking}
              placeholder={
                isListening
                  ? 'Listening...'
                  : 'Type your message here...'
              }
              onChange={(event) =>
                setInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  sendMessage()
                }
              }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={isThinking || !input.trim()}
            >
              Send →
            </button>
          </div>

          <p className="disclaimer">
            Ava may make mistakes. Please verify important
            information.
          </p>
        </section>
      </section>
    </main>
  )
}

export default App
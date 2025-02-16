import { FC, useRef, useState, useEffect } from "react";
import { Card, CardBody, Button } from "@heroui/react";
import { SubtitleSettings, defaultSettings } from "./SubtitleSettings";
import { SupportedLanguage } from "@/types/language";

interface VideoStreamProps {
  language: SupportedLanguage;
  onSubtitleChange: (data: { time: string; text: string }) => void;
  onSummaryChange: (data: { time: string; text: string }) => void;
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  onTranscription?: (data: any) => void;
}

export const VideoStream: FC<VideoStreamProps> = ({
                                                    language,
                                                    onSubtitleChange,
                                                    onPermissionGranted,
                                                    onPermissionDenied,
                                                  }) => {
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("Starting...");
  const [autoVoice, setAutoVoice] = useState<boolean>(false); // новая галочка
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [subtitleSettings] = useState<SubtitleSettings>(defaultSettings);

  // Маппинг языка для API перевода (используется, если язык не русский)
  const languageMap: Record<SupportedLanguage, string> = {
    ru: "Russian",
    en: "English",
    es: "Spanish",
  };

  // Функция перевода текста
  const translateText = async (
      text: string,
      sourceLang: string,
      targetLang: string
  ): Promise<string> => {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
    });
    if (!response.ok) {
      throw new Error("Ошибка перевода");
    }
    const data = await response.json();
    return data.translation;
  };

  // Функция для автоматического озвучивания субтитра
  const autoVoiceSubtitle = async (text: string) => {
    try {
      const ttsResponse = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!ttsResponse.ok) {
        throw new Error("Ошибка озвучивания текста");
      }
      const blob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  const startStream = async () => {
    setStatus("waiting");
    setErrorMessage("");
    setDebugInfo("Starting stream...");

    try {
      // Получаем стрим с камеры и микрофона
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Логируем настройки аудио трека
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      setDebugInfo((prev) => prev + `\nAudio track settings: ${JSON.stringify(settings)}`);

      // Создаем AudioContext
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(1024, 1, 1);

      // Создаем WebSocket соединение
      const ws = new WebSocket("/ws");
      wsRef.current = ws;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const amplifiedData = new Float32Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            amplifiedData[i] = Math.max(-1, Math.min(1, inputData[i] * 2));
          }
          const intData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            intData[i] = Math.max(-32768, Math.min(32767, amplifiedData[i] * 32768));
          }
          console.log("Sending audio chunk:", {
            length: intData.length,
            maxAmplitude: Math.max(...Array.from(intData).map(Math.abs)),
          });
          ws.send(intData.buffer);
        }
      };

      ws.onmessage = (event) => {
        let originalText = event.data as string;
        if (originalText.indexOf("DimaTorzok") !== -1 || originalText === 'Редактор субтитров А.Семкин Корректор А.Егорова') {
          originalText = 'Тишина';
        }
        const time = new Date().toLocaleTimeString();

        if (language === "ru") {
          setCurrentSubtitle(originalText);
          onSubtitleChange({ time, text: originalText });
          setDebugInfo((prev) => prev + "\nReceived subtitle: " + originalText);
          if (autoVoice) {
            autoVoiceSubtitle(originalText);
          }
        } else {
          (async () => {
            try {
              const targetLangFull = languageMap[language] || "Russian";
              const translatedText = await translateText(originalText, "Russian", targetLangFull);
              setCurrentSubtitle(translatedText);
              onSubtitleChange({ time, text: translatedText });
              setDebugInfo(
                  (prev) => prev + "\nReceived subtitle: " + originalText + " -> " + translatedText
              );
              if (autoVoice) {
                autoVoiceSubtitle(translatedText);
              }
            } catch (error) {
              console.error("Subtitle translation error:", error);
              setCurrentSubtitle(originalText);
              onSubtitleChange({ time, text: originalText });
              setDebugInfo((prev) => prev + "\nReceived subtitle (untranslated): " + originalText);
              if (autoVoice) {
                autoVoiceSubtitle(originalText);
              }
            }
          })();
        }
      };

      ws.onopen = () => {
        setStatus("streaming");
        onPermissionGranted && onPermissionGranted();
        setDebugInfo((prev) => prev + "\nWebSocket connected");
      };

      ws.onerror = (error) => {
        setDebugInfo((prev) => prev + "\nWebSocket error: " + error);
        setStatus("error");
        setErrorMessage("Ошибка подключения к серверу");
      };

      ws.onclose = () => {
        setDebugInfo((prev) => prev + "\nWebSocket closed");
        if (status === "streaming") {
          setStatus("error");
          setErrorMessage("Соединение прервано");
        }
      };
    } catch (err) {
      setDebugInfo((prev) => prev + "\nStream error: " + String(err));
      let message = "Ошибка доступа к камере";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") message = "Доступ к камере запрещён";
        else if (err.name === "NotFoundError") message = "Камера не найдена";
        else if (err.name === "NotReadableError") message = "Камера уже используется другим приложением";
      }
      setErrorMessage(message);
      setStatus("error");
      onPermissionDenied && onPermissionDenied();
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
      <Card>
        <CardBody className="p-0 relative aspect-video max-h-[480px]">
          <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover rounded-lg ${status !== "streaming" ? "hidden" : ""}`}
          />
          {status === "streaming" && currentSubtitle && (
              <div
                  className="absolute left-0 right-0 px-4 py-2"
                  style={{
                    bottom: `${subtitleSettings.bottomOffset}px`,
                    background: subtitleSettings.backgroundColor,
                    fontFamily: subtitleSettings.fontFamily,
                  }}
              >
                <p
                    className="text-center"
                    style={{
                      color: subtitleSettings.textColor,
                      fontSize: `${subtitleSettings.fontSize}px`,
                    }}
                >
                  {currentSubtitle}
                </p>
              </div>
          )}
          {status !== "streaming" && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                <div className="text-center px-4">
                  {status === "idle" && (
                      <Button color="primary" size="lg" onPress={startStream}>
                        Попробовать
                      </Button>
                  )}
                  {status === "waiting" && (
                      <>
                        <p className="text-lg mb-2">Ожидание разрешения...</p>
                        <p className="text-sm text-gray-600">
                          Пожалуйста, разрешите доступ к камере и микрофону
                        </p>
                      </>
                  )}
                  {status === "error" && (
                      <>
                        <p className="text-lg text-red-600 mb-4">{errorMessage}</p>
                        <Button color="primary" onPress={startStream}>
                          Попробовать снова
                        </Button>
                      </>
                  )}
                </div>
              </div>
          )}
          {/* Блок для отладки и управления озвучиванием */}
          <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 font-mono whitespace-pre-wrap">
            {debugInfo.split("\n").slice(-10).join("\n")}
            <div className="mt-2">
              <label className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={autoVoice}
                    onChange={(e) => setAutoVoice(e.target.checked)}
                />
                <span>Озвучивать субтитры</span>
              </label>
            </div>
          </div>
        </CardBody>
      </Card>
  );
};

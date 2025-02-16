// Demo.tsx
import {FC, useEffect, useRef, useState} from 'react';
import { SupportedLanguage } from '@/types/language';
import { Button, Card, CardBody, Select, SelectItem } from "@heroui/react";
import { VideoStream } from '@/components/conference/VideoStream';
import { Home, Users, FileText, Search } from "lucide-react";
import vbpfp from '../assets/vbpfp.png';

interface TranscriptEntry {
  time: string;
  text: string;
  timestamp: string;
}

const Sidebar: FC = () => {
  return (
      <div className="w-64 min-h-screen bg-white border-r border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Home className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="text-2xl font-semibold">BITHoven</h1>
        </div>
        <div className="mb-6">
          <div className="bg-gray-100 rounded-lg p-2 mb-4">
            <div className="flex items-center gap-2">
              <img src={vbpfp} alt="User" className="rounded-full object-fill w-10 h-10" />
              <div>
                <p className="font-medium">Вадим Быков</p>
                <p className="text-sm text-gray-500">Тестер</p>
              </div>
            </div>
          </div>
          <Button className="w-full">Создать встречу</Button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
        </div>
        <nav className="space-y-2">
          <a className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <Home className="w-5 h-5" />
            <span>Главная</span>
          </a>
          <a className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <Users className="w-5 h-5" />
            <span>Встречи</span>
          </a>
          <a className="flex items-center gap-2 p-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <FileText className="w-5 h-5" />
            <span>Записи транскрипций</span>
          </a>
        </nav>
      </div>
  );
};

const TranscriptionPanel: FC<{
  entries: TranscriptEntry[];
  onVoiceText: (text: string) => void;
  showSummary: boolean;
}> = ({ entries, onVoiceText, showSummary }) => {
  return (
      <div className="flex flex-col-reverse space-y-4">
        {entries.map((entry, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                P1
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{entry.time}</span>
                  <Button size="sm" variant="light" onPress={() => onVoiceText(entry.text)}>
                    Озвучить текст
                  </Button>
                </div>
                <p className="mt-1">{entry.text}</p>
              </div>
            </div>
        ))}
        {entries.length === 0 && (
            <p className="text-center text-gray-500 py-4">
              {showSummary ? 'Пока нет доступных сводок' : 'Начните говорить, чтобы увидеть транскрипцию'}
            </p>
        )}
      </div>
  );
};

const Demo: FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("ru");
  const [showSummary, setShowSummary] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [summaryEntries, setSummaryEntries] = useState<TranscriptEntry[]>([]);
  const translateText = async (
      text: string,
      sourceLang: string,
      targetLang: string
  ): Promise<string> => {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang })
    });
    if (!response.ok) {
      throw new Error("Ошибка перевода");
    }
    const data = await response.json();
    // Используем поле translation из ответа
    return data.translation;
  };
  const languageMap: Record<SupportedLanguage, string> = {
    ru: "Russian",
    en: "English",
    es: "Spanish",
  };
  const handleVoiceText = async (text: string) => {
    try {
      // Определяем исходный язык из выбранного языка (SelectedLang)
      const sourceLang = "Russian";
      // Задаём целевой язык. Здесь по умолчанию переводим на английский.
      const targetLang = languageMap[selectedLanguage] || "English";

      // Переводим текст перед отправкой в TTS
      const translatedText = await translateText(text, sourceLang, targetLang);

      // Затем отправляем переведённый текст в TTS
      const ttsResponse = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: translatedText, language: selectedLanguage })
      });
      if (!ttsResponse.ok) {
        throw new Error("Ошибка озвучивания текста");
      }
      const blob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      console.error(err);
    }
  };
  const handleSubtitleChange = ({ time, text }: { time: string, text: string }) => {
    setTranscriptEntries(prev => [
      ...prev,
      { time, text, timestamp: new Date().toISOString() }
    ]);
  };

  const transcriptTextRef = useRef<string>("");
  useEffect(() => {
    transcriptTextRef.current = transcriptEntries.map((e) => e.text).join(" ");
  }, [transcriptEntries]);

  const performSummarization = async () => {
    const fullText = transcriptTextRef.current;
    if (!fullText.trim()) return;
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: fullText })
      });
      if (!response.ok) {
        throw new Error("Ошибка суммаризации");
      }
      const data = await response.json();
      const summaryText = data.summary;
      const time = new Date().toLocaleTimeString();
      setSummaryEntries((prev) => [
        ...prev,
        { time, text: summaryText, timestamp: new Date().toISOString() }
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const summaryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (showSummary) {
      // Выполнить суммаризацию сразу
      performSummarization();
      summaryIntervalRef.current = setInterval(() => {
        performSummarization();
      }, 25000);
    } else {
      if (summaryIntervalRef.current) {
        clearInterval(summaryIntervalRef.current);
        summaryIntervalRef.current = null;
      }
    }
    return () => {
      if (summaryIntervalRef.current) {
        clearInterval(summaryIntervalRef.current);
        summaryIntervalRef.current = null;
      }
    };
  }, [showSummary]);
  const handleSummaryChange = ({ time, text }: { time: string, text: string }) => {
    setSummaryEntries(prev => [
      ...prev,
      { time, text, timestamp: new Date().toISOString() }
    ]);
  };
  return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold mb-2">Демонстрация сервиса</h1>
                  <p className="text-gray-600">Попробуйте поговорить и посмотреть, как сервис работает</p>
                </div>
                <Select
                    label="Язык"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)}
                    className="w-48"
                >
                  <SelectItem key="ru" value="ru">Русский</SelectItem>
                  <SelectItem key="en" value="en">English</SelectItem>
                  <SelectItem key="es" value="es">Español</SelectItem>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-2">
                <VideoStream
                    language={selectedLanguage}
                    onSubtitleChange={handleSubtitleChange}
                    onSummaryChange={handleSummaryChange}
                />
              </div>
              <div className="space-y-4">
                <Card>
                  <CardBody className="p-4">
                    <div className="flex gap-2 mb-4">
                      <Button color={!showSummary ? "primary" : "default"} onPress={() => setShowSummary(false)}>
                        Транскрипция
                      </Button>
                      <Button color={showSummary ? "primary" : "default"} onPress={() => setShowSummary(true)}>
                        Краткое содержание
                      </Button>
                    </div>
                    <TranscriptionPanel
                        entries={showSummary ? summaryEntries : transcriptEntries}
                        onVoiceText={handleVoiceText}
                        showSummary={showSummary}
                    />
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Demo;

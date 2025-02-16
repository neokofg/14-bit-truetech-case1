// src/components/conference/SubtitleSettings.tsx
import { FC, useState } from 'react';
import { Button, Input, Card, CardBody, Select, SelectItem, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { Settings } from "lucide-react";

// SubtitleSettings.ts
// SubtitleSettings.ts
export interface SubtitleSettings {
  bottomOffset: number;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
}
export const defaultSettings: SubtitleSettings = {
  bottomOffset: 20,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  textColor: "#FFFFFF",
  fontFamily: "Arial, sans-serif",
  fontSize: 24,
};

interface SubtitleSettingsProps {
  settings: SubtitleSettings;
  onSettingsChange: (settings: SubtitleSettings) => void;
}

const fontOptions = [
  "Inter",
  "Arial",
  "Roboto",
  "Times New Roman",
  "Georgia"
];

export const SubtitleSettingsPanel: FC<SubtitleSettingsProps> = ({
  settings,
  onSettingsChange
}) => {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleChange = (key: keyof SubtitleSettings, value: string | number) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button 
          variant="light" 
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Настроить субтитры
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Card>
          <CardBody className="w-80 p-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Размер текста</label>
                <input 
                  type="range"
                  className="w-full"
                  value={localSettings.fontSize}
                  onChange={e => handleChange('fontSize', parseInt(e.target.value))}
                  min={12}
                  max={48}
                  step={1}
                />
                <div className="text-sm text-gray-500 mt-1">
                  {localSettings.fontSize}px
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Цвет текста</label>
                <Input 
                  type="color" 
                  value={localSettings.textColor}
                  onChange={e => handleChange('textColor', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Цвет фона</label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="color" 
                    value={localSettings.backgroundColor.replace(/[^\d,]/g, '')}
                    onChange={e => {
                      const color = e.target.value;
                      handleChange('backgroundColor', `rgba(${parseInt(color.substr(1,2), 16)}, ${parseInt(color.substr(3,2), 16)}, ${parseInt(color.substr(5,2), 16)}, 0.7)`);
                    }}
                  />
                  <input 
                    type="range"
                    className="flex-1"
                    value={parseFloat(localSettings.backgroundColor.split(',')[3])}
                    onChange={e => {
                      const rgba = localSettings.backgroundColor.split(',');
                      rgba[3] = ` ${e.target.value})`;
                      handleChange('backgroundColor', rgba.join(','));
                    }}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Отступ снизу</label>
                <input 
                  type="range"
                  className="w-full"
                  value={localSettings.bottomOffset}
                  onChange={e => handleChange('bottomOffset', parseInt(e.target.value))}
                  min={0}
                  max={100}
                  step={1}
                />
                <div className="text-sm text-gray-500 mt-1">
                  {localSettings.bottomOffset}px
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Шрифт</label>
                <Select 
                  value={localSettings.fontFamily}
                  onChange={e => handleChange('fontFamily', e.target.value)}
                >
                  {fontOptions.map(font => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>
          </CardBody>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
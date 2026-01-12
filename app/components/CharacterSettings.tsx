'use client';

import { useState, useEffect } from 'react';

export interface CharacterConfig {
  name: string;
  avatar: string;
  personality: string;
  speechStyle: string;
}

const DEFAULT_CHARACTER: CharacterConfig = {
  name: 'アシスタント',
  avatar: '🤖',
  personality: '親切で明るい',
  speechStyle: 'フレンドリーな敬語',
};

const AVATAR_OPTIONS = ['🤖', '🐱', '🐶', '🦊', '🐰', '🐼', '🦄', '👻', '🌟', '💫', '🎀', '🌸'];

const PERSONALITY_OPTIONS = [
  { value: '親切で明るい', label: '親切で明るい' },
  { value: '知的でクール', label: '知的でクール' },
  { value: '元気いっぱい', label: '元気いっぱい' },
  { value: '落ち着いて優しい', label: '落ち着いて優しい' },
  { value: 'ツンデレ', label: 'ツンデレ' },
];

const SPEECH_STYLE_OPTIONS = [
  { value: 'フレンドリーな敬語', label: 'フレンドリーな敬語（〜ですね！）' },
  { value: 'カジュアル', label: 'カジュアル（〜だよ！）' },
  { value: '丁寧語', label: '丁寧語（〜でございます）' },
  { value: '関西弁', label: '関西弁（〜やで！）' },
];

interface CharacterSettingsProps {
  onCharacterChange: (config: CharacterConfig) => void;
}

export default function CharacterSettings({ onCharacterChange }: CharacterSettingsProps) {
  const [config, setConfig] = useState<CharacterConfig>(DEFAULT_CHARACTER);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('character_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConfig(parsed);
      onCharacterChange(parsed);
    } else {
      onCharacterChange(DEFAULT_CHARACTER);
    }
  }, [onCharacterChange]);

  const handleSave = () => {
    localStorage.setItem('character_config', JSON.stringify(config));
    onCharacterChange(config);
    setIsOpen(false);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CHARACTER);
    localStorage.removeItem('character_config');
    onCharacterChange(DEFAULT_CHARACTER);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg"
      >
        <span className="text-xl">{config.avatar}</span>
        <span className="font-medium">{config.name}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span>✨</span> キャラクター設定
          </h3>

          {/* 名前 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              名前
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              placeholder="キャラクターの名前"
            />
          </div>

          {/* アバター */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              アバター
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setConfig({ ...config, avatar: emoji })}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    config.avatar === emoji
                      ? 'bg-purple-100 dark:bg-purple-900 ring-2 ring-purple-500'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 性格 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              性格
            </label>
            <select
              value={config.personality}
              onChange={(e) => setConfig({ ...config, personality: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              {PERSONALITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 話し方 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              話し方
            </label>
            <select
              value={config.speechStyle}
              onChange={(e) => setConfig({ ...config, speechStyle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              {SPEECH_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* ボタン */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
            >
              保存
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              リセット
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

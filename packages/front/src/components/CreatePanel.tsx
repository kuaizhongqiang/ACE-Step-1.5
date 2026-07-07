import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sparkles, ChevronDown, Settings2, Trash2, Music2, Sliders, Dices, Hash, RefreshCw, Plus, Upload, Play, Pause, Loader2 } from 'lucide-react';
import { GenerationParams, Song, ReferenceTrack } from '../types';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { generateApi } from '../services/api';
import { MAIN_STYLES } from '@data/genres';
import { EditableSlider } from './EditableSlider';

interface CreatePanelProps {
  onGenerate: (params: GenerationParams) => void;
  isGenerating: boolean;
  initialData?: { song: Song, timestamp: number } | null;
  createdSongs?: Song[];
  pendingAudioSelection?: { target: 'reference' | 'source'; url: string; title?: string } | null;
  onAudioSelectionApplied?: () => void;
}

const KEY_SIGNATURES = [
  '',
  'C major', 'C minor',
  'C# major', 'C# minor',
  'Db major', 'Db minor',
  'D major', 'D minor',
  'D# major', 'D# minor',
  'Eb major', 'Eb minor',
  'E major', 'E minor',
  'F major', 'F minor',
  'F# major', 'F# minor',
  'Gb major', 'Gb minor',
  'G major', 'G minor',
  'G# major', 'G# minor',
  'Ab major', 'Ab minor',
  'A major', 'A minor',
  'A# major', 'A# minor',
  'Bb major', 'Bb minor',
  'B major', 'B minor'
];

const TIME_SIGNATURES = ['', '2', '3', '4', '6', 'N/A'];

const TRACK_NAMES = [
  'woodwinds', 'brass', 'fx', 'synth', 'strings', 'percussion',
  'keyboard', 'guitar', 'bass', 'drums', 'backing_vocals', 'vocals',
];

const VOCAL_LANGUAGE_KEYS = [
  { value: 'unknown', key: 'autoInstrumental' as const },
  { value: 'ar', key: 'vocalArabic' as const },
  { value: 'az', key: 'vocalAzerbaijani' as const },
  { value: 'bg', key: 'vocalBulgarian' as const },
  { value: 'bn', key: 'vocalBengali' as const },
  { value: 'ca', key: 'vocalCatalan' as const },
  { value: 'cs', key: 'vocalCzech' as const },
  { value: 'da', key: 'vocalDanish' as const },
  { value: 'de', key: 'vocalGerman' as const },
  { value: 'el', key: 'vocalGreek' as const },
  { value: 'en', key: 'vocalEnglish' as const },
  { value: 'es', key: 'vocalSpanish' as const },
  { value: 'fa', key: 'vocalPersian' as const },
  { value: 'fi', key: 'vocalFinnish' as const },
  { value: 'fr', key: 'vocalFrench' as const },
  { value: 'he', key: 'vocalHebrew' as const },
  { value: 'hi', key: 'vocalHindi' as const },
  { value: 'hr', key: 'vocalCroatian' as const },
  { value: 'ht', key: 'vocalHaitianCreole' as const },
  { value: 'hu', key: 'vocalHungarian' as const },
  { value: 'id', key: 'vocalIndonesian' as const },
  { value: 'is', key: 'vocalIcelandic' as const },
  { value: 'it', key: 'vocalItalian' as const },
  { value: 'ja', key: 'vocalJapanese' as const },
  { value: 'ko', key: 'vocalKorean' as const },
  { value: 'la', key: 'vocalLatin' as const },
  { value: 'lt', key: 'vocalLithuanian' as const },
  { value: 'ms', key: 'vocalMalay' as const },
  { value: 'ne', key: 'vocalNepali' as const },
  { value: 'nl', key: 'vocalDutch' as const },
  { value: 'no', key: 'vocalNorwegian' as const },
  { value: 'pa', key: 'vocalPunjabi' as const },
  { value: 'pl', key: 'vocalPolish' as const },
  { value: 'pt', key: 'vocalPortuguese' as const },
  { value: 'ro', key: 'vocalRomanian' as const },
  { value: 'ru', key: 'vocalRussian' as const },
  { value: 'sa', key: 'vocalSanskrit' as const },
  { value: 'sk', key: 'vocalSlovak' as const },
  { value: 'sr', key: 'vocalSerbian' as const },
  { value: 'sv', key: 'vocalSwedish' as const },
  { value: 'sw', key: 'vocalSwahili' as const },
  { value: 'ta', key: 'vocalTamil' as const },
  { value: 'te', key: 'vocalTelugu' as const },
  { value: 'th', key: 'vocalThai' as const },
  { value: 'tl', key: 'vocalTagalog' as const },
  { value: 'tr', key: 'vocalTurkish' as const },
  { value: 'uk', key: 'vocalUkrainian' as const },
  { value: 'ur', key: 'vocalUrdu' as const },
  { value: 'vi', key: 'vocalVietnamese' as const },
  { value: 'yue', key: 'vocalCantonese' as const },
  { value: 'zh', key: 'vocalChineseMandarin' as const },
];

export const CreatePanel: React.FC<CreatePanelProps> = ({
  onGenerate,
  isGenerating,
  initialData,
  createdSongs = [],
  pendingAudioSelection,
  onAudioSelectionApplied,
}) => {
  const { isAuthenticated, token, user } = useAuth();
  const { t: _t } = useI18n();
  const t = (key: string) => _t(key as any);

  // Randomly select 6 music tags from MAIN_STYLES
  const [musicTags, setMusicTags] = useState<string[]>(() => {
    const shuffled = [...MAIN_STYLES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6);
  });

  // Function to refresh music tags
  const refreshMusicTags = useCallback(() => {
    const shuffled = [...MAIN_STYLES].sort(() => Math.random() - 0.5);
    setMusicTags(shuffled.slice(0, 6));
  }, []);

  // Mode
  const [customMode, setCustomMode] = useState(true);

  // Simple Mode
  const [songDescription, setSongDescription] = useState('');

  // Custom Mode
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');

  // Common
  const [instrumental, setInstrumental] = useState(false);
  const [vocalLanguage, setVocalLanguage] = useState('en');
  const [vocalGender, setVocalGender] = useState<'male' | 'female' | ''>('');

  // Music Parameters
  const [bpm, setBpm] = useState(0);
  const [keyScale, setKeyScale] = useState('');
  const [timeSignature, setTimeSignature] = useState('');

  // Advanced Settings
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [duration, setDuration] = useState(-1);
  const [batchSize, setBatchSize] = useState(() => {
    const stored = localStorage.getItem('ace-batchSize');
    return stored ? Number(stored) : 1;
  });
  const [bulkCount, setBulkCount] = useState(() => {
    const stored = localStorage.getItem('ace-bulkCount');
    return stored ? Number(stored) : 1;
  });
  const [guidanceScale, setGuidanceScale] = useState(9.0);
  const [randomSeed, setRandomSeed] = useState(true);
  const [seed, setSeed] = useState(-1);
  const [thinking, setThinking] = useState(false); // Default false for GPU compatibility
  const [enhance, setEnhance] = useState(false); // AI Enhance: uses LLM to enrich caption & generate metadata
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'flac'>('mp3');
  const [inferenceSteps, setInferenceSteps] = useState(12);
  const [inferMethod, setInferMethod] = useState<'ode' | 'sde'>('ode');
  const [lmBackend, setLmBackend] = useState<'pt' | 'vllm'>('pt');
  const [lmModel, setLmModel] = useState(() => {
    return localStorage.getItem('ace-lmModel') || 'acestep-5Hz-lm-0.6B';
  });
  const [shift, setShift] = useState(3.0);

  // LM Parameters (under Expert)
  const [showLmParams, setShowLmParams] = useState(false);
  const [lmTemperature, setLmTemperature] = useState(0.8);
  const [lmCfgScale, setLmCfgScale] = useState(2.2);
  const [lmTopK, setLmTopK] = useState(0);
  const [lmTopP, setLmTopP] = useState(0.92);
  const [lmNegativePrompt, setLmNegativePrompt] = useState('NO USER INPUT');

  // Expert Parameters (now in Advanced section)
  const [referenceAudioUrl, setReferenceAudioUrl] = useState('');
  const [sourceAudioUrl, setSourceAudioUrl] = useState('');
  const [referenceAudioTitle, setReferenceAudioTitle] = useState('');
  const [sourceAudioTitle, setSourceAudioTitle] = useState('');
  const [audioCodes, setAudioCodes] = useState('');
  const [repaintingStart, setRepaintingStart] = useState(0);
  const [repaintingEnd, setRepaintingEnd] = useState(-1);
  const [instruction, setInstruction] = useState('Fill the audio semantic mask based on the given conditions:');
  const [audioCoverStrength, setAudioCoverStrength] = useState(1.0);
  const [taskType, setTaskType] = useState('text2music');
  const [useAdg, setUseAdg] = useState(false);
  const [cfgIntervalStart, setCfgIntervalStart] = useState(0.0);
  const [cfgIntervalEnd, setCfgIntervalEnd] = useState(1.0);
  const [customTimesteps, setCustomTimesteps] = useState('');
  const [useCotMetas, setUseCotMetas] = useState(true);
  const [useCotCaption, setUseCotCaption] = useState(true);
  const [useCotLanguage, setUseCotLanguage] = useState(true);
  const [autogen, setAutogen] = useState(false);
  const [constrainedDecodingDebug, setConstrainedDecodingDebug] = useState(false);
  const [allowLmBatch, setAllowLmBatch] = useState(true);
  const [getScores, setGetScores] = useState(false);
  const [getLrc, setGetLrc] = useState(false);
  const [scoreScale, setScoreScale] = useState(0.5);
  const [lmBatchChunkSize, setLmBatchChunkSize] = useState(8);
  const [trackName, setTrackName] = useState('');
  const [completeTrackClasses, setCompleteTrackClasses] = useState('');
  const [isFormatCaption, setIsFormatCaption] = useState(false);
  const [maxDurationWithLm, setMaxDurationWithLm] = useState(240);
  const [maxDurationWithoutLm, setMaxDurationWithoutLm] = useState(240);

  // LoRA Parameters
  const [showLoraPanel, setShowLoraPanel] = useState(false);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('ace-model') || 'acestep-v15-turbo-shift3';
  });
  const [showModelMenu, setShowModelMenu] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const previousModelRef = useRef<string>(selectedModel);

  // Available models fetched from backend
  const [fetchedModels, setFetchedModels] = useState<{ name: string; is_active: boolean; is_preloaded: boolean }[]>([]);

  // Fallback model list when backend is unavailable
  const availableModels = useMemo(() => {
    if (fetchedModels.length > 0) {
      return fetchedModels.map(m => ({ id: m.name, name: m.name }));
    }
    return [
      { id: 'acestep-v15-base', name: 'acestep-v15-base' },
      { id: 'acestep-v15-sft', name: 'acestep-v15-sft' },
      { id: 'acestep-v15-turbo', name: 'acestep-v15-turbo' },
      { id: 'acestep-v15-turbo-shift1', name: 'acestep-v15-turbo-shift1' },
      { id: 'acestep-v15-turbo-shift3', name: 'acestep-v15-turbo-shift3' },
      { id: 'acestep-v15-turbo-continuous', name: 'acestep-v15-turbo-continuous' },
    ];
  }, [fetchedModels]);

  // Map model ID to short display name
  const getModelDisplayName = (modelId: string): string => {
    const mapping: Record<string, string> = {
      'acestep-v15-base': '1.5B',
      'acestep-v15-sft': '1.5S',
      'acestep-v15-turbo-shift1': '1.5TS1',
      'acestep-v15-turbo-shift3': '1.5TS3',
      'acestep-v15-turbo-continuous': '1.5TC',
      'acestep-v15-turbo': '1.5T',
    };
    return mapping[modelId] || modelId;
  };

  // Check if model is a turbo variant
  const isTurboModel = (modelId: string): boolean => {
    return modelId.includes('turbo');
  };

  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [isTranscribingReference, setIsTranscribingReference] = useState(false);
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isFormattingStyle, setIsFormattingStyle] = useState(false);
  const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dragKind, setDragKind] = useState<'file' | 'audio' | null>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioModalTarget, setAudioModalTarget] = useState<'reference' | 'source'>('reference');
  const [tempAudioUrl, setTempAudioUrl] = useState('');
  const [audioTab, setAudioTab] = useState<'reference' | 'source'>('reference');
  const referenceAudioRef = useRef<HTMLAudioElement>(null);
  const sourceAudioRef = useRef<HTMLAudioElement>(null);
  const [referencePlaying, setReferencePlaying] = useState(false);
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const [referenceTime, setReferenceTime] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [referenceDuration, setReferenceDuration] = useState(0);
  const [sourceDuration, setSourceDuration] = useState(0);

  // Reference tracks modal state
  const [referenceTracks, setReferenceTracks] = useState<ReferenceTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [playingTrackSource, setPlayingTrackSource] = useState<'uploads' | 'created' | null>(null);
  const modalAudioRef = useRef<HTMLAudioElement>(null);
  const [modalTrackTime, setModalTrackTime] = useState(0);
  const [modalTrackDuration, setModalTrackDuration] = useState(0);
  const [libraryTab, setLibraryTab] = useState<'uploads' | 'created'>('uploads');

  const createdTrackOptions = useMemo(() => {
    return createdSongs
      .filter(song => !song.isGenerating)
      .filter(song => (user ? song.userId === user.id : true))
      .filter(song => Boolean(song.audioUrl))
      .map(song => ({
        id: song.id,
        title: song.title || 'Untitled',
        audio_url: song.audioUrl!,
        duration: song.duration,
      }));
  }, [createdSongs, user]);

  const getAudioLabel = (url: string) => {
    try {
      const parsed = new URL(url);
      const name = decodeURIComponent(parsed.pathname.split('/').pop() || parsed.hostname);
      return name.replace(/\.[^/.]+$/, '') || name;
    } catch {
      const parts = url.split('/');
      const name = decodeURIComponent(parts[parts.length - 1] || url);
      return name.replace(/\.[^/.]+$/, '') || name;
    }
  };

  // Resize Logic
  const [lyricsHeight, setLyricsHeight] = useState(() => {
    const saved = localStorage.getItem('acestep_lyrics_height');
    return saved ? parseInt(saved, 10) : 144; // Default h-36 is 144px (9rem * 16)
  });
  const [isResizing, setIsResizing] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);


  // Close model menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setShowModelMenu(false);
      }
    };

    if (showModelMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showModelMenu]);

  // Track previous model for change detection
  useEffect(() => {
    previousModelRef.current = selectedModel;
  }, [selectedModel]);

  // ── Event Handlers ──────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    const params: GenerationParams = {
      customMode,
      songDescription: songDescription || undefined,
      prompt: customMode ? (style || 'pop music') : undefined,
      lyrics: instrumental ? '' : (lyrics || ''),
      style: style || 'pop music',
      title: title || 'Untitled',
      instrumental,
      vocalLanguage: vocalLanguage || undefined,
      duration: duration > 0 ? duration : undefined,
      bpm: bpm > 0 ? bpm : undefined,
      keyScale: keyScale || undefined,
      timeSignature: timeSignature || undefined,
      inferenceSteps: inferenceSteps || undefined,
      guidanceScale: guidanceScale || undefined,
      batchSize: batchSize || undefined,
      randomSeed,
      seed: randomSeed ? undefined : (seed >= 0 ? seed : undefined),
      thinking,
      enhance,
      audioFormat,
      inferMethod,
      shift: shift || undefined,
      lmTemperature: showLmParams ? lmTemperature : undefined,
      lmCfgScale: showLmParams ? lmCfgScale : undefined,
      lmTopK: showLmParams ? lmTopK : undefined,
      lmTopP: showLmParams ? lmTopP : undefined,
      lmNegativePrompt: showLmParams ? lmNegativePrompt : undefined,
      lmBackend,
      lmModel,
      ditModel: selectedModel,
      referenceAudioUrl: referenceAudioUrl || undefined,
      sourceAudioUrl: sourceAudioUrl || undefined,
      taskType: taskType === 'text2music' ? undefined : taskType,
      useAdg,
      cfgIntervalStart: cfgIntervalStart || undefined,
      cfgIntervalEnd: cfgIntervalEnd === 1.0 ? undefined : cfgIntervalEnd,
      customTimesteps: customTimesteps || undefined,
      useCotMetas,
      useCotCaption,
      useCotLanguage,
      autogen,
      constrainedDecodingDebug,
      allowLmBatch,
      getScores,
      getLrc,
      scoreScale,
      lmBatchChunkSize,
      trackName: trackName || undefined,
      isFormatCaption,
      repaintingStart: repaintingStart > 0 ? repaintingStart : undefined,
      repaintingEnd: repaintingEnd > 0 ? repaintingEnd : undefined,
      instruction: instruction || undefined,
      audioCoverStrength,
    };
    onGenerate(params);
  }, [customMode, songDescription, style, lyrics, title, instrumental, vocalLanguage,
      duration, bpm, keyScale, timeSignature, inferenceSteps, guidanceScale, batchSize,
      randomSeed, seed, thinking, enhance, audioFormat, inferMethod, shift,
      showLmParams, lmTemperature, lmCfgScale, lmTopK, lmTopP, lmNegativePrompt,
      lmBackend, lmModel, selectedModel, referenceAudioUrl, sourceAudioUrl, taskType,
      useAdg, cfgIntervalStart, cfgIntervalEnd, customTimesteps, useCotMetas,
      useCotCaption, useCotLanguage, autogen, constrainedDecodingDebug, allowLmBatch,
      getScores, getLrc, scoreScale, lmBatchChunkSize, trackName, isFormatCaption,
      repaintingStart, repaintingEnd, instruction, audioCoverStrength, onGenerate]);

  const toggleMode = () => setCustomMode(!customMode);

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-zinc-900 to-black overflow-y-auto">
      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{t('create')}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMode}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                customMode
                  ? 'bg-pink-500/20 border-pink-500/50 text-pink-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {customMode ? t('customMode') : t('simpleMode')}
            </button>
          </div>
        </div>

        {/* Simple Mode: Song Description */}
        {!customMode && (
          <div className="space-y-3 bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
            <label className="text-sm font-medium text-zinc-300">{t('songDescription')}</label>
            <textarea
              value={songDescription}
              onChange={e => setSongDescription(e.target.value)}
              placeholder={t('songDescriptionPlaceholder')}
              className="w-full h-24 bg-zinc-900/80 text-white rounded-lg p-3 text-sm border border-zinc-700 resize-none focus:outline-none focus:border-pink-500/50"
            />
            <div className="flex flex-wrap gap-2">
              {musicTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSongDescription(prev => prev ? `${prev}, ${tag}` : tag)}
                  className="px-2.5 py-1 text-xs rounded-full bg-zinc-700/60 text-zinc-300 hover:bg-zinc-600 transition-colors"
                >
                  {tag}
                </button>
              ))}
              <button onClick={refreshMusicTags} className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300">
                <RefreshCw size={12} className="inline mr-1" />{t('refresh')}
              </button>
            </div>
          </div>
        )}

        {/* Custom Mode */}
        {customMode && (
          <>
            {/* Title + Style Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('title')}</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('titlePlaceholder')}
                  className="w-full bg-zinc-800/80 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-pink-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('style')}</label>
                <input
                  value={style}
                  onChange={e => setStyle(e.target.value)}
                  placeholder={t('stylePlaceholder')}
                  className="w-full bg-zinc-800/80 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-pink-500/50"
                />
              </div>
            </div>

            {/* Lyrics */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">{t('lyrics')}</label>
                <button
                  onClick={() => setInstrumental(!instrumental)}
                  className={`text-xs px-2 py-0.5 rounded ${instrumental ? 'bg-pink-500/20 text-pink-300' : 'text-zinc-500'}`}
                >
                  {t('instrumental')}
                </button>
              </div>
              <textarea
                value={lyrics}
                onChange={e => setLyrics(e.target.value)}
                placeholder={instrumental ? t('instrumentalDesc') : t('lyricsPlaceholder')}
                disabled={instrumental}
                className="w-full bg-zinc-800/80 text-white rounded-lg p-3 text-sm border border-zinc-700 resize-none focus:outline-none focus:border-pink-500/50 disabled:opacity-40"
                style={{ height: lyricsHeight }}
              />
            </div>
          </>
        )}

        {/* Music Parameters */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">{t('bpm')}</label>
            <input
              type="number"
              value={bpm || ''}
              onChange={e => setBpm(parseInt(e.target.value) || 0)}
              placeholder="120"
              className="w-full bg-zinc-800/80 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-pink-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">{t('key')}</label>
            <select
              value={keyScale}
              onChange={e => setKeyScale(e.target.value)}
              className="w-full bg-zinc-800/80 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-pink-500/50"
            >
              <option value="">{t('auto')}</option>
              {KEY_SIGNATURES.filter(Boolean).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">{t('timeSignature')}</label>
            <select
              value={timeSignature}
              onChange={e => setTimeSignature(e.target.value)}
              className="w-full bg-zinc-800/80 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-pink-500/50"
            >
              <option value="">{t('auto')}</option>
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
            </select>
          </div>
        </div>

        {/* Model Selection */}
        <div className="relative" ref={modelMenuRef}>
          <label className="text-xs font-medium text-zinc-400 mb-1.5 block">{t('model')}</label>
          <button
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="w-full bg-zinc-800/80 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 flex items-center justify-between"
          >
            <span>{getModelDisplayName(selectedModel)}</span>
            <ChevronDown size={14} className={`transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
          </button>
          {showModelMenu && (
            <div className="absolute z-50 mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {availableModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setShowModelMenu(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                    m.id === selectedModel ? 'text-pink-400 bg-pink-500/10' : 'text-zinc-300'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Settings2 size={14} />
          {showAdvanced ? t('hideAdvanced') : t('showAdvanced')}
        </button>

        {showAdvanced && (
          <div className="space-y-3 bg-zinc-800/30 rounded-xl p-4 border border-zinc-700/50">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <EditableSlider label={t('duration')} value={duration} min={-1} max={480} step={5} onChange={setDuration} />
              <EditableSlider label={t('batchSize')} value={batchSize} min={1} max={16} step={1} onChange={setBatchSize} />
              <EditableSlider label={t('guidanceScale')} value={guidanceScale} min={1} max={20} step={0.5} onChange={setGuidanceScale} />
              <EditableSlider label={t('inferenceSteps')} value={inferenceSteps} min={1} max={50} step={1} onChange={setInferenceSteps} />
              <EditableSlider label={t('shift')} value={shift} min={0} max={15} step={1} onChange={setShift} />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('audioFormat')}</label>
                <select value={audioFormat} onChange={e => setAudioFormat(e.target.value as 'mp3' | 'flac')}
                  className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700">
                  <option value="mp3">MP3</option>
                  <option value="flac">FLAC</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">{t('inferMethod')}</label>
                <select value={inferMethod} onChange={e => setInferMethod(e.target.value as 'ode' | 'sde')}
                  className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700">
                  <option value="ode">ODE</option>
                  <option value="sde">SDE</option>
                </select>
              </div>
            </div>

            {/* Seed */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={randomSeed} onChange={e => setRandomSeed(e.target.checked)}
                  className="rounded bg-zinc-700 border-zinc-600" />
                {t('randomSeed')}
              </label>
              {!randomSeed && (
                <input type="number" value={seed >= 0 ? seed : ''} onChange={e => setSeed(parseInt(e.target.value) || -1)}
                  placeholder="42" className="w-24 bg-zinc-800 text-white rounded px-2 py-1 text-sm border border-zinc-700" />
              )}
            </div>

            {/* Toggle switches */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={thinking} onChange={e => setThinking(e.target.checked)} />
                {t('thinking')}
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={enhance} onChange={e => setEnhance(e.target.checked)} />
                {t('enhance')}
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={useAdg} onChange={e => setUseAdg(e.target.checked)} />
                ADG
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={autogen} onChange={e => setAutogen(e.target.checked)} />
                {t('autogen')}
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={getLrc} onChange={e => setGetLrc(e.target.checked)} />
                LRC
              </label>
            </div>

            {/* LM Parameters */}
            <button
              onClick={() => setShowLmParams(!showLmParams)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              {showLmParams ? t('hideLmParams') : t('showLmParams')}
            </button>
            {showLmParams && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <EditableSlider label="Temperature" value={lmTemperature} min={0.1} max={2.0} step={0.05} onChange={setLmTemperature} />
                <EditableSlider label="CFG Scale" value={lmCfgScale} min={1} max={5} step={0.1} onChange={setLmCfgScale} />
                <EditableSlider label="Top K" value={lmTopK} min={0} max={100} step={1} onChange={setLmTopK} />
                <EditableSlider label="Top P" value={lmTopP} min={0} max={1} step={0.01} onChange={setLmTopP} />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">{t('lmBackend')}</label>
                  <select value={lmBackend} onChange={e => setLmBackend(e.target.value as 'pt' | 'vllm')}
                    className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700">
                    <option value="pt">PyTorch</option>
                    <option value="vllm">vLLM</option>
                  </select>
                </div>
              </div>
            )}

            {/* Expert: Reference/Source Audio */}
            <div className="pt-2 space-y-2">
              <label className="text-xs font-medium text-zinc-400">{t('referenceAudio')}</label>
              <div className="flex gap-2">
                <input value={referenceAudioUrl} onChange={e => setReferenceAudioUrl(e.target.value)}
                  placeholder={t('audioUrlPlaceholder')}
                  className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700" />
                <button onClick={() => { setShowAudioModal(true); setAudioModalTarget('reference'); }}
                  className="px-3 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600">
                  <Upload size={14} />
                </button>
              </div>
              <label className="text-xs font-medium text-zinc-400">{t('sourceAudio')}</label>
              <div className="flex gap-2">
                <input value={sourceAudioUrl} onChange={e => setSourceAudioUrl(e.target.value)}
                  placeholder={t('audioUrlPlaceholder')}
                  className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700" />
                <button onClick={() => { setShowAudioModal(true); setAudioModalTarget('source'); }}
                  className="px-3 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600">
                  <Upload size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
            isGenerating
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 shadow-lg shadow-pink-500/25'
          }`}
        >
          {isGenerating ? (
            <><Loader2 size={16} className="animate-spin" /> {t('generating')}</>
          ) : (
            <><Sparkles size={16} /> {t('generate')}</>
          )}
        </button>

        {/* Created Songs */}
        {createdSongs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-zinc-400">{t('generatedSongs')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {createdSongs.map((song, idx) => (
                <div key={song.id || idx}
                  className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <Music2 size={14} className="text-zinc-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{song.title}</p>
                    <p className="text-xs text-zinc-500">{song.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

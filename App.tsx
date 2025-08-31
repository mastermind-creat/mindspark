import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { AppName, AppInfo, GratitudeEntry } from './types';
import {
    generatePaletteDescription,
    generateWittyComment,
    generateMotivationalMessage,
    generateProductivityTip,
    generateEmojiStory,
    generateEmojiCaption,
    generateGreetingCaption,
    rewriteGratitudeEntry,
    generateDailyAffirmation
} from './services/geminiService';

// START: ICONS =======================================================
const PaletteIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.69-.28 3.89-.77.42-.17.85-.36 1.25-.57a10.025 10.025 0 0 0 5.86-8.66A10.007 10.007 0 0 0 12 2z"/>
        <path d="M20 12c0-2.21-.89-4.21-2.34-5.66"/>
    </svg>
);
const SpinnerIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);
const TimerIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
    </svg>
);
const EmojiIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
);
const JournalIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 1 4 14.5V4A2 2 0 0 1 6 2z"/>
        <path d="M12 13.5V6.5a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1V8"/>
    </svg>
);
// END: ICONS =======================================================

// START: CUSTOM HOOK =======================================================
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };
  return [storedValue, setValue];
};
// END: CUSTOM HOOK =======================================================

// START: AI SUGGESTION COMPONENT ==============================================
const AiSuggestion: React.FC<{ text: string | null | undefined }> = ({ text }) => {
    if (!text) return null;

    const isError = text.includes("error") || text.includes("AI is disabled") || text.includes("An error occurred") || text.includes("Rate limit exceeded");

    if (isError) {
        return (
            <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{text}</span>
            </div>
        );
    }

    // Remove surrounding quotes if they exist at the very start/end of the string
    let cleanText = text.trim();
    if ((cleanText.startsWith('"') && cleanText.endsWith('"')) || (cleanText.startsWith("'") && cleanText.endsWith("'"))) {
        cleanText = cleanText.slice(1, -1);
    }
    
    // Split by newlines to handle paragraphs and lists
    const parts = cleanText.split('\n').filter(part => part.trim() !== '').map((part, index) => {
        // Handle list items starting with * or -
        if (part.trim().startsWith('* ') || part.trim().startsWith('- ')) {
            const content = part.trim().substring(2);
            // Process bold/emphasis within the list item
            const styledContent = content.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((segment, i) => {
                if (segment.startsWith('**') && segment.endsWith('**')) {
                    return <strong key={i} className="font-bold text-purple-300">{segment.slice(2, -2)}</strong>;
                }
                if (segment.startsWith('*') && segment.endsWith('*')) {
                    return <em key={i} className="font-semibold not-italic text-purple-300">{segment.slice(1, -1)}</em>;
                }
                return segment;
            });
            return (
                <li key={index} className="flex items-start">
                    <span className="text-purple-400 mr-2 mt-1">•</span>
                    <span>{styledContent}</span>
                </li>
            );
        }

        // Handle bold/emphasis in regular text
        const styledContent = part.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((segment, i) => {
            if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={i} className="font-bold text-purple-300">{segment.slice(2, -2)}</strong>;
            }
            if (segment.startsWith('*') && segment.endsWith('*')) {
                return <em key={i} className="font-semibold not-italic text-purple-300">{segment.slice(1, -1)}</em>;
            }
            return segment;
        });

        return <p key={index}>{styledContent}</p>;
    });
    
    const hasListItems = parts.some(p => p.type === 'li');
    if (hasListItems) {
        return <ul className="space-y-1 text-left">{parts}</ul>;
    }

    return <div className="space-y-2">{parts}</div>;
};
// END: AI SUGGESTION COMPONENT ================================================

// START: MODAL COMPONENT ======================================================
const Modal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: React.ReactNode;
}> = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: -20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: -20 }}
                className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm m-4 text-white"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold mb-4">{title}</h3>
                <div className="mb-6 text-white/80">{children}</div>
                <div className="flex justify-end gap-4">
                    <motion.button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 rounded-lg font-semibold"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Cancel
                    </motion.button>
                    <motion.button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Confirm
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};
// END: MODAL COMPONENT ========================================================


// START: APP COMPONENTS =======================================================

const moods = {
    '😊': { name: 'Happy', colors: ['#FFD700', '#FFB6C1', '#87CEEB', '#98FB98', '#FFA07A'] },
    '😢': { name: 'Sad', colors: ['#4682B4', '#708090', '#B0C4DE', '#1E90FF', '#000080'] },
    '😠': { name: 'Angry', colors: ['#DC143C', '#FF4500', '#8B0000', '#B22222', '#FF0000'] },
    '🧘': { name: 'Calm', colors: ['#E0FFFF', '#AFEEEE', '#B0E0E6', '#ADD8E6', '#87CEFA'] },
    '⚡️': { name: 'Energetic', colors: ['#FFA500', '#FF6347', '#FFD700', '#FFFF00', '#ADFF2F'] },
    '❤️': { name: 'Romantic', colors: ['#FFC0CB', '#FF69B4', '#DB7093', '#C71585', '#E6E6FA'] },
};

const MoodPalette = () => {
    const [selectedMood, setSelectedMood] = useState<keyof typeof moods>('😊');
    const [palette, setPalette] = useState<string[]>(moods['😊'].colors);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedColor, setCopiedColor] = useState<string | null>(null);

    useEffect(() => {
        const fetchDescription = async () => {
            setLoading(true);
            const desc = await generatePaletteDescription(moods[selectedMood].name, palette);
            setDescription(desc);
            setLoading(false);
        };
        fetchDescription();
    }, [selectedMood, palette]);

    const handleMoodSelect = (mood: keyof typeof moods) => {
        setSelectedMood(mood);
        setPalette(moods[mood].colors);
    };

    const handleCopy = (color: string) => {
        navigator.clipboard.writeText(color);
        setCopiedColor(color);
        setTimeout(() => setCopiedColor(null), 2000);
    };

    return (
        <div className="p-4 md:p-8 flex flex-col items-center gap-8 w-full">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Mood Color Palette</h2>
            <div className="flex gap-4 p-3 bg-white/10 rounded-full shadow-lg">
                {Object.keys(moods).map((mood) => (
                    <motion.button
                        key={mood}
                        onClick={() => handleMoodSelect(mood as keyof typeof moods)}
                        className={`text-3xl md:text-4xl p-2 rounded-full transition-all duration-300 ${selectedMood === mood ? 'bg-white/30 scale-110' : 'hover:bg-white/20'}`}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        {mood}
                    </motion.button>
                ))}
            </div>
            <motion.div layout className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                <AnimatePresence>
                    {palette.map((color, index) => (
                        <motion.div
                            key={color}
                            layout
                            initial={{ opacity: 0, y: 50, scale: 0.5 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="relative aspect-square rounded-2xl shadow-lg cursor-pointer group"
                            style={{ backgroundColor: color }}
                            onClick={() => handleCopy(color)}
                        >
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center rounded-2xl p-2 text-center">
                                <span className="font-mono text-white text-sm break-all">{color}</span>
                                <span className="text-white text-xs mt-1">{copiedColor === color ? 'Copied!' : 'Copy'}</span>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>
            <div className="w-full max-w-2xl p-4 bg-white/10 rounded-2xl shadow-lg text-center min-h-[6rem] flex justify-center items-center">
                <div className="text-lg italic text-white/80">
                    {loading ? <span className="animate-pulse">Generating description...</span> : <AiSuggestion text={description} />}
                </div>
            </div>
        </div>
    );
};


const ConfettiPiece: React.FC<{
    initialX: number;
    delay: number;
    duration: number;
    color: string;
}> = ({ initialX, delay, duration, color }) => (
    <motion.div
        className="absolute w-2 h-4 rounded-sm"
        style={{ left: `${initialX}%`, top: '-20px', backgroundColor: color }}
        initial={{ opacity: 1, rotate: Math.random() * 360 }}
        animate={{
            y: '110vh',
            x: (Math.random() - 0.5) * 200,
            rotate: Math.random() * 720,
        }}
        transition={{ duration, delay, ease: 'linear' }}
    />
);

const Confetti: React.FC = () => {
    const confettiColors = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    const pieces = useMemo(() => Array.from({ length: 150 }).map((_, i) => ({
        id: i,
        initialX: Math.random() * 100,
        delay: Math.random() * 2,
        duration: Math.random() * 3 + 4,
        color: confettiColors[i % confettiColors.length],
    })), []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
            {pieces.map(({ id, ...props }) => <ConfettiPiece key={id} {...props} />)}
        </div>
    );
};

const DecisionSpinner = () => {
    const [options, setOptions] = useState<string>('Pizza, Tacos, Sushi, Burger, Pasta');
    const [isSpinning, setIsSpinning] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [aiComment, setAiComment] = useState('');
    const [showConfetti, setShowConfetti] = useState(false);
    const controls = useAnimation();
    const spinSoundRef = useRef<HTMLAudioElement>(null);
    const winSoundRef = useRef<HTMLAudioElement>(null);

    const optionArray = useMemo(() => options.split(',').map(s => s.trim()).filter(Boolean), [options]);
    const anglePerSlice = 360 / Math.max(1, optionArray.length);
    const colors = useMemo(() => ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#D946EF'], []);
    
    const conicGradient = useMemo(() => {
        if (optionArray.length < 1) return 'transparent';
        const gradientParts = optionArray.map((_, index) => {
            const startAngle = index * anglePerSlice;
            const endAngle = (index + 1) * anglePerSlice;
            return `${colors[index % colors.length]} ${startAngle}deg ${endAngle}deg`;
        });
        return `conic-gradient(from 0deg, ${gradientParts.join(', ')})`;
    }, [optionArray, anglePerSlice, colors]);

    const handleSpin = async () => {
        if (isSpinning || optionArray.length < 2) return;
        
        setShowConfetti(false);
        setIsSpinning(true);
        setResult(null);
        setAiComment('');
        spinSoundRef.current?.play();

        const randomSpins = Math.floor(Math.random() * 5) + 8; // More spins
        const randomIndex = Math.floor(Math.random() * optionArray.length);
        const randomAngleOffset = (Math.random() - 0.5) * anglePerSlice * 0.8;
        const targetRotation = (randomSpins * 360) - (randomIndex * anglePerSlice) - (anglePerSlice / 2) + randomAngleOffset;
        const spinDuration = Math.random() * 3 + 5; // 5-8 seconds

        await controls.start({
            rotate: targetRotation,
            transition: { duration: spinDuration, ease: [0.25, 1, 0.5, 1] }
        });

        if (spinSoundRef.current) {
            spinSoundRef.current.pause();
            spinSoundRef.current.currentTime = 0;
        }
        winSoundRef.current?.play();
        
        const winningOption = optionArray[randomIndex];
        setResult(winningOption);
        setShowConfetti(true);

        const comment = await generateWittyComment(winningOption);
        setAiComment(comment);
        setIsSpinning(false);
    };
    
    return (
        <div className="p-4 md:p-8 flex flex-col items-center gap-8 w-full relative">
            {showConfetti && <Confetti />}
            <audio ref={spinSoundRef} src="https://cdn.pixabay.com/audio/2022/03/15/audio_2b18a1a39a.mp3" preload="auto" loop />
            <audio ref={winSoundRef} src="https://cdn.pixabay.com/audio/2022/11/17/audio_8222d21a1f.mp3" preload="auto" />
            
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Decision Spinner</h2>
            <div className="w-full max-w-lg">
                <input
                    type="text"
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    placeholder="Enter options, comma separated"
                    className="w-full p-3 bg-white/10 text-white rounded-lg border-2 border-transparent focus:border-purple-400 focus:outline-none placeholder-white/50"
                    disabled={isSpinning}
                />
            </div>
            <div className="relative w-72 h-72 md:w-96 md:h-96 flex justify-center items-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 drop-shadow-lg">
                    <path d="M12 21L3 9L21 9L12 21Z" fill="url(#pointer-gradient)" stroke="#FFFFFF" strokeWidth="1"/>
                    <defs>
                        <linearGradient id="pointer-gradient" x1="12" y1="9" x2="12" y2="21" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#F472B6"/>
                            <stop offset="1" stopColor="#A78BFA"/>
                        </linearGradient>
                    </defs>
                </svg>
                <motion.div
                    className="relative w-full h-full rounded-full border-4 border-white/20 shadow-2xl"
                    animate={controls}
                    style={{ backgroundImage: conicGradient }}
                >
                    {optionArray.map((option, index) => {
                        const angle = index * anglePerSlice + (anglePerSlice / 2);
                        return (
                            <div
                                key={index}
                                className="absolute inset-0 flex justify-center"
                                style={{ transform: `rotate(${angle}deg)` }}
                            >
                                <span
                                    className="absolute text-white font-semibold text-xs md:text-sm truncate"
                                    style={{ top: '10%', transform: `rotate(-${angle}deg)` }}
                                >
                                    {option}
                                </span>
                            </div>
                        );
                    })}
                </motion.div>
            </div>
             <motion.button
                onClick={handleSpin}
                disabled={isSpinning || optionArray.length < 2}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {isSpinning ? 'Spinning...' : 'SPIN'}
            </motion.button>
            <AnimatePresence>
                {result && (
                     <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 15, stiffness: 300 } }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="text-center p-6 bg-white/10 rounded-2xl shadow-lg w-full max-w-md"
                    >
                        <p className="text-white text-xl">The winner is...</p>
                        <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 my-2">{result}</p>
                        <div className="text-white/80 italic min-h-[1.5rem]">
                            {aiComment ? <AiSuggestion text={aiComment} /> : <span className="animate-pulse">...</span>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FocusTimer = () => {
    const FOCUS_TIME = 25 * 60;
    const BREAK_TIME = 5 * 60;

    const [mode, setMode] = useState<'focus' | 'break'>('focus');
    const [timeRemaining, setTimeRemaining] = useState(FOCUS_TIME);
    const [isActive, setIsActive] = useState(false);
    const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('timer-theme', 'dark');
    const [aiMessage, setAiMessage] = useState<string | null>(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isActive && timeRemaining > 0) {
            interval = setInterval(() => {
                setTimeRemaining(time => time - 1);
            }, 1000);
        } else if (timeRemaining === 0) {
            setIsActive(false);
            if (mode === 'focus') {
                setMode('break');
                setTimeRemaining(BREAK_TIME);
                generateMotivationalMessage().then(setAiMessage);
            } else {
                setMode('focus');
                setTimeRemaining(FOCUS_TIME);
                generateMotivationalMessage().then(setAiMessage);
            }
            new Audio('https://www.soundjay.com/buttons/sounds/button-1.mp3').play();
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeRemaining, mode]);

    const toggleTimer = () => setIsActive(!isActive);
    const resetTimer = () => {
        setIsActive(false);
        setTimeRemaining(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
    };

    const handleGetTip = async () => {
        setAiMessage(null); // Clear previous message
        const tip = await generateProductivityTip();
        setAiMessage(tip);
    };
    
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const totalDuration = mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
    const progress = (totalDuration - timeRemaining) / totalDuration;
    
    return (
        <div className={`${theme} transition-colors duration-500 w-full`}>
            <div className="p-4 md:p-8 flex flex-col items-center gap-8 w-full bg-gray-50 dark:bg-transparent min-h-full">
                <div className="absolute top-4 right-4">
                    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center">Focus Timer</h2>
                
                <div className="relative w-64 h-64 md:w-80 md:h-80 flex justify-center items-center">
                    <svg className="absolute w-full h-full transform -rotate-90">
                        <circle cx="50%" cy="50%" r="calc(50% - 10px)" strokeWidth="10" className="stroke-current text-gray-200 dark:text-white/10" fill="transparent"/>
                        <motion.circle
                            cx="50%" cy="50%" r="calc(50% - 10px)"
                            strokeWidth="10"
                            className="stroke-current text-purple-500"
                            fill="transparent"
                            strokeLinecap="round"
                            pathLength="1"
                            strokeDasharray="1"
                            strokeDashoffset={1 - progress}
                            transition={{ duration: 1, ease: "linear" }}
                        />
                    </svg>
                    <div className="z-10 text-center">
                        <p className="text-5xl md:text-6xl font-bold font-mono text-gray-900 dark:text-white">
                            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </p>
                        <p className="text-lg text-gray-500 dark:text-white/60">{mode === 'focus' ? 'Focus' : 'Break'}</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <motion.button onClick={toggleTimer} className="px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-full" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        {isActive ? 'Pause' : 'Start'}
                    </motion.button>
                    <motion.button onClick={resetTimer} className="px-8 py-3 bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white font-bold rounded-full" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        Reset
                    </motion.button>
                </div>
                
                 <motion.button onClick={handleGetTip} className="mt-4 px-6 py-2 border-2 border-purple-400 text-purple-400 font-semibold rounded-full" whileHover={{ scale: 1.05, backgroundColor: '#8B5CF6', color: 'white' }} whileTap={{ scale: 0.95 }}>
                    Get AI Tip
                </motion.button>
                
                <AnimatePresence>
                {aiMessage && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                        className="mt-4 p-4 max-w-md w-full bg-white dark:bg-white/10 rounded-lg shadow-lg text-center"
                    >
                        <div className="text-gray-800 dark:text-white/80 italic"><AiSuggestion text={aiMessage} /></div>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const EmojiStory = () => {
    const [keyword, setKeyword] = useState('');
    const [story, setStory] = useState('');
    const [caption, setCaption] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGenerate = async (promptText: string, type: 'keyword' | 'morning' | 'night' = 'keyword') => {
        if (!promptText.trim() || loading) return;
        setLoading(true);
        setStory('');
        setCaption('');
        setKeyword(promptText);

        const emojiResult = await generateEmojiStory(promptText);
        setStory(emojiResult);

        if (emojiResult && !emojiResult.includes("error")) {
            const captionResult = (type === 'morning' || type === 'night') 
                ? await generateGreetingCaption(type, emojiResult)
                : await generateEmojiCaption(emojiResult);
            setCaption(captionResult);
        }
        setLoading(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleGenerate(keyword, 'keyword');
    };

    const handleShare = () => {
        const textToShare = `${story}\n\n"${caption}"\n\nGenerated by MindSpark ✨`;
        if (navigator.share) {
            navigator.share({
                title: 'Emoji Story',
                text: textToShare,
            });
        } else {
            navigator.clipboard.writeText(textToShare);
            alert('Copied to clipboard!');
        }
    };

    return (
        <div className="p-4 md:p-8 flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Emoji Story Generator</h2>
            
            <div className="w-full p-4 bg-white/5 rounded-2xl shadow-lg">
                <form onSubmit={handleSubmit} className="w-full flex gap-2">
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Enter a keyword (e.g., 'space adventure')"
                        className="flex-grow p-3 bg-white/10 text-white rounded-lg border-2 border-transparent focus:border-purple-400 focus:outline-none placeholder-white/50"
                        disabled={loading}
                    />
                    <motion.button type="submit" disabled={loading} className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-lg disabled:opacity-50" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        {loading ? '...' : 'Go'}
                    </motion.button>
                </form>
                <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                    <span className="text-white/50">Or try a preset:</span>
                    <motion.button onClick={() => handleGenerate('Good morning', 'morning')} disabled={loading} className="px-3 py-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50">☀️ Good Morning</motion.button>
                    <motion.button onClick={() => handleGenerate('Good night', 'night')} disabled={loading} className="px-3 py-1 bg-white/10 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50">🌙 Good Night</motion.button>
                </div>
            </div>
            
            <div className="w-full min-h-[200px] p-6 bg-white/10 rounded-2xl shadow-lg flex flex-col justify-center items-center gap-4 text-center">
                {loading && <div className="text-white animate-pulse">Generating your story...</div>}
                {!loading && !story && (
                    <div className="text-center text-white/60">
                        <EmojiIcon className="w-12 h-12 mx-auto mb-2 opacity-50"/>
                        <p>Enter a keyword or use a preset to begin!</p>
                    </div>
                )}
                {story && (
                    <motion.div className="text-5xl md:text-6xl flex gap-2 md:gap-4 flex-wrap justify-center"
                        initial="hidden" animate="visible" variants={{
                            visible: { transition: { staggerChildren: 0.1 } },
                            hidden: {},
                        }}>
                        {Array.from(story).map((emoji, index) => (
                            <motion.span key={index} variants={{
                                hidden: { opacity: 0, y: 20 },
                                visible: { opacity: 1, y: 0 },
                            }}>{emoji}</motion.span>
                        ))}
                    </motion.div>
                )}
                {caption && <div className="text-white/80 italic text-lg max-w-md"><AiSuggestion text={caption} /></div>}
            </div>
            
             {!loading && caption && (
                <div className="flex gap-4">
                    <motion.button onClick={() => handleGenerate(keyword, 'keyword')} disabled={loading} className="px-6 py-2 bg-white/20 text-white font-semibold rounded-full" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        Generate Again
                    </motion.button>
                    <motion.button onClick={handleShare} className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-full" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        Share
                    </motion.button>
                </div>
            )}
        </div>
    );
};

const GratitudeJournal = () => {
    const [entries, setEntries] = useLocalStorage<GratitudeEntry[]>('gratitude-entries', []);
    const [newEntry, setNewEntry] = useState('');
    const [affirmation, setAffirmation] = useState('');
    const [loading, setLoading] = useState({ affirmation: false, rewrite: null as number | null });
    const [isClearModalOpen, setIsClearModalOpen] = useState(false);

    const handleGetAffirmation = useCallback(async () => {
        setLoading(prev => ({...prev, affirmation: true }));
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const cachedAffirmationItem = localStorage.getItem('mindspark-affirmation');

        if (cachedAffirmationItem) {
            try {
                const cachedAffirmation = JSON.parse(cachedAffirmationItem);
                if (cachedAffirmation.date === today && cachedAffirmation.text) {
                    setAffirmation(cachedAffirmation.text);
                    setLoading(prev => ({...prev, affirmation: false }));
                    return; // Use cached version
                }
            } catch (e) {
                console.error("Could not parse cached affirmation:", e);
                localStorage.removeItem('mindspark-affirmation'); // Clear corrupted data
            }
        }
        
        // If cache is invalid or not for today, fetch a new one
        const newAffirmation = await generateDailyAffirmation();
        setAffirmation(newAffirmation);
        
        // Only cache successful responses
        if (newAffirmation && !newAffirmation.toLowerCase().includes('error') && !newAffirmation.toLowerCase().includes('rate limit')) {
            const newCachedItem = { date: today, text: newAffirmation };
            localStorage.setItem('mindspark-affirmation', JSON.stringify(newCachedItem));
        }
        
        setLoading(prev => ({...prev, affirmation: false }));
    }, []);

    useEffect(() => {
        handleGetAffirmation();
    }, [handleGetAffirmation]);

    const handleAddEntry = () => {
        if (!newEntry.trim()) return;
        const entry: GratitudeEntry = {
            id: Date.now(),
            date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            text: newEntry.trim(),
        };
        setEntries([entry, ...entries]);
        setNewEntry('');
    };
    
    const handleDeleteEntry = (id: number) => {
        setEntries(entries.filter(entry => entry.id !== id));
    };

    const handleRewrite = async (id: number) => {
        const entry = entries.find(e => e.id === id);
        if (!entry) return;
        setLoading(prev => ({...prev, rewrite: id }));
        const rewritten = await rewriteGratitudeEntry(entry.text);
        setEntries(entries.map(e => e.id === id ? { ...e, rewrittenText: rewritten } : e));
        setLoading(prev => ({...prev, rewrite: null }));
    };
    
    const handleClearAll = () => {
        setEntries([]);
        setIsClearModalOpen(false);
    };

    return (
        <>
            <AnimatePresence>
                <Modal
                    isOpen={isClearModalOpen}
                    onClose={() => setIsClearModalOpen(false)}
                    onConfirm={handleClearAll}
                    title="Clear All Entries?"
                >
                    <p>Are you sure you want to delete all your gratitude entries? This action cannot be undone.</p>
                </Modal>
            </AnimatePresence>
            <div className="p-4 md:p-8 flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-4xl font-bold text-white text-center">Gratitude Journal</h2>
                <div className="w-full p-4 bg-white/10 rounded-xl shadow-lg text-center">
                    <p className="text-white/80 mb-2">Daily Affirmation:</p>
                    <div className="text-white italic text-lg min-h-[1.75rem]">
                        {loading.affirmation ? <span className="animate-pulse">...</span> : <AiSuggestion text={affirmation} />}
                    </div>
                </div>
                <div className="w-full flex flex-col gap-2">
                    <textarea
                        value={newEntry}
                        onChange={(e) => setNewEntry(e.target.value)}
                        placeholder="What are you grateful for today?"
                        rows={3}
                        className="w-full p-3 bg-white/10 text-white rounded-lg border-2 border-transparent focus:border-purple-400 focus:outline-none placeholder-white/50"
                    />
                    <motion.button onClick={handleAddEntry} className="self-end px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-full" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        Add Entry
                    </motion.button>
                </div>
                <div className="w-full">
                    <div className="w-full flex-grow overflow-y-auto space-y-4 pr-2 max-h-[45vh]">
                        <AnimatePresence>
                            {entries.map(entry => (
                                <motion.div 
                                    key={entry.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -50 }}
                                    className="p-4 bg-white/5 rounded-xl shadow-md"
                                >
                                    <p className="text-xs text-white/50">{entry.date}</p>
                                    <p className="text-white mt-1">{entry.text}</p>
                                    {entry.rewrittenText && (
                                        <div className="mt-3 pt-3 border-t border-white/10">
                                            <div className="relative p-3 bg-gradient-to-br from-purple-600/20 to-pink-500/20 rounded-lg">
                                                <div className="absolute top-0 left-0 -mt-2 -ml-2 text-xl">✨</div>
                                                <div className="text-sm text-white/90 italic ml-4">
                                                    <AiSuggestion text={entry.rewrittenText} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-3 flex gap-2 justify-end">
                                        <motion.button 
                                            onClick={() => handleRewrite(entry.id)} 
                                            className="text-xs px-3 py-1 bg-purple-500/50 text-white rounded-full disabled:opacity-50"
                                            disabled={loading.rewrite === entry.id}
                                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                            {loading.rewrite === entry.id ? '...' : 'Enhance ✨'}
                                        </motion.button>
                                        <motion.button onClick={() => handleDeleteEntry(entry.id)} className="text-xs px-3 py-1 bg-red-500/50 text-white rounded-full" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                            Delete
                                        </motion.button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    {entries.length > 0 && (
                        <div className="mt-4 flex justify-end">
                            <motion.button
                                onClick={() => setIsClearModalOpen(true)}
                                className="text-sm px-4 py-2 bg-red-500/20 text-red-300 rounded-full"
                                whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.4)' }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Clear All Entries
                            </motion.button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

// END: APP COMPONENTS =======================================================


const apps: AppInfo[] = [
    { name: 'Mood Palette', icon: PaletteIcon, component: MoodPalette },
    { name: 'Decision Spinner', icon: SpinnerIcon, component: DecisionSpinner },
    { name: 'Focus Timer', icon: TimerIcon, component: FocusTimer },
    { name: 'Emoji Story', icon: EmojiIcon, component: EmojiStory },
    { name: 'Gratitude Journal', icon: JournalIcon, component: GratitudeJournal },
];

const Sidebar: React.FC<{ activeApp: AppName; setActiveApp: (name: AppName) => void }> = ({ activeApp, setActiveApp }) => {
    return (
        <aside className="fixed inset-y-0 left-0 z-20 w-20 bg-black/20 backdrop-blur-lg flex flex-col items-center py-8 space-y-6">
            <div className="w-10 h-10" aria-label="MindSpark Logo">
                <img src="/logo.png" alt="MindSpark Logo" />
            </div>
            <nav className="flex flex-col items-center space-y-4">
                {apps.map((app) => (
                    <button
                        key={app.name}
                        onClick={() => setActiveApp(app.name)}
                        className={`p-3 rounded-xl transition-colors duration-300 relative group ${activeApp === app.name ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                        aria-label={app.name}
                    >
                        <app.icon className="w-6 h-6" />
                         <span className="absolute left-full ml-4 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            {app.name}
                        </span>
                    </button>
                ))}
            </nav>
        </aside>
    );
};


export default function App() {
    const [activeApp, setActiveApp] = useState<AppName>('Mood Palette');

    const ActiveAppComponent = apps.find(app => app.name === activeApp)?.component;

    return (
        <main className="min-h-screen bg-gray-900 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white font-sans">
            <Sidebar activeApp={activeApp} setActiveApp={setActiveApp} />
            <div className="ml-20 min-h-screen flex items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeApp}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full flex items-center justify-center"
                    >
                        {ActiveAppComponent && <ActiveAppComponent />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </main>
    );
}
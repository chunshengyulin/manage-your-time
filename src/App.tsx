/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Bell, 
  BellOff, 
  Volume2, 
  VolumeX,
  Calendar as CalendarIcon,
  AlertCircle,
  Upload,
  Music
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface Task {
  id: string;
  text: string;
  time: string; // HH:mm format
  completed: boolean;
  reminded: boolean;
  createdAt: number;
}

const ALARM_SOUNDS = [
  { id: 'classic', name: '经典闹铃', url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73484.mp3' },
  { id: 'digital', name: '电子滴滴', url: 'https://cdn.pixabay.com/audio/2022/03/24/audio_739116668e.mp3' },
  { id: 'chime', name: '清脆铃声', url: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3' },
  { id: 'modern', name: '现代提醒', url: 'https://cdn.pixabay.com/audio/2021/08/04/audio_bb630d7a4f.mp3' },
  { id: 'lofi', name: 'Lofi 节奏', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'upbeat', name: '欢快律动', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 'dreamy', name: '梦幻旋律', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
  { id: 'energetic', name: '活力四射', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' },
  { id: 'custom', name: '自定义上传...', url: '' },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('focusflow_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedSoundId, setSelectedSoundId] = useState(() => {
    return localStorage.getItem('focusflow_sound_id') || 'classic';
  });
  const [customSoundUrl, setCustomSoundUrl] = useState(() => {
    return localStorage.getItem('focusflow_custom_sound') || '';
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeAlarmTask, setActiveAlarmTask] = useState<Task | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showAllCompletedCelebration, setShowAllCompletedCelebration] = useState(false);
  const [lastCompletedTask, setLastCompletedTask] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const victoryAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize audio and check initial notification state
  useEffect(() => {
    const sound = ALARM_SOUNDS.find(s => s.id === selectedSoundId) || ALARM_SOUNDS[0];
    const url = (selectedSoundId === 'custom' && customSoundUrl) ? customSoundUrl : (sound.url || ALARM_SOUNDS[0].url);
    
    audioRef.current = new Audio(url);
    audioRef.current.loop = true;

    // Add error listener to help debug
    audioRef.current.onerror = (e) => {
      console.error("Main Audio Error:", e);
    };

    successAudioRef.current = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3');
    victoryAudioRef.current = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3');

    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Update audio source when selected sound changes
  useEffect(() => {
    if (audioRef.current) {
      const sound = ALARM_SOUNDS.find(s => s.id === selectedSoundId) || ALARM_SOUNDS[0];
      const url = selectedSoundId === 'custom' ? customSoundUrl : sound.url;
      
      if (url) {
        audioRef.current.src = url;
        audioRef.current.load(); // Ensure new source is loaded
        localStorage.setItem('focusflow_sound_id', selectedSoundId);
      }
    }
  }, [selectedSoundId, customSoundUrl]);

  const handleSoundChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedSoundId(newId);

    if (newId === 'custom') {
      fileInputRef.current?.click();
    } else {
      // Preview the sound
      const sound = ALARM_SOUNDS.find(s => s.id === newId);
      if (sound && sound.url && audioRef.current && soundEnabled) {
        const previewAudio = new Audio(sound.url);
        previewAudio.volume = 0.5;
        previewAudio.play().catch(e => console.error("Preview play failed:", e));
        setTimeout(() => {
          previewAudio.pause();
          previewAudio.src = ""; // Clean up
        }, 3000); 
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setCustomSoundUrl(url);
        localStorage.setItem('focusflow_custom_sound', url);
        setSelectedSoundId('custom');
        
        // Preview custom sound
        if (audioRef.current && soundEnabled) {
          const previewAudio = new Audio(url);
          previewAudio.volume = 0.5;
          previewAudio.play().catch(console.error);
          setTimeout(() => previewAudio.pause(), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save tasks to localStorage
  useEffect(() => {
    localStorage.setItem('focusflow_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (!activeAlarmTask) {
        checkReminders(now);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [tasks, notificationsEnabled, soundEnabled, activeAlarmTask]);

  // Check for reminders
  const checkReminders = (now: Date) => {
    const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const taskToRemind = tasks.find(task => !task.completed && !task.reminded && task.time === currentHHmm);
    if (taskToRemind) {
      triggerReminder(taskToRemind);
    }
  };

  const triggerReminder = (task: Task) => {
    // Mark as reminded immediately
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, reminded: true } : t));
    setActiveAlarmTask(task);

    // 1. Sound alert
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
    }

    // 2. Browser notification (for minimized state)
    if (notificationsEnabled && Notification.permission === 'granted') {
      const notification = new Notification('⏰ FocusFlow 任务提醒', {
        body: `时间到了！该去完成：${task.text}`,
        icon: 'https://cdn-icons-png.flaticon.com/512/2098/2098402.png',
        requireInteraction: true,
        tag: 'task-reminder'
      });

      // Clicking notification brings window to front and stops alarm
      notification.onclick = () => {
        window.focus();
        stopAlarm();
        notification.close();
      };
    }

    // 3. System Alert (Crucial for minimized attention)
    // This blocks execution and usually forces the browser icon to flash/pop up
    setTimeout(() => {
      alert(`⏰ 任务提醒：${task.text}\n设定时间：${task.time}`);
    }, 100);
  };

  const stopAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveAlarmTask(null);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('抱歉，您的浏览器不支持桌面通知功能。');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('通知权限已被拒绝。请点击浏览器地址栏左侧的“锁头”图标，手动开启“通知”权限。');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      new Notification('设置成功', { body: '您现在可以接收到任务提醒了！' });
    } else {
      setNotificationsEnabled(false);
    }
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !newTaskTime) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      text: newTaskText,
      time: newTaskTime,
      completed: false,
      reminded: false,
      createdAt: Date.now(),
    };

    setTasks(prev => [...prev, newTask].sort((a, b) => a.time.localeCompare(b.time)));
    setNewTaskText('');
    setNewTaskTime('');
  };

  const triggerAllCompletedCelebration = () => {
    setShowAllCompletedCelebration(true);
    
    // Play victory fanfare
    if (soundEnabled && victoryAudioRef.current) {
      victoryAudioRef.current.currentTime = 0;
      victoryAudioRef.current.play().catch(console.error);
    }

    // Fireworks sequence
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => {
      const newTasks = prev.map(task => {
        if (task.id === id) {
          const newCompleted = !task.completed;
          if (newCompleted) {
            // Play success sound
            if (soundEnabled && successAudioRef.current) {
              successAudioRef.current.currentTime = 0;
              successAudioRef.current.play().catch(console.error);
            }

            // Trigger standard confetti
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444']
            });
            
            // Show success message
            setLastCompletedTask(task.text);
            setShowSuccessMessage(true);
            setTimeout(() => setShowSuccessMessage(false), 3000);
          }
          return { ...task, completed: newCompleted };
        }
        return task;
      });

      // Check if all are completed now
      if (newTasks.length > 0 && newTasks.every(t => t.completed)) {
        // Only trigger if the action was completing a task (not uncompleting)
        const taskThatWasToggled = prev.find(t => t.id === id);
        if (taskThatWasToggled && !taskThatWasToggled.completed) {
          triggerAllCompletedCelebration();
        }
      }

      return newTasks;
    });
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        {/* Header Section */}
        <header className="mb-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-4"
          >
            <CalendarIcon className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl font-bold text-zinc-900 tracking-tight mb-2"
          >
            FocusFlow
          </motion.h1>
          <div className="flex flex-col items-center gap-1">
            <p className="text-zinc-500 font-medium">{formatDate(currentTime)}</p>
            <p className="text-3xl font-mono font-bold text-indigo-600">{formatTime(currentTime)}</p>
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-wrap justify-end gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-zinc-200 shadow-sm">
            <Music className="w-4 h-4 text-indigo-500" />
            <select 
              value={selectedSoundId}
              onChange={handleSoundChange}
              className="text-sm font-medium bg-transparent focus:outline-none cursor-pointer text-zinc-600 pr-2"
            >
              {ALARM_SOUNDS.map(sound => (
                <option key={sound.id} value={sound.id}>
                  {sound.id === 'custom' && customSoundUrl ? '🎵 我的自定义音乐' : sound.name}
                </option>
              ))}
            </select>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="audio/*" 
              className="hidden" 
            />
            {selectedSoundId === 'custom' && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1 hover:bg-zinc-100 rounded-md transition-colors"
                title="更换自定义音乐"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              const testTask: Task = {
                id: 'test-' + Date.now(),
                text: '这是一条测试提醒，检查声音和通知是否正常！',
                time: '--:--',
                completed: false,
                reminded: false,
                createdAt: Date.now()
              };
              triggerReminder(testTask);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">测试闹钟</span>
          </button>
          <button
            onClick={requestNotificationPermission}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              notificationsEnabled 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
            }`}
          >
            {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            <span className="text-sm font-medium">桌面通知</span>
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              soundEnabled 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="text-sm font-medium">提示音</span>
          </button>
        </div>

        {/* Add Task Form */}
        <form onSubmit={addTask} className="glass-card p-6 mb-8 flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">任务内容</label>
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="今天要做什么？"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">时间</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="time"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus className="w-6 h-6" />
          </button>
        </form>

        {/* Task List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {tasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 bg-zinc-100/50 rounded-3xl border-2 border-dashed border-zinc-200"
              >
                <AlertCircle className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500 font-medium">今天还没有计划，开始添加吧！</p>
              </motion.div>
            ) : (
              tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`task-item glass-card p-4 flex items-center gap-4 ${
                    task.completed ? 'opacity-60 grayscale' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`transition-colors ${task.completed ? 'text-emerald-500' : 'text-zinc-300 hover:text-indigo-500'}`}
                  >
                    {task.completed ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-lg truncate ${task.completed ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>
                      {task.text}
                    </h3>
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-sm font-mono font-medium">{task.time}</span>
                      {task.reminded && !task.completed && (
                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">已提醒</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        {tasks.length > 0 && (
          <footer className="mt-8 text-center">
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">
              {tasks.filter(t => t.completed).length} / {tasks.length} 任务已完成
            </p>
          </footer>
        )}
      </div>

      {/* Alarm Modal Overlay */}
      <AnimatePresence>
        {activeAlarmTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/95 backdrop-blur-md"
          >
            {/* Pulsing Screen Flash */}
            <motion.div 
              animate={{ opacity: [0, 0.1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 bg-indigo-500 pointer-events-none"
            />

            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ 
                scale: 1, 
                opacity: 1, 
                rotate: 0,
                x: [0, -5, 5, -5, 5, 0], // Screen shake effect
                transition: { 
                  scale: { type: "spring", damping: 12, stiffness: 100 },
                  x: { duration: 0.4, repeat: Infinity, repeatDelay: 2 }
                }
              }}
              exit={{ scale: 0.5, opacity: 0, rotate: 10 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_0_100px_rgba(79,70,229,0.5)] text-center relative overflow-hidden"
            >
              {/* Dynamic Animated Background Layers */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.4, 1],
                  rotate: [0, 180, 360],
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-500 rounded-full blur-[100px] -z-10"
              />
              <motion.div 
                animate={{ 
                  scale: [1, 1.8, 1],
                  x: [-40, 40, -40],
                  opacity: [0.2, 0.5, 0.2]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-400 rounded-full blur-[100px] -z-10"
              />
              
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [-15, 15, -15],
                  y: [0, -10, 0]
                }}
                transition={{ duration: 0.3, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 rounded-3xl mb-8 shadow-2xl shadow-indigo-300"
              >
                <Bell className="w-14 h-14 text-white drop-shadow-lg" />
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <motion.h2 
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-sm font-black text-indigo-600 uppercase tracking-[0.4em] mb-4"
                >
                  Action Required!
                </motion.h2>
                <p className="text-4xl font-black text-zinc-900 mb-6 leading-[1.1] tracking-tight drop-shadow-sm">
                  {activeAlarmTask.text}
                </p>
                <div className="flex items-center justify-center gap-3 text-zinc-400 mb-10 font-mono text-xl bg-zinc-50 py-4 px-8 rounded-2xl border border-zinc-100 shadow-inner">
                  <Clock className="w-7 h-7 text-indigo-500" />
                  <span className="font-black text-zinc-800">{activeAlarmTask.time}</span>
                </div>
              </motion.div>
              
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
                whileTap={{ scale: 0.95 }}
                onClick={stopAlarm}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-2xl shadow-2xl transition-all text-2xl tracking-widest group flex items-center justify-center gap-4 border-b-4 border-indigo-800"
              >
                <span>DONE</span>
                <CheckCircle2 className="w-8 h-8 text-white group-hover:rotate-12 transition-transform" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All Completed Celebration Modal */}
      <AnimatePresence>
        {showAllCompletedCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-indigo-600/95 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 50, opacity: 0 }}
              className="text-center text-white max-w-lg"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 10, 0],
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-block mb-8"
              >
                <div className="bg-white/20 p-8 rounded-full backdrop-blur-md border border-white/30 shadow-2xl">
                  <CheckCircle2 className="w-24 h-24 text-white" />
                </div>
              </motion.div>
              
              <h2 className="text-5xl font-black mb-6 tracking-tighter leading-tight">
                今日大满贯！
              </h2>
              <p className="text-xl text-indigo-100 mb-12 font-medium leading-relaxed">
                恭喜！您已经完成了今天计划的所有任务。这种自律和执行力简直无懈可击，给自己一个赞吧！
              </p>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAllCompletedCelebration(false)}
                className="bg-white text-indigo-600 font-black px-10 py-5 rounded-2xl text-xl shadow-2xl hover:bg-zinc-50 transition-colors"
              >
                继续保持，明天见
              </motion.button>
            </motion.div>

            {/* Floating Decorative Elements */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ 
                  y: [0, -100, 0],
                  x: [0, Math.random() * 40 - 20, 0],
                  opacity: [0, 0.5, 0],
                  scale: [0, 1, 0]
                }}
                transition={{ 
                  duration: 3 + Math.random() * 2, 
                  repeat: Infinity,
                  delay: i * 0.5
                }}
                className="absolute text-4xl pointer-events-none"
                style={{ 
                  left: `${15 + i * 15}%`, 
                  top: `${20 + (i % 3) * 20}%` 
                }}
              >
                {['✨', '🔥', '🏆', '⭐', '🚀', '👏'][i]}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message Toast */}
      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-zinc-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10">
              <div className="bg-emerald-500 p-2 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">太棒了！</p>
                <p className="font-bold text-lg">已完成：{lastCompletedTask}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

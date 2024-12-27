"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { Moon, Sun, Settings, HelpCircle, Camera, ImageIcon, X, ChevronUp, ChevronDown, Keyboard, List, MousePointer2, Lightbulb, Zap, Clock, Info, LogIn, LogOut } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Toast } from "@/components/ui/toast"
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { pdfjs } from 'react-pdf'
import { ToastProvider } from "@/components/ui/toast"
import { performOCR } from '@/utils/ocr';

// Initialize pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

type Mode = 'typing' | 'multiple-choice' | 'drag-and-drop' | 'guided' | 'challenge'
type Difficulty = 'easy' | 'medium' | 'hard'

const modeConfig: Record<Mode, { icon: React.ReactNode, label: string, description: string }> = {
  'typing': { icon: <Keyboard className="h-5 w-5" />, label: 'Typing', description: 'Fill in the gaps by typing the missing words' },
  'multiple-choice': { icon: <List className="h-5 w-5" />, label: 'Multiple Choice', description: 'Choose the correct word from a list of options' },
  'drag-and-drop': { icon: <MousePointer2 className="h-5 w-5" />, label: 'Drag and Drop', description: 'Drag words to their correct positions' },
  'guided': { icon: <Lightbulb className="h-5 w-5" />, label: 'Guided', description: 'Get hints and guidance as you fill in the gaps' },
  'challenge': { icon: <Zap className="h-5 w-5" />, label: 'Challenge', description: 'Test your skills with timed challenges' }
}

export default function Component() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [text, setText] = useState('')
  const [language, setLanguage] = useState('en')
  const [specialWords, setSpecialWords] = useState('')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [isImageSectionOpen, setIsImageSectionOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('typing')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasTimeLimit, setHasTimeLimit] = useState(false)
  const [timeLimit, setTimeLimit] = useState(5)
  const [remainingTime, setRemainingTime] = useState(timeLimit * 60)
  const [isCountdownActive, setIsCountdownActive] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [ocrResult, setOcrResult] = useState('')
  const [exercise, setExercise] = useState<Array<{ type: 'text' | 'gap'; content?: string; original?: string }>>([])
  const [userAnswers, setUserAnswers] = useState<string[]>([])
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [accuracy, setAccuracy] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [detectedText, setDetectedText] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [ocrLanguage, setOcrLanguage] = useState('deu');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCountdownActive && remainingTime > 0) {
      interval = setInterval(() => {
        setRemainingTime((prevTime) => prevTime - 1);
        setProgress((prevProgress) => prevProgress + (100 / (timeLimit * 60)));
      }, 1000);
    } else if (remainingTime === 0) {
      setIsCountdownActive(false);
      setStatus('Time\'s up!');
      handleSubmitExercise();
    }
    return () => clearInterval(interval);
  }, [isCountdownActive, remainingTime, timeLimit]);

  useEffect(() => {
    if (hasTimeLimit) {
      setRemainingTime(timeLimit * 60);
      setProgress(0);
    }
  }, [hasTimeLimit, timeLimit]);

  const handleGenerateGaps = async () => {
    setStatus('Generating gaps...');
    try {
      const words = text.split(/\s+/)
      const gapCount = Math.floor(words.length * (difficulty === 'easy' ? 0.1 : difficulty === 'medium' ? 0.2 : 0.3))
      const gapIndices = new Set<number>()

      while (gapIndices.size < gapCount) {
        gapIndices.add(Math.floor(Math.random() * words.length))
      }

      const newExercise = words.map((word, index) =>
        gapIndices.has(index) ? { type: 'gap', original: word } : { type: 'text', content: word }
      )

      setExercise(newExercise)
      setUserAnswers(new Array(gapCount).fill(''))
      setStatus('Exercise generated successfully!');
      setGameStarted(true);
      setIsSetupMode(false);
      if (hasTimeLimit) setIsCountdownActive(true);
    } catch (error) {
      setErrorMessage('Failed to generate exercise. Please try again.');
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newImages = Array.from(files).map(file => URL.createObjectURL(file))
      setUploadedImages(prev => [...prev, ...newImages])
      
      // Perform OCR on the first uploaded image
      const formData = new FormData();
      formData.append('image', files[0]);
      try {
        const response = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (!response.ok) throw new Error('OCR failed');
        const result = await response.json();
        setOcrResult(result.text);
        setText(result.text);
      } catch (error) {
        setErrorMessage('OCR failed. Please try uploading the image again.');
      }
    }
  }

  const handleImageUploadForTextDetection = async (imageUrl: string) => {
    try {
      setStatus('Extracting text from image...');
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl, language: ocrLanguage }),
      });
      if (!response.ok) throw new Error('OCR request failed');
      const result = await response.json();
      setDetectedText(result.text);
      setStatus('Text extracted successfully!');
    } catch (error) {
      setErrorMessage('Text extraction failed. Please try again.');
    }
  };


  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  const triggerFileInput = (captureMethod?: 'user' | 'environment') => {
    if (fileInputRef.current) {
      fileInputRef.current.capture = captureMethod || ''
      fileInputRef.current.click()
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  const getModeStyles = (modeType: Mode) => {
    const baseStyles = "relative overflow-hidden rounded-lg p-3 transition-all duration-200 flex flex-col items-center justify-center gap-2 hover:scale-[0.98] active:scale-95"
    const activeStyles = "ring-2 ring-primary ring-offset-2 dark:ring-offset-background"
    
    const modeStyles = {
      'typing': "bg-gradient-to-br from-blue-500/10 to-blue-500/20 hover:from-blue-500/20 hover:to-blue-500/30 dark:from-blue-400/30 dark:to-blue-500/40 dark:hover:from-blue-400/40 dark:hover:to-blue-500/50",
      'multiple-choice': "bg-gradient-to-br from-green-500/10 to-green-500/20 hover:from-green-500/20 hover:to-green-500/30 dark:from-green-400/30 dark:to-green-500/40 dark:hover:from-green-400/40 dark:hover:to-green-500/50",
      'drag-and-drop': "bg-gradient-to-br from-amber-500/10 to-amber-500/20 hover:from-amber-500/20 hover:to-amber-500/30 dark:from-amber-400/30 dark:to-amber-500/40 dark:hover:from-amber-400/40 dark:hover:to-amber-500/50",
      'guided': "bg-gradient-to-br from-purple-500/10 to-purple-500/20 hover:from-purple-500/20 hover:to-purple-500/30 dark:from-purple-400/30 dark:to-purple-500/40 dark:hover:from-purple-400/40 dark:hover:to-purple-500/50",
      'challenge': "bg-gradient-to-br from-red-500/10 to-red-500/20 hover:from-red-500/20 hover:to-red-500/30 dark:from-red-400/30 dark:to-red-500/40 dark:hover:from-red-400/40 dark:hover:to-red-500/50"
    }

    return `${baseStyles} ${modeStyles[modeType]} ${mode === modeType ? activeStyles : ''}`
  }

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) throw new Error('Authentication failed');
      const data = await response.json();
      localStorage.setItem('token', data.token);
      setIsAuthenticated(true);
      setShowAuthModal(false);
    } catch (error) {
      setErrorMessage('Authentication failed. Please try again.');
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  }

  const handleAnswerChange = (index: number, value: string) => {
    setUserAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[index] = value;
      return newAnswers;
    });
  }

  const handleSubmitExercise = async () => {
    try {
      const gaps = exercise.filter(item => item.type === 'gap')
      const correctCount = userAnswers.reduce((count, answer, index) =>
        answer.toLowerCase() === gaps[index].original.toLowerCase() ? count + 1 : count, 0
      )
      const newScore = (correctCount / gaps.length) * 100
      setScore(newScore)
      setAccuracy(newScore)
      setShowResults(true)
    } catch (error) {
      setErrorMessage('Failed to submit exercise. Please try again.');
    }
  }

  const renderExercise = () => {
    if (!exercise.length) return null;

    switch (mode) {
      case 'typing':
        return (
          <div className="space-y-4">
            {exercise.map((item, index) =>
              item.type === 'gap' ? (
                <Input
                  key={index}
                  value={userAnswers[userAnswers.length - exercise.filter(i => i.type === 'gap' && exercise.indexOf(i) <= index).length]}
                  onChange={(e) => handleAnswerChange(userAnswers.length - exercise.filter(i => i.type === 'gap' && exercise.indexOf(i) <= index).length, e.target.value)}
                  className="inline-block w-24 mx-1"
                />
              ) : (
                <span key={index}>{item.content} </span>
              )
            )}
          </div>
        );
      case 'multiple-choice':
        return (
          <div className="space-y-4">
            <div className="prose dark:prose-invert max-w-none">
              {exercise.map((item, index) =>
                item.type === 'gap' ? (
                  <Popover key={index}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="mx-1 min-w-[100px] bg-muted/50"
                      >
                        {userAnswers[userAnswers.length - exercise.filter(i => i.type === 'gap' && exercise.indexOf(i) <= index).length] || '____'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-0">
                      <div className="flex flex-col">
                        {[item.original, ...generateRandomWords(2)].sort(() => Math.random() - 0.5).map((option, optionIndex) => (
                          <Button
                            key={optionIndex}
                            variant="ghost"
                            className="justify-start font-normal"
                            onClick={() => {
                              handleAnswerChange(
                                userAnswers.length - exercise.filter(i => i.type === 'gap' && exercise.indexOf(i) <= index).length,
                                option
                              )
                            }}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span key={index} className="mx-1">{item.content}</span>
                )
              )}
            </div>
          </div>
        );
      case 'drag-and-drop':
        return (
          <DragDropContext onDragEnd={(result) => {
            if (!result.destination) return;
            const newAnswers = Array.from(userAnswers);
            const [reorderedItem] = newAnswers.splice(result.source.index, 1);
            newAnswers.splice(result.destination.index, 0, reorderedItem);
            setUserAnswers(newAnswers);
          }}>
            <div className="space-y-4">
              <Droppable droppableId="text" direction="horizontal">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-wrap gap-2">
                    {exercise.map((item, index) =>
                      item.type === 'gap' ? (
                        <Draggable key={index} draggableId={`gap-${index}`} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="w-24 h-8 bg-secondary rounded flex items-center justify-center"
                            >
                              {userAnswers[userAnswers.length - exercise.filter(i => i.type === 'gap' && exercise.indexOf(i) <= index).length] || '____'}
                            </div>
                          )}
                        </Draggable>
                      ) : (
                        <span key={index}>{item.content} </span>
                      )
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <Droppable droppableId="words" direction="horizontal">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="flex flex-wrap gap-2">
                    {exercise.filter(item => item.type === 'gap').map((item, index) => (
                      <Draggable key={`word-${index}`} draggableId={`word-${index}`} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="p-2 bg-primary text-primary-foreground rounded"
                          >
                            {item.original}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </DragDropContext>
        );
      default:
        return null;
    }
  }

  const generateRandomWords = (count: number) => {
    const randomWords = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon']
    return Array.from({ length: count }, () => randomWords[Math.floor(Math.random() * randomWords.length)])
  }

  return (
    <ToastProvider>
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="max-w-md mx-auto p-4 space-y-6 bg-background text-foreground">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">GapFill Pro</h1>
          <div className="flex items-center space-x-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                  <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Welcome to GapFill Pro!</DialogTitle>
                  <DialogDescription>
                    Learn how to use the app and create engaging gap-fill exercises.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[300px] sm:h-[400px] p-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">1. Enter Your Text</h3>
                      <p className="text-sm text-muted-foreground">Start by entering the text you want to create a gap-fill exercise from in the main text area.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">2. Choose a Mode</h3>
                      <p className="text-sm text-muted-foreground">Select from various modes like Typing, Multiple Choice, Drag and Drop, Guided, or Challenge to customize your exercise.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">3. Set Difficulty</h3>
                      <p className="text-sm text-muted-foreground">Choose the difficulty level for your exercise: Easy, Medium, or Hard.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">4. Set a Time Limit (Optional)</h3>
                      <p className="text-sm text-muted-foreground">If you want to add a time constraint to your exercise, enable the time limit and set the duration.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">5. Add Images (Optional)</h3>
                      <p className="text-sm text-muted-foreground">Enhance your exercise by adding relevant images. You can take photos or choose from your gallery.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">6. Specify AI Focus</h3>
                      <p className="text-sm text-muted-foreground">Use the "AI Focus" feature to guide the AI in selecting specific types of words for your gaps.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">7. Generate Gaps</h3>
                      <p className="text-sm text-muted-foreground">Click the "Generate Gaps" button to create your exercise. The AI will process your text and create gaps based on your settings.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">8. Customize Settings</h3>
                      <p className="text-sm text-muted-foreground">Use the Settings menu to further personalize your experience with notifications, auto-save, and language preferences.</p>
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full"
                  >
                    {isDarkMode ? (
                      <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    ) : (
                      <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    )}
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Toggle {isDarkMode ? 'light' : 'dark'} mode</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>App Settings</DialogTitle>
                  <DialogDescription>
                    Customize your GapFill Pro experience
                  </DialogDescription>
                </DialogHeader>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notifications" className="text-sm font-medium">
                      Notifications
                    </Label>
                    <Switch id="notifications" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-save" className="text-sm font-medium">
                      Auto-save
                    </Label>
                    <Switch id="auto-save" />
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </DialogContent>
            </Dialog>
            {isAuthenticated ? (
              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 sm:h-9 sm:w-9">
                <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setShowAuthModal(true)} className="h-8 w-8 sm:h-9 sm:w-9">
                <LogIn className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
          </div>
        </header>

        {/* Authentication Modal */}
        <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{authMode === 'login' ? 'Login' : 'Register'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">
                {authMode === 'login' ? 'Login' : 'Register'}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="w-full"
              >
                {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Difficulty and AI Focus */}
        {isSetupMode && (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 sm:space-x-2">
              <Select value={difficulty} onValueChange={(value: Difficulty) => setDifficulty(value)}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Info className="h-4 w-4 mr-2" />
                    AI Focus
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>AI Focus</DialogTitle>
                    <DialogDescription>
                      Guide the AI on what to focus on when generating gaps
                    </DialogDescription>
                  </DialogHeader>
                  <div className="p-4 pb-0">
                    <Textarea
                      placeholder="E.g., focus on verbs, avoid nouns, include idiomatic expressions"
                      value={specialWords}
                      onChange={(e) => setSpecialWords(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Timer Section */}
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <Label htmlFor="time-limit-toggle" className="text-sm font-medium flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Time Limit
                </Label>
                <Switch
                  id="time-limit-toggle"
                  checked={hasTimeLimit}
                  onCheckedChange={setHasTimeLimit}
                />
              </div>
              {hasTimeLimit && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{timeLimit} minutes</span>
                    <span className="text-sm font-medium">
                      {isCountdownActive ? formatTime(remainingTime) : formatTime(timeLimit * 60)}
                    </span>
                  </div>
                  <Slider
                    value={[timeLimit]}
                    onValueChange={(value) => setTimeLimit(value[0])}
                    min={1}
                    max={30}
                    step={1}
                    aria-label="Time limit in minutes"
                  />
                  {isCountdownActive && (
                    <Progress value={progress} className="w-full" />
                  )}
                </div>
              )}
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Mode</Label>
              <ScrollArea className="h-[140px] w-full rounded-md border">
                <div className="p-4">
                  {(Object.keys(modeConfig) as Mode[]).map((modeType) => (
                    <button
                      key={modeType}
                      onClick={() => setMode(modeType)}
                      className={`${getModeStyles(modeType)} w-full mb-2 last:mb-0`}
                      aria-label={`Select ${modeConfig[modeType].label} mode`}
                      aria-pressed={mode === modeType}
                    >
                      <div className="flex items-center justify-start w-full">
                        <span className="mr-3">{modeConfig[modeType].icon}</span>
                        <div className="text-left">
                          <span className="font-medium block text-sm sm:text-base">{modeConfig[modeType].label}</span>
                          <span className="text-xs text-muted-foreground">{modeConfig[modeType].description}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* Main Section */}
        <main className="space-y-4">
          {isSetupMode ? (
            <>
              <Textarea
                placeholder="Enter your text here..."
                className="min-h-[150px] resize-y"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Button
                className="w-full py-2 text-lg font-semibold bg-primary hover:bg-primary/90 transition-all duration-200"
                onClick={handleGenerateGaps}
              >
                Generate Gaps
              </Button>
            </>
          ) : (
            <>
              {hasTimeLimit && (
                <div className="flex justify-between items-center">
                  <span>Time Remaining:</span>
                  <span>{formatTime(remainingTime)}</span>
                </div>
              )}
              <Progress value={progress} className="w-full" />
            </>
          )}
          {status && (
            <div className="text-sm text-center font-medium text-primary">{status}</div>
          )}
        </main>

        {/* Exercise Section */}
        {exercise.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-xl font-bold">Your Exercise</h2>
              {renderExercise()}
              <Button onClick={handleSubmitExercise} className="w-full">
                Submit Answers
              </Button>
              <Button onClick={() => {
                setGameStarted(false);
                setExercise([]);
                setUserAnswers([]);
                setShowResults(false);
                setIsCountdownActive(false);
                setRemainingTime(timeLimit * 60);
                setProgress(0);
                setIsSetupMode(true);
              }} className="w-full mt-2">
                New Game
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {showResults && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-xl font-bold">Results</h2>
              <p>Score: {score.toFixed(2)}%</p>
              <p>Accuracy: {accuracy.toFixed(2)}%</p>
              <Button onClick={() => setShowResults(false)} className="w-full">
                Close Results
              </Button>
            </CardContent>
          </Card>
        )}


        {/* Image Upload and Text Detection Section */}
        <Card className="space-y-4">
          <CardContent className="p-4">
            <div className="flex flex-col spacey-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">OCR Text Extraction</h2>
                  <p className="text-sm text-muted-foreground">Powered by Tesseract.js</p>

                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsImageSectionOpen(!isImageSectionOpen)}
                >
                  {isImageSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mb-4">
                <Label htmlFor="ocr-language" className="mb-2 block text-sm font-medium">
                  OCR Language
                </Label>
                <Select value={ocrLanguage} onValueChange={setOcrLanguage}>
                  <SelectTrigger id="ocr-language">
                    <SelectValue placeholder="Select OCR language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deu">German</SelectItem>
                    <SelectItem value="eng">English</SelectItem>
                    <SelectItem value="fra">French</SelectItem>
                    <SelectItem value="spa">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isImageSectionOpen && (
                <>
                  <div className="flex justify-center space-x-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerFileInput('environment')}
                      className="flex-1"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerFileInput()}
                      className="flex-1"
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Upload Image
                    </Button>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    multiple
                  />

                  <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                    <div className="grid grid-cols-2 gap-4">
                      {uploadedImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img src={image} alt={`Uploaded ${index + 1}`} className="w-full h-auto rounded-lg" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            className="w-full mt-2"
                            onClick={() => handleImageUploadForTextDetection(image)}
                          >
                            Extract Text
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {detectedText && (
                    <div className="space-y-2">
                      <Label>Detected Text:</Label>
                      <ScrollArea className="h-[100px] w-full rounded-md border p-4">
                        <p className="whitespace-pre-wrap">{detectedText}</p>
                      </ScrollArea>
                      <Button onClick={() => setText(detectedText)} className="w-full">
                        Use This Text
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Toast */}
        {errorMessage && (
          <Toast>
            <div className="flex items-center space-x-2">
              <X className="h-5 w-5 text-destructive" />
              <span>{errorMessage}</span>
            </div>
          </Toast>
        )}
      </div>
    </div>
    </ToastProvider>
  )
}


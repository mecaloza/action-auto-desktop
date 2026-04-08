import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import VideoContainer from '../components/VideoContainer';
import { RuntineIndicator } from '../components/RuntineIndicator';
import { InfoClass } from '../components/InfoClass';
import { QRContainer } from '../components/QRContainer';
import styles from '../styles/routine.module.scss';
import type { MusicTrack } from '../stores/appStore';

// CDN distributions for load balancing
const CDN_DISTRIBUTIONS = [
  'https://d2pi1lsph7m4xz.cloudfront.net',
  'https://d3rug0yr92b85b.cloudfront.net',
  'https://dwazljzvyhd3l.cloudfront.net',
  'https://dhtacmdviug3h.cloudfront.net',
];

const getRandomCDN = (): string => {
  return CDN_DISTRIBUTIONS[Math.floor(Math.random() * CDN_DISTRIBUTIONS.length)];
};

const getLoadBalancedVideoURL = (originalUrl: string | undefined, selectedCDN: string): string => {
  if (!originalUrl) return '';
  const urlParts = originalUrl.split('.cloudfront.net');
  if (urlParts.length > 1) {
    return `${selectedCDN}${urlParts[1]}`;
  }
  return originalUrl;
};

const Routine: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentRoutine,
    roomName,
    clubName,
    currentExerciseIndex,
    setCurrentExerciseIndex,
  } = useAppStore();

  const [selectedCDN] = useState(getRandomCDN());
  const [exerciseTimer, setExerciseTimer] = useState(0);
  const [classTimeRemaining, setClassTimeRemaining] = useState(3600);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [currentBlock, setCurrentBlock] = useState(1);
  const [showNextExercise, setShowNextExercise] = useState(false);
  const [showGifFollowing, setShowGifFollowing] = useState(false);
  const [showGifRest, setShowGifRest] = useState(false);
  const [domoVideoEnded, setDomoVideoEnded] = useState(false);
  const [showDomoVideo, setShowDomoVideo] = useState(true); // Start true, will check on mount
  const [domoChecked, setDomoChecked] = useState(false); // Track if we've checked whether to show domo
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [musicTrigger, setMusicTrigger] = useState(0); // Used to force music useEffect to re-run
  const [jabCombinationNumbers, setJabCombinationNumbers] = useState<string[]>([]); // Jab punch combination numbers
  const [showNextBlockText, setShowNextBlockText] = useState(false); // "NEXT BLOCK" text overlay for Tonic/Solido REST
  const [showQR, setShowQR] = useState(false); // QR code for attendance signing during WARM UP
  const [appVersion, setAppVersion] = useState('');

  // Check if we should show domo video on mount (only if class just started)
  useEffect(() => {
    if (!currentRoutine?.time_from) {
      // No time_from, don't show domo
      setShowDomoVideo(false);
      setDomoChecked(true);
      return;
    }
    const timeElapsedMs = Date.now() - currentRoutine.time_from;
    // Only show domo if less than 60 seconds have passed since class start
    const shouldShowDomo = timeElapsedMs < 60000;
    console.log('Domo video check - timeElapsed:', timeElapsedMs, 'shouldShow:', shouldShowDomo);
    setShowDomoVideo(shouldShowDomo);
    setDomoChecked(true);
  }, [currentRoutine?.time_from]);

  // Enter fullscreen on mount
  useEffect(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log('Error attempting to enable fullscreen on mount:', err);
      });
    }
  }, []);

  // Toggle fullscreen when clicking RuntineIndicator
  const handleFullScreenClick = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.log('Error attempting to exit fullscreen:', err);
      });
    }
  };

  // Handle left click - close context menu if open
  const handleContainerClick = () => {
    if (showContextMenu) {
      setShowContextMenu(false);
    }
  };

  // Handle right click to show context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default browser context menu
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Exit fullscreen
  const handleExitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.log('Error attempting to exit fullscreen:', err);
      });
    }
  };

  // Handle refresh - stop everything, go back to home
  const handleRefresh = () => {
    // Stop crossfade
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
    if (fadingOutAudioRef.current) { fadingOutAudioRef.current.pause(); fadingOutAudioRef.current.src = ''; fadingOutAudioRef.current = null; }
    // Stop music playing in renderer
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current.src = '';
      musicAudioRef.current = null;
    }
    window.electron.mqtt.setManualMode();
    window.electron.mqtt.disconnect();
    musicPlayingRef.current = false;
    currentMusicIndexRef.current = -1;
    musicInitializedRef.current = false;
    minTrackIndexRef.current = 0;
    navigate('/');
  };

  // Handle logout
  const handleLogout = async () => {
    // Stop crossfade
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
    if (fadingOutAudioRef.current) { fadingOutAudioRef.current.pause(); fadingOutAudioRef.current.src = ''; fadingOutAudioRef.current = null; }
    // Stop music playing in renderer
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current.src = '';
      musicAudioRef.current = null;
    }
    window.electron.mqtt.setManualMode();
    window.electron.mqtt.disconnect();
    musicPlayingRef.current = false;
    currentMusicIndexRef.current = -1;
    musicInitializedRef.current = false;
    minTrackIndexRef.current = 0;
    await window.electron.store.clear();
    window.location.reload();
  };

  // Debug log on mount
  useEffect(() => {
    console.log('=== Routine Page Mounted ===');
    console.log('roomName:', roomName);
    console.log('clubName:', clubName);
    console.log('currentRoutine:', currentRoutine);
    console.log('showDomoVideo initial:', showDomoVideo);
    const timeElapsed = currentRoutine?.time_from ? Date.now() - currentRoutine.time_from : 0;
    console.log('Time elapsed (ms):', timeElapsed);
  }, []);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBeepTimeRef = useRef<number>(-1);
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);
  const domoVideoRef = useRef<HTMLVideoElement>(null);

  // Music player state
  const currentMusicIndexRef = useRef<number>(-1);
  const musicPlayingRef = useRef<boolean>(false);
  const musicInitializedRef = useRef<boolean>(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadingOutAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const forceNextTrackRef = useRef<boolean>(false); // Flag to force immediate track switch
  const minTrackIndexRef = useRef<number>(0); // Minimum track index - prevents going backwards after force-switch

  // Crossfade duration in ms
  const CROSSFADE_MS = 3000;
  const FADE_STEPS = 30; // number of volume steps during fade

  // Get exercises from routine_data (must be defined before using classInfo)
  const classInfo = currentRoutine?.routine_data || [];
  const currentBlockData = classInfo[currentExerciseIndex];
  const nextBlockData = classInfo[currentExerciseIndex + 1];

  // Get music playlist from routine
  const musicPlaylist: MusicTrack[] = currentRoutine?.music_playlist || [];
  console.log('Music playlist length:', musicPlaylist.length);
  if (musicPlaylist.length > 0) {
    console.log('First track:', musicPlaylist[0]?.song_name, musicPlaylist[0]?.s3_url);
  } else {
    console.log('No music_playlist found in routine. Routine keys:', currentRoutine ? Object.keys(currentRoutine) : 'null');
  }

  // Determine class type from routine type, lights_sequence, or room name
  // For Tonic/Solid rooms: lights_sequence === 1 means Tonic, lights_sequence === 2 means Solid
  const routineType = currentRoutine?.type?.toUpperCase() || '';
  const roomLower = roomName?.toLowerCase() || '';
  const firstExerciseLightsSequence = classInfo?.[0]?.lights_sequence;

  // Determine if this is a Tonic or Solid class based on lights_sequence (like original project)
  const isTonicByLights = firstExerciseLightsSequence === 1;
  const isSolidByLights = firstExerciseLightsSequence === 2;

  const getClassType = (): string => {
    // Use routine type first (most accurate)
    if (routineType === 'GIRO') return 'Giro';
    if (routineType === 'BEATS') return 'Beats';
    if (routineType === 'SAVAGE') return 'Savage';
    if (routineType === 'TONIC') return 'Tonic';
    if (routineType === 'SOLID') return 'Solid';
    if (routineType === 'JAB') return 'Jab';
    if (routineType === 'STRIDE') return 'Stride';
    if (routineType === 'BUUM') return 'Buum';
    if (routineType === 'LEVEL') return 'Level';
    // Use lights_sequence for Tonic/Solid rooms (like original project)
    if (roomLower.includes('tonic') || roomLower.includes('solid')) {
      if (isSolidByLights) return 'Solid';
      if (isTonicByLights) return 'Tonic';
    }
    // Fallback to room name
    if (roomLower.includes('giro')) return 'Giro';
    if (roomLower.includes('beats')) return 'Beats';
    if (roomLower.includes('savage')) return 'Savage';
    if (roomLower.includes('tonic')) return 'Tonic';
    if (roomLower.includes('solid')) return 'Solid';
    if (roomLower.includes('jab')) return 'Jab';
    if (roomLower.includes('stride')) return 'Stride';
    if (roomLower.includes('buum')) return 'Buum';
    if (roomLower.includes('level')) return 'Level';
    return 'Rutine';
  };

  const classType = getClassType();

  // Detect class type - use routine type, lights_sequence, or room name
  const isJab = routineType === 'JAB' || roomLower.includes('jab');
  const isStride = routineType === 'STRIDE' || roomLower.includes('stride');
  // For Tonic/Solid: use routine type first, then lights_sequence
  const isTonic = routineType === 'TONIC' || (roomLower.includes('tonic') && isTonicByLights);
  const isSolido = routineType === 'SOLID' || (roomLower.includes('solid') && isSolidByLights) || isSolidByLights;
  const isTonicOrSolido = isTonic || isSolido || roomLower.includes('tonic') || roomLower.includes('solid');
  const isBuum = routineType === 'BUUM' || roomLower.includes('buum');
  const isLevel = routineType === 'LEVEL' || roomLower.includes('level');

  // Giro and Beats are 45 min (2700s), others are 60 min (3600s)
  const totalClassMs = (classType === 'Giro' || classType === 'Beats' ? 2700 : 3600) * 1000;

  // Each block has an "exercises" array with individual exercises (usually 2 for split screen)
  const exerciseDetails = currentBlockData?.exercises || [];
  const exercise1 = exerciseDetails[0];
  const exercise2 = exerciseDetails[1];

  // Next exercise details (for preview)
  const nextExerciseDetails = nextBlockData?.exercises || [];
  const nextExercise1 = nextExerciseDetails[0];
  const nextExercise2 = nextExerciseDetails[1];

  // Get video URLs from the exercises
  const video1Url = exercise1?.video_urls?.[0];
  const video2Url = exercise2?.video_urls?.[0];

  // Next exercise video URLs (for preview)
  const nextVideo1Url = nextExercise1?.video_urls?.[0];
  const nextVideo2Url = nextExercise2?.video_urls?.[0];

  // Determine zone
  const zone = currentBlockData?.zone || exercise1?.zone || '';
  const isRest = zone === 'REST';
  const isWarmup = zone === 'WARM UP';
  const isStretching = zone === 'STRETCHING';

  // For Tonic/Solido: ACTIVE PAUSE is when zone is REST but has a cycle (exerciseCycle)
  // Regular REST is when zone is REST but NO cycle
  // Use blockData.cycle directly for accurate detection (cycle can be 0, undefined, or a positive number)
  const blockCycle = currentBlockData?.cycle;
  const hasExerciseCycle = blockCycle !== undefined && blockCycle !== null && blockCycle !== '' && blockCycle !== 0;
  const isActivePause = isTonicOrSolido && isRest && hasExerciseCycle;
  const isRegularRest = isRest && !isActivePause;

  // Determine if this is an intense moment for volume boost
  // Savage: SAVAGE level, Jab: KNOCKOUT/FREE or combinations, Stride: POWER speed
  const getIntensityLevel = (): 'rest' | 'low' | 'normal' | 'high' => {
    // For Tonic/Solido: ACTIVE PAUSE should have normal volume, not rest volume
    if (isRegularRest) return 'rest';
    if (isActivePause) return 'normal'; // ACTIVE PAUSE keeps normal volume
    if (isWarmup || isStretching) return 'low';

    const exercise1Name = exercise1?.exercise_name?.toUpperCase() || '';
    const exercise2Name = exercise2?.exercise_name?.toUpperCase() || '';
    const speed = exercise1?.variations?.speed?.toUpperCase() || '';
    const combinations = exercise1?.variations?.combinations;

    // Savage room: SAVAGE level = high intensity
    if (roomLower.includes('savage')) {
      if (exercise2Name === 'SAVAGE') return 'high';
      if (exercise2Name === 'MEDIUM') return 'normal';
      return 'normal'; // BASIC
    }

    // Jab room: KNOCKOUT, FREE, or with combinations = high intensity
    if (roomLower.includes('jab')) {
      if (exercise1Name === 'KNOCKOUT' || exercise1Name === 'FREE') return 'high';
      if (combinations && combinations >= 1) return 'high';
      return 'normal';
    }

    // Stride room: POWER speed = high intensity
    if (roomLower.includes('stride')) {
      if (speed === 'POWER') return 'high';
      if (speed === 'MEDIUM') return 'normal';
      return 'normal'; // BASIC
    }

    // Other rooms (Tonic, Solid, etc.)
    return 'normal';
  };

  const intensityLevel = getIntensityLevel();

  // Check if this is US club (Tribeca, FlatIron)
  const isUSClub = clubName === 'Tribeca' || clubName === 'FlatIron';

  // Get domo video URL based on room name and lights_sequence (like original project)
  // For Tonic/Solid rooms: lights_sequence === 1 means Tonic, lights_sequence === 2 means Solid
  const getDomoVideoUrl = (): string => {
    if (roomLower.includes('savage')) {
      return isUSClub
        ? `${selectedCDN}/domoVideos/SavageUS.mp4`
        : `${selectedCDN}/domoVideos/Savage+domo.mp4`;
    }
    if (roomLower.includes('jab')) {
      return isUSClub
        ? `${selectedCDN}/domoVideos/JabUS.mp4`
        : `${selectedCDN}/domoVideos/Jab+domo.mp4`;
    }
    if (roomLower.includes('stride')) {
      return isUSClub
        ? `${selectedCDN}/domoVideos/stride_inlg.mp4`
        : `${selectedCDN}/domoVideos/domo-+stride.mp4`;
    }
    // For Tonic/Solid rooms: use lights_sequence to determine which domo video (like original)
    if (roomLower.includes('tonic') && firstExerciseLightsSequence === 1) {
      return isUSClub
        ? `${selectedCDN}/domoVideos/TonicUS.mp4`
        : `${selectedCDN}/domoVideos/Tonic+domo.mp4`;
    }
    if (roomLower.includes('solid') && firstExerciseLightsSequence === 2) {
      return isUSClub
        ? `${selectedCDN}/domoVideos/SolidoUS.mp4`
        : `${selectedCDN}/domoVideos/Solido+domo.mp4`;
    }
    // Fallback for Tonic/Solid rooms without specific lights_sequence
    if (roomLower.includes('tonic') || roomLower.includes('solid')) {
      // Default to Solido domo (like original project's fallback)
      return isUSClub
        ? `${selectedCDN}/domoVideos/SolidoUS.mp4`
        : `${selectedCDN}/domoVideos/Solido+domo.mp4`;
    }
    return `${selectedCDN}/domoVideos/Solido+domo.mp4`;
  };

  // Handle domo video end
  const handleDomoVideoEnd = () => {
    console.log('Domo video ended');
    setDomoVideoEnded(true);
    setShowDomoVideo(false);
    if (domoVideoRef.current) {
      domoVideoRef.current.style.display = 'none';
    }
  };

  // Handle domo video play - set volume
  const handleDomoVideoPlay = () => {
    if (domoVideoRef.current) {
      domoVideoRef.current.volume = clubName === 'Tribeca' ? 0.5 : 0.4;
    }
  };

  // Get room color - always red for the runtime indicator (matching original)
  const getRoomColor = (): string => {
    return 'red';
  };

  // Calculate time elapsed since class started and sync position
  // duration_sum is CUMULATIVE - it's the end time of each exercise from class start
  const calculateTimeAndSync = useCallback(() => {
    if (!currentRoutine || classInfo.length === 0) return;

    const timeFrom = currentRoutine.time_from; // Scheduled start time in ms
    const now = Date.now();
    const timeElapsedMs = now - timeFrom; // Time transcurred since class start

    // If class hasn't started yet or time_from is invalid, start from beginning
    if (timeElapsedMs < 0 || !timeFrom) {
      setClassTimeRemaining(totalClassMs / 1000);
      // Set first exercise timer
      const firstExerciseDuration = classInfo[0]?.duration_sum || 30000;
      setExerciseTimer(Math.floor(firstExerciseDuration / 1000));
      return;
    }

    // If class is over, end it
    if (timeElapsedMs >= totalClassMs) {
      handleClassEnd();
      return;
    }

    // Calculate total class time remaining
    const timeRemainingMs = totalClassMs - timeElapsedMs;
    setClassTimeRemaining(Math.floor(timeRemainingMs / 1000));

    // Find the correct exercise based on elapsed time
    // duration_sum is cumulative - each block's duration_sum is the END time from class start
    let targetExerciseIndex = 0;

    for (let i = 0; i < classInfo.length; i++) {
      const blockEndTime = classInfo[i].duration_sum || 0; // Cumulative end time in ms
      if (timeElapsedMs < blockEndTime) {
        targetExerciseIndex = i;
        break;
      }
      // If we've passed all exercises, stay on the last one
      if (i === classInfo.length - 1) {
        targetExerciseIndex = classInfo.length - 1;
      }
    }

    // Calculate exercise time remaining
    // Exercise time remaining = block's duration_sum (cumulative end) - time elapsed
    const currentBlockEndTime = classInfo[targetExerciseIndex]?.duration_sum || 0;
    const exerciseTimeRemainingMs = currentBlockEndTime - timeElapsedMs;
    const exerciseTimeRemainingSec = Math.max(0, Math.floor(exerciseTimeRemainingMs / 1000));
    setExerciseTimer(exerciseTimeRemainingSec);

    // Show GIF and next exercise preview logic
    // GIF "following exercise" shows 6-4 seconds before change
    // Next exercise preview shows 4-0 seconds before change
    const targetZone = classInfo[targetExerciseIndex]?.zone || classInfo[targetExerciseIndex]?.exercises?.[0]?.zone;
    const nextZone = classInfo[targetExerciseIndex + 1]?.zone || classInfo[targetExerciseIndex + 1]?.exercises?.[0]?.zone;

    const canShowPreview = targetExerciseIndex < classInfo.length - 1 &&
      targetZone !== 'REST' &&
      targetZone !== 'WARM UP' &&
      targetZone !== 'STRETCHING' &&
      nextZone !== 'REST';

    // Show "following exercise" GIF between 6-4 seconds
    if (exerciseTimeRemainingSec <= 6 && exerciseTimeRemainingSec > 4 && canShowPreview) {
      setShowGifFollowing(true);
      setShowNextExercise(false);
    }
    // Show actual next exercise preview between 4-0 seconds
    else if (exerciseTimeRemainingSec <= 4 && exerciseTimeRemainingSec > 0 && canShowPreview) {
      setShowGifFollowing(false);
      setShowNextExercise(true);
    }
    // Hide both
    else {
      setShowGifFollowing(false);
      setShowNextExercise(false);
    }

    // Show REST GIF during first part of REST (when time > 40 seconds remaining)
    // After 40 seconds, show the next exercise preview instead
    setShowGifRest(targetZone === 'REST' && exerciseTimeRemainingSec > 40);

    // For Tonic/Solido: Show "NEXT BLOCK" text overlay between 40-20 seconds during regular REST
    // This is specific to regular REST (not ACTIVE PAUSE)
    const isTonicOrSolidoRoom = roomLower.includes('tonic') || roomLower.includes('solid');
    const targetBlockCycle = classInfo[targetExerciseIndex]?.cycle;
    const hasTargetCycle = targetBlockCycle !== undefined && targetBlockCycle !== null && targetBlockCycle !== '' && targetBlockCycle !== 0;
    const isTargetActivePause = isTonicOrSolidoRoom && targetZone === 'REST' && hasTargetCycle;
    const isTargetRegularRest = targetZone === 'REST' && !isTargetActivePause;

    // Show "NEXT BLOCK" text between 40-20 seconds during regular REST for Tonic/Solido
    // Also check that next block is not STRETCHING
    const nextBlockZone = classInfo[targetExerciseIndex + 1]?.exercises?.[0]?.zone || classInfo[targetExerciseIndex + 1]?.zone;
    const shouldShowNextBlockText = isTonicOrSolidoRoom &&
      isTargetRegularRest &&
      exerciseTimeRemainingSec <= 40 &&
      exerciseTimeRemainingSec > 20 &&
      nextBlockZone !== 'STRETCHING';
    setShowNextBlockText(shouldShowNextBlockText);

    // Show QR code for attendance during WARM UP phase (first ~7 minutes of class)
    // QR appears when class has started and we're still in WARM UP zone
    const targetZoneForQR = classInfo[targetExerciseIndex]?.zone || classInfo[targetExerciseIndex]?.exercises?.[0]?.zone;
    const isInWarmUp = targetZoneForQR === 'WARM UP';
    // Also show QR during the first 5 minutes (300s) even if not in WARM UP zone
    const isWithinFirst5Min = timeElapsedMs > 0 && timeElapsedMs <= 300000;
    setShowQR(isInWarmUp || isWithinFirst5Min);

    // Update exercise index if different
    if (targetExerciseIndex !== currentExerciseIndex) {
      setCurrentExerciseIndex(targetExerciseIndex);
    }

    // Update cycle and block based on block data
    const targetBlock = classInfo[targetExerciseIndex];
    if (targetBlock?.cycle !== undefined) {
      setCurrentCycle(targetBlock.cycle);
    }
    if (targetBlock?.block !== undefined) {
      setCurrentBlock(targetBlock.block);
    }
  }, [currentRoutine, classInfo, totalClassMs, currentExerciseIndex, setCurrentExerciseIndex]);

  // Handle class end
  const handleClassEnd = useCallback(() => {
    window.electron.mqtt.setManualMode();
    // Stop crossfade
    if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
    if (fadingOutAudioRef.current) { fadingOutAudioRef.current.pause(); fadingOutAudioRef.current.src = ''; fadingOutAudioRef.current = null; }
    // Stop music playing in renderer
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current.src = '';
      musicAudioRef.current = null;
    }
    musicPlayingRef.current = false;
    currentMusicIndexRef.current = -1;
    musicInitializedRef.current = false;
    minTrackIndexRef.current = 0;
    navigate('/');
  }, [navigate]);

  // Initialize and sync with scheduled time
  useEffect(() => {
    // Initial sync
    calculateTimeAndSync();

    // Set up periodic sync every second to keep time accurate
    syncIntervalRef.current = setInterval(() => {
      calculateTimeAndSync();
    }, 1000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [calculateTimeAndSync]);

  // Clean up music on unmount
  useEffect(() => {
    return () => {
      // Stop crossfade
      if (fadeIntervalRef.current) { clearInterval(fadeIntervalRef.current); fadeIntervalRef.current = null; }
      if (fadingOutAudioRef.current) { fadingOutAudioRef.current.pause(); fadingOutAudioRef.current.src = ''; fadingOutAudioRef.current = null; }
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current.src = '';
        musicAudioRef.current = null;
      }
      musicPlayingRef.current = false;
      currentMusicIndexRef.current = -1;
      musicInitializedRef.current = false;
      minTrackIndexRef.current = 0;
    };
  }, []);

  // Fetch app version on mount
  useEffect(() => {
    window.electron.app.getVersion().then(setAppVersion);
  }, []);

  // Unlock audio context on mount - required for Windows Electron autoplay
  useEffect(() => {
    const unlockAudio = () => {
      const silentAudio = new Audio();
      silentAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      silentAudio.volume = 0;
      silentAudio.play().then(() => {
        console.log('Audio context unlocked');
        silentAudio.pause();
      }).catch(() => {});
    };
    unlockAudio();
  }, []);

  // Preload beep sound on mount
  useEffect(() => {
    const beepUrl = `${selectedCDN}/audios/beep.mp3`;
    const beep = new Audio(beepUrl);
    beep.preload = 'auto';
    beep.load();
    beepAudioRef.current = beep;
    console.log('Beep sound preloaded:', beepUrl);
  }, [selectedCDN]);

  // Parse Jab combination numbers from exercise name (e.g., "1 - 2 - 3" -> ["1", "2", "3"])
  useEffect(() => {
    if (isJab && exercise1?.exercise_name) {
      const nameExercise = exercise1.exercise_name;
      const sequenceJab = nameExercise.split('-');
      const numbers: string[] = [];
      sequenceJab.forEach((sequence: string) => {
        const sequenceNum = parseInt(sequence.trim());
        if (!isNaN(sequenceNum)) {
          numbers.push(sequence.trim());
        }
      });
      setJabCombinationNumbers(numbers);
    } else {
      setJabCombinationNumbers([]);
    }
  }, [isJab, exercise1?.exercise_name]);

  // Initialize MQTT connection
  useEffect(() => {
    if (roomName && clubName) {
      window.electron.mqtt.connect({ club: clubName, room: roomName });
      window.electron.mqtt.setAutomaticMode();
    }
    return () => {
      window.electron.mqtt.disconnect();
    };
  }, [roomName, clubName]);

  // Light sequence on exercise change
  useEffect(() => {
    if (currentBlockData?.lights_sequence !== undefined) {
      window.electron.mqtt.publishLightSequence(currentBlockData.lights_sequence);
    }
  }, [currentExerciseIndex, currentBlockData]);

  // Helper: get the audio URL from a music track (s3_url or audio_url)
  const getTrackUrl = useCallback((track: MusicTrack): string | undefined => {
    return track.s3_url || track.audio_url;
  }, []);

  // Helper: convert volume from API scale (0-100) to AudioEngine scale (0-1)
  const normalizeVolume = useCallback((apiVolume: number | undefined): number => {
    if (apiVolume === undefined) return 0.87;
    // API uses 0-100, AudioEngine uses 0-1
    return Math.max(0, Math.min(1, apiVolume / 100));
  }, []);

  // Get volume multiplier based on intensity level
  const getVolumeMultiplier = useCallback((intensity: 'rest' | 'low' | 'normal' | 'high'): number => {
    switch (intensity) {
      case 'rest': return 0.25; // Very low during rest (25%)
      case 'low': return 0.5;   // Low during warmup/stretching (50%)
      case 'normal': return 0.85; // Normal intensity (85%)
      case 'high': return 1.0;  // Maximum during intense moments (100%)
      default: return 0.85;
    }
  }, []);

  // Volume adjustment based on intensity - uses track volume with intensity multiplier
  useEffect(() => {
    if (!musicAudioRef.current) return;
    const currentTrack = musicPlaylist[currentMusicIndexRef.current];
    const baseVolume = normalizeVolume(currentTrack?.volume);
    const multiplier = getVolumeMultiplier(intensityLevel);
    const newVolume = baseVolume * multiplier;
    musicAudioRef.current.volume = newVolume;
    console.log(`Volume adjusted: intensity=${intensityLevel}, multiplier=${multiplier}, volume=${newVolume.toFixed(2)}`);
  }, [intensityLevel, musicPlaylist, normalizeVolume, getVolumeMultiplier]);

  // Music player - sync tracks with class elapsed time using music_playlist duration_sum
  // Runs every second (via classTimeRemaining) to ensure music starts and switches tracks
  useEffect(() => {
    if (!currentRoutine || musicPlaylist.length === 0) return;

    // Don't start music until we've checked if domo should play
    if (!domoChecked) {
      console.log('Music: Waiting for domo check...');
      return;
    }

    // Don't start music while domo video is playing
    if (showDomoVideo && !domoVideoEnded) {
      console.log('Music: Waiting for domo video to finish...');
      return;
    }

    const timeFrom = currentRoutine.time_from;
    const now = Date.now();
    const timeElapsedMs = now - timeFrom;

    if (timeElapsedMs < 0) {
      console.log('Music: Class not started yet, timeElapsedMs:', timeElapsedMs);
      return;
    }

    // Check if we need to force switch to next track (song ended early)
    const forceNext = forceNextTrackRef.current;
    if (forceNext) {
      forceNextTrackRef.current = false; // Reset the flag
    }

    // Find current track based on music_playlist duration_sum (cumulative end time)
    let targetTrackIndex = 0;
    for (let i = 0; i < musicPlaylist.length; i++) {
      const trackEndTime = musicPlaylist[i].duration_sum || 0;
      if (timeElapsedMs < trackEndTime) {
        targetTrackIndex = i;
        break;
      }
      if (i === musicPlaylist.length - 1) {
        targetTrackIndex = musicPlaylist.length - 1;
      }
    }

    // If force next, jump to the next track and update minimum index
    if (forceNext && currentMusicIndexRef.current >= 0) {
      const nextIndex = currentMusicIndexRef.current + 1;
      if (nextIndex < musicPlaylist.length) {
        targetTrackIndex = nextIndex;
        minTrackIndexRef.current = nextIndex; // Prevent going backwards
        console.log('Music: Force switching to next track', targetTrackIndex, '(song ended early), minIndex now:', nextIndex);
      }
    }

    // Never go below the minimum track index (prevents loop after force-switch)
    if (targetTrackIndex < minTrackIndexRef.current) {
      targetTrackIndex = minTrackIndexRef.current;
    }

    // Safety: if targetTrackIndex is beyond playlist, reset to last valid track
    if (targetTrackIndex >= musicPlaylist.length) {
      console.log('Music: SAFETY - targetTrackIndex beyond playlist, resetting to last track');
      targetTrackIndex = musicPlaylist.length - 1;
      minTrackIndexRef.current = targetTrackIndex;
    }

    let track = musicPlaylist[targetTrackIndex];
    let trackUrl = getTrackUrl(track);

    // Skip tracks with 0 duration or no URL, find next valid track
    while ((!trackUrl || track.duration === 0) && targetTrackIndex < musicPlaylist.length - 1) {
      console.log(`Music: Skipping invalid track ${targetTrackIndex}, finding next valid...`);
      targetTrackIndex++;
      track = musicPlaylist[targetTrackIndex];
      trackUrl = getTrackUrl(track);
    }

    if (!trackUrl) {
      // LAST RESORT: Find ANY track with a valid URL from the beginning
      console.log('Music: SAFETY - No valid URL found, searching entire playlist...');
      for (let i = 0; i < musicPlaylist.length; i++) {
        const fallbackTrack = musicPlaylist[i];
        const fallbackUrl = getTrackUrl(fallbackTrack);
        if (fallbackUrl && (fallbackTrack.duration || 0) > 0) {
          targetTrackIndex = i;
          track = fallbackTrack;
          trackUrl = fallbackUrl;
          minTrackIndexRef.current = 0; // Reset min index since we're going back
          console.log(`Music: SAFETY - Found fallback track ${i}: ${track.song_name}`);
          break;
        }
      }
    }

    if (!trackUrl) {
      console.log('Music: ERROR - No playable tracks in entire playlist!');
      return;
    }

    const needsPlay = targetTrackIndex !== currentMusicIndexRef.current ||
      !musicInitializedRef.current ||
      forceNext;

    if (!needsPlay) return; // Already playing the right track

    // If the next track is the same song as the current one, just change volume — don't restart
    const prevTrackIndex = currentMusicIndexRef.current;
    if (
      prevTrackIndex >= 0 &&
      targetTrackIndex !== prevTrackIndex &&
      musicPlaylist[targetTrackIndex]?.song_id === musicPlaylist[prevTrackIndex]?.song_id &&
      musicAudioRef.current && !musicAudioRef.current.paused &&
      !forceNext
    ) {
      const volume = normalizeVolume(track.volume);
      const multiplier = getVolumeMultiplier(intensityLevel);
      const adjustedVolume = volume * multiplier;

      console.log(
        `Music: Same song "${track.song_name}" (index ${prevTrackIndex} → ${targetTrackIndex}), only changing volume to ${adjustedVolume}`
      );

      if (musicAudioRef.current) {
        musicAudioRef.current.volume = adjustedVolume;
      }
      currentMusicIndexRef.current = targetTrackIndex;
      return;
    }

    // When forcing next track, start from the beginning (song_millisecond_start only)
    const prevTrackEnd = targetTrackIndex > 0
      ? (musicPlaylist[targetTrackIndex - 1]?.duration_sum || 0)
      : 0;
    const timeIntoTrack = forceNext ? 0 : Math.max(0, timeElapsedMs - prevTrackEnd);
    const songStartOffset = track.song_millisecond_start || 0;
    let seekPosition = songStartOffset + timeIntoTrack;

    // Check if seek position exceeds track duration - if so, adjust or skip
    const trackDuration = track.duration || 0;
    if (trackDuration > 0 && seekPosition >= trackDuration) {
      console.log(`Music: Seek position ${seekPosition}ms exceeds track duration ${trackDuration}ms`);
      // Try to skip to next track
      if (targetTrackIndex < musicPlaylist.length - 1) {
        minTrackIndexRef.current = targetTrackIndex + 1;
        forceNextTrackRef.current = true;
        setMusicTrigger(prev => prev + 1);
        return;
      } else {
        // Last track - just play from the song start offset instead of skipping
        console.log('Music: Last track, playing from song start offset instead');
        seekPosition = songStartOffset;
      }
    }

    const volume = normalizeVolume(track.volume);
    const multiplier = getVolumeMultiplier(intensityLevel);
    const adjustedVolume = volume * multiplier;

    const isNewTrack = targetTrackIndex !== currentMusicIndexRef.current;
    currentMusicIndexRef.current = targetTrackIndex;
    musicInitializedRef.current = true;
    musicPlayingRef.current = true;

    console.log(
      `Music: ${isNewTrack ? 'Switching to' : 'Initial sync'} track ${targetTrackIndex}` +
      ` "${track.song_name}" by ${track.main_artist}` +
      ` url: ${trackUrl}` +
      ` from ${seekPosition}ms, volume: ${adjustedVolume}` +
      ` (playlist: ${track.playlist_name})`
    );

    // Clear any ongoing fade interval
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    // Kill any previously fading-out audio (from an earlier crossfade)
    if (fadingOutAudioRef.current) {
      fadingOutAudioRef.current.pause();
      fadingOutAudioRef.current.src = '';
      fadingOutAudioRef.current = null;
    }

    // Stop any ongoing crossfade
    if (fadingOutAudioRef.current) {
      fadingOutAudioRef.current.pause();
      fadingOutAudioRef.current.src = '';
      fadingOutAudioRef.current = null;
    }

    // Reuse existing Audio element or create one (only once)
    let audio = musicAudioRef.current;
    if (!audio) {
      audio = new Audio();
      // Listen for track ending - switch to next track
      audio.addEventListener('ended', () => {
        console.log('Music: Track ended naturally, forcing switch to next track');
        forceNextTrackRef.current = true;
        setMusicTrigger(prev => prev + 1);
      });
      // Listen for errors - switch to next track
      audio.addEventListener('error', (e) => {
        console.error('Music: Track failed to load, switching to next track', e);
        forceNextTrackRef.current = true;
        setMusicTrigger(prev => prev + 1);
      });
      musicAudioRef.current = audio;
    }

    // Switch track: stop current, load new source
    audio.pause();
    audio.src = trackUrl;
    audio.currentTime = seekPosition / 1000;
    audio.volume = adjustedVolume;
    audio.play().then(() => {
      console.log('Music: playing successfully');
    }).catch((err: unknown) => {
      console.error('Music: play() FAILED:', err);
    });
  }, [currentExerciseIndex, classTimeRemaining, currentRoutine, musicPlaylist, intensityLevel, getTrackUrl, normalizeVolume, getVolumeMultiplier, musicTrigger, domoChecked, showDomoVideo, domoVideoEnded]);

  // Preload next music track using HTML5 Audio in renderer
  useEffect(() => {
    if (musicPlaylist.length === 0) return;
    const nextTrackIndex = currentMusicIndexRef.current + 1;
    if (nextTrackIndex < musicPlaylist.length) {
      const nextTrack = musicPlaylist[nextTrackIndex];
      const nextUrl = nextTrack?.s3_url || nextTrack?.audio_url;
      if (nextUrl) {
        const preloadAudio = new Audio();
        preloadAudio.preload = 'auto';
        preloadAudio.src = nextUrl;
        // The browser will start buffering; we don't need to keep a reference
      }
    }
  }, [currentExerciseIndex, musicPlaylist]);

  // Play beep sound at 3, 2, 1, 0 seconds before exercise change
  // For Jab: play boxing bell when next exercise is KNOCKOUT or FREE
  useEffect(() => {
    // Skip beeps during warmup, stretching, rest, or last exercise
    if (isWarmup || isStretching || isRest || currentExerciseIndex >= classInfo.length - 1) {
      return;
    }

    // Check if next exercise is KNOCKOUT or FREE (for Jab boxing bell)
    const nextExerciseName = classInfo[currentExerciseIndex + 1]?.exercises?.[0]?.exercise_name;
    const isNextKnockoutOrFree = isJab && (nextExerciseName === 'KNOCKOUT' || nextExerciseName === 'FREE');

    // For Jab KNOCKOUT/FREE: play boxing bell at 0 seconds only
    if (isNextKnockoutOrFree) {
      if (exerciseTimer <= 0 && lastBeepTimeRef.current !== 0) {
        lastBeepTimeRef.current = 0;
        const bellAudio = new Audio(`${selectedCDN}/audios/BELL_SOUND.mp3`);
        bellAudio.volume = 0.5;
        bellAudio.currentTime = 0;
        bellAudio.play().then(() => {
          console.log('Boxing bell played for KNOCKOUT/FREE transition');
        }).catch((err) => {
          console.log('Boxing bell failed to play:', err);
        });
      }
      // Reset lastBeepTime when timer goes above 3 (new exercise started)
      if (exerciseTimer > 3) {
        lastBeepTimeRef.current = -1;
      }
      return; // Skip normal beeps for KNOCKOUT/FREE transitions
    }

    // Normal beep logic: play beep when timer is 3 or less, but only once per second value
    if (exerciseTimer <= 3 && exerciseTimer >= 0 && exerciseTimer !== lastBeepTimeRef.current) {
      lastBeepTimeRef.current = exerciseTimer;

      const volume = clubName === 'Alcala' || clubName === 'OrtegayGasset' || clubName === 'Ventas' ? 0.2 : 0.5;

      // Use preloaded beep or create new one
      if (beepAudioRef.current) {
        beepAudioRef.current.volume = volume;
        beepAudioRef.current.currentTime = 0;
        beepAudioRef.current.play().then(() => {
          console.log('Beep played at', exerciseTimer, 'seconds for exercise index:', currentExerciseIndex);
        }).catch((err) => {
          console.log('Beep failed, creating new audio:', err);
          // Fallback: create new audio
          const fallbackBeep = new Audio(`${selectedCDN}/audios/beep.mp3`);
          fallbackBeep.volume = volume;
          fallbackBeep.play().catch(() => {});
        });
      } else {
        // Fallback if preload didn't work
        const beepAudio = new Audio(`${selectedCDN}/audios/beep.mp3`);
        beepAudio.volume = volume;
        beepAudio.play().then(() => {
          console.log('Beep (fallback) played at', exerciseTimer, 'seconds');
        }).catch((err) => {
          console.log('Beep sound failed to play:', err);
        });
      }
    }

    // Reset lastBeepTime when timer goes above 3 (new exercise started)
    if (exerciseTimer > 3) {
      lastBeepTimeRef.current = -1;
    }
  }, [exerciseTimer, currentExerciseIndex, isWarmup, isStretching, isRest, isJab, classInfo, selectedCDN, clubName]);

  if (!currentRoutine) {
    return (
      <div className={styles.container}>
        <div className={styles.noRoutine}>
          <h1>No routine loaded</h1>
          <button onClick={() => navigate('/')}>Go Back</button>
        </div>
      </div>
    );
  }

  // Render video containers based on current state
  const renderVideos = () => {
    console.log('=== renderVideos called ===');
    console.log('routineType:', routineType);
    console.log('classType:', classType);
    console.log('firstExerciseLightsSequence:', firstExerciseLightsSequence);
    console.log('isTonic:', isTonic, 'isSolido:', isSolido, 'isTonicByLights:', isTonicByLights, 'isSolidByLights:', isSolidByLights);
    console.log('showDomoVideo:', showDomoVideo);
    console.log('domoVideoEnded:', domoVideoEnded);
    console.log('currentExerciseIndex:', currentExerciseIndex);
    console.log('zone:', zone);
    console.log('isWarmup:', isWarmup);
    console.log('isStretching:', isStretching);
    console.log('isRest:', isRest);
    console.log('isActivePause:', isActivePause);
    console.log('isRegularRest:', isRegularRest);
    console.log('currentCycle:', currentCycle);
    console.log('blockCycle:', blockCycle);
    console.log('hasExerciseCycle:', hasExerciseCycle);
    console.log('isTonicOrSolido:', isTonicOrSolido);
    console.log('roomLower:', roomLower);

    // Domo video is now rendered as overlay in main return, skip here
    if (showDomoVideo && !domoVideoEnded) {
      console.log('>>> DOMO VIDEO PLAYING AS OVERLAY <<<');
      // Return empty div as placeholder while overlay is showing
      return <div style={{ height: '61vh' }} />;
    }

    // During warmup or stretching - single video
    if (isWarmup || isStretching) {
      return (
        <div className={styles.warmupContainer}>
          {video1Url ? (
            <VideoContainer
              name="warmup"
              video={getLoadBalancedVideoURL(video1Url, selectedCDN)}
              height="100%"
              width="100%"
            />
          ) : (
            // Show warm_up.mp4 GIF when there's no exercise video
            <VideoContainer
              name="warmupGif"
              video={`${selectedCDN}/text_videos/warm_up.mp4`}
              height="100%"
              width="100%"
            />
          )}
        </div>
      );
    }

    // Show "following exercise" GIF (6-4 seconds before change) - video area only
    if (showGifFollowing) {
      return (
        <div className={styles.videoAreaGifOverlay}>
          <VideoContainer
            name="gifFollowing"
            video={`${selectedCDN}/text_videos/followingExcercise.mp4`}
            height="100%"
            width="100%"
          />
        </div>
      );
    }

    // During REST - check if it's ACTIVE PAUSE (Tonic/Solido) or regular REST
    if (isRest) {
      // ACTIVE PAUSE for Tonic/Solido: show exercise video or "ACTIVE PAUSE" text
      // Active Pause happens when zone is REST but there's an exercise cycle
      if (isActivePause) {
        return (
          <div className={styles.activePauseContainer}>
            {video1Url ? (
              <VideoContainer
                name="activePause"
                video={getLoadBalancedVideoURL(video1Url, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : (
              <p className={styles.bigText}>ACTIVE PAUSE</p>
            )}
          </div>
        );
      }

      // Regular REST: Show REST GIF video first, then preview of next exercise
      // Show REST GIF video - video area only (not covering top/bottom indicators)
      if (showGifRest) {
        return (
          <div className={styles.videoAreaGifOverlay}>
            <VideoContainer
              name="gifRest"
              video={`${selectedCDN}/text_videos/rest.mp4`}
              height="100%"
              width="100%"
            />
          </div>
        );
      }

      // Buum REST preview: show all next exercises in grid
      if (isBuum && nextBlockData) {
        const nextExercises = nextBlockData.exercises || [];
        return (
          <div className={styles.buumContainer}>
            {nextExercises.map((exercise: any, index: number) => {
              const exVideo = exercise?.video_urls?.[0];
              return (
                <React.Fragment key={index}>
                  {index > 0 && <div className={styles.dividerLine}></div>}
                  <div className={styles.buumExerciseWrapper}>
                    <h2 className={styles.exerciseName}>
                      <div className={styles.nameContainer}>
                        <span>{exercise?.exercise_name || ''}</span>
                      </div>
                    </h2>
                    {exVideo ? (
                      <VideoContainer
                        name={`buum-next-${index}`}
                        video={getLoadBalancedVideoURL(exVideo, selectedCDN)}
                        height="100%"
                        width="100%"
                      />
                    ) : (
                      <div className={styles.noVideo}>
                        <p>{exercise?.exercise_name || ''}</p>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        );
      }

      // Level REST preview: show next 3 zones
      if (isLevel && nextBlockData) {
        const nextExercises = nextBlockData.exercises || [];
        const nextReformer = nextExercises[2];
        const nextMatt = nextExercises[0];
        const nextPulley = nextExercises[1];
        return (
          <div className={styles.levelContainer}>
            <div className={styles.levelZone}>
              <div className={styles.levelZoneLabel}>REFORMER</div>
              {nextReformer?.video_urls?.[0] ? (
                <VideoContainer
                  name="level-next-reformer"
                  video={getLoadBalancedVideoURL(nextReformer.video_urls[0], selectedCDN)}
                  height="100%" width="100%"
                />
              ) : (
                <div className={styles.noVideo}><p>{nextReformer?.exercise_name || 'REFORMER'}</p></div>
              )}
            </div>
            <div className={styles.levelDividerLine}></div>
            <div className={styles.levelZone}>
              <div className={styles.levelZoneLabel}>MATT</div>
              {nextMatt?.video_urls?.[0] ? (
                <VideoContainer
                  name="level-next-matt"
                  video={getLoadBalancedVideoURL(nextMatt.video_urls[0], selectedCDN)}
                  height="100%" width="100%"
                />
              ) : (
                <div className={styles.noVideo}><p>{nextMatt?.exercise_name || 'MATT'}</p></div>
              )}
            </div>
            <div className={styles.levelDividerLine}></div>
            <div className={styles.levelZone}>
              <div className={styles.levelZoneLabel}>PULLEY</div>
              {nextPulley?.video_urls?.[0] ? (
                <VideoContainer
                  name="level-next-pulley"
                  video={getLoadBalancedVideoURL(nextPulley.video_urls[0], selectedCDN)}
                  height="100%" width="100%"
                />
              ) : (
                <div className={styles.noVideo}><p>{nextPulley?.exercise_name || 'PULLEY'}</p></div>
              )}
            </div>
          </div>
        );
      }

      // Show next exercise preview during REST (after GIF) - standard 2-video
      if (nextBlockData) {
      return (
        <div
          className={styles.videosContainer}
          style={(isJab || isStride) ? { flexDirection: 'row-reverse' } : undefined}
        >
          {/* Left video - next exercise preview */}
          <div className={styles.videoWrapper}>
            <h2 className={styles.exerciseName}>
              <div className={styles.nameContainer}>
                <span>{nextExercise1?.exercise_name || ''}</span>
              </div>
            </h2>
            {nextVideo1Url ? (
              <VideoContainer
                name="nextExercise1"
                video={getLoadBalancedVideoURL(nextVideo1Url, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : (
              <div className={styles.noVideo}>
                <p>{nextExercise1?.exercise_name || ''}</p>
              </div>
            )}
          </div>

          <div className={styles.dividerLine}></div>

          {/* Right video - next exercise preview */}
          <div className={styles.videoWrapper}>
            <h2 className={styles.exerciseName}>
              <div className={styles.nameContainer}>
                <span>{nextExercise2?.exercise_name || ''}</span>
              </div>
            </h2>
            {nextVideo2Url ? (
              <VideoContainer
                name="nextExercise2"
                video={getLoadBalancedVideoURL(nextVideo2Url, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : nextExercise2?.exercise_name ? (
              <div className={styles.noVideo}>
                <p>{nextExercise2.exercise_name}</p>
              </div>
            ) : null}
          </div>
        </div>
      );
      }

      // No next block data during REST - show text
      return (
        <div className={styles.textContainer}>
          <p className={styles.bigText}>REST</p>
        </div>
      );
    }

    // Show next exercise preview (4 seconds before switching)
    if (showNextExercise && nextBlockData) {
      return (
        <div
          className={styles.videosContainer}
          style={(isJab || isStride) ? { flexDirection: 'row-reverse' } : undefined}
        >
          {/* Left video - next exercise preview */}
          <div className={styles.videoWrapper}>
            <h2 className={styles.exerciseName}>
              <div className={styles.nameContainer}>
                <span>{nextExercise1?.exercise_name || ''}</span>
              </div>
            </h2>
            {nextVideo1Url ? (
              <VideoContainer
                name="nextExercise1"
                video={getLoadBalancedVideoURL(nextVideo1Url, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : (
              <div className={styles.noVideo}>
                <p>{nextExercise1?.exercise_name || ''}</p>
              </div>
            )}
          </div>

          <div className={styles.dividerLine}></div>

          {/* Right video - next exercise preview */}
          <div className={styles.videoWrapper}>
            <h2 className={styles.exerciseName}>
              <div className={styles.nameContainer}>
                <span>{nextExercise2?.exercise_name || ''}</span>
              </div>
            </h2>
            {nextVideo2Url ? (
              <VideoContainer
                name="nextExercise2"
                video={getLoadBalancedVideoURL(nextVideo2Url, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : nextExercise2?.exercise_name ? (
              <div className={styles.noVideo}>
                <p>{nextExercise2.exercise_name}</p>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    // === BUUM: Multi-exercise grid (up to 7 exercises) ===
    if (isBuum) {
      return (
        <div className={styles.buumContainer}>
          {exerciseDetails.map((exercise: any, index: number) => {
            const exVideo = exercise?.video_urls?.[0];
            return (
              <React.Fragment key={index}>
                {index > 0 && <div className={styles.dividerLine}></div>}
                <div className={styles.buumExerciseWrapper}>
                  {exVideo ? (
                    <VideoContainer
                      name={`buum-exercise-${index}`}
                      video={getLoadBalancedVideoURL(exVideo, selectedCDN)}
                      height="100%"
                      width="100%"
                    />
                  ) : (
                    <div className={styles.noVideo}>
                      <p>{exercise?.exercise_name || ''}</p>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          {/* Vertical info panel on the right */}
          <div className={styles.dividerLine}></div>
          <div className={styles.buumInfoPanel}>
            <div className={styles.buumInfoItem}>
              <span className={styles.buumInfoLabel}>BLOCK</span>
              <span className={styles.buumInfoValue}>
                {currentBlock >= 10 ? currentBlock : `0${currentBlock || 0}`}
              </span>
              <div className={styles.buumInfoDivider}></div>
            </div>
            <div className={styles.buumInfoItem}>
              <span className={styles.buumInfoLabel}>CYCLES</span>
              <span className={styles.buumInfoValue}>
                0{currentCycle || 0}
              </span>
              <div className={styles.buumInfoDivider}></div>
            </div>
            <div className={styles.buumInfoItem}>
              <span className={styles.buumInfoLabel}>TIME</span>
              <span className={styles.buumInfoValue}>
                {Math.floor(exerciseTimer / 60).toString().padStart(2, '0')}:
                {Math.floor(exerciseTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // === LEVEL: 3-zone layout (Reformer + Matt + Pulley) ===
    if (isLevel) {
      const reformerExercise = exerciseDetails[2]; // exercises[2] = REFORMER
      const mattExercise = exerciseDetails[0];      // exercises[0] = MATT
      const pulleyExercise = exerciseDetails[1];    // exercises[1] = PULLEY
      const reformerVideo = reformerExercise?.video_urls?.[0];
      const mattVideo = mattExercise?.video_urls?.[0];
      const pulleyVideo = pulleyExercise?.video_urls?.[0];

      return (
        <div className={styles.levelContainer}>
          {/* Left info panel */}
          <div className={styles.levelInfoPanel}>
            <div className={styles.buumInfoItem}>
              <span className={styles.buumInfoLabel}>BLOCK</span>
              <span className={styles.buumInfoValue}>
                {currentBlock >= 10 ? currentBlock : `0${currentBlock || 0}`}
              </span>
              <div className={styles.buumInfoDivider}></div>
            </div>
            <div className={styles.buumInfoItem}>
              <span className={styles.buumInfoLabel}>CYCLES</span>
              <span className={styles.buumInfoValue}>
                0{currentCycle || 0}
              </span>
              <div className={styles.buumInfoDivider}></div>
            </div>
            <div className={styles.buumInfoItem}>
              <span className={styles.buumInfoLabel}>TIME</span>
              <span className={styles.buumInfoValue}>
                {Math.floor(exerciseTimer / 60).toString().padStart(2, '0')}:
                {Math.floor(exerciseTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* REFORMER zone */}
          <div className={styles.levelZone}>
            <div className={styles.levelZoneLabel}>REFORMER</div>
            {reformerVideo ? (
              <VideoContainer
                name="level-reformer"
                video={getLoadBalancedVideoURL(reformerVideo, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : (
              <div className={styles.noVideo}>
                <p>{reformerExercise?.exercise_name || 'REFORMER'}</p>
              </div>
            )}
          </div>

          <div className={styles.levelDividerLine}></div>

          {/* MATT zone */}
          <div className={styles.levelZone}>
            <div className={styles.levelZoneLabel}>MATT</div>
            {mattVideo ? (
              <VideoContainer
                name="level-matt"
                video={getLoadBalancedVideoURL(mattVideo, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : (
              <div className={styles.noVideo}>
                <p>{mattExercise?.exercise_name || 'MATT'}</p>
              </div>
            )}
          </div>

          <div className={styles.levelDividerLine}></div>

          {/* PULLEY zone */}
          <div className={styles.levelZone}>
            <div className={styles.levelZoneLabel}>PULLEY</div>
            {pulleyVideo ? (
              <VideoContainer
                name="level-pulley"
                video={getLoadBalancedVideoURL(pulleyVideo, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : (
              <div className={styles.noVideo}>
                <p>{pulleyExercise?.exercise_name || 'PULLEY'}</p>
              </div>
            )}
          </div>

          {/* Fitness level indicators */}
          <div className={styles.levelIndicators}>
            <div className={styles.levelIndicatorGroup}>
              <span className={styles.levelIndicatorCategory}>AMATEUR</span>
              <span className={styles.levelIndicatorDifficulty}>LOW</span>
            </div>
            <div className={styles.levelIndicatorGroup}>
              <span className={styles.levelIndicatorCategory}>FITNESS</span>
              <span className={styles.levelIndicatorDifficulty}>MEDIUM</span>
            </div>
            <div className={styles.levelIndicatorGroup}>
              <span className={styles.levelIndicatorCategory}>PRO</span>
              <span className={styles.levelIndicatorDifficulty}>HIGH</span>
            </div>
            <div className={styles.levelCircles}>
              <div className={styles.levelCircle} style={{ borderColor: '#FFD600' }}>EASY</div>
              <div className={styles.levelCircle} style={{ borderColor: '#00BFFF' }}>MEDIUM</div>
              <div className={styles.levelCircle} style={{ borderColor: '#FF0000' }}>HARD</div>
            </div>
          </div>
        </div>
      );
    }

    // Check if Jab KNOCKOUT or FREE mode
    const isKnockoutOrFree = isJab && (exercise1?.exercise_name === 'KNOCKOUT' || exercise1?.exercise_name === 'FREE');

    // Normal split screen - NO name overlay during normal playback
    return (
      <div
        className={styles.videosContainer}
        style={(isJab || isStride) ? { flexDirection: 'row-reverse' } : undefined}
      >
        {/* Left video - In Jab, show KNOCKOUT/FREE text or video with combination numbers */}
        {isKnockoutOrFree ? (
          <div className={styles.knockoutContainer}>
            <p>{exercise1?.exercise_name}</p>
          </div>
        ) : (
          <div className={styles.videoWrapper}>
            {/* Jab combination numbers overlay */}
            {isJab && jabCombinationNumbers.length > 0 && (
              <div className={styles.jabCombinationContainer}>
                {jabCombinationNumbers.map((num, index) => (
                  <div key={index} className={styles.jabCombinationNumber}>
                    {num}
                  </div>
                ))}
              </div>
            )}
            {video1Url ? (
              <VideoContainer
                name="exercise1"
                video={getLoadBalancedVideoURL(video1Url, selectedCDN)}
                height="100%"
                width="100%"
              />
            ) : (
              <div className={styles.noVideo}>
                <p>{exercise1?.exercise_name || 'Exercise 1'}</p>
              </div>
            )}
          </div>
        )}

        <div className={styles.dividerLine}></div>

        {/* Right video */}
        <div className={styles.videoWrapper}>
          {video2Url ? (
            <VideoContainer
              name="exercise2"
              video={getLoadBalancedVideoURL(video2Url, selectedCDN)}
              height="100%"
              width="100%"
            />
          ) : exercise2?.exercise_name ? (
            <div className={styles.noVideo}>
              <p>{exercise2.exercise_name}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // Check if domo video is currently playing (full screen mode)
  const isDomoPlaying = showDomoVideo && !domoVideoEnded;

  // Domo video overlay - rendered via portal to body for true fullscreen
  const domoVideoOverlay = isDomoPlaying
    ? ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999,
            backgroundColor: '#000',
          }}
        >
          <video
            ref={domoVideoRef}
            autoPlay
            playsInline
            preload="auto"
            onEnded={handleDomoVideoEnd}
            onPlay={() => {
              console.log('Domo video onPlay fired');
              handleDomoVideoPlay();
            }}
            onLoadStart={() => console.log('Domo video onLoadStart')}
            onCanPlay={() => console.log('Domo video onCanPlay')}
            onError={(e) => {
              console.error('Domo video error:', e);
              console.error('Video element:', domoVideoRef.current);
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          >
            <source src={getDomoVideoUrl()} type="video/mp4" />
          </video>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={styles.container} onClick={handleContainerClick} onContextMenu={handleContextMenu}>
      {/* Domo video overlay - rendered via portal */}
      {domoVideoOverlay}

      {/* Context menu - right click */}
      {showContextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={styles.contextMenuItem}
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(false);
              handleExitFullscreen();
            }}
          >
            Exit Fullscreen
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(false);
              handleRefresh();
            }}
          >
            Refresh
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(false);
              handleLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}

      {/* "NEXT BLOCK" text overlay for Tonic/Solido during REST preview */}
      {showNextBlockText && (
        <div className={styles.nextBlockTextContainer}>
          <p>NEXT BLOCK</p>
        </div>
      )}

      {/* QR Code for attendance - shows during WARM UP / first 5 minutes */}
      {showQR && currentRoutine?.type && (
        <div className={styles.routineQRContainer}>
          <QRContainer classType={currentRoutine.type} />
        </div>
      )}

      {/* RuntineIndicator at top - click to toggle fullscreen */}
      <RuntineIndicator
        timeClass={classTimeRemaining}
        typeClass={classType}
        color={getRoomColor()}
        onClick={handleFullScreenClick}
      />

      {/* Main video area */}
      {renderVideos()}

      {/* InfoClass at bottom */}
      <InfoClass
        block={currentBlock}
        cycle={currentCycle}
        timeExercise={exerciseTimer}
        roomType={roomName}
        exerciseNames={exerciseDetails}
      />

      {/* Version label - small in bottom-right corner */}
      {appVersion && (
        <span style={{
          position: 'absolute',
          bottom: 4,
          right: 8,
          fontSize: '0.65rem',
          color: 'rgba(255,255,255,0.3)',
          pointerEvents: 'none',
          zIndex: 1,
        }}>v{appVersion}</span>
      )}
    </div>
  );
};

export default Routine;

import { create } from 'zustand';

export interface RoutineData {
  time_from: number;
  type: string;
  routine_data: Exercise[];
  music_playlist?: MusicTrack[];
  voice_over_routine?: VoiceOver[];
}

export interface Exercise {
  video_urls?: string[];
  duration_sum: number;
  lights_sequence: number;
  zone?: string;
  exercises?: ExerciseDetail[];
}

export interface ExerciseDetail {
  name: string;
  exercise_name?: string;
  duration: number;
  zone?: string;
  inclination?: number;
  speed?: number;
  rpm?: number;
  position?: string;
  video_urls?: string[];
  variations?: {
    inclination?: number;
    speed?: string;
    grip?: number;
    combinations?: number;
  };
}

export interface MusicTrack {
  audio_url?: string;
  s3_url?: string;
  song_id?: string;
  song_millisecond_start?: number;
  volume?: number;
  duration?: number;
  duration_sum?: number;
  playlist_name?: string;
  song_name?: string;
  main_artist?: string;
  all_artists?: string;
  picture_url?: string;
}

export interface VoiceOver {
  url: string;
  time: number;
}

interface AppState {
  // Auth state
  isLoggedIn: boolean;
  token: string | null;

  // Room state
  roomId: string | null;
  roomName: string | null;
  clubName: string | null;
  classType: string | null;

  // Routine state
  routines: RoutineData[];
  currentRoutine: RoutineData | null;
  currentExerciseIndex: number;
  timeRemaining: number;

  // Connection state
  mqttConnected: boolean;

  // Actions
  login: (token: string, roomId: string, roomName: string, clubName: string) => void;
  logout: () => void;
  setRoutines: (routines: RoutineData[]) => void;
  setCurrentRoutine: (routine: RoutineData | null) => void;
  setCurrentExerciseIndex: (index: number) => void;
  setTimeRemaining: (time: number) => void;
  setMqttConnected: (connected: boolean) => void;
  setClassType: (type: string) => void;
  nextExercise: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  isLoggedIn: false,
  token: null,
  roomId: null,
  roomName: null,
  clubName: null,
  classType: null,
  routines: [],
  currentRoutine: null,
  currentExerciseIndex: 0,
  timeRemaining: 0,
  mqttConnected: false,

  // Actions
  login: (token, roomId, roomName, clubName) =>
    set({
      isLoggedIn: true,
      token,
      roomId,
      roomName,
      clubName,
    }),

  logout: () =>
    set({
      isLoggedIn: false,
      token: null,
      roomId: null,
      roomName: null,
      clubName: null,
      routines: [],
      currentRoutine: null,
      currentExerciseIndex: 0,
    }),

  setRoutines: (routines) => set({ routines }),

  setCurrentRoutine: (routine) =>
    set({
      currentRoutine: routine,
      currentExerciseIndex: 0,
    }),

  setCurrentExerciseIndex: (index) => set({ currentExerciseIndex: index }),

  setTimeRemaining: (time) => set({ timeRemaining: time }),

  setMqttConnected: (connected) => set({ mqttConnected: connected }),

  setClassType: (type) => set({ classType: type }),

  nextExercise: () => {
    const { currentRoutine, currentExerciseIndex } = get();
    if (currentRoutine && currentExerciseIndex < currentRoutine.routine_data.length - 1) {
      set({ currentExerciseIndex: currentExerciseIndex + 1 });
    }
  },
}));

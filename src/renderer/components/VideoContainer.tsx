import React, { useRef, useEffect, useCallback, useState } from 'react';
import styles from '../styles/videoContainer.module.scss';

interface VideoContainerProps {
  name?: string;
  video: string;
  height?: string;
  width?: string;
  muted?: boolean;
}

const VideoContainer: React.FC<VideoContainerProps> = ({
  name,
  video,
  height = '100%',
  width = '49%',
  muted = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryCountRef = useRef<number>(0);
  const errorCountRef = useRef<number>(0); // Track total errors to avoid spam
  const maxRetries = 3;
  const maxErrorLogs = 3; // Only log first few errors to avoid console spam
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasAudioError, setHasAudioError] = useState(false); // Track if audio-related error occurred

  const handleVideoClick = () => {
    const videoElement = videoRef.current;
    if (videoElement) {
      if (videoElement.paused) {
        videoElement.play().catch(() => {});
      } else {
        videoElement.pause();
      }
    }
  };

  // Try to recover video playback
  const recoverPlayback = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    retryCountRef.current++;

    if (retryCountRef.current <= maxRetries) {
      console.log(`VideoContainer [${name}]: Attempting recovery (attempt ${retryCountRef.current}/${maxRetries})`);
      // Try to reload and play
      const currentTime = videoElement.currentTime;
      videoElement.load();
      videoElement.currentTime = currentTime > 0 ? currentTime : 0;
      videoElement.play().catch(() => {
        // Silent catch - avoid spamming console
      });
    }
    // After max retries, stop trying - video may have persistent codec issue
  }, [name]);

  // Handle video error
  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoElement = e.currentTarget;
    const error = videoElement.error;
    const errorMessage = error?.message || '';

    errorCountRef.current++;

    // Check if it's an audio decoding error - these are common with muted videos
    // and don't actually affect video playback
    const isAudioError = errorMessage.includes('audio') ||
                         errorMessage.includes('PIPELINE_ERROR_DECODE');

    // Only log first error per video to identify problematic files
    if (errorCountRef.current === 1) {
      // Extract just the filename from the URL for cleaner logging
      const urlParts = video.split('/');
      const filename = urlParts[urlParts.length - 1];

      if (isAudioError) {
        console.warn(`⚠️ PROBLEMATIC VIDEO (audio codec issue): ${filename}`);
        console.warn(`   Full URL: ${video}`);
        console.warn(`   Fix with: ffmpeg -i "${filename}" -an -c:v copy "${filename.replace('.mp4', '_fixed.mp4')}"`);
      } else {
        console.error(`❌ VIDEO ERROR [${name}]: code=${error?.code}, message=${errorMessage}`);
        console.error(`   URL: ${video}`);
      }
    }

    if (isAudioError && muted) {
      // For muted videos with audio errors, just mark it and don't keep retrying
      // The video often plays fine despite the audio error
      setHasAudioError(true);

      // Still try to play - the video track may work fine
      videoElement.play().catch(() => {});
      return;
    }

    // For other errors, try recovery (but limited times)
    if (retryCountRef.current < maxRetries) {
      recoverPlayback();
    }
  }, [name, video, muted, recoverPlayback]);

  // Handle stalled playback
  const handleStalled = useCallback(() => {
    // Only recover if we haven't exceeded retries
    if (retryCountRef.current < maxRetries) {
      console.log(`VideoContainer [${name}]: Video stalled, attempting recovery...`);
      recoverPlayback();
    }
  }, [name, recoverPlayback]);

  // Handle waiting (buffering) - only log occasionally
  const handleWaiting = useCallback(() => {
    // Suppress excessive waiting logs
  }, []);

  // Handle successful play - reset retry counter
  const handlePlaying = useCallback(() => {
    if (retryCountRef.current > 0) {
      console.log(`VideoContainer [${name}]: Video recovered and playing`);
    }
    retryCountRef.current = 0;
  }, [name]);

  // Periodic check to ensure video is still playing
  useEffect(() => {
    const checkVideoHealth = () => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      // Don't spam recovery attempts if we have audio errors (video may be playing fine)
      if (hasAudioError && !videoElement.paused) {
        return; // Video is playing despite audio error, that's fine
      }

      // Check if video should be playing but isn't
      const isStuck = !videoElement.paused &&
                      !videoElement.ended &&
                      videoElement.readyState < 3 && // HAVE_FUTURE_DATA
                      videoElement.currentTime > 0;

      // Also check if video is paused when it shouldn't be (and not at the end)
      const isUnexpectedlyPaused = videoElement.paused &&
                                    !videoElement.ended &&
                                    videoElement.readyState >= 2;

      if (isStuck || isUnexpectedlyPaused) {
        console.log(`VideoContainer [${name}]: Health check failed - stuck: ${isStuck}, unexpectedlyPaused: ${isUnexpectedlyPaused}, readyState: ${videoElement.readyState}`);

        // Try to resume playback
        videoElement.play().catch(() => {
          if (retryCountRef.current < maxRetries) {
            recoverPlayback();
          }
        });
      }
    };

    // Check every 5 seconds (less frequent to reduce overhead)
    checkIntervalRef.current = setInterval(checkVideoHealth, 5000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [name, recoverPlayback, hasAudioError]);

  // Reset counters when video URL changes
  useEffect(() => {
    retryCountRef.current = 0;
    errorCountRef.current = 0;
    setHasAudioError(false);
  }, [video]);

  return (
    <video
      ref={videoRef}
      loop
      autoPlay
      muted={muted}
      playsInline
      preload="auto"
      style={{ height, width }}
      key={`${name}-${video}`}
      className={name === 'nextExercise' ? styles.nextExercise : undefined}
      onClick={handleVideoClick}
      onError={handleError}
      onStalled={handleStalled}
      onWaiting={handleWaiting}
      onPlaying={handlePlaying}
    >
      <source src={video} type="video/mp4" />
    </video>
  );
};

export default VideoContainer;

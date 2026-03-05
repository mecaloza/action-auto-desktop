import React, { useState, useEffect } from 'react';
import { convertMsToMinutesSeconds } from '../utils/convertMsToMinutesSeconds';
import styles from '../styles/runtineIndicator.module.scss';

interface RuntineIndicatorProps {
  timeClass: number; // Time remaining in seconds (counts down from total)
  typeClass?: string; // 'Giro', 'Beats', 'Rutine', etc.
  color?: string;
  onClick?: () => void; // Click handler for fullscreen toggle
}

const RuntineIndicator: React.FC<RuntineIndicatorProps> = ({
  timeClass,
  typeClass = 'default',
  color = 'red',
  onClick,
}) => {
  const [count, setCount] = useState(0);

  // Durations based on class type (matching original)
  const timeExercises = typeClass === 'Giro' || typeClass === 'Rutine' ? 2280 : 3180;
  const timeStretching = 180;
  const warmUpDuration = 420;
  const exercisesDuration = typeClass === 'Giro' || typeClass === 'Rutine' ? 2100 : 3000;

  // Total class duration
  const totalDuration = typeClass === 'Beats' || typeClass === 'Giro' ? 2700 : 3600;

  // Determine which section we're in
  useEffect(() => {
    if (timeClass < timeExercises && timeClass > timeStretching) {
      setCount(1); // In exercises section
    } else if (timeClass <= timeStretching) {
      setCount(2); // In stretching section
    } else {
      setCount(0); // In warmup section
    }
  }, [timeClass, timeExercises, timeStretching]);

  // Calculate bar width percentage
  const calculateBarWidth = (duration: number, remaining: number): number => {
    const elapsed = duration - remaining;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  };

  // Calculate warmup progress
  const getWarmupWidth = (): number => {
    if (count > 0) return 100; // Warmup complete
    const warmupRemaining = timeClass - timeExercises;
    return calculateBarWidth(warmUpDuration, warmupRemaining);
  };

  // Calculate exercises progress
  const getExercisesWidth = (): number => {
    if (count < 1) return 0; // Haven't started exercises
    if (count > 1) return 100; // Exercises complete
    const exercisesRemaining = timeClass - timeStretching;
    return calculateBarWidth(exercisesDuration, exercisesRemaining);
  };

  // Calculate stretching progress
  const getStretchingWidth = (): number => {
    if (count < 2) return 0; // Haven't started stretching
    return calculateBarWidth(timeStretching, timeClass);
  };

  return (
    <div className={styles.charger_container} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Time remaining (left) */}
      <div className={styles.time_text}>
        {convertMsToMinutesSeconds(timeClass)}
      </div>

      {/* Progress bar (middle) */}
      <div className={styles.container_progress}>
        <div className={styles.bar}>
          {/* Warmup section */}
          <div className={styles.barPoint}>
            <div
              className={styles.myBar}
              style={{
                width: `${getWarmupWidth()}%`,
                backgroundColor: color,
              }}
            />
            <div className={styles.margin_div}>
              {Array.from({ length: 17 }, (_, i) => (
                <div key={i} />
              ))}
            </div>
          </div>

          {/* Exercises section (main progress) */}
          <div className={styles.progress}>
            <div
              className={styles.myBar}
              style={{
                width: `${getExercisesWidth()}%`,
                backgroundColor: color,
              }}
            />
          </div>

          {/* Stretching section */}
          <div className={styles.barPoint}>
            <div
              className={styles.myBar}
              style={{
                width: `${getStretchingWidth()}%`,
                backgroundColor: color,
              }}
            />
            <div className={styles.margin_div}>
              {Array.from({ length: 17 }, (_, i) => (
                <div key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Time elapsed (right) */}
      <div className={styles.time_text}>
        {convertMsToMinutesSeconds(totalDuration - timeClass)}
      </div>
    </div>
  );
};

export { RuntineIndicator };

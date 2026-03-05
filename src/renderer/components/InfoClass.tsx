import React, { useEffect, useState } from 'react';
import { CountDownRutine } from './CountDownRutine';
import styles from '../styles/infoClass.module.scss';

interface ExerciseDetail {
  exercise_name?: string;
  zone?: string;
  variations?: {
    inclination?: number;
    speed?: string;
    grip?: number;
    combinations?: number;
  };
}

interface InfoClassProps {
  block: number;
  cycle: number;
  timeExercise: number;
  roomType?: string;
  exerciseNames?: ExerciseDetail[];
}

const InfoClass: React.FC<InfoClassProps> = ({
  block,
  cycle,
  timeExercise,
  roomType = '',
  exerciseNames = [],
}) => {
  const [colorTextSavage, setColorTextSavage] = useState('');
  const [colorTextStride, setColorTextStride] = useState('');
  const [colorTextJab, setColorTextJab] = useState('');

  const roomLower = roomType?.toLowerCase() || '';
  const isSavage = roomLower.includes('savage');
  const isStride = roomLower.includes('stride');
  const isJab = roomLower.includes('jab');
  const isTonic = roomLower.includes('tonic') || roomLower.includes('solid');

  const exercise0 = exerciseNames?.[0];
  const exercise1 = exerciseNames?.[1];
  const zone = exercise0?.zone || '';

  // Savage color based on exercise name
  useEffect(() => {
    const exerciseName = exercise1?.exercise_name;
    if (exerciseName === 'BASIC') {
      setColorTextSavage('#FFD600');
    } else if (exerciseName === 'MEDIUM') {
      setColorTextSavage('#FF6B00');
    } else if (exerciseName === 'SAVAGE') {
      setColorTextSavage('#FF0F00');
    } else if (exerciseName === 'REST') {
      setColorTextSavage('#3EDBDB');
    } else {
      setColorTextSavage('');
    }
  }, [exercise1?.exercise_name]);

  // Jab color
  useEffect(() => {
    const exerciseName = exercise0?.exercise_name;
    if (exerciseName === 'KNOCKOUT' || exerciseName === 'FREE') {
      setColorTextJab('#FF1F1F');
    } else if (exerciseName === 'REST') {
      setColorTextJab('#3EDBDB');
    } else if (exerciseName === 'WARM UP' || exerciseName === 'STRETCHING') {
      setColorTextJab('#808080');
    } else if (!exercise0?.variations?.combinations) {
      setColorTextJab('#FFD600');
    } else if (exercise0?.variations?.combinations === 1) {
      setColorTextJab('#FF6B00');
    }
  }, [exercise0]);

  // Stride color
  useEffect(() => {
    const speed = exercise0?.variations?.speed;
    if (speed === 'BASIC') {
      setColorTextStride('#FFD600');
    } else if (speed === 'MEDIUM') {
      setColorTextStride('#FF6B00');
    } else if (speed === 'POWER') {
      setColorTextStride('#FF0F00');
    } else if (speed === 'REST') {
      setColorTextStride('#3EDBDB');
    } else {
      setColorTextStride('');
    }
  }, [exercise0?.variations?.speed]);

  // Format block number
  const formatBlock = (num: number): string => {
    if (zone === 'WARM UP') return '01';
    return num >= 10 ? String(num) : `0${num || 0}`;
  };

  // Format cycle number
  const formatCycle = (num: number): string => {
    if (zone === 'WARM UP') return '01';
    return `0${num || 0}`;
  };

  // Get speed/state text for Savage
  const getSavageSpeedText = (): string => {
    if (zone === 'WARM UP') return 'WARM UP';
    if (zone === 'STRETCHING') return 'STRETCHING';
    if (zone !== 'REST' && zone !== 'STRETCHING' && zone !== 'WARM UP') {
      return exercise1?.exercise_name || 'BASIC';
    }
    return exercise1?.exercise_name === 'REST' ? 'REST' : 'BASIC';
  };

  // Get state text for Stride
  const getStrideStateText = (): string => {
    if (zone === 'WARM UP') return 'WARM UP';
    if (zone === 'STRETCHING') return 'STRETCHING';
    if (zone !== 'REST' && zone !== 'STRETCHING' && zone !== 'WARM UP') {
      return exercise0?.variations?.speed || 'BASIC';
    }
    return exercise1?.exercise_name === 'REST' ? 'REST' : 'BASIC';
  };

  // Get state text for Jab
  const getJabStateText = (): string => {
    if (zone === 'WARM UP') return 'WARM UP';
    if (zone === 'STRETCHING') return 'STRETCHING';
    if (exercise0?.exercise_name === 'REST') return 'REST';
    if (exercise0?.exercise_name === 'KNOCKOUT') return 'KNOCKOUT';
    if (exercise0?.exercise_name === 'FREE') return 'FREE';
    return exercise0?.variations?.combinations === 0 ? 'POWER' : 'SPEED';
  };

  return (
    <div className={styles.container_info}>
      {/* Main info section: BLOCK, CYCLE, TIME */}
      <div
        className={styles.info}
        style={isTonic ? { width: '95%', justifyContent: 'space-around' } : undefined}
      >
        <div
          className={styles.block_info}
          style={isTonic ? { width: '33.33%' } : undefined}
        >
          <p>BLOCK</p>
          <p>{formatBlock(block)}</p>
        </div>

        {isTonic ? (
          <>
            <div style={{ width: '25%' }}>
              <p>TIME</p>
              <CountDownRutine timeExercise={timeExercise} />
            </div>
            <div style={{ width: '33.33%' }}>
              <p>CYCLE</p>
              <p>{formatCycle(cycle)}</p>
            </div>
          </>
        ) : (
          <>
            <div className={styles.cycle_info}>
              <p>CYCLE</p>
              <p>{formatCycle(cycle)}</p>
            </div>
            <div>
              <p>TIME</p>
              <CountDownRutine timeExercise={timeExercise} />
            </div>
          </>
        )}
      </div>

      {/* Savage: INCLINATION + SPEED */}
      {isSavage && (
        <div
          className={styles.info_savage}
          style={zone === 'WARM UP' ? { gap: 0 } : undefined}
        >
          <div>
            <p>INCLINATION</p>
            <p>{exercise1?.variations?.inclination || '0'}</p>
          </div>
          <div style={zone === 'WARM UP' ? { minWidth: '78%' } : { minWidth: '54%' }}>
            <p>SPEED</p>
            <p
              style={
                zone === 'STRETCHING' || zone === 'WARM UP'
                  ? { fontSize: '7vw', color: colorTextSavage }
                  : { color: colorTextSavage }
              }
            >
              {getSavageSpeedText()}
            </p>
          </div>
        </div>
      )}

      {/* Jab: STATE */}
      {isJab && (
        <div className={styles.info_jab}>
          <div style={{ width: '88%' }}>
            <p>STATE</p>
            <p style={{ color: colorTextJab }}>{getJabStateText()}</p>
          </div>
        </div>
      )}

      {/* Stride: POSITION + STATE */}
      {isStride && (
        <div
          className={styles.info_savage}
          style={zone === 'WARM UP' ? { gap: 0 } : undefined}
        >
          <div>
            <p>POSITION</p>
            <p>{exercise0?.variations?.grip || '1'}</p>
          </div>
          <div style={zone === 'WARM UP' ? { minWidth: '78%' } : { minWidth: '54%' }}>
            <p>STATE</p>
            <p
              style={
                zone === 'STRETCHING' || zone === 'WARM UP'
                  ? { fontSize: '7vw', color: colorTextStride }
                  : { color: colorTextStride }
              }
            >
              {getStrideStateText()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export { InfoClass };

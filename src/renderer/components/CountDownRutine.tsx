import React from 'react';
import { convertMsToMinutesSeconds } from '../utils/convertMsToMinutesSeconds';
import styles from '../styles/countDownRutine.module.scss';

interface CountDownRutineProps {
  timeExercise: number;
}

const CountDownRutine: React.FC<CountDownRutineProps> = ({ timeExercise }) => {
  const timeString = convertMsToMinutesSeconds(timeExercise);
  const [minutes, seconds] = timeString.split(':');

  return (
    <div className={styles.container_timer}>
      <div>{minutes?.[0] || '0'}</div>
      <div>{minutes?.[1] || '0'}</div>
      <div style={{ width: '3%', minWidth: '9%' }}>:</div>
      <div>{seconds?.[0] || '0'}</div>
      <div>{seconds?.[1] || '0'}</div>
    </div>
  );
};

export { CountDownRutine };

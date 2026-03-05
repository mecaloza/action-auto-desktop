import React from 'react';
import styles from '../styles/peopleBooked.module.scss';

interface PeopleBookedProps {
  item: {
    spot_number?: number;
    name?: string;
    photo?: string;
  } | number;
  capacity: number;
  style?: React.CSSProperties;
  isSwapped?: boolean;
  clubName?: string;
}

const PeopleBooked: React.FC<PeopleBookedProps> = ({ item, capacity, style, isSwapped, clubName }) => {
  const isEmptySpot = typeof item === 'number';
  const spotPosition = isEmptySpot ? item + 1 : (item.spot_number || 1);

  let firstName = '';
  let lastName = '';

  if (!isEmptySpot && item.name) {
    const nameArr = item.name.split(' ');
    firstName = nameArr[0] || '';
    lastName = nameArr.length === 4 ? nameArr[2] : (nameArr[1] || '');
  }

  const getSpotNumber = () => {
    const halfCapacity = Math.ceil(capacity / 2);
    const number = ((spotPosition - 1) % halfCapacity) + 1;
    let letter;
    if (isSwapped) {
      letter = spotPosition > halfCapacity ? 'A' : 'B';
    } else {
      letter = spotPosition <= halfCapacity ? 'A' : 'B';
    }
    return `${number}${letter}`;
  };

  const photo = !isEmptySpot && item.photo
    ? item.photo
    : 'https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg';

  const hasName = !isEmptySpot && item.name;

  return (
    <div className={styles.container} style={style}>
      <div className={styles.number_spot}>{getSpotNumber()}</div>
      <div className={styles.name}>
        {hasName ? (
          <>
            <p>{firstName.toUpperCase()}</p>
            <p>{lastName.toUpperCase()}</p>
          </>
        ) : (
          <p>{clubName === 'Tribeca' || clubName === 'FlatIron' ? 'Available' : 'Disponible'}</p>
        )}
      </div>
      <div className={styles.img}>
        <img src={photo} alt="User Avatar" />
      </div>
    </div>
  );
};

export { PeopleBooked };

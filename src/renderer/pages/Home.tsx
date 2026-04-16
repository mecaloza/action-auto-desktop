import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactLoading from 'react-loading';
import { useAppStore } from '../stores/appStore';
import { PeopleBooked } from '../components/PeopleBooked';
import { QRContainer } from '../components/QRContainer';
import styles from '../styles/home.module.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.example.com/';

interface Club {
  id: string;
  name: string;
  rooms: Room[];
}

interface Room {
  id: string;
  type: string | string[];
}

interface SpotData {
  spot_number?: number;
  name?: string;
  photo?: string;
}

// Helper to get room display name from type
const getRoomDisplayName = (room: Room): string => {
  return Array.isArray(room.type) ? room.type.join('/') : room.type;
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { login, roomId, roomName, clubName, setRoutines, setCurrentRoutine, token: storeToken } = useAppStore();

  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [section, setSection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ hours: string; minutes: string; seconds: string } | null>(null);
  const [nextClass, setNextClass] = useState<any>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [userBook, setUserBook] = useState<SpotData[]>([]);
  const [capacity, setCapacity] = useState(24);
  const [showQR, setShowQR] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Close context menu when clicking elsewhere
  const handleCloseContextMenu = () => {
    setShowContextMenu(false);
  };

  // Check for saved session
  useEffect(() => {
    const checkSavedSession = async () => {
      const savedToken = await window.electron.store.get('token') as string;
      const savedRoomId = await window.electron.store.get('roomId') as string;
      const savedRoomName = await window.electron.store.get('roomName') as string;
      const savedClubName = await window.electron.store.get('clubName') as string;

      if (savedToken && savedRoomId) {
        setToken(savedToken);
        login(savedToken, savedRoomId, savedRoomName, savedClubName);
        setSection(3); // Go to countdown view
      }
    };
    checkSavedSession();
  }, []);

  // Handle login
  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await response.json();

      if (!data.result?.auth_token) {
        alert('User or password incorrect');
        setLoading(false);
        return;
      }

      const authToken = data.result.auth_token;
      setToken(authToken);
      await window.electron.store.set('token', authToken);

      // Get clubs
      const clubsResponse = await fetch(`${API_BASE_URL}v1/branch-rooms`, {
        headers: {
          Authorization: `Token ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      const clubsData = await clubsResponse.json();
      setClubs(clubsData.result || []);
      setSection(1);
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle club selection
  const handleSelectClub = (club: Club) => {
    setSelectedClub(club);
  };

  const handleNextToRooms = () => {
    if (selectedClub) {
      setSection(2);
    }
  };

  // Handle room selection
  const handleSelectRoom = async (room: Room) => {
    setSelectedRoom(room);
  };

  const handleConfirmRoom = async () => {
    if (!selectedRoom || !selectedClub || !token) return;

    const roomDisplayName = getRoomDisplayName(selectedRoom);

    await window.electron.store.set('roomId', selectedRoom.id);
    await window.electron.store.set('roomName', roomDisplayName);
    await window.electron.store.set('clubName', selectedClub.name);

    login(token, selectedRoom.id, roomDisplayName, selectedClub.name);

    // Connect MQTT
    await window.electron.mqtt.connect({
      club: selectedClub.name,
      room: roomDisplayName,
    });

    setSection(3);
  };

  // Giro room IDs use a different API endpoint
  const GIRO_ROOM_IDS = [
    '114', '272', '63', '277', '278', '284', '281', '268',
    '175', '144', '244', '267', '282', '197', '130', '191',
  ];

  // Fetch routines from the room's normal schedule
  const fetchRoutines = useCallback(async () => {
    const currentToken = token || storeToken;
    if (!currentToken || !roomId) return;

    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Use the appropriate endpoint based on room type
      const isGiroRoom = GIRO_ROOM_IDS.includes(roomId);
      const endpoint = isGiroRoom
        ? `${API_BASE_URL}v1/routine-day-giro/${dateStr}/room/${roomId}`
        : `${API_BASE_URL}v1/routine-day/${dateStr}/room/${roomId}`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Token ${currentToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (data.result?.routines) {
        console.log('API response - routines count:', data.result.routines.length);
        console.log('API response - routine types:', data.result.routines.map((r: any) => r.type));

        setRoutines(data.result.routines);

        // Find the next upcoming class or a class currently in progress (within 1 hour window)
        const now = Date.now();
        let foundClass = null;

        for (const routine of data.result.routines) {
          const diff = now - routine.time_from;

          // Class currently in progress (started less than 1 hour ago)
          if (diff > 0 && diff < 3600000) {
            foundClass = routine;
            break;
          }

          // Class about to start (in the future)
          if (diff <= 0) {
            foundClass = routine;
            break;
          }
        }

        if (foundClass) {
          setNextClass(foundClass);
        }
      }
    } catch (error) {
      console.error('Failed to fetch routines:', error);
    }
  }, [token, storeToken, roomId, setRoutines]);

  // Fetch booked attendees
  const fetchBooked = useCallback(async () => {
    const currentToken = token || storeToken;
    if (!currentToken || !roomId || !nextClass?.time_from) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}v1/room-attendees/${roomId}?time=${nextClass.time_from}&country=${clubName}`,
        {
          headers: {
            Authorization: `Token ${currentToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch room attendees: ${response.status}`);
        return;
      }

      const data = await response.json();

      if (data.result) {
        setUserBook(data.result.spots_data || []);
        setCapacity(data.result.capacity || 24);
      }
    } catch (error) {
      console.error('Error fetching room attendees:', error);
    }
  }, [token, storeToken, roomId, clubName, nextClass?.time_from]);

  // Initial fetch and refresh interval
  useEffect(() => {
    if (section === 3 && (token || storeToken) && roomId) {
      fetchRoutines();
      const interval = setInterval(fetchRoutines, 3600000); // Refresh every hour
      return () => clearInterval(interval);
    }
  }, [section, token, storeToken, roomId, fetchRoutines]);

  // Fetch booked when nextClass changes
  useEffect(() => {
    if (nextClass?.time_from) {
      fetchBooked();
      // Poll for booked updates every 10 minutes
      const interval = setInterval(fetchBooked, 600000);
      return () => clearInterval(interval);
    }
  }, [nextClass?.time_from, fetchBooked]);

  // Countdown timer
  useEffect(() => {
    if (!nextClass) return;

    const updateCountdown = () => {
      const now = Date.now();
      const diff = nextClass.time_from - now;

      // Show QR 5 minutes before class
      setShowQR(diff > 0 && diff <= 300000);

      if (diff <= 0) {
        // Class is starting!
        setCurrentRoutine(nextClass);
        navigate('/routine');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextClass, navigate, setCurrentRoutine]);

  // Fetch app version on mount
  useEffect(() => {
    window.electron.app.getVersion().then(setAppVersion);
  }, []);

  // Listen for update downloaded event — auto-install during countdown
  useEffect(() => {
    const cleanup = window.electron.app.onUpdateDownloaded(() => {
      console.log('Update downloaded — auto-installing in 3 seconds...');
      setUpdateAvailable(true);
      // Auto quit and install after brief delay (allows UI to show update notice)
      setTimeout(() => {
        console.log('Auto-installing update now');
        window.electron.app.installUpdate();
      }, 3000);
    });
    return cleanup;
  }, []);

  // Fullscreen toggle
  const handleFullScreenClick = () => {
    if (!isFullScreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullScreen(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await window.electron.store.clear();
    await window.electron.mqtt.disconnect();
    window.location.reload();
  };

  const isBeatsRoom = roomName?.includes('Beats');

  return (
    <div className={section === 3 ? styles.containerFullscreen : styles.container}>
      {/* Login Card Sections (0-2) */}
      {section < 3 && (
        <div className={styles.card}>
          <img src="/assets/logo-action.png" alt="Action Fitness" className={styles.logo} />

          {section === 0 && (
            <>
              <h2>Login</h2>
              <div className={styles.inputGroup}>
                <label>Username</label>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Password</label>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
              <button onClick={handleLogin} disabled={loading}>
                {loading ? <ReactLoading type="bars" color="#fff" height={20} width={20} /> : 'Login'}
              </button>
            </>
          )}

          {section === 1 && (
            <>
              <h2>Select Club</h2>
              <div className={styles.selectList}>
                {clubs.map((club) => (
                  <div
                    key={club.id}
                    className={`${styles.selectItem} ${selectedClub?.id === club.id ? styles.selected : ''}`}
                    onClick={() => handleSelectClub(club)}
                  >
                    {club.name}
                  </div>
                ))}
              </div>
              {selectedClub && (
                <button onClick={handleNextToRooms}>Next</button>
              )}
            </>
          )}

          {section === 2 && selectedClub && (
            <>
              <h2>Select Room - {selectedClub.name}</h2>
              <div className={styles.selectList}>
                {selectedClub.rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`${styles.selectItem} ${selectedRoom?.id === room.id ? styles.selected : ''}`}
                    onClick={() => handleSelectRoom(room)}
                  >
                    {getRoomDisplayName(room)}
                  </div>
                ))}
              </div>
              {selectedRoom && (
                <button onClick={handleConfirmRoom}>Start</button>
              )}
            </>
          )}
        </div>
      )}

      {/* Countdown Section (3) - Full screen like original */}
      {section === 3 && (
        <div
          className={styles.countdownContainer}
          onClick={(e) => {
            handleCloseContextMenu();
            handleFullScreenClick();
          }}
          onContextMenu={handleContextMenu}
          style={isBeatsRoom ? { justifyContent: 'flex-start', gap: '3%', marginTop: '1%' } : undefined}
        >
          {/* Right-click context menu */}
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
                  setNextClass(null);
                  setCountdown(null);
                  fetchRoutines();
                }}
              >
                Refresh
              </button>
              <button
                className={styles.contextMenuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
              >
                Logout
              </button>
            </div>
          )}
          <button className={styles.button_fullsize}></button>

          {/* Update button - only visible when a new version is downloaded */}
          {updateAvailable && (
            <button
              className={styles.updateButton}
              onClick={(e) => {
                e.stopPropagation();
                window.electron.app.installUpdate();
              }}
            >
              Update Available — Tap to Install
            </button>
          )}

          {/* QR Code - shows 5 minutes before class */}
          {showQR && nextClass?.type && (
            <div className={styles.containerQR}>
              <QRContainer classType={nextClass.type} />
            </div>
          )}

          {/* Countdown Display */}
          {!nextClass ? (
            <p className={styles.text_info}>DONE</p>
          ) : countdown ? (
            <div className={styles.waiting_container}>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                {countdown.hours[0]}
              </div>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                {countdown.hours[1]}
              </div>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                :
              </div>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                {countdown.minutes[0]}
              </div>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                {countdown.minutes[1]}
              </div>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                :
              </div>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                {countdown.seconds[0]}
              </div>
              <div className={styles.block_counter} style={isBeatsRoom ? { fontSize: '12vh', minWidth: '5vw' } : undefined}>
                {countdown.seconds[1]}
              </div>
            </div>
          ) : (
            <p className={styles.text_info}>GO</p>
          )}

          {/* Booked People Display */}
          <div className={styles.container_booked} style={isBeatsRoom ? { height: '80vh' } : undefined}>
            {userBook.length > 0 ? (
              userBook.map((item, index) => (
                <PeopleBooked
                  key={index}
                  item={item}
                  capacity={capacity}
                  clubName={clubName}
                  style={{
                    width: isBeatsRoom ? '10vw' : `${90 / (capacity / 2)}vw`,
                    height: isBeatsRoom ? '12vh' : undefined,
                  }}
                />
              ))
            ) : (
              // Show empty spots placeholder
              Array.from({ length: isBeatsRoom ? 48 : 24 }, (_, i) => (
                <PeopleBooked
                  key={i}
                  item={i}
                  capacity={isBeatsRoom ? 48 : 24}
                  clubName={clubName}
                  style={{
                    width: isBeatsRoom ? '10vw' : `${90 / 12}vw`,
                    height: isBeatsRoom ? '12vh' : undefined,
                  }}
                />
              ))
            )}
          </div>

          {/* Version label - small in bottom-right corner */}
          {appVersion && (
            <span className={styles.versionLabel}>v{appVersion}</span>
          )}

        </div>
      )}
    </div>
  );
};

export default Home;

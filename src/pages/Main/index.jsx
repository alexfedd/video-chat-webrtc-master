import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, Container, Typography } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { setUsername } from '../../store';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min';
import { v4 as uuidv4 } from 'uuid';

export default function Main() {
  const dispatch = useDispatch();
  const history = useHistory()
  const username = useSelector((state) => state.user.username);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      history.push('/auth/login')
    }

    socket.on(ACTIONS.SHARE_ROOMS, ({ rooms }) => {
      setRooms(rooms);
    });

    return () => {
      socket.off(ACTIONS.SHARE_ROOMS);
    };
  }, [username]);

  const handleLogout = () => {
    dispatch(setUsername(''));
    localStorage.removeItem('token')
    history.push('/auth/register');
  };

  const createRoom = () => {
    const newRoomID = uuidv4();
    history.push(`/room/${newRoomID}`);
  };

  return (
    <Container maxWidth="sm" style={{ textAlign: 'center', marginTop: '50px' }}>
      <Typography variant="h4" gutterBottom>
        Welcome, {username}!
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={createRoom}
        style={{ margin: '10px' }}
      >
        Create Room
      </Button>
      <Link to="/settings" style={{ textDecoration: 'none' }}>
        <Button
          variant="contained"
          color="primary"
          style={{ margin: '10px' }}
        >
          Settings
        </Button>
      </Link>
      <Button
        variant="outlined"
        color="secondary"
        onClick={handleLogout}
        style={{ margin: '10px' }}
      >
        Logout
      </Button>

      <Typography variant="h5" style={{ marginTop: '30px' }}>
        Available Rooms
      </Typography>
      {rooms.length > 0 ? (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {rooms.map((room) => (
            <li key={room} style={{ margin: '10px 0' }}>
              <Typography variant="body1">
                Room ID: {room}
              </Typography>
              <Link to={`/room/${room}`} style={{ textDecoration: 'none' }}>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ marginTop: '5px' }}
                >
                  Join
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Typography variant="body1" style={{ marginTop: '20px' }}>
          No rooms available.
        </Typography>
      )}
    </Container>
  );
}
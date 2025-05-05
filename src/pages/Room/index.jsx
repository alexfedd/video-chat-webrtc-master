import React, { useState, useEffect } from 'react';
import { Modal, Box, IconButton, Typography } from '@mui/material';
import { People, Mic, MicOff, Videocam, VideocamOff, ExitToApp } from '@mui/icons-material';
import { useParams } from 'react-router';
import useWebRTC, { LOCAL_VIDEO } from '../../hooks/useWebRTC';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';
import { useSelector } from 'react-redux';
import './Room.css';

function layout(clientsNumber = 1) {
  const pairs = Array.from({ length: clientsNumber }).reduce((acc, next, index, arr) => {
    if (index % 2 === 0) {
      acc.push(arr.slice(index, index + 2));
    }

    return acc;
  }, []);

  const rowsNumber = pairs.length;
  const height = `${100 / rowsNumber}%`;

  return pairs
    .map((row, index, arr) => {
      if (index === arr.length - 1 && row.length === 1) {
        return [
          {
            width: '100%',
            height,
          },
        ];
      }

      return row.map(() => ({
        width: '50%',
        height,
      }));
    })
    .flat();
}

export default function Room() {
  const { id: roomID } = useParams();
  const { clients, provideMediaRef, localMediaStream } = useWebRTC(roomID);
  const videoLayout = layout(clients.length);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const currentUser = useSelector((state) => state.user.username);
  const [isCreator, setIsCreator] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleMic = () => {
    const audioTrack = localMediaStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localMediaStream.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  };

  const leaveRoom = () => {
    socket.emit(ACTIONS.LEAVE);
    window.location.href = '/';
  };

  const removeUser = (peerID) => {
    socket.emit(ACTIONS.REMOVE_PEER, { roomID, peerID });
  };

  useEffect(() => {
    socket.on(ACTIONS.SHARE_CONNECTED_USERS, (users) => {
      console.log('Received SHARE_CONNECTED_USERS event:', users);
      setConnectedUsers(users);

      // Проверяем, является ли текущий пользователь создателем комнаты
      const creator = users.find((user) => user.isCreator);
      if (creator && creator.username === currentUser) {
        setIsCreator(true);
      } else {
        setIsCreator(false);
      }
    });

    return () => {
      socket.off(ACTIONS.SHARE_CONNECTED_USERS);
    };
  }, [currentUser]);

  useEffect(() => {
    const handleRemovePeer = ({ peerID }) => {
      console.log(`Removing peer: ${peerID}`);
      setConnectedUsers((prevUsers) => prevUsers.filter((user) => user.id !== peerID));
    };

    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);

    return () => {
      socket.off(ACTIONS.REMOVE_PEER, handleRemovePeer);
    };
  }, []);

  useEffect(() => {
    console.log('Rendering clients:', clients);
  }, [clients]);

  return (
    <div className="room-container">
      <IconButton className="users-button" onClick={() => setIsModalOpen(true)} color="inherit">
        <People />
      </IconButton>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Box className="modal-box">
          <Typography variant="h6" gutterBottom>
            Connected Users
          </Typography>
          <ul>
            {connectedUsers.map((user) => (
              <li key={user.id}>
                {user.username}
                {isCreator && user.username !== currentUser && (
                  <button onClick={() => removeUser(user.id)} style={{ marginLeft: '10px' }}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Box>
      </Modal>

      <div className="video-grid">
        {clients.map((clientID, index) => (
          <div key={clientID} className="video-container" style={videoLayout[index]} id={clientID}>
            <video
              ref={(instance) => provideMediaRef(clientID, instance)}
              autoPlay
              playsInline
              muted={clientID === LOCAL_VIDEO}
            />
          </div>
        ))}
      </div>

      <div className="controls">
        <IconButton onClick={toggleMic} color={isMicMuted ? 'error' : 'inherit'}>
          {isMicMuted ? <MicOff /> : <Mic />}
        </IconButton>
        <IconButton onClick={toggleCamera} color={isCameraOff ? 'error' : 'inherit'}>
          {isCameraOff ? <VideocamOff /> : <Videocam />}
        </IconButton>
        <IconButton onClick={leaveRoom} color="error">
          <ExitToApp />
        </IconButton>
      </div>
    </div>
  );
}
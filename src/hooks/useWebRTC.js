import {useEffect, useRef, useCallback} from 'react';
import { useSelector } from 'react-redux';
import freeice from 'freeice';
import useStateWithCallback from './useStateWithCallback';
import socket from '../socket';
import ACTIONS from '../socket/actions';

export const LOCAL_VIDEO = 'LOCAL_VIDEO';


export default function useWebRTC(roomID) {
  const [clients, updateClients] = useStateWithCallback([]);

  const selectedAudioDevice = useSelector((state) => state.user.selectedAudioDevice);
  const selectedVideoDevice = useSelector((state) => state.user.selectedVideoDevice);

  const addNewClient = useCallback((newClient, cb) => {
    updateClients(list => {
      if (!list.includes(newClient)) {
        return [...list, newClient]
      }

      return list;
    }, cb);
  }, [clients, updateClients]);

  const peerConnections = useRef({});
  const localMediaStream = useRef(null);
  const peerMediaElements = useRef({
    [LOCAL_VIDEO]: null,
  });

  useEffect(() => {
    async function handleNewPeer({peerID, createOffer}) {
      if (peerID in peerConnections.current) {
        return console.warn(`Already connected to peer ${peerID}`);
      }

      peerConnections.current[peerID] = new RTCPeerConnection({
        iceServers: freeice(),
      });

      peerConnections.current[peerID].onicecandidate = event => {
        if (event.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, {
            peerID,
            iceCandidate: event.candidate,
          });
        }
      }

      let tracksNumber = 0;
      peerConnections.current[peerID].ontrack = ({streams: [remoteStream]}) => {
        tracksNumber++

        if (tracksNumber === 2) { // video & audio tracks received
          tracksNumber = 0;
          addNewClient(peerID, () => {
            if (peerMediaElements.current[peerID]) {
              peerMediaElements.current[peerID].srcObject = remoteStream;
            } else {
              // FIX LONG RENDER IN CASE OF MANY CLIENTS
              let settled = false;
              const interval = setInterval(() => {
                if (peerMediaElements.current[peerID]) {
                  peerMediaElements.current[peerID].srcObject = remoteStream;
                  settled = true;
                }

                if (settled) {
                  clearInterval(interval);
                }
              }, 1000);
            }
          });
        }
      }

      localMediaStream.current?.getTracks().forEach(track => {
        peerConnections.current[peerID].addTrack(track, localMediaStream.current);
      });

      if (createOffer) {
        const offer = await peerConnections.current[peerID].createOffer();

        await peerConnections.current[peerID].setLocalDescription(offer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: offer,
        });
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);

    return () => {
      socket.off(ACTIONS.ADD_PEER);
    }
  }, []);

  useEffect(() => {
    async function setRemoteMedia({peerID, sessionDescription: remoteDescription}) {
      await peerConnections.current[peerID]?.setRemoteDescription(
        new RTCSessionDescription(remoteDescription)
      );

      if (remoteDescription.type === 'offer') {
        const answer = await peerConnections.current[peerID].createAnswer();

        await peerConnections.current[peerID].setLocalDescription(answer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: answer,
        });
      }
    }

    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia)

    return () => {
      socket.off(ACTIONS.SESSION_DESCRIPTION);
    }
  }, []);

  useEffect(() => {
    socket.on(ACTIONS.ICE_CANDIDATE, ({peerID, iceCandidate}) => {
      peerConnections.current[peerID]?.addIceCandidate(
        new RTCIceCandidate(iceCandidate)
      );
    });

    return () => {
      socket.off(ACTIONS.ICE_CANDIDATE);
    }
  }, []);

  useEffect(() => {
    const handleRemovePeer = ({ peerID }) => {
      console.log(`Removing peer: ${peerID}`);

      // Закрываем соединение WebRTC
      if (peerConnections.current[peerID]) {
        peerConnections.current[peerID].close();
      }

      // Удаляем медиапотоки
      delete peerConnections.current[peerID];
      delete peerMediaElements.current[peerID];

      // Удаляем видеопоток из DOM
      const videoElement = peerMediaElements.current[peerID];
      if (videoElement) {
        videoElement.srcObject = null;
      }

      // Обновляем список клиентов
      updateClients((list) => {
        const updatedList = list.filter((c) => c !== peerID);
        console.log('Updated clients list:', updatedList);
        return updatedList;
      });

      // Если текущий пользователь был удален, перенаправляем его
      if (peerID === socket.id) {
        console.log('Current user has been removed from the room. Redirecting...');
        localMediaStream.current?.getTracks().forEach((track) => track.stop());
        window.location.href = '/';
      }
    };

    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);

    return () => {
      socket.off(ACTIONS.REMOVE_PEER, handleRemovePeer);
    };
  }, []);

  useEffect(() => {
    async function startCapture() {
      const constraints = {
        audio: selectedAudioDevice ? { deviceId: selectedAudioDevice } : true,
        video: selectedVideoDevice ? { deviceId: selectedVideoDevice } : {
          width: 1280,
          height: 720,
        },
      };

      localMediaStream.current = await navigator.mediaDevices.getUserMedia(constraints);

      addNewClient(LOCAL_VIDEO, () => {
        const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];

        if (localVideoElement) {
          localVideoElement.volume = 0;
          localVideoElement.srcObject = localMediaStream.current;
        }
      });
    }

    startCapture()
      .then(() => socket.emit(ACTIONS.JOIN, { room: roomID }))
      .catch((e) => console.error('Error getting userMedia:', e));

    return () => {
      localMediaStream.current?.getTracks().forEach((track) => track.stop());

      socket.emit(ACTIONS.LEAVE);
    };
  }, [roomID, selectedAudioDevice, selectedVideoDevice]);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  return {
    clients,
    provideMediaRef,
    localMediaStream
  };
}
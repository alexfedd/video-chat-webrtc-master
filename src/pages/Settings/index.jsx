import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedAudioDevice, setSelectedVideoDevice } from '../../store';
import { useHistory } from 'react-router-dom';
import { Button, MenuItem, Select, Typography, Box, Paper } from '@mui/material';

export default function Settings() {
  const dispatch = useDispatch();
  const history = useHistory();
  const selectedAudioDeviceFromStore = useSelector((state) => state.user.selectedAudioDevice);
  const selectedVideoDeviceFromStore = useSelector((state) => state.user.selectedVideoDevice);

  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDeviceState] = useState(selectedAudioDeviceFromStore || '');
  const [selectedVideoDevice, setSelectedVideoDeviceState] = useState(selectedVideoDeviceFromStore || '');

  useEffect(() => {
    async function fetchDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter(device => device.kind === 'audioinput'));
      setVideoDevices(devices.filter(device => device.kind === 'videoinput'));

      // Устанавливаем выбранные устройства, если они есть в Redux
      if (selectedAudioDeviceFromStore) {
        setSelectedAudioDeviceState(selectedAudioDeviceFromStore);
      } else if (devices.length > 0) {
        setSelectedAudioDeviceState(devices.find(device => device.kind === 'audioinput')?.deviceId || '');
      }

      if (selectedVideoDeviceFromStore) {
        setSelectedVideoDeviceState(selectedVideoDeviceFromStore);
      } else if (devices.length > 0) {
        setSelectedVideoDeviceState(devices.find(device => device.kind === 'videoinput')?.deviceId || '');
      }
    }

    fetchDevices();
  }, [selectedAudioDeviceFromStore, selectedVideoDeviceFromStore]);

  const handleAudioChange = (event) => {
    setSelectedAudioDeviceState(event.target.value);
  };

  const handleVideoChange = (event) => {
    setSelectedVideoDeviceState(event.target.value);
  };

  const handleSaveSettings = () => {
    dispatch(setSelectedAudioDevice(selectedAudioDevice));
    dispatch(setSelectedVideoDevice(selectedVideoDevice));
    console.log('Settings saved:', { selectedAudioDevice, selectedVideoDevice });
    history.push('/');
  };

  return (
    <Paper elevation={3} sx={{ padding: 3, maxWidth: 500, margin: '50px auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Audio Devices
        </Typography>
        <Select
          value={selectedAudioDevice}
          onChange={handleAudioChange}
          fullWidth
          variant="outlined"
        >
          {audioDevices.map(device => (
            <MenuItem key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId}`}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Box sx={{ marginBottom: 3 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Video Devices
        </Typography>
        <Select
          value={selectedVideoDevice}
          onChange={handleVideoChange}
          fullWidth
          variant="outlined"
        >
          {videoDevices.map(device => (
            <MenuItem key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId}`}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Button
        variant="contained"
        color="primary"
        onClick={handleSaveSettings}
        fullWidth
      >
        Save Settings
      </Button>
    </Paper>
  );
}
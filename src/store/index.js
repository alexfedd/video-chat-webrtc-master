import { configureStore, createSlice } from '@reduxjs/toolkit';

const persistedState = {
  selectedAudioDevice: localStorage.getItem('selectedAudioDevice') || '',
  selectedVideoDevice: localStorage.getItem('selectedVideoDevice') || '',
};

const userSlice = createSlice({
  name: 'user',
  initialState: {
    username: '',
    ...persistedState,
  },
  reducers: {
    setUsername: (state, action) => {
      state.username = action.payload;
    },
    setSelectedAudioDevice: (state, action) => {
      state.selectedAudioDevice = action.payload;
      localStorage.setItem('selectedAudioDevice', action.payload);
    },
    setSelectedVideoDevice: (state, action) => {
      state.selectedVideoDevice = action.payload;
      localStorage.setItem('selectedVideoDevice', action.payload);
    },
  },
});

export const { setUsername, setSelectedAudioDevice, setSelectedVideoDevice } = userSlice.actions;

const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
});

export default store;
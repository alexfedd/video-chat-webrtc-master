import { configureStore, createSlice } from '@reduxjs/toolkit';

// Восстанавливаем состояние из localStorage
const persistedState = {
  selectedAudioDevice: localStorage.getItem('selectedAudioDevice') || '',
  selectedVideoDevice: localStorage.getItem('selectedVideoDevice') || '',
};

// Создаем slice для пользователя
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

// Экспортируем действия
export const { setUsername, setSelectedAudioDevice, setSelectedVideoDevice } = userSlice.actions;

// Создаем хранилище
const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
});

export default store;
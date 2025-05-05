import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Provider, useDispatch } from 'react-redux';
import store, { setUsername } from './store';

function Root() {
  const dispatch = useDispatch();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/auth/protected', {
        method: 'GET',
        headers: {
          Authorization: token,
        },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Failed to fetch user data');
        })
        .then((data) => {
          dispatch(setUsername(data.user.username));
        })
        .catch((error) => {
          console.error('Error fetching user data:', error);
        });
    }
  }, [dispatch]);

  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <Provider store={store}>
    <Root />
  </Provider>
);

const path = require('path');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const {version, validate} = require('uuid');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const ACTIONS = require('./src/socket/actions');
const PORT = process.env.PORT || 3001;

// Middleware для обработки JSON
app.use(express.json());

// Настройка подключения к PostgreSQL
const sequelize = new Sequelize('video_chat', 'postgres', 'postgres', {
  host: 'database', // Используем имя сервиса из docker-compose.yml
  dialect: 'postgres',
});

// Модель пользователя
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Синхронизация базы данных
sequelize.sync().then(() => {
  console.log('Database synced');
}).catch(err => {
  console.error('Error syncing database:', err);
});

// Регистрация пользователя
app.post('/auth/register',
  body('username').isLength({ min: 3 }),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword });
      res.status(201).json({ message: 'User registered successfully', user });
    } catch (error) {
      res.status(500).json({ error: 'Error registering user' });
    }
  }
);

// Вход пользователя
app.post('/auth/login',
  body('username').notEmpty(),
  body('password').notEmpty(),
  async (req, res) => {
    const { username, password } = req.body;

    try {
      const user = await User.findOne({ where: { username } });
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id }, 'your_jwt_secret', { expiresIn: '1h' });
      res.json({ token });
    } catch (error) {
      res.status(500).json({ error: 'Error logging in' });
    }
  }
);

// Middleware для проверки токена
function authenticateToken(req, res, next) {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ error: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token is not valid' });
  }
}

// Пример защищенного маршрута
app.get('/auth/protected', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: { username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

function getClientRooms() {
  const {rooms} = io.sockets.adapter;

  return Array.from(rooms.keys()).filter(roomID => validate(roomID) && version(roomID) === 4);
}

function shareRoomsInfo() {
  const rooms = getClientRooms().filter(roomID => {
    const clients = io.sockets.adapter.rooms.get(roomID);
    return clients && clients.size > 0; // Убедимся, что в комнате есть пользователи
  });
  console.log(getClientRooms(), rooms);
  io.emit(ACTIONS.SHARE_ROOMS, {
    rooms
  });
}

function shareConnectedUsers(roomID) {
  const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

  if (!clients.length) {
    console.log(`Room ${roomID} has no connected users.`);
    return;
  }

  const creatorID = roomCreators.get(roomID);

  const users = clients.map(clientID => {
    const socket = io.sockets.sockets.get(clientID);
    if (!socket) {
      console.warn(`Socket not found for clientID: ${clientID}`);
      return null;
    }
    return {
      id: clientID,
      username: socket.user?.username || 'Anonymous',
      isCreator: clientID === creatorID, // Добавляем isCreator
    };
  }).filter(user => user !== null);

  console.log(`Sharing connected users for room ${roomID}:`, users);
  io.to(roomID).emit(ACTIONS.SHARE_CONNECTED_USERS, users);
}

const roomCreators = new Map(); // Хранение создателей комнат

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');

    // Проверяем пользователя в базе данных
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', socket => {
  shareRoomsInfo();

  socket.on(ACTIONS.JOIN, config => {
    const {room: roomID} = config;
    const {rooms: joinedRooms} = socket;

    if (Array.from(joinedRooms).includes(roomID)) {
      return console.warn(`Already joined to ${roomID}`);
    }

    const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

    // Если комната пуста, текущий пользователь становится создателем
    if (clients.length === 0) {
      roomCreators.set(roomID, socket.id);
    }

    clients.forEach(clientID => {
      io.to(clientID).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: false
      });

      socket.emit(ACTIONS.ADD_PEER, {
        peerID: clientID,
        createOffer: true,
      });
    });

    socket.join(roomID);
    shareRoomsInfo();
    shareConnectedUsers(roomID);
  });

  socket.on(ACTIONS.REMOVE_PEER, ({ roomID, peerID }) => {
    const creatorID = roomCreators.get(roomID);

    if (socket.id !== creatorID) {
      return console.warn(`User ${socket.id} is not the creator of room ${roomID} and cannot remove peers.`);
    }

    if (peerID === creatorID) {
      return console.warn(`Creator ${creatorID} cannot remove themselves from the room.`);
    }

    const clients = io.sockets.adapter.rooms.get(roomID);
    if (clients && clients.has(peerID)) {
      console.log(`Removing peer ${peerID} from room ${roomID}`);

      // Отправляем событие REMOVE_PEER всем клиентам в комнате
      io.to(roomID).emit(ACTIONS.REMOVE_PEER, { peerID });

      // Удаляем пользователя из комнаты
      io.sockets.sockets.get(peerID)?.leave(roomID);
      shareConnectedUsers(roomID);
    } else {
      console.warn(`Peer ${peerID} not found in room ${roomID}`);
    }
  });

  function leaveRoom() {
    const { rooms } = socket;

    Array.from(rooms)
      .filter(roomID => validate(roomID) && version(roomID) === 4)
      .forEach(roomID => {
        console.log(`User ${socket.id} leaving room ${roomID}`);
        socket.leave(roomID);

        const clients = io.sockets.adapter.rooms.get(roomID);
        if (clients && clients.size > 0) {
          console.log(`Room ${roomID} still has users:`, Array.from(clients));
          shareConnectedUsers(roomID);
        } else {
          console.log(`Room ${roomID} is now empty and will be removed.`);
          roomCreators.delete(roomID); // Удаляем запись о создателе комнаты
        }

        // Отправляем событие REMOVE_PEER всем пользователям в комнате
        socket.to(roomID).emit(ACTIONS.REMOVE_PEER, { peerID: socket.id });
      });

    // Обновляем список комнат только после обработки всех событий
    setTimeout(() => {
      console.log('Updating room list after leave event');
      shareRoomsInfo();
    }, 0);
  }

  socket.on(ACTIONS.LEAVE, leaveRoom);
  socket.on('disconnecting', leaveRoom);

  socket.on(ACTIONS.RELAY_SDP, ({peerID, sessionDescription}) => {
    io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerID: socket.id,
      sessionDescription,
    });
  });

  socket.on(ACTIONS.RELAY_ICE, ({peerID, iceCandidate}) => {
    io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
      peerID: socket.id,
      iceCandidate,
    });
  });

});

const publicPath = path.join(__dirname, 'build');

app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log('Server Started!')
})

module.exports = { sequelize, User };
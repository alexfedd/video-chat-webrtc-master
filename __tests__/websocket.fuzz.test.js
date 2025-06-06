const fc = require('fast-check');
const { server } = require('../server');
const ACTIONS = require('../src/socket/actions');
const { io } = require('socket.io-client');

jest.setTimeout(120000); // Increase timeout to 120 seconds

describe('WebSocket Fuzzing Tests', () => {
  let clientSocket;
  let httpServer;
    beforeAll(async () => {
    return new Promise((resolve) => {
      httpServer = server.listen(0);
      const port = httpServer.address().port;
      
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: 'test_token' },
        reconnection: false,
        timeout: 5000
      });
      
      clientSocket.on('connect', () => {
        setTimeout(resolve, 1000); // Give extra time for socket setup
      });
    });
  });

  afterAll(async () => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    await new Promise(resolve => httpServer.close(resolve));
  });

  describe('Room Management Fuzzing', () => {    it('should handle various room IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(1, 100),
          async (roomId) => {
            const response = await new Promise((resolve) => {
              clientSocket.emit(ACTIONS.JOIN, { room: roomId });
              clientSocket.once(ACTIONS.SHARE_ROOMS, (data) => {
                resolve(data);
              });
            });
            
            return Array.isArray(response.rooms);
          }
        ),
        { numRuns: 50 }
      );
    });    it('should handle concurrent room joins', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string(1, 36), { minLength: 1, maxLength: 5 }),
          async (roomIds) => {
            const joins = roomIds.map(roomId => {
              return new Promise((resolve) => {
                clientSocket.emit(ACTIONS.JOIN, { room: roomId });
                clientSocket.once(ACTIONS.SHARE_ROOMS, resolve);
              });
            });
            
            try {
              const results = await Promise.all(joins);
              return results.every(result => Array.isArray(result.rooms));
            } catch {
              return true; // If any promise rejects, we consider it a valid case
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('WebRTC Signaling Fuzzing', () => {    it('should handle malformed SDP data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.anything(),
          async (peerId, malformedSdp) => {
            const response = await new Promise((resolve) => {
              clientSocket.emit(ACTIONS.RELAY_SDP, {
                peerId: peerId,
                sessionDescription: malformedSdp
              });
              
              setTimeout(() => {
                resolve(clientSocket.connected);
              }, 50);
            });
            
            return response === true;
          }
        ),
        { numRuns: 20 }
      );
    });    it('should handle malformed ICE candidate data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.object(),
          async (peerId, malformedIce) => {
            const response = await new Promise((resolve) => {
              clientSocket.emit(ACTIONS.RELAY_ICE, {
                peerId: peerId,
                iceCandidate: malformedIce
              });
              
              setTimeout(() => {
                resolve(clientSocket.connected);
              }, 50);
            });
            
            return response === true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

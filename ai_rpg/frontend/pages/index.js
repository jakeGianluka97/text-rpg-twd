import { useState, useEffect } from 'react';
import io from 'socket.io-client';

// Establish socket connection when component mounts
let socket;

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    socket = io('http://localhost:4000');
    socket.on('connect', () => {
      setConnected(true);
    });
    socket.on('gmMessage', (data) => {
      setMessages((msgs) => [...msgs, { author: 'GM', text: data.text }]);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    // Add player message to local state
    setMessages((msgs) => [...msgs, { author: 'You', text: input }]);
    // Emit message via socket
    // Includi un playerId hardcoded (ad esempio 1) finché non sarà disponibile
    // un sistema di autenticazione. Il backend userà questo ID per associare
    // eventi e personaggi.
    socket.emit('playerMessage', { text: input, playerId: 1 });
    setInput('');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>AI RPG - MVP Chat</h1>
      <div style={{ border: '1px solid #ccc', padding: '1rem', height: '300px', overflowY: 'auto', marginBottom: '1rem' }}>
        {messages.map((msg, index) => (
          <p key={index}><strong>{msg.author}:</strong> {msg.text}</p>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Digita un comando..."
        style={{ width: '80%', marginRight: '0.5rem' }}
      />
      <button onClick={sendMessage}>Invia</button>
    </div>
  );
}
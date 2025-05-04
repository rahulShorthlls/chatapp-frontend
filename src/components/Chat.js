import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './Chat.css';

const socket = io('http://localhost:5000'); // Replace with your backend URL

function Chat({ username }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    socket.on('message', (message) => {
      setMessages((prev) => [...prev, message]);
    });
  }, []);

  const sendMessage = () => {
    if (input.trim()) {
      const message = { username, text: input, type: 'text' };
      socket.emit('message', message);
      setMessages((prev) => [...prev, message]);
      setInput('');
    }
  };

  const sendImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const message = { username, text: reader.result, type: 'image' };
        socket.emit('message', message);
        setMessages((prev) => [...prev, message]);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat App</h3>
        <button onClick={clearChat}>Clear Chat</button>
      </div>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.username === username ? 'self' : ''}`}>
            <strong>{msg.username}</strong>
            {msg.type === 'text' ? <p>{msg.text}</p> : <img src={msg.text} alt="sent" />}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder="Type a message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <input type="file" accept="image/*" onChange={sendImage} />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default Chat;

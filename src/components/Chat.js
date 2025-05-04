import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './Chat.css';

const socket = io('http://localhost:5000'); // Replace with your backend URL

function Chat({ username }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [users, setUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null); // Track the message being replied to
  const inputRef = useRef(null); // Reference to the input field

  useEffect(() => {
    // Fix for mobile viewport height
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
    };
  }, []);

  useEffect(() => {
    socket.on('receive-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('user-typing', (data) => {
      setTyping(data.typing && data.username !== username);
    });

    socket.on('user-connected', (user) => {
      setUsers((prev) => [...prev, user]);
    });

    socket.on('user-disconnected', (user) => {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    });

    return () => {
      socket.off('receive-message');
      socket.off('user-typing');
      socket.off('user-connected');
      socket.off('user-disconnected');
    };
  }, [username]);

  const sendMessage = (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    if (input.trim()) {
      const message = { username, text: input, type: 'text', replyTo };
      socket.emit('send-message', message);
      setMessages((prev) => [...prev, message]);
      setInput('');
      setReplyTo(null); // Clear the reply context after sending
      inputRef.current.focus(); // Keep the input field focused
    }
  };

  const sendImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const message = { username, text: reader.result, type: 'image' };
        socket.emit('send-message', message);
        setMessages((prev) => [...prev, message]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    socket.emit('typing', { username, typing: e.target.value.length > 0 });
  };

  const handleReply = (message) => {
    setReplyTo(message); // Set the message being replied to
  };

  const cancelReply = () => {
    setReplyTo(null); // Clear the reply context
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat App</h3>
        <button onClick={clearChat}>Clear Chat</button>
        <div className="user-list">
          {users.map((user) => (
            <span key={user.id} className={user.online ? 'online' : 'offline'}>
              {user.name}
            </span>
          ))}
        </div>
      </div>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.username === username ? 'self' : ''}`}
            onDoubleClick={() => handleReply(msg)} // Double-click to reply
          >
            <strong>{msg.username}</strong>
            {msg.replyTo && (
              <div className="reply-context">
                <strong>Replying to {msg.replyTo.username}:</strong>
                <p>{msg.replyTo.text}</p>
              </div>
            )}
            {msg.type === 'text' ? <p>{msg.text}</p> : <img src={msg.text} alt="sent" />}
          </div>
        ))}
        {typing && <div className="typing-indicator">Someone is typing...</div>}
      </div>
      {replyTo && (
        <div className="reply-preview">
          <strong>Replying to {replyTo.username}:</strong>
          <p>{replyTo.text}</p>
          <button onClick={cancelReply}>Cancel</button>
        </div>
      )}
      <form className="chat-input" onSubmit={sendMessage}>
        <input
          ref={inputRef} // Attach the ref to the input field
          type="text"
          placeholder="Type a message"
          value={input}
          onChange={handleTyping}
        />
        <input type="file" accept="image/*" onChange={sendImage} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default Chat;

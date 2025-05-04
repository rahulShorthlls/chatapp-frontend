import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://chatapp-backend-evk7.onrender.com', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    timeout: 60000,
    cors: {
        origin: "*"
    }
});

function App() {
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [image, setImage] = useState(null);
    const [replyTo, setReplyTo] = useState(null);

    useEffect(() => {
        // Load messages from localStorage on startup
        const savedMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        setMessages(savedMessages);

        // Reconnect socket if disconnected
        socket.on('connect', () => {
            console.log('Connected to server successfully');
            const userName = localStorage.getItem('name') || prompt('Enter your name:');
            if (!userName) return; // Ensure a name is provided
            setName(userName);
            localStorage.setItem('name', userName);
            socket.emit('new-user', userName);
        });

        // Add connection status logging
        socket.on('connect_error', (error) => {
            console.error('Connection Error:', error);
        });

        // Listen for messages
        socket.on('receive-message', (data) => {
            console.log('Received message:', data);
            setMessages((prev) => {
                const newMessages = [...prev, data];
                localStorage.setItem('chatMessages', JSON.stringify(newMessages));
                return newMessages;
            });
        });

        // Listen for chat cleared
        socket.on('chat-cleared', () => {
            console.log('Clearing chat...');
            setMessages([]); // Clear messages when chat is cleared
        });

        return () => {
            socket.off('connect');
            socket.off('connect_error');
            socket.off('receive-message');
            socket.off('chat-cleared');
        };
    }, [name]);

    const convertImageToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const base64Image = await convertImageToBase64(file);
                setImage(base64Image);
            } catch (error) {
                console.error('Error converting image:', error);
            }
        }
    };

    const handleReply = (msg) => {
        setReplyTo(msg);
    };

    const sendMessage = () => {
        if (message.trim() || image) {
            const messageData = {
                name,
                message: message.trim(),
                image,
                timestamp: new Date().toISOString(),
                replyTo
            };
            
            socket.emit('send-message', messageData);
            setMessage('');
            setImage(null);
            setReplyTo(null);
        }
    };

    const clearChat = () => {
        localStorage.removeItem('chatMessages');
        setMessages([]);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-container">
            <div className="chat-header">
                <h2>Chat App</h2>
                <button className="clear-button" onClick={clearChat}>🗑️</button>
            </div>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.name === name ? 'self' : 'other'}`} onClick={() => handleReply(msg)}>
                        <strong>{msg.name}</strong>
                        {msg.replyTo && (
                            <div className="reply-content">
                                <span>Replying to {msg.replyTo.name}</span>
                                <p>{msg.replyTo.message}</p>
                            </div>
                        )}
                        {msg.message && <p>{msg.message}</p>}
                        {msg.image && <img src={msg.image} alt="sent" />}
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                ))}
            </div>
            {replyTo && (
                <div className="reply-preview">
                    <div>
                        <span>Replying to {replyTo.name}</span>
                        <p>{replyTo.message}</p>
                    </div>
                    <button onClick={() => setReplyTo(null)}>✕</button>
                </div>
            )}
            <div className="chat-input">
                <input
                    type="text"
                    placeholder="Type a message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <label htmlFor="file-upload">📎</label>
                <input
                    id="file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                />
                <button onClick={sendMessage}>Send</button>
            </div>
        </div>
    );
}

export default App;

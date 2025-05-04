import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [seenMessages, setSeenMessages] = useState({});
    const inputRef = useRef(null);
    const minSwipeDistance = 50;

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
            setMessages(prev => {
                const newMessages = [...prev, data];
                localStorage.setItem('chatMessages', JSON.stringify(newMessages));
                
                // Only show vibration for new messages from others
                if (data.name !== name && 'vibrate' in navigator) {
                    navigator.vibrate(200);
                }
                
                return newMessages;
            });
        });

        // Remove chat-history listener as we're using localStorage

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
            socket.off('message-seen');
        };
    }, [name]); // Only depend on name

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
        inputRef.current?.focus();
    };

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.touches[0].clientX);
    };

    const onTouchMove = (e) => {
        setTouchEnd(e.touches[0].clientX);
    };

    const onTouchEnd = useCallback((msg) => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        
        if (isLeftSwipe) {
            handleReply(msg);
        }
        
        setTouchStart(null);
        setTouchEnd(null);
    }, [touchStart, touchEnd]);

    const sendMessage = (e) => {
        e?.preventDefault();
        if (message.trim() || image) {
            const messageData = {
                id: new Date().toISOString(),
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
            inputRef.current?.focus();
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

    const formatSeenTime = (timestamp) => {
        if (!timestamp) return '';
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
                    <div
                        key={index}
                        className={`message ${msg.name === name ? 'self' : 'other'}`}
                    >
                        <strong>{msg.name}</strong>
                        {msg.replyTo && (
                            <div className="reply-content">
                                <span>Replying to {msg.replyTo.name}</span>
                                <p>{msg.replyTo.message}</p>
                            </div>
                        )}
                        {msg.message && <p>{msg.message}</p>}
                        {msg.image && <img src={msg.image} alt="sent" />}
                        <div className="message-status">
                            <span className="message-time">{formatTime(msg.timestamp)}</span>
                            {msg.name === name && seenMessages[msg.id] && (
                                <span className="seen-status">
                                    Seen {formatSeenTime(Object.values(seenMessages[msg.id])[0])}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <form className="chat-input" onSubmit={sendMessage}>
                <input
                    ref={inputRef}
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
                <button type="submit">Send</button>
            </form>
        </div>
    );
}

export default App;

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
    const [notificationPermission, setNotificationPermission] = useState(false);
    const [notificationEnabled, setNotificationEnabled] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [authError, setAuthError] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const authenticateUser = (userName) => {
        const allowedUsers = ['paari', 'vidhi'];
        return allowedUsers.includes(userName.toLowerCase());
    };

    const requestNotificationPermission = async () => {
        try {
            if (!('Notification' in window)) {
                alert('This browser does not support notifications');
                return;
            }

            const permission = await Notification.requestPermission();
            setNotificationPermission(permission === 'granted');
            setNotificationEnabled(permission === 'granted');
            
            if (permission === 'granted') {
                new Notification('Notifications enabled!', {
                    body: 'You will now receive notifications for new messages'
                });
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    };

    useEffect(() => {
        // Load messages from localStorage on startup
        const savedMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        setMessages(savedMessages);

        // Reconnect socket if disconnected
        socket.on('connect', () => {
            console.log('Connected to server successfully');
            const storedName = localStorage.getItem('name');
            
            if (storedName) {
                if (authenticateUser(storedName)) {
                    setName(storedName);
                    setIsAuthenticated(true);
                    socket.emit('new-user', storedName);
                } else {
                    localStorage.removeItem('name');
                    setAuthError('Authentication failed. Only Paari and Vidhi can use this app.');
                }
            } else {
                const userName = prompt('Enter your name (only Paari or Vidhi):');
                if (userName && authenticateUser(userName)) {
                    setName(userName);
                    setIsAuthenticated(true);
                    localStorage.setItem('name', userName);
                    socket.emit('new-user', userName);
                } else {
                    setAuthError('Authentication failed. Only Paari and Vidhi can use this app.');
                }
            }
        });

        // Add connection status logging
        socket.on('connect_error', (error) => {
            console.error('Connection Error:', error);
        });

        // Listen for messages and show notification
        socket.on('receive-message', (data) => {
            console.log('Received message:', data);
            setMessages((prev) => {
                const newMessages = [...prev, data];
                localStorage.setItem('chatMessages', JSON.stringify(newMessages));
                return newMessages;
            });

            // Show notification if the message is from someone else and the window is not focused
            if (data.name !== name && document.hidden && notificationPermission) {
                const notification = new Notification('New Message from ' + data.name, {
                    body: data.message || 'Sent an image',
                    icon: '/notification-icon.png' // You can add an icon in the public folder
                });

                // Play notification sound
                const audio = new Audio('/notification-sound.mp3'); // Add this file to public folder
                audio.play().catch(e => console.log('Audio play failed:', e));

                // Close notification after 5 seconds
                setTimeout(() => notification.close(), 5000);
            }
        });

        // Remove chat-history listener as we're using localStorage

        // Listen for chat cleared
        socket.on('chat-cleared', () => {
            console.log('Clearing chat...');
            setMessages([]); // Clear messages when chat is cleared
        });

        socket.on('message-seen', (data) => {
            setMessages(prevMessages => 
                prevMessages.map(msg => {
                    if (msg.timestamp === data.messageId && !msg.seenBy?.includes(data.username)) {
                        return {
                            ...msg,
                            seen: true,
                            seenBy: [...(msg.seenBy || []), data.username],
                            seenTimestamp: data.seenTimestamp
                        };
                    }
                    return msg;
                })
            );
        });

        return () => {
            socket.off('connect');
            socket.off('connect_error');
            socket.off('receive-message');
            socket.off('chat-cleared');
            socket.off('message-seen');
        };
    }, [name, notificationPermission]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const messageId = entry.target.getAttribute('data-message-id');
                        if (messageId) {
                            handleMessageSeen(messageId);
                        }
                    }
                });
            },
            { threshold: 0.5 }
        );

        const messageElements = document.querySelectorAll('.message.other');
        messageElements.forEach(el => observer.observe(el));

        return () => {
            messageElements.forEach(el => observer.unobserve(el));
        };
    }, [messages]);

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

    const handleReply = (message) => {
        setReplyTo(message);
    };

    const cancelReply = () => {
        setReplyTo(null);
    };

    const handleMessageSeen = (messageId) => {
        socket.emit('message-seen', { messageId, username: name, seenTimestamp: new Date().toISOString() });
    };

    const sendMessage = () => {
        if (message.trim() || image) {
            const messageData = {
                name,
                message: message.trim(),
                image,
                timestamp: new Date().toISOString(),
                replyTo: replyTo ? {
                    name: replyTo.name,
                    message: replyTo.message,
                    timestamp: replyTo.timestamp
                } : null
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
            {!isAuthenticated ? (
                <div className="auth-error">
                    <h2>Authentication Error</h2>
                    <p>{authError}</p>
                    <button onClick={() => window.location.reload()}>Try Again</button>
                </div>
            ) : (
                <>
                    <div className="chat-header">
                        <h2>Chat App ({name})</h2>
                        <button className="clear-button" onClick={clearChat}>🗑️</button>
                    </div>
                    <div className="chat-messages">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`message ${msg.name === name ? 'self' : 'other'}`}
                                data-message-id={msg.timestamp}
                            >
                                {msg.replyTo && (
                                    <div className="reply-context">
                                        <strong>{msg.replyTo.name}</strong>
                                        <p>{msg.replyTo.message || 'Image'}</p>
                                    </div>
                                )}
                                <strong>{msg.name}</strong>
                                {msg.message && <p>{msg.message}</p>}
                                {msg.image && <img src={msg.image} alt="sent" />}
                                <div className="message-footer">
                                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                                    {msg.name === name && (
                                        <div className="seen-status">
                                            {msg.seen ? `Seen ${formatTime(msg.seenTimestamp)}` : 'Sent'}
                                        </div>
                                    )}
                                </div>
                                <button className="reply-button" onClick={() => handleReply(msg)}>↩️</button>
                            </div>
                        ))}
                    </div>
                    {replyTo && (
                        <div className="reply-preview">
                            <div>
                                <strong>Replying to {replyTo.name}</strong>
                                <p>{replyTo.message || 'Image'}</p>
                            </div>
                            <button onClick={cancelReply}>✕</button>
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
                </>
            )}
        </div>
    );
}

export default App;

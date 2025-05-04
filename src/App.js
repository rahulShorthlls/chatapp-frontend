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
    const [notificationPermission, setNotificationPermission] = useState(false);
    const [notificationEnabled, setNotificationEnabled] = useState(false);

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
                
                // Show mobile notification for new messages
                if (data.name !== name && 'vibrate' in navigator) {
                    // Vibrate for 200ms
                    navigator.vibrate(200);
                    
                    // Play notification sound
                    const audio = new Audio('data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//tUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFbgC1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1tbW1//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjM1AAAAAAAAAAAAAAAAJAYAAAAAAAAABa7hf+NWwAAAAAAAAAAAAAAAAAAAAP/7kGQAD/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==');
                    audio.play().catch(console.error);
                    
                    // Try to use system notification if supported
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(data.name, {
                            body: data.message || 'Sent an image',
                            silent: true // Don't play system sound
                        });
                    }
                }
                
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

        return () => {
            window.removeEventListener('focus', handleFocus);
            socket.off('connect');
            socket.off('connect_error');
            socket.off('receive-message');
            socket.off('chat-cleared');
            socket.off('message-seen');
        };
    }, [name, notificationPermission]);

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
        e?.preventDefault(); // Prevent any default form behavior
        if (message.trim() || image) {
            const messageData = {
                id: new Date().toISOString(), // Add unique ID
                name,
                message: message.trim(),
                image,
                timestamp: new Date().toISOString()
            };
            
            socket.emit('send-message', messageData);
            setMessage('');
            setImage(null);
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
                <div className="header-buttons">
                    <button 
                        className="notification-button" 
                        onClick={requestNotificationPermission}
                        title={notificationEnabled ? "Notifications enabled" : "Enable notifications"}
                    >
                        {notificationEnabled ? '🔔' : '🔕'}
                    </button>
                    <button className="clear-button" onClick={clearChat}>
                        🗑️
                    </button>
                </div>
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
            <div className="chat-input">
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

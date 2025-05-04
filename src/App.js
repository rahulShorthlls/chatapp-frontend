import React, { useState, useEffect, useRef } from 'react';
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
    const [notificationEnabled, setNotificationEnabled] = useState(() => {
        return localStorage.getItem('notificationEnabled') === 'true';
    });
    const messagesEndRef = useRef(null);

    const showNotification = React.useCallback((title, body) => {
        if (!('Notification' in window)) {
            console.log('Notifications not supported');
            return;
        }

        if (Notification.permission === 'granted' && notificationEnabled) {
            try {
                const notification = new Notification(title, {
                    body,
                    icon: '/favicon.ico',
                    tag: 'chat-message',
                    silent: false
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                const audio = new Audio('https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3');
                audio.volume = 0.5;
                audio.play().catch(console.error);

            } catch (error) {
                console.error('Notification failed:', error);
            }
        }
    }, [notificationEnabled]);

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            alert('This browser does not support notifications');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            const isEnabled = permission === 'granted';
            setNotificationEnabled(isEnabled);
            localStorage.setItem('notificationEnabled', isEnabled.toString());

            if (isEnabled) {
                showNotification('Notifications Enabled', 'You will now receive chat notifications');
            }
        } catch (error) {
            console.error('Permission request failed:', error);
        }
    };

    useEffect(() => {
        const savedMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        setMessages(savedMessages);

        const checkNotificationPermission = async () => {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                const savedEnabled = localStorage.getItem('notificationEnabled') === 'true';
                const isEnabled = permission === 'granted' && savedEnabled;
                setNotificationEnabled(isEnabled);
            }
        };

        checkNotificationPermission();

        socket.on('connect', () => {
            console.log('Connected to server successfully');
            const userName = localStorage.getItem('name') || prompt('Enter your name:');
            if (!userName) return;
            setName(userName);
            localStorage.setItem('name', userName);
            socket.emit('new-user', userName);
        });

        socket.on('connect_error', (error) => {
            console.error('Connection Error:', error);
        });

        socket.on('receive-message', (data) => {
            setMessages(prev => {
                const newMessages = [...prev, data];
                localStorage.setItem('chatMessages', JSON.stringify(newMessages));
                
                if (data.name !== name && document.hidden) {
                    showNotification(
                        `New Message from ${data.name}`,
                        data.message || 'Sent an image'
                    );
                }

                // Scroll to bottom after message is added
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }, 100);
                
                return newMessages;
            });
        });

        socket.on('chat-cleared', () => {
            console.log('Clearing chat...');
            setMessages([]);
        });

        return () => {
            socket.off('connect');
            socket.off('connect_error');
            socket.off('receive-message');
            socket.off('chat-cleared');
        };
    }, [name, showNotification]);

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

    const sendMessage = () => {
        if (message.trim() || image) {
            const messageData = {
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
                        {msg.message && <p>{msg.message}</p>}
                        {msg.image && <img src={msg.image} alt="sent" />}
                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
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

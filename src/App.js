
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

// SVG component for the send icon
const SendIcon = () => (
  <svg className="send-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

// SVG component for the copy icon
const CopyIcon = () => (
  <svg className="copy-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
  </svg>
);

// SVG component for the delete icon
const DeleteIcon = () => (
  <svg className="delete-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);

// A simple spinner component
const Spinner = () => <div className="spinner-border"></div>;

function App() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const chatEndRef = useRef(null);

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages for the current conversation when it changes
  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
    } else {
      setChatHistory([]); // Clear chat history if no conversation is selected
    }
  }, [currentConversationId]);

  // Scroll to the bottom of the chat on new message or loading state change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  const fetchConversations = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        // Automatically select the latest conversation if available and no conversation is selected
        if (data.length > 0 && currentConversationId === null) {
          setCurrentConversationId(data[0].id);
        } else if (data.length === 0) {
          setCurrentConversationId(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchMessages = async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/conversations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setChatHistory(data);
      }
    } catch (error) {
      console.error(`Failed to fetch messages for conversation ${id}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (message.trim() !== '' && !loading) {
      const userMessage = { text: message, sender: 'user', timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, userMessage]);
      setMessage('');
      setLoading(true);

      try {
        const response = await fetch('http://localhost:5000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage.text, conversationId: currentConversationId }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        const aiMessage = { text: data.response, sender: 'ai', timestamp: new Date().toISOString() };
        setChatHistory(prev => [...prev, aiMessage]);

        // If it was a new conversation, update the current ID and fetch conversations again
        if (!currentConversationId) {
          setCurrentConversationId(data.conversationId);
          fetchConversations(); // Refresh conversation list to show new one
        }

      } catch (error) {
        console.error('Error sending message:', error);
        const errorMessage = { text: 'Sorry, something went wrong. Please try again.', sender: 'ai', timestamp: new Date().toISOString() };
        setChatHistory(prev => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setChatHistory([]);
    setMessage('');
    setLoading(false);
  };

  const handleDeleteConversation = async (id, event) => {
    event.stopPropagation(); // Prevent selecting the conversation when deleting
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        const response = await fetch(`http://localhost:5000/api/conversations/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          fetchConversations(); // Refresh the list
          if (currentConversationId === id) {
            setCurrentConversationId(null); // Clear current chat if deleted
          }
        } else {
          console.error('Failed to delete conversation');
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
      }
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const formatTimestamp = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <button className="new-chat-button" onClick={startNewChat}>+ New Chat</button>
        <div className="conversation-list">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
              onClick={() => setCurrentConversationId(conv.id)}
            >
              <span className="conversation-title">{conv.title}</span>
              <button className="delete-conversation-button" onClick={(e) => handleDeleteConversation(conv.id, e)}>
                <DeleteIcon />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="main-chat-area">
        <header className="chat-header">
          洛克王国安德莉亚
        </header>

        <div className="chat-history">
          {chatHistory.map((chat, index) => (
            <div key={index} className={`message-wrapper ${chat.sender}`}>
              <div className={`avatar ${chat.sender}-avatar`}>
                {chat.sender === 'ai' ? '安德莉亚' : '波比'}
              </div>
              <div className={`message-bubble ${chat.sender}-bubble`}>
                <ReactMarkdown>{chat.text}</ReactMarkdown>
                {chat.timestamp && <div className="message-timestamp">{formatTimestamp(chat.timestamp)}</div>}
                {chat.sender === 'ai' && (
                  <button className="copy-button" onClick={() => handleCopy(chat.text)}>
                    <CopyIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
              <div className="message-wrapper ai">
                  <div className="avatar ai-avatar">安德莉亚</div>
                  <div className="message-bubble ai-bubble loading-indicator">
                      <Spinner />
                  </div>
              </div>
          )}
          <div ref={chatEndRef} />
        </div>

        

        <form onSubmit={handleSendMessage} className="message-form">
          <input
            type="text"
            className="message-input"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="send-button" disabled={loading}>
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;

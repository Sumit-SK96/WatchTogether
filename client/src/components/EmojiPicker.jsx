import React from 'react';

const EMOJI_CATEGORIES = [
  { name: 'Smileys', emojis: ['😀','😂','🥰','😎','🤔','🙄','😴','😷','🤯','🥳'] },
  { name: 'Gestures', emojis: ['👍','👎','✌️','🤞','🤝','🙏','💪','👋','🤙','🤌'] },
  { name: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','💔','💖','💘'] },
  { name: 'Objects', emojis: ['🎬','🍿','🍕','🍔','🍺','🥂','🎮','🎧','📱','💡'] }
];

export default function EmojiPicker({ onSelect, onClose }) {
  // Prevent clicks inside the picker from closing it
  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div 
      onClick={handleContainerClick}
      className="glass-panel"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '0',
        marginBottom: '12px',
        width: '320px',
        height: '280px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        zIndex: 50,
        transformOrigin: 'bottom left',
        animation: 'slideUpFade 0.15s var(--spring-ease)',
        overflowY: 'auto'
      }}
    >
      <style>{`
        @keyframes slideUpFade {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .emoji-grid-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 6px;
          transition: transform 0.15s var(--spring-ease);
        }
        .emoji-grid-btn:hover {
          transform: scale(1.3);
          background: rgba(124, 58, 237, 0.2);
        }
      `}</style>
      
      {EMOJI_CATEGORIES.map(category => (
        <div key={category.name}>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '0.05em'
          }}>
            {category.name}
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {category.emojis.map(emoji => (
              <button
                key={emoji}
                className="emoji-grid-btn"
                onClick={() => onSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

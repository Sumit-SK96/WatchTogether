import React, { useState, useEffect } from 'react';

const MOCK_GIFS = [
  { id: '1', url: 'https://media.tenor.com/zW8R2sU1nKcAAAAC/laugh-cry.gif', thumb: 'https://media.tenor.com/zW8R2sU1nKcAAAAC/laugh-cry.gif' },
  { id: '2', url: 'https://media.tenor.com/152W02oM_wQAAAAC/wow-omg.gif', thumb: 'https://media.tenor.com/152W02oM_wQAAAAC/wow-omg.gif' },
  { id: '3', url: 'https://media.tenor.com/z1hXG5z1XKcAAAAC/popcorn-eating.gif', thumb: 'https://media.tenor.com/z1hXG5z1XKcAAAAC/popcorn-eating.gif' },
  { id: '4', url: 'https://media.tenor.com/lx2aS6HLOE4AAAAC/mind-blown-explosion.gif', thumb: 'https://media.tenor.com/lx2aS6HLOE4AAAAC/mind-blown-explosion.gif' },
  { id: '5', url: 'https://media.tenor.com/PZcI6r1y4P4AAAAC/clap-clapping.gif', thumb: 'https://media.tenor.com/PZcI6r1y4P4AAAAC/clap-clapping.gif' },
  { id: '6', url: 'https://media.tenor.com/qL3p9E3yVGEAAAAC/no-nope.gif', thumb: 'https://media.tenor.com/qL3p9E3yVGEAAAAC/no-nope.gif' },
  { id: '7', url: 'https://media.tenor.com/Z4c2g6y9XJAAAAAC/dance-dancing.gif', thumb: 'https://media.tenor.com/Z4c2g6y9XJAAAAAC/dance-dancing.gif' },
  { id: '8', url: 'https://media.tenor.com/7D2Uu7H-c9UAAAAC/confused-john-travolta.gif', thumb: 'https://media.tenor.com/7D2Uu7H-c9UAAAAC/confused-john-travolta.gif' },
  { id: '9', url: 'https://media.tenor.com/jIuG5jR6MQQAAAAC/crying-sad.gif', thumb: 'https://media.tenor.com/jIuG5jR6MQQAAAAC/crying-sad.gif' },
];

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchGifs = () => {
      setLoading(true);
      setTimeout(() => {
        if (active) {
          setGifs(MOCK_GIFS);
          setLoading(false);
        }
      }, 200);
    };
    
    // Debounce search
    const timer = setTimeout(fetchGifs, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

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
        height: '320px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 50,
        transformOrigin: 'bottom left',
        animation: 'slideUpFade 0.15s var(--spring-ease)',
      }}
    >
      <input 
        type="text" 
        placeholder="Search GIFs..." 
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'var(--surface-light)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          color: 'var(--text)',
          fontSize: '0.85rem',
          outline: 'none'
        }}
        autoFocus
      />
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        paddingRight: '4px'
      }}>
        {loading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
            Loading...
          </div>
        ) : (
          gifs.map(gif => (
            <img 
              key={gif.id}
              src={gif.thumb}
              alt="gif"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(gif.url);
              }}
              style={{
                width: '100%',
                height: '80px',
                objectFit: 'cover',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            />
          ))
        )}
      </div>
    </div>
  );
}

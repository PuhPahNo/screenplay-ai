-- Characters table
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  arc TEXT,
  relationships TEXT,  -- JSON string
  appearances TEXT     -- JSON string array of scene IDs
);

-- Scenes table
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  number INTEGER,
  heading TEXT,
  location TEXT,
  time_of_day TEXT,
  summary TEXT,
  characters TEXT,  -- JSON string array of character IDs
  start_line INTEGER,
  end_line INTEGER,
  content TEXT
);

-- Storyline table
CREATE TABLE IF NOT EXISTS storyline (
  id TEXT PRIMARY KEY,
  act INTEGER,
  plot_points TEXT,  -- JSON string
  themes TEXT,       -- JSON string array
  narrative_structure TEXT
);

-- AI Memory table
CREATE TABLE IF NOT EXISTS ai_memory (
  id TEXT PRIMARY KEY,
  timestamp INTEGER,
  context_type TEXT,
  content TEXT,
  embedding BLOB
);

-- AI History table (for chat messages)
CREATE TABLE IF NOT EXISTS ai_history (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  context_used TEXT  -- JSON string
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scenes_number ON scenes(number);
CREATE INDEX IF NOT EXISTS idx_ai_history_timestamp ON ai_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_memory_context_type ON ai_memory(context_type);


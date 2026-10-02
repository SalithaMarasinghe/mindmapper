-- ============================================================================
-- Migration: 20261011120000_jarvis_vector_memory.sql
-- Description: Enable pgvector, create jarvis_memory_embeddings table, HNSW index,
--              add summary_xyz to projects, and define match_jarvis_memory RPC.
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add summary_xyz to projects table if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'summary_xyz'
    ) THEN
        ALTER TABLE projects ADD COLUMN summary_xyz TEXT;
    END IF;
END $$;

-- 3. Create jarvis_memory_embeddings table
CREATE TABLE IF NOT EXISTS jarvis_memory_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Source Reference
    source_type TEXT NOT NULL CHECK (source_type IN ('work_journal', 'meeting', 'project_summary', 'mindmap', 'task')),
    source_id UUID NOT NULL,
    
    -- Storyline Context
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_name TEXT,
    event_date DATE,
    
    -- Chunk semantics
    chunk_type TEXT NOT NULL CHECK (chunk_type IN ('executive', 'technical', 'decision', 'action_item', 'project_summary')),
    content TEXT NOT NULL,
    embedding VECTOR(768),
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE jarvis_memory_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own embeddings" ON jarvis_memory_embeddings;
CREATE POLICY "Users can manage their own embeddings" 
ON jarvis_memory_embeddings 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. HNSW Index for ultra-fast similarity search (Cosine distance)
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_embedding_hnsw 
ON jarvis_memory_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for relational lookups
CREATE INDEX IF NOT EXISTS idx_jarvis_memory_user_project 
ON jarvis_memory_embeddings (user_id, project_id, chunk_type);

CREATE INDEX IF NOT EXISTS idx_jarvis_memory_date 
ON jarvis_memory_embeddings (user_id, event_date);

-- 6. RPC: match_jarvis_memory for hybrid/filtered semantic search
CREATE OR REPLACE FUNCTION match_jarvis_memory(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.4,
    match_count INT DEFAULT 10,
    p_user_id UUID DEFAULT NULL,
    p_project_name TEXT DEFAULT NULL,
    p_chunk_type TEXT DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    source_type TEXT,
    source_id UUID,
    project_id UUID,
    project_name TEXT,
    event_date DATE,
    chunk_type TEXT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    effective_user_id UUID;
BEGIN
    effective_user_id := COALESCE(p_user_id, auth.uid());
    
    IF effective_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID must be provided or user must be authenticated.';
    END IF;

    RETURN QUERY
    SELECT
        m.id,
        m.source_type,
        m.source_id,
        m.project_id,
        m.project_name,
        m.event_date,
        m.chunk_type,
        m.content,
        m.metadata,
        (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
    FROM jarvis_memory_embeddings m
    WHERE m.user_id = effective_user_id
      AND (p_project_name IS NULL OR m.project_name ILIKE '%' || p_project_name || '%')
      AND (p_chunk_type IS NULL OR m.chunk_type = p_chunk_type)
      AND (p_start_date IS NULL OR m.event_date >= p_start_date)
      AND (p_end_date IS NULL OR m.event_date <= p_end_date)
      AND (1 - (m.embedding <=> query_embedding)) > match_threshold
    ORDER BY m.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

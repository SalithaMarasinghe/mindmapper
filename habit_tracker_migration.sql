-- ==============================================================================
-- Habit Tracker Migration
-- ==============================================================================

-- 1. Create habits table
CREATE TABLE IF NOT EXISTS public.habits (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_minutes INTEGER NOT NULL DEFAULT 60,
    color TEXT NOT NULL DEFAULT '#8b5cf6',
    icon TEXT DEFAULT '⚡',
    project_id TEXT,
    project_tag TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create habit_logs table
CREATE TABLE IF NOT EXISTS public.habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_habit_date UNIQUE (user_id, habit_id, date)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for habits
CREATE POLICY "Users can view their own habits" 
    ON public.habits FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habits" 
    ON public.habits FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits" 
    ON public.habits FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits" 
    ON public.habits FOR DELETE 
    USING (auth.uid() = user_id);

-- 5. Create RLS Policies for habit_logs
CREATE POLICY "Users can view their own habit logs" 
    ON public.habit_logs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habit logs" 
    ON public.habit_logs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit logs" 
    ON public.habit_logs FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit logs" 
    ON public.habit_logs FOR DELETE 
    USING (auth.uid() = user_id);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public.habit_logs(user_id, date);

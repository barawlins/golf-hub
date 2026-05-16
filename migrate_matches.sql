-- Migration: Add missing columns to matches table
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Add course_id and tee_id columns
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS course_id text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS tee_id text;

-- 2. Add nines point distribution columns
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS points_1st float;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS points_2nd float;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS points_3rd float;

-- 3. Update the format constraint to allow all match formats
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_format_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_format_check CHECK (format IN ('1v1', '2v1', '2v2', 'nines'));

-- Crește limita de dimensiune pentru poze foraj (5 MB -> 20 MB)
-- Pozele de pe telefoane pot depăși 5 MB ușor
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'borehole-photos';

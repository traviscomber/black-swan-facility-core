-- Keep extension-owned objects out of the exposed public schema.
-- btree_gist is relocatable and the canonical extensions schema is already in search_path.

alter extension btree_gist set schema extensions;

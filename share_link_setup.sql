-- Share links: schema + public read policies

ALTER TABLE mindmaps
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Public can read shared mindmap metadata by token
CREATE POLICY IF NOT EXISTS "public_can_read_shared_mindmaps"
ON mindmaps
FOR SELECT
TO public
USING (share_token IS NOT NULL);

-- Public can read nodes for shared maps
CREATE POLICY IF NOT EXISTS "public_can_read_nodes_of_shared_maps"
ON nodes
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM mindmaps
    WHERE mindmaps.id = nodes.map_id
      AND mindmaps.share_token IS NOT NULL
  )
);

-- Public can read node_content for shared maps
CREATE POLICY IF NOT EXISTS "public_can_read_node_content_of_shared_maps"
ON node_content
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM mindmaps
    WHERE mindmaps.id = node_content.map_id
      AND mindmaps.share_token IS NOT NULL
  )
);

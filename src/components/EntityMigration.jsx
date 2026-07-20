import { useEntityMigration } from '../lib/context/notesEntities';

// Headless: runs the one-time per-workspace migration of legacy per-app stores
// into the unified `entities` store (WEBOS Phase 4). Renders nothing.
export default function EntityMigration() {
  useEntityMigration();
  return null;
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Download, ExternalLink, File as FileIcon, FileText, FolderPlus, Folder, FolderOpen,
  Home, Image as ImageIcon, Pencil, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store/WorkspaceProvider';
import { downloadBytes, readFileBytes } from '@/lib/office';
import { zipBlobs } from '@/lib/zip';
import { humanBytes } from '@/lib/image-shared';
import { putBlob, getBlob, deleteBlobs } from '@/lib/blobStore';
import { appForFile, requestOpen } from '@/lib/openWith';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `d-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

// A soft cap so a stray huge upload doesn't blow the browser's storage quota.
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per file

function extIcon(mime, name) {
  const m = mime || '';
  if (m.startsWith('image/')) return ImageIcon;
  if (m === 'application/pdf' || /\.pdf$/i.test(name)) return FileText;
  if (m.startsWith('text/') || /\.(txt|md|csv|json|docx?|xlsx?|pptx?)$/i.test(name)) return FileText;
  return FileIcon;
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

// Drive: a per-workspace file store. Metadata (the folder tree + file records)
// lives in useStore('driveNodes') so it is workspace-isolated and synced; the
// actual file BYTES live in IndexedDB (src/lib/blobStore) keyed by node id, so
// large binaries never bloat localStorage/RTDB.
function DriveApp() {
  const [nodes, setNodes] = useStore('driveNodes', []);
  const [cwd, setCwd] = useState(null); // current folder id (null = root)
  const [renaming, setRenaming] = useState(null); // node id
  const [renameVal, setRenameVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null); // { node, url }
  const [menu, setMenu] = useState(null); // { node, x, y }
  const fileRef = useRef(null);
  const navigate = useNavigate();

  // Storage used by THIS workspace — sum the file sizes in its metadata (each
  // workspace's `nodes` is already isolated), not the global IndexedDB total.
  const usage = useMemo(() => nodes.reduce((s, n) => s + (n.kind === 'file' ? (n.size || 0) : 0), 0), [nodes]);

  const rootRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // If the workspace switched and the current folder no longer exists, reset.
  useEffect(() => {
    if (cwd && !nodes.some((n) => n.id === cwd && n.kind === 'folder')) setCwd(null);
  }, [nodes, cwd]);

  const byId = useMemo(() => { const m = new Map(); nodes.forEach((n) => m.set(n.id, n)); return m; }, [nodes]);

  const children = useMemo(() => {
    const list = nodes.filter((n) => (n.parentId ?? null) === cwd);
    // folders first, then files, each alphabetical
    return list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [nodes, cwd]);

  const breadcrumbs = useMemo(() => {
    const chain = [];
    let id = cwd;
    while (id) { const n = byId.get(id); if (!n) break; chain.unshift(n); id = n.parentId ?? null; }
    return chain;
  }, [cwd, byId]);

  // Descendant ids of a folder (inclusive) — for recursive delete / zip.
  const descendantsOf = (id) => {
    const out = [];
    const walk = (pid) => {
      for (const n of nodes) if ((n.parentId ?? null) === pid) { out.push(n); if (n.kind === 'folder') walk(n.id); }
    };
    walk(id);
    return out;
  };

  const nameExists = (name, kind) => children.some((n) => n.kind === kind && n.name.toLowerCase() === name.toLowerCase());
  const uniqueName = (name, kind) => {
    if (!nameExists(name, kind)) return name;
    const dot = name.lastIndexOf('.');
    const base = dot > 0 && kind === 'file' ? name.slice(0, dot) : name;
    const ext = dot > 0 && kind === 'file' ? name.slice(dot) : '';
    let i = 1;
    let candidate;
    do { candidate = `${base} (${i})${ext}`; i += 1; } while (nameExists(candidate, kind));
    return candidate;
  };

  // ---- actions ----
  const newFolder = () => {
    const name = uniqueName('New folder', 'folder');
    const id = newId();
    setNodes([...nodes, { id, name, kind: 'folder', parentId: cwd, createdMs: Date.now() }]);
    setRenaming(id);
    setRenameVal(name);
  };

  const onPickFiles = () => fileRef.current?.click();

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) { toast.error(`"${file.name}" is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`); continue; }
        const id = newId();
        try {
          await putBlob(id, file);
        } catch (err) {
          toast.error(`Couldn't store "${file.name}": ${err.message || err}`);
          continue;
        }
        added.push({ id, name: uniqueNameWith(added, file.name), kind: 'file', parentId: cwd, size: file.size, mime: file.type || '', createdMs: Date.now() });
      }
      if (added.length) {
        setNodes([...nodes, ...added]);
        toast.success(`Uploaded ${added.length} file${added.length > 1 ? 's' : ''}`);
      }
    } finally {
      setBusy(false);
    }
  };
  // name-uniqueness that also accounts for files added earlier in this same batch
  const uniqueNameWith = (pending, name) => {
    const taken = new Set([...children, ...pending].filter((n) => n.kind === 'file').map((n) => n.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 1;
    let c;
    do { c = `${base} (${i})${ext}`; i += 1; } while (taken.has(c.toLowerCase()));
    return c;
  };

  const onFileInput = (e) => { addFiles(e.target.files); e.target.value = ''; };

  const commitRename = () => {
    const id = renaming;
    const val = renameVal.trim();
    setRenaming(null);
    if (!id || !val) return;
    setNodes(nodes.map((n) => (n.id === id ? { ...n, name: val } : n)));
  };

  const remove = async (node) => {
    const isFolder = node.kind === 'folder';
    const desc = isFolder ? descendantsOf(node.id) : [];
    const all = [node, ...desc];
    const fileIds = all.filter((n) => n.kind === 'file').map((n) => n.id);
    const removeIds = new Set(all.map((n) => n.id));
    setNodes(nodes.filter((n) => !removeIds.has(n.id)));
    if (fileIds.length) { try { await deleteBlobs(fileIds); } catch { /* ignore */ } }
    toast.success(`Deleted "${node.name}"`);
  };

  const openFile = async (node) => {
    try {
      const blob = await getBlob(node.id);
      if (!blob) { toast.error('File data missing'); return; }
      const url = URL.createObjectURL(blob);
      if ((node.mime || '').startsWith('image/')) { setPreview({ node, url }); return; }
      // open other types in a new tab
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(`Couldn't open file: ${err.message || err}`);
    }
  };

  const download = async (node) => {
    try {
      const blob = await getBlob(node.id);
      if (!blob) { toast.error('File data missing'); return; }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      downloadBytes(bytes, node.name, node.mime || 'application/octet-stream');
    } catch (err) {
      toast.error(`Download failed: ${err.message || err}`);
    }
  };

  const downloadFolder = async (folder) => {
    setBusy(true);
    try {
      const desc = descendantsOf(folder.id).filter((n) => n.kind === 'file');
      if (!desc.length) { toast.error('Folder is empty'); return; }
      // build path names relative to the folder
      const pathOf = (n) => {
        const parts = [n.name];
        let pid = n.parentId;
        while (pid && pid !== folder.id) { const p = byId.get(pid); if (!p) break; parts.unshift(p.name); pid = p.parentId; }
        return parts.join('/');
      };
      const entries = [];
      for (const n of desc) {
        const blob = await getBlob(n.id);
        if (blob) entries.push({ name: pathOf(n), blob });
      }
      const zip = await zipBlobs(entries);
      downloadBytes(new Uint8Array(await zip.arrayBuffer()), `${folder.name}.zip`, 'application/zip');
      toast.success(`Zipped ${entries.length} file${entries.length > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(`Zip failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const open = (node) => {
    if (node.kind === 'folder') setCwd(node.id);
    else openFile(node);
  };

  // Open a file in its matching app (Word/Excel/PowerPoint/PDF): hand the bytes
  // to the openWith channel and navigate to that app's route.
  const openInApp = async (node) => {
    const target = appForFile(node.name);
    if (!target) return;
    try {
      const blob = await getBlob(node.id);
      if (!blob) { toast.error('File data missing'); return; }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      requestOpen(target.app, node.name, bytes);
      navigate(target.route);
    } catch (err) {
      toast.error(`Couldn't open: ${err.message || err}`);
    }
  };

  const openContextMenu = (e, node) => {
    if (node.kind !== 'file') return;
    e.preventDefault();
    setMenu({ node, x: e.clientX, y: e.clientY });
  };

  // ---- drag & drop upload ----
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div
      ref={rootRef}
      className="@container flex h-full min-h-0 flex-col"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      <input ref={fileRef} type="file" multiple className="hidden" onChange={onFileInput} />

      {/* Toolbar */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 border-b pb-2">
        <Button size="sm" className="gap-1.5" onClick={onPickFiles} disabled={busy}><Upload className="size-4" /> Upload</Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={newFolder} disabled={busy}><FolderPlus className="size-4" /> New folder</Button>
        <div className="ml-auto text-xs text-muted-foreground">{humanBytes(usage)} used</div>
      </div>

      {/* Breadcrumbs */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-0.5 text-sm">
        <button type="button" className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent', cwd === null && 'font-medium')} onClick={() => setCwd(null)}>
          <Home className="size-3.5" /> Drive
        </button>
        {breadcrumbs.map((n) => (
          <React.Fragment key={n.id}>
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button type="button" className="max-w-40 truncate rounded px-1.5 py-0.5 hover:bg-accent" onClick={() => setCwd(n.id)}>{n.name}</button>
          </React.Fragment>
        ))}
      </div>

      {/* Contents */}
      <div className={cn('relative min-h-0 flex-1 overflow-y-auto rounded-md border p-2', dragOver && 'border-primary ring-2 ring-primary/40')}>
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/5 text-sm font-medium text-primary">
            Drop files to upload
          </div>
        )}
        {children.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <FolderOpen className="size-8 opacity-40" />
            This folder is empty. Upload files or drop them here.
          </div>
        ) : (
          <div className={cn('grid gap-2', narrow ? 'grid-cols-1' : 'grid-cols-2 @2xl:grid-cols-3')}>
            {children.map((n) => {
              const Icon = n.kind === 'folder' ? Folder : extIcon(n.mime, n.name);
              const isRenaming = renaming === n.id;
              return (
                <Card key={n.id} className="group gap-0 py-0 transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center gap-2 px-3 py-2" onContextMenu={(e) => openContextMenu(e, n)}>
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => !isRenaming && open(n)} onDoubleClick={() => open(n)}>
                      <Icon className={cn('size-5 shrink-0', n.kind === 'folder' ? 'text-primary' : 'text-muted-foreground')} />
                      {isRenaming ? (
                        <Input
                          autoFocus
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={commitRename}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } else if (e.key === 'Escape') { setRenaming(null); } }}
                          className="h-7"
                        />
                      ) : (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{n.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {n.kind === 'folder' ? 'Folder' : humanBytes(n.size || 0)} · {relativeTime(n.createdMs)}
                          </p>
                        </div>
                      )}
                    </button>
                    {!isRenaming && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {n.kind === 'file' && appForFile(n.name) && (
                          <Button variant="ghost" size="icon" className="size-7" title={appForFile(n.name).label} onClick={() => openInApp(n)}><ExternalLink className="size-3.5" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="size-7" title="Rename" onClick={() => { setRenaming(n.id); setRenameVal(n.name); }}><Pencil className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-7" title={n.kind === 'folder' ? 'Download as .zip' : 'Download'} onClick={() => (n.kind === 'folder' ? downloadFolder(n) : download(n))}><Download className="size-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" title="Delete" onClick={() => remove(n)}><Trash2 className="size-3.5" /></Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Right-click context menu (files) */}
      {menu && (
        <>
          <div className="fixed inset-0 z-[5999]" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="fixed z-[6000] min-w-44 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg" style={{ left: menu.x, top: menu.y }}>
            {appForFile(menu.node.name) && (
              <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent" onClick={() => { openInApp(menu.node); setMenu(null); }}>
                <ExternalLink className="size-3.5" /> {appForFile(menu.node.name).label}
              </button>
            )}
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent" onClick={() => { open(menu.node); setMenu(null); }}>
              <FolderOpen className="size-3.5" /> Preview
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent" onClick={() => { setRenaming(menu.node.id); setRenameVal(menu.node.name); setMenu(null); }}>
              <Pencil className="size-3.5" /> Rename
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent" onClick={() => { download(menu.node); setMenu(null); }}>
              <Download className="size-3.5" /> Download
            </button>
            <div className="my-1 h-px bg-border" />
            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-destructive hover:bg-accent" onClick={() => { remove(menu.node); setMenu(null); }}>
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </>
      )}

      {/* Image preview overlay */}
      {preview && (
        <div
          className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/70 p-6"
          onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}
        >
          <div className="flex max-h-full max-w-full flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.node.name} className="max-h-[80vh] max-w-full rounded-md object-contain" />
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="truncate">{preview.node.name}</span>
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => download(preview.node)}><Download className="size-4" /> Download</Button>
              <Button size="sm" variant="secondary" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriveApp;

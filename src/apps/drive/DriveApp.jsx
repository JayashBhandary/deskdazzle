import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, Download, ExternalLink, File as FileIcon, FileArchive, FileText,
  FolderPlus, Folder, FolderOpen, Home, Image as ImageIcon, LayoutGrid, List as ListIcon,
  Loader2, Pencil, RefreshCw, Trash2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store/WorkspaceProvider';
import { office, downloadBytes } from '@/lib/office';
import { humanBytes } from '@/lib/image-shared';
import { putBlob, getBlob, deleteBlobs } from '@/lib/blobStore';
import { appForFile, requestOpen } from '@/lib/openWith';
import { convertTargets, runConvert } from './convert';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { newId } from '@/lib/id';

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const extOf = (name) => (name.lastIndexOf('.') >= 0 ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');
const isZip = (n) => n.kind === 'file' && extOf(n.name) === 'zip';

function extIcon(node) {
  if (node.kind === 'folder') return Folder;
  const m = node.mime || '';
  const e = extOf(node.name);
  if (m.startsWith('image/') || /^(png|jpe?g|webp|gif|bmp|svg)$/.test(e)) return ImageIcon;
  if (e === 'zip') return FileArchive;
  if (m === 'application/pdf' || /^(pdf|txt|md|csv|docx?|xlsx?|pptx?)$/.test(e)) return FileText;
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

// A per-workspace file explorer. Metadata (folder tree) is in useStore
// (workspace-isolated + synced); file bytes live in IndexedDB. Compress/extract
// (zip) and all conversions run on-device via the Rust/wasm cores.
function DriveApp() {
  const [nodes, setNodes] = useStore('driveNodes', []);
  const [cwd, setCwd] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [lastClicked, setLastClicked] = useState(null);
  const [view, setView] = useStore('driveView', 'list'); // 'list' | 'grid'
  const [sort, setSort] = useState({ key: 'name', dir: 1 });
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  // Revoke the preview's object URL when it changes or the app unmounts, so an
  // image preview left open (or the window closed) never leaks the blob.
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);
  const [menu, setMenu] = useState(null); // { node, x, y }
  const [convertFor, setConvertFor] = useState(null); // node for convert submenu
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const rootRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const usage = useMemo(() => nodes.reduce((s, n) => s + (n.kind === 'file' ? (n.size || 0) : 0), 0), [nodes]);
  const byId = useMemo(() => { const m = new Map(); nodes.forEach((n) => m.set(n.id, n)); return m; }, [nodes]);

  useEffect(() => {
    if (cwd && !nodes.some((n) => n.id === cwd && n.kind === 'folder')) setCwd(null);
  }, [nodes, cwd]);
  useEffect(() => { setSel(new Set()); setLastClicked(null); }, [cwd]);

  const children = useMemo(() => {
    const list = nodes.filter((n) => (n.parentId ?? null) === cwd);
    const dir = sort.dir;
    return list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1; // folders first
      let cmp = 0;
      if (sort.key === 'size') cmp = (a.size || 0) - (b.size || 0);
      else if (sort.key === 'type') cmp = extOf(a.name).localeCompare(extOf(b.name));
      else if (sort.key === 'modified') cmp = (a.createdMs || 0) - (b.createdMs || 0);
      else cmp = a.name.localeCompare(b.name);
      return cmp * dir || a.name.localeCompare(b.name);
    });
  }, [nodes, cwd, sort]);

  const breadcrumbs = useMemo(() => {
    const chain = []; let id = cwd;
    while (id) { const n = byId.get(id); if (!n) break; chain.unshift(n); id = n.parentId ?? null; }
    return chain;
  }, [cwd, byId]);

  const descendantsOf = (id) => {
    const out = [];
    const walk = (pid) => { for (const n of nodes) if ((n.parentId ?? null) === pid) { out.push(n); if (n.kind === 'folder') walk(n.id); } };
    walk(id);
    return out;
  };

  const uniqueName = (name, kind, parent = cwd, extra = []) => {
    const taken = new Set([
      ...nodes.filter((n) => (n.parentId ?? null) === parent && n.kind === kind).map((n) => n.name.toLowerCase()),
      ...extra.map((s) => s.toLowerCase()),
    ]);
    if (!taken.has(name.toLowerCase())) return name;
    const dot = kind === 'file' ? name.lastIndexOf('.') : -1;
    const b = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 1; let c;
    do { c = `${b} (${i})${ext}`; i += 1; } while (taken.has(c.toLowerCase()));
    return c;
  };

  // ---- selection ----
  const clickItem = (e, node, index) => {
    if (e.metaKey || e.ctrlKey) {
      setSel((s) => { const n = new Set(s); if (n.has(node.id)) n.delete(node.id); else n.add(node.id); return n; });
      setLastClicked(index);
    } else if (e.shiftKey && lastClicked != null) {
      const [a, b] = [Math.min(lastClicked, index), Math.max(lastClicked, index)];
      setSel(new Set(children.slice(a, b + 1).map((n) => n.id)));
    } else {
      setSel(new Set([node.id]));
      setLastClicked(index);
    }
  };
  const selectedNodes = useMemo(() => children.filter((n) => sel.has(n.id)), [children, sel]);

  // ---- create / mutate ----
  const newFolder = () => {
    const name = uniqueName('New folder', 'folder');
    const id = newId();
    setNodes([...nodes, { id, name, kind: 'folder', parentId: cwd, createdMs: Date.now() }]);
    setRenaming(id); setRenameVal(name);
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) { toast.error(`"${file.name}" too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`); continue; }
        const id = newId();
        try { await putBlob(id, file); } catch (err) { toast.error(`Couldn't store "${file.name}": ${err.message || err}`); continue; }
        added.push({ id, name: uniqueName(file.name, 'file', cwd, added.map((a) => a.name)), kind: 'file', parentId: cwd, size: file.size, mime: file.type || '', createdMs: Date.now() });
      }
      if (added.length) { setNodes([...nodes, ...added]); toast.success(`Uploaded ${added.length} file${added.length > 1 ? 's' : ''}`); }
    } finally { setBusy(false); }
  };

  const commitRename = () => {
    const id = renaming; const val = renameVal.trim();
    setRenaming(null);
    if (!id || !val) return;
    setNodes(nodes.map((n) => (n.id === id ? { ...n, name: val } : n)));
  };

  const removeNodes = async (targets) => {
    const all = [];
    for (const node of targets) { all.push(node); if (node.kind === 'folder') all.push(...descendantsOf(node.id)); }
    const ids = new Set(all.map((n) => n.id));
    const fileIds = all.filter((n) => n.kind === 'file').map((n) => n.id);
    setNodes(nodes.filter((n) => !ids.has(n.id)));
    setSel(new Set());
    if (fileIds.length) { try { await deleteBlobs(fileIds); } catch { /* ignore */ } }
    toast.success(`Deleted ${targets.length} item${targets.length > 1 ? 's' : ''}`);
  };

  const bytesOf = async (node) => { const b = await getBlob(node.id); if (!b) throw new Error('file data missing'); return new Uint8Array(await b.arrayBuffer()); };

  // ---- open / preview / open-in-app ----
  const openFile = async (node) => {
    try {
      const blob = await getBlob(node.id);
      if (!blob) { toast.error('File data missing'); return; }
      const url = URL.createObjectURL(blob);
      if ((node.mime || '').startsWith('image/') || /^(png|jpe?g|webp|gif|bmp)$/.test(extOf(node.name))) { setPreview({ node, url }); return; }
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) { toast.error(`Couldn't open: ${err.message || err}`); }
  };
  const open = (node) => { if (node.kind === 'folder') setCwd(node.id); else openFile(node); };

  const openInApp = async (node) => {
    const target = appForFile(node.name);
    if (!target) return;
    try { requestOpen(target.app, node.name, await bytesOf(node)); navigate(target.route); }
    catch (err) { toast.error(`Couldn't open: ${err.message || err}`); }
  };

  const download = async (node) => {
    try { downloadBytes(await bytesOf(node), node.name, node.mime || 'application/octet-stream'); }
    catch (err) { toast.error(`Download failed: ${err.message || err}`); }
  };

  // ---- compress (selection or one node) → .zip in current folder ----
  const compress = async (targets) => {
    if (!targets.length) return;
    setBusy(true);
    try {
      const entries = [];
      const addFileEntry = async (node, prefix) => entries.push({ name: prefix + node.name, bytes: await bytesOf(node) });
      for (const node of targets) {
        if (node.kind === 'file') await addFileEntry(node, '');
        else {
          const pathOf = (n) => { const parts = [n.name]; let pid = n.parentId; while (pid && pid !== node.parentId) { const p = byId.get(pid); if (!p) break; parts.unshift(p.name); pid = p.parentId; } return parts.join('/'); };
          for (const d of descendantsOf(node.id)) if (d.kind === 'file') entries.push({ name: pathOf(d), bytes: await bytesOf(d) });
        }
      }
      if (!entries.length) { toast.error('Nothing to compress'); return; }
      const t0 = performance.now();
      const zip = await office.zipFiles(entries);
      const zipName = uniqueName(targets.length === 1 ? `${targets[0].name.replace(/\.[^.]+$/, '')}.zip` : 'Archive.zip', 'file');
      const id = newId();
      await putBlob(id, new Blob([zip], { type: 'application/zip' }));
      setNodes([...nodes, { id, name: zipName, kind: 'file', parentId: cwd, size: zip.length, mime: 'application/zip', createdMs: Date.now() }]);
      setSel(new Set());
      toast.success(`Compressed ${entries.length} file${entries.length > 1 ? 's' : ''} → ${zipName} (${humanBytes(zip.length)})`);
    } catch (err) { toast.error(`Compress failed: ${err.message || err}`); }
    finally { setBusy(false); }
  };

  // ---- extract a .zip into a new folder ----
  const extract = async (node) => {
    setBusy(true);
    try {
      const files = await office.unzip(await bytesOf(node));
      if (!files.length) { toast.error('Archive is empty'); return; }
      const rootName = uniqueName(node.name.replace(/\.zip$/i, ''), 'folder');
      const rootId = newId();
      const newNodes = [{ id: rootId, name: rootName, kind: 'folder', parentId: cwd, createdMs: Date.now() }];
      const folderByPath = new Map(); folderByPath.set('', rootId);
      const ensureFolder = (dirPath) => {
        if (folderByPath.has(dirPath)) return folderByPath.get(dirPath);
        const segs = dirPath.split('/');
        const parentPath = segs.slice(0, -1).join('/');
        const parentId = ensureFolder(parentPath);
        const fid = newId();
        newNodes.push({ id: fid, name: segs[segs.length - 1], kind: 'folder', parentId, createdMs: Date.now() });
        folderByPath.set(dirPath, fid);
        return fid;
      };
      for (const f of files) {
        const parts = f.name.split('/').filter(Boolean);
        const fname = parts.pop();
        if (!fname) continue;
        const parentId = ensureFolder(parts.join('/'));
        const fid = newId();
        const mime = mimeForExt(extOf(fname));
        await putBlob(fid, new Blob([f.bytes], { type: mime }));
        newNodes.push({ id: fid, name: fname, kind: 'file', parentId, size: f.bytes.length, mime, createdMs: Date.now() });
      }
      setNodes([...nodes, ...newNodes]);
      toast.success(`Extracted ${files.length} file${files.length > 1 ? 's' : ''} → ${rootName}`);
    } catch (err) { toast.error(`Extract failed: ${err.message || err}`); }
    finally { setBusy(false); }
  };

  // ---- convert one file → new file node next to it ----
  const doConvert = async (node, key) => {
    setBusy(true);
    try {
      const t0 = performance.now();
      const out = await runConvert({ name: node.name, bytes: await bytesOf(node), mime: node.mime }, key);
      const name = uniqueName(out.name, 'file');
      const id = newId();
      await putBlob(id, new Blob([out.bytes], { type: out.mime }));
      setNodes([...nodes, { id, name, kind: 'file', parentId: cwd, size: out.bytes.length, mime: out.mime, createdMs: Date.now() }]);
      toast.success(`Converted → ${name} (${humanBytes(out.bytes.length)})`);
    } catch (err) { toast.error(`Convert failed: ${err.message || err}`); }
    finally { setBusy(false); setMenu(null); setConvertFor(null); }
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); };
  const openMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sel.has(node.id)) setSel(new Set([node.id]));
    // Position relative to the app root, not the viewport: the desktop-widget
    // window is CSS-transformed, which re-bases `position:fixed`, so viewport
    // clientX/clientY would place the menu far from the cursor. Clamp so it
    // stays inside the app.
    const rect = rootRef.current?.getBoundingClientRect();
    const MENU_W = 200;
    const MENU_H = 320;
    let x = rect ? e.clientX - rect.left : e.clientX;
    let y = rect ? e.clientY - rect.top : e.clientY;
    if (rect) {
      x = Math.min(x, Math.max(0, rect.width - MENU_W));
      y = Math.min(y, Math.max(0, rect.height - MENU_H));
    }
    setMenu({ node, x, y });
    setConvertFor(null);
  };

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const sortArrow = (key) => (sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '');

  return (
    <div
      ref={rootRef}
      className="@container relative flex h-full min-h-0 flex-col"
      onClick={() => { if (menu) { setMenu(null); setConvertFor(null); } }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

      {/* Toolbar */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 border-b pb-2">
        <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={newFolder} disabled={busy}><FolderPlus className="size-4" /> New folder</Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{humanBytes(usage)} used</span>
          <div className="flex overflow-hidden rounded-md border">
            <button type="button" className={cn('flex size-8 items-center justify-center', view === 'list' ? 'bg-accent' : 'hover:bg-accent/50')} onClick={() => setView('list')} title="List view"><ListIcon className="size-4" /></button>
            <button type="button" className={cn('flex size-8 items-center justify-center', view === 'grid' ? 'bg-accent' : 'hover:bg-accent/50')} onClick={() => setView('grid')} title="Grid view"><LayoutGrid className="size-4" /></button>
          </div>
        </div>
      </div>

      {/* Breadcrumbs + selection actions */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1 text-sm">
        <button type="button" className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent', cwd === null && 'font-medium')} onClick={() => setCwd(null)}><Home className="size-3.5" /> Drive</button>
        {breadcrumbs.map((n) => (
          <React.Fragment key={n.id}>
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button type="button" className="max-w-40 truncate rounded px-1.5 py-0.5 hover:bg-accent" onClick={() => setCwd(n.id)}>{n.name}</button>
          </React.Fragment>
        ))}
        {sel.size > 0 && (
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{sel.size} selected</span>
            <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => compress(selectedNodes)} disabled={busy}><FileArchive className="size-3.5" /> Compress</Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-destructive hover:text-destructive" onClick={() => removeNodes(selectedNodes)} disabled={busy}><Trash2 className="size-3.5" /> Delete</Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setSel(new Set())}><X className="size-3.5" /></Button>
          </div>
        )}
      </div>

      {/* Contents */}
      <div className={cn('relative min-h-0 flex-1 overflow-y-auto rounded-md border', dragOver && 'border-primary ring-2 ring-primary/40')}>
        {dragOver && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/5 text-sm font-medium text-primary">Drop files to upload</div>}
        {children.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <FolderOpen className="size-8 opacity-40" /> This folder is empty. Upload files or drop them here.
          </div>
        ) : view === 'list' ? (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-muted/80 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="cursor-pointer px-3 py-1.5 text-left font-medium" onClick={() => toggleSort('name')}>Name{sortArrow('name')}</th>
                <th className="hidden cursor-pointer px-3 py-1.5 text-right font-medium @md:table-cell" onClick={() => toggleSort('size')}>Size{sortArrow('size')}</th>
                <th className="hidden cursor-pointer px-3 py-1.5 text-left font-medium @lg:table-cell" onClick={() => toggleSort('type')}>Type{sortArrow('type')}</th>
                <th className="hidden cursor-pointer px-3 py-1.5 text-right font-medium @lg:table-cell" onClick={() => toggleSort('modified')}>Modified{sortArrow('modified')}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {children.map((n, i) => {
                const Icon = extIcon(n);
                const selected = sel.has(n.id);
                return (
                  <tr
                    key={n.id}
                    className={cn('cursor-default border-t hover:bg-accent/40', selected && 'bg-primary/10 hover:bg-primary/15')}
                    onClick={(e) => clickItem(e, n, i)}
                    onDoubleClick={() => open(n)}
                    onContextMenu={(e) => openMenu(e, n)}
                  >
                    <td className="max-w-0 px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('size-4 shrink-0', n.kind === 'folder' ? 'text-primary' : 'text-muted-foreground')} />
                        {renaming === n.id ? (
                          <Input autoFocus value={renameVal} onClick={(e) => e.stopPropagation()} onChange={(e) => setRenameVal(e.target.value)} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } else if (e.key === 'Escape') setRenaming(null); }} className="h-6" />
                        ) : <span className="truncate">{n.name}</span>}
                      </div>
                    </td>
                    <td className="hidden px-3 py-1.5 text-right text-muted-foreground @md:table-cell">{n.kind === 'folder' ? '—' : humanBytes(n.size || 0)}</td>
                    <td className="hidden px-3 py-1.5 text-muted-foreground @lg:table-cell">{n.kind === 'folder' ? 'Folder' : (extOf(n.name).toUpperCase() || 'File')}</td>
                    <td className="hidden px-3 py-1.5 text-right text-muted-foreground @lg:table-cell">{relativeTime(n.createdMs)}</td>
                    <td className="px-1"><button type="button" className="flex size-6 items-center justify-center rounded hover:bg-accent" onClick={(e) => openMenu(e, n)}><ChevronDown className="size-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className={cn('grid gap-2 p-2', narrow ? 'grid-cols-2' : 'grid-cols-3 @2xl:grid-cols-4')}>
            {children.map((n, i) => {
              const Icon = extIcon(n);
              const selected = sel.has(n.id);
              return (
                <div
                  key={n.id}
                  className={cn('flex cursor-default flex-col items-center gap-1 rounded-md border p-3 text-center hover:border-primary/40', selected && 'border-primary/60 bg-primary/10')}
                  onClick={(e) => clickItem(e, n, i)}
                  onDoubleClick={() => open(n)}
                  onContextMenu={(e) => openMenu(e, n)}
                >
                  <Icon className={cn('size-9', n.kind === 'folder' ? 'text-primary' : 'text-muted-foreground')} />
                  {renaming === n.id ? (
                    <Input autoFocus value={renameVal} onClick={(e) => e.stopPropagation()} onChange={(e) => setRenameVal(e.target.value)} onBlur={commitRename} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } else if (e.key === 'Escape') setRenaming(null); }} className="h-6 text-center" />
                  ) : <span className="w-full truncate text-xs">{n.name}</span>}
                  <span className="text-[10px] text-muted-foreground">{n.kind === 'folder' ? 'Folder' : humanBytes(n.size || 0)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context menu — absolute within the app root (widget windows are
          CSS-transformed, so position:fixed would be mis-anchored). */}
      {menu && (
        <div className="absolute z-[6000] min-w-48 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {menu.node.kind === 'file' && appForFile(menu.node.name) && (
            <MenuItem icon={ExternalLink} onClick={() => { openInApp(menu.node); setMenu(null); }}>{appForFile(menu.node.name).label}</MenuItem>
          )}
          <MenuItem icon={menu.node.kind === 'folder' ? FolderOpen : FileText} onClick={() => { open(menu.node); setMenu(null); }}>{menu.node.kind === 'folder' ? 'Open' : 'Preview'}</MenuItem>
          {menu.node.kind === 'file' && convertTargets(menu.node.name).length > 0 && (
            <div className="relative" onMouseEnter={() => setConvertFor(menu.node)} onMouseLeave={() => setConvertFor(null)}>
              <button type="button" className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-accent">
                <span className="flex items-center gap-2"><RefreshCw className="size-3.5" /> Convert to…</span><ChevronRight className="size-3.5" />
              </button>
              {convertFor && convertFor.id === menu.node.id && (
                <div className="absolute left-full top-0 ml-1 min-w-44 rounded-md border bg-popover p-1 shadow-lg">
                  {convertTargets(menu.node.name).map((t) => (
                    <MenuItem key={t.key} onClick={() => doConvert(menu.node, t.key)}>{t.label}</MenuItem>
                  ))}
                </div>
              )}
            </div>
          )}
          {isZip(menu.node) && <MenuItem icon={FolderOpen} onClick={() => { extract(menu.node); setMenu(null); }}>Extract here</MenuItem>}
          <MenuItem icon={FileArchive} onClick={() => { compress(sel.size > 1 ? selectedNodes : [menu.node]); setMenu(null); }}>Compress{sel.size > 1 ? ` (${sel.size})` : ''}</MenuItem>
          <MenuItem icon={Pencil} onClick={() => { setRenaming(menu.node.id); setRenameVal(menu.node.name); setMenu(null); }}>Rename</MenuItem>
          {menu.node.kind === 'file' && <MenuItem icon={Download} onClick={() => { download(menu.node); setMenu(null); }}>Download</MenuItem>}
          <div className="my-1 h-px bg-border" />
          <MenuItem icon={Trash2} destructive onClick={() => { removeNodes(sel.size > 1 ? selectedNodes : [menu.node]); setMenu(null); }}>Delete{sel.size > 1 ? ` (${sel.size})` : ''}</MenuItem>
        </div>
      )}

      {/* Image preview — portalled to <body> so it escapes the desktop window's
          transform/z-index stacking context and can truly cover everything
          (header + dock included). A high z-index alone wouldn't work while it's
          nested inside the window. */}
      {preview && createPortal(
        <div className="fixed inset-0 z-[6200] flex items-center justify-center bg-black/70 p-6" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
          <div className="flex max-h-full max-w-full flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <img src={preview.url} alt={preview.node.name} className="max-h-[80vh] max-w-full rounded-md object-contain" />
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="truncate">{preview.node.name}</span>
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => download(preview.node)}><Download className="size-4" /> Download</Button>
              <Button size="sm" variant="secondary" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>Close</Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, destructive, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-accent', destructive && 'text-destructive')}>
      {Icon && <Icon className="size-3.5" />} {children}
    </button>
  );
}

// A minimal ext → mime map for files reconstituted from a zip.
function mimeForExt(e) {
  const m = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip', wav: 'audio/wav', mp3: 'audio/mpeg', mp4: 'video/mp4',
  };
  return m[e] || 'application/octet-stream';
}

export default DriveApp;

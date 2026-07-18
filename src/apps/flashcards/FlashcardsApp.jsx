import React, { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../lib/store/WorkspaceProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const DAY_MS = 86_400_000;
const AGAIN_MS = 600_000; // "Again" comes back in 10 minutes

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// SM-2-style scheduling. grade: 0 Again · 1 Hard · 2 Good · 3 Easy.
function schedule(card, grade, now) {
  let { reps, ease, intervalDays, lapses } = card;
  if (grade === 0) {
    return { ...card, lapses: lapses + 1, reps: 0, intervalDays: 0, dueMs: now + AGAIN_MS };
  }
  if (grade === 1) {
    ease = Math.max(1.3, ease - 0.15);
    intervalDays = Math.max(1, intervalDays * 1.2);
  } else if (grade === 2) {
    intervalDays = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(intervalDays * ease);
  } else {
    ease += 0.15;
    intervalDays = reps === 0 ? 2 : Math.round(intervalDays * ease * 1.3);
  }
  return { ...card, reps: reps + 1, ease, intervalDays, lapses, dueMs: now + intervalDays * DAY_MS };
}

const fmtInterval = (card, grade, now) => {
  if (grade === 0) return '10 min';
  const days = schedule(card, grade, now).intervalDays;
  return `${Math.round(days * 10) / 10}d`;
};

const GRADES = [
  { label: 'Again', grade: 0, variant: 'destructive' },
  { label: 'Hard', grade: 1, variant: 'outline' },
  { label: 'Good', grade: 2, variant: 'default' },
  { label: 'Easy', grade: 3, variant: 'secondary' },
];

// ----- Deck create / rename dialog ---------------------------------------

function DeckDialog({ state, onClose, onSave }) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (state.open) setName(state.deck?.name ?? '');
  }, [state]);

  const save = () => {
    if (!name.trim()) return;
    onSave(name.trim());
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{state.deck ? 'Rename deck' : 'New deck'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="deck-name">Deck name</Label>
          <Input
            id="deck-name"
            value={name}
            autoFocus
            placeholder="e.g. Pharmacology"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!name.trim()}>
            {state.deck ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Card edit dialog ----------------------------------------------------

function CardDialog({ card, onClose, onSave }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  useEffect(() => {
    if (card) {
      setFront(card.front);
      setBack(card.back);
    }
  }, [card]);

  return (
    <Dialog open={!!card} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-front">Front</Label>
            <Textarea id="edit-front" value={front} onChange={(e) => setFront(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-back">Back</Label>
            <Textarea id="edit-back" value={back} onChange={(e) => setBack(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(front, back)} disabled={!front.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Deck list screen ----------------------------------------------------

function DeckList({ decks, cards, now, onOpen, onCreate, onRename, onDelete }) {
  return (
    <div className="space-y-2">
      {decks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No decks yet — create one and start studying. 📚
          </CardContent>
        </Card>
      ) : (
        decks.map((deck) => {
          const deckCards = cards.filter((c) => c.deckId === deck.id);
          const due = deckCards.filter((c) => c.dueMs <= now).length;
          return (
            <div
              key={deck.id}
              className="group flex cursor-pointer items-center gap-3 rounded-md border bg-card px-4 py-3 transition-colors hover:bg-accent/50"
              role="button"
              tabIndex={0}
              onClick={() => onOpen(deck.id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(deck.id)}
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{deck.name}</span>
                <span className="text-xs text-muted-foreground">
                  {deckCards.length} card{deckCards.length === 1 ? '' : 's'}
                </span>
              </div>
              <Badge variant={due > 0 ? 'default' : 'secondary'}>{due} due</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-60 hover:opacity-100"
                aria-label={`Rename “${deck.name}”`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(deck);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-60 hover:opacity-100"
                aria-label={`Delete “${deck.name}”`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(deck);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })
      )}
      <Button className="mt-2" onClick={onCreate}>
        <Plus /> New deck
      </Button>
    </div>
  );
}

// ----- Study tab -------------------------------------------------------------

function StudyTab({ dueCards, showAnswer, onShowAnswer, onGrade, now }) {
  const current = dueCards[0];

  if (!current) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <p className="text-2xl">🎉</p>
          <p className="mt-2 font-medium">Done for today!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No cards due right now — come back later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-muted-foreground">
        {dueCards.length} card{dueCards.length === 1 ? '' : 's'} due
      </p>
      <Card>
        <CardContent className="px-6 py-8">
          <p className="whitespace-pre-wrap text-center text-lg">{current.front}</p>
          {showAnswer && (
            <>
              <hr className="my-5 border-border" />
              <p className="whitespace-pre-wrap text-center text-lg">{current.back}</p>
            </>
          )}
        </CardContent>
      </Card>
      {!showAnswer ? (
        <Button className="w-full" size="lg" onClick={onShowAnswer}>
          Show answer <span className="ml-1 text-xs opacity-70">(Space)</span>
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g, i) => (
            <Button
              key={g.grade}
              variant={g.variant}
              className="h-auto flex-col gap-0.5 py-2"
              onClick={() => onGrade(g.grade)}
            >
              <span>
                {g.label} <span className="text-xs opacity-70">({i + 1})</span>
              </span>
              <span className="text-xs font-normal opacity-70">
                {fmtInterval(current, g.grade, now)}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- Cards tab ---------------------------------------------------------------

function CardsTab({ deckCards, onAdd, onEdit, onDelete }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const add = () => {
    if (!front.trim()) return;
    onAdd(front.trim(), back.trim());
    setFront('');
    setBack('');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="new-front">Front</Label>
          <Textarea
            id="new-front"
            value={front}
            placeholder="Question / term"
            onChange={(e) => setFront(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-back">Back</Label>
          <Textarea
            id="new-back"
            value={back}
            placeholder="Answer / definition"
            onChange={(e) => setBack(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={add} disabled={!front.trim()}>
        <Plus /> Add card
      </Button>

      <div className="space-y-2">
        {deckCards.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No cards in this deck yet.
            </CardContent>
          </Card>
        ) : (
          deckCards.map((card) => (
            <div key={card.id} className="group flex items-center gap-3 rounded-md border bg-card px-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{card.front}</span>
                <span className="block truncate text-sm text-muted-foreground">{card.back}</span>
              </div>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {card.reps === 0 ? 'new' : `every ${Math.round(card.intervalDays * 10) / 10}d`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-60 hover:opacity-100"
                aria-label="Edit card"
                onClick={() => onEdit(card)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-60 hover:opacity-100"
                aria-label="Delete card"
                onClick={() => onDelete(card)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ----- App ---------------------------------------------------------------------

// The Flashcards app — self-contained module rendered by the thin page host.
// A `@container` root keeps the layout consistent with the rest of the apps.
function FlashcardsApp() {
  const [data, setData] = useStore('flashcards', { decks: [], cards: [] });
  const decks = data.decks ?? [];
  const cards = data.cards ?? [];

  const [deckId, setDeckId] = useState(null);
  const [tab, setTab] = useState('study');
  const [showAnswer, setShowAnswer] = useState(false);
  const [deckDialog, setDeckDialog] = useState({ open: false, deck: null });
  const [editingCard, setEditingCard] = useState(null);

  // "now" drives the due queue; ticks so cards graded "Again" resurface.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const deck = decks.find((d) => d.id === deckId) ?? null;
  const deckCards = deck ? cards.filter((c) => c.deckId === deck.id) : [];
  const dueCards = deckCards.filter((c) => c.dueMs <= now).sort((a, b) => a.dueMs - b.dueMs);
  const current = dueCards[0] ?? null;

  // --- deck CRUD ---
  const saveDeck = (name) => {
    if (deckDialog.deck) {
      setData((d) => ({
        ...d,
        decks: d.decks.map((x) => (x.id === deckDialog.deck.id ? { ...x, name } : x)),
      }));
      toast.success('Deck renamed');
    } else {
      setData((d) => ({
        ...d,
        decks: [...d.decks, { id: uid(), name, createdMs: Date.now() }],
      }));
      toast.success('Deck created');
    }
    setDeckDialog({ open: false, deck: null });
  };

  const deleteDeck = (target) => {
    if (!window.confirm(`Delete “${target.name}” and all its cards?`)) return;
    setData((d) => ({
      decks: d.decks.filter((x) => x.id !== target.id),
      cards: d.cards.filter((c) => c.deckId !== target.id),
    }));
    if (deckId === target.id) setDeckId(null);
    toast.success('Deck deleted');
  };

  // --- card CRUD ---
  const addCard = (front, back) => {
    setData((d) => ({
      ...d,
      cards: [
        ...d.cards,
        { id: uid(), deckId, front, back, reps: 0, ease: 2.5, intervalDays: 0, dueMs: Date.now(), lapses: 0 },
      ],
    }));
    toast.success('Card added');
  };

  const saveCard = (front, back) => {
    setData((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === editingCard.id ? { ...c, front: front.trim(), back: back.trim() } : c)),
    }));
    setEditingCard(null);
    toast.success('Card updated');
  };

  const deleteCard = (card) => {
    setData((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== card.id) }));
    toast.success('Card deleted');
  };

  // --- study ---
  const grade = (g) => {
    if (!current) return;
    const t = Date.now();
    const updated = schedule(current, g, t);
    setData((d) => ({ ...d, cards: d.cards.map((c) => (c.id === current.id ? updated : c)) }));
    setShowAnswer(false);
    setNow(t);
  };

  // Keyboard shortcuts while studying: Space reveals, 1–4 grade.
  useEffect(() => {
    if (!deck || tab !== 'study' || !current) return;
    const onKey = (e) => {
      const el = e.target;
      if (el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (deckDialog.open || editingCard) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!showAnswer) setShowAnswer(true);
      } else if (showAnswer && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, tab, current?.id, showAnswer, deckDialog.open, editingCard]);

  return (
    <div className="@container">
      {deck && (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setDeckId(null)}>
            <ArrowLeft /> All decks
          </Button>
        </div>
      )}

      {!deck ? (
        <DeckList
          decks={decks}
          cards={cards}
          now={now}
          onOpen={(id) => {
            setDeckId(id);
            setTab('study');
            setShowAnswer(false);
            setNow(Date.now());
          }}
          onCreate={() => setDeckDialog({ open: true, deck: null })}
          onRename={(d) => setDeckDialog({ open: true, deck: d })}
          onDelete={deleteDeck}
        />
      ) : (
        <div className="space-y-4">
          <h2 className="truncate text-lg font-medium">{deck.name}</h2>
          <Tabs value={tab} onValueChange={(v) => { setTab(v); setShowAnswer(false); }}>
            <TabsList className="mb-4">
              <TabsTrigger value="study">
                Study{dueCards.length > 0 && <Badge className="ml-1.5">{dueCards.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="cards">Cards ({deckCards.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="study">
              <StudyTab
                dueCards={dueCards}
                showAnswer={showAnswer}
                onShowAnswer={() => setShowAnswer(true)}
                onGrade={grade}
                now={now}
              />
            </TabsContent>
            <TabsContent value="cards">
              <CardsTab
                deckCards={deckCards}
                onAdd={addCard}
                onEdit={setEditingCard}
                onDelete={deleteCard}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <DeckDialog
        state={deckDialog}
        onClose={() => setDeckDialog({ open: false, deck: null })}
        onSave={saveDeck}
      />
      <CardDialog card={editingCard} onClose={() => setEditingCard(null)} onSave={saveCard} />
    </div>
  );
}

export default FlashcardsApp;

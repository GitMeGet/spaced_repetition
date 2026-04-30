<script lang="ts">
  import { onMount } from 'svelte';
  import { BarChart3, Check, Download, ImagePlus, Library, RotateCcw, Trash2, Upload } from 'lucide-svelte';
  import { addCard, deleteCard, exportBackup, getDeck, getDueCards, gradeCard, importCards, restoreBackup, syncDefaultCards, updateCardNote } from './lib/db';
  import { downloadText, downscaleImage, normalizeImageBase64 } from './lib/images';
  import { isDue } from './lib/scheduler';
  import type { ImportCard, McqCard } from './lib/types';

  type View = 'study' | 'add' | 'deck';
  type StudyMode = 'new' | 'due' | 'review';

  let view: View = 'study';
  let studyMode: StudyMode = 'new';
  let cards: McqCard[] = [];
  let dueCards: McqCard[] = [];
  let active: McqCard | undefined;
  let selectedIndex: number | undefined;
  let submitted = false;
  let noteDraft = '';
  let status = '';
  let question = '';
  let answers = ['', '', '', ''];
  let correctIndex = 0;
  let imageBase64 = '';
  let busy = false;

  $: total = cards.length;
  $: newCount = cards.filter((card) => card.state === 'new').length;
  $: dueCount = dueCards.filter((card) => card.state !== 'new').length;
  $: reviewReady = cards.filter((card) => card.state === 'review' && isDue(card)).length;
  $: accuracy = total ? Math.round((cards.reduce((sum, card) => sum + card.reps - card.lapses, 0) / Math.max(1, cards.reduce((sum, card) => sum + card.reps, 0))) * 100) : 0;
  $: hasAnswer = selectedIndex !== undefined;
  $: isCorrect = hasAnswer && active ? selectedIndex === active.correctIndex : false;
  $: activeQueue = getStudyQueue(studyMode);

  onMount(() => {
    void load(true);
  });

  async function load(syncDefaults = false) {
    if (syncDefaults) {
      const sync = await syncDefaultCards();
      if (sync.added || sync.updated || sync.deleted) {
        status = `Synced bundled questions: ${sync.added} added, ${sync.updated} updated, ${sync.deleted} deleted.`;
      }
    }
    cards = await getDeck();
    dueCards = await getDueCards();
    setActive(pickRandom(getStudyQueue(studyMode)));
  }

  function getStudyQueue(mode: StudyMode): McqCard[] {
    if (mode === 'new') return cards.filter((card) => card.state === 'new');
    if (mode === 'review') return cards.filter((card) => card.state === 'review' && isDue(card));
    return dueCards.filter((card) => card.state !== 'new');
  }

  function selectStudyMode(mode: StudyMode) {
    studyMode = mode;
    setActive(pickRandom(getStudyQueue(mode)));
  }

  function setActive(card: McqCard | undefined) {
    active = card;
    selectedIndex = undefined;
    submitted = false;
    noteDraft = card?.note ?? '';
  }

  function pickRandom(queue: McqCard[]): McqCard | undefined {
    if (queue.length === 0) return undefined;
    return queue[Math.floor(Math.random() * queue.length)];
  }

  function queueLabel(mode: StudyMode): string {
    if (mode === 'new') return 'New card';
    if (mode === 'review') return 'Review card';
    return 'Due card';
  }

  async function submitCard() {
    status = '';
    try {
      await addCard({ question, answers, correctIndex, imageBase64 });
      question = '';
      answers = ['', '', '', ''];
      correctIndex = 0;
      imageBase64 = '';
      status = 'Card saved locally.';
      await load();
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not save card.';
    }
  }

  async function nextCard() {
    if (!active) return;
    const reviewedCard = { ...active, note: noteDraft.trim() || undefined };
    await saveNote();
    await gradeCard(reviewedCard, isCorrect ? 'good' : 'again');
    await load();
  }

  async function saveNote() {
    if (!active?.id) return;
    const note = noteDraft.trim();
    await updateCardNote(active.id, note);
    active = { ...active, note: note || undefined };
    cards = cards.map((card) => (card.id === active?.id ? { ...card, note: note || undefined } : card));
  }

  async function handleImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    try {
      imageBase64 = await downscaleImage(file);
    } finally {
      busy = false;
      input.value = '';
    }
  }

  async function handleImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    status = '';
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items: ImportCard[] = Array.isArray(parsed) ? parsed : parsed.cards;
      const count = await importCards(items);
      status = `Imported ${count} cards.`;
      await load();
    } catch (error) {
      status = error instanceof Error ? error.message : 'Import failed.';
    } finally {
      input.value = '';
    }
  }

  async function handleRestore(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    status = '';
    try {
      const count = await restoreBackup(await file.text());
      status = `Restored ${count} cards.`;
      await load(true);
    } catch (error) {
      status = error instanceof Error ? error.message : 'Restore failed.';
    } finally {
      input.value = '';
    }
  }

  async function backup() {
    downloadText(`mcq-fsrs-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportBackup());
  }

  async function removeCard(id: number | undefined) {
    if (!id) return;
    await deleteCard(id);
    await load();
  }
</script>

<main class="shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">Offline MCQ Study</p>
      <h1>MCQ FSRS</h1>
    </div>
    <nav aria-label="Primary">
      <button class:active={view === 'study'} on:click={() => (view = 'study')} title="Study">
        <Check size={18} /> Study
      </button>
      <button class:active={view === 'add'} on:click={() => (view = 'add')} title="Add cards">
        <ImagePlus size={18} /> Add
      </button>
      <button class:active={view === 'deck'} on:click={() => (view = 'deck')} title="Review deck">
        <Library size={18} /> Deck
      </button>
    </nav>
  </header>

  <section class="metrics" aria-label="Study queues">
    <button class:active={studyMode === 'new'} on:click={() => selectStudyMode('new')} title="Study new cards">
      <span>{newCount}</span>
      <p>New</p>
    </button>
    <button class:active={studyMode === 'due'} on:click={() => selectStudyMode('due')} title="Study due cards">
      <span>{dueCount}</span>
      <p>Due now</p>
    </button>
    <button class:active={studyMode === 'review'} on:click={() => selectStudyMode('review')} title="Study review cards">
      <span>{reviewReady}</span>
      <p>Review</p>
    </button>
    <div>
      <span>{accuracy}%</span>
      <p>Accuracy</p>
    </div>
  </section>

  {#if status}
    <p class="status">{status}</p>
  {/if}

  {#if view === 'study'}
    <section class="workspace study">
      {#if active}
        <article class="question-panel">
          {#if active.imageBase64}
            <img src={active.imageBase64} alt="" />
          {/if}
          <p class="eyebrow">{queueLabel(studyMode)} · {activeQueue.length} in queue</p>
          <h2>{active.question}</h2>
          <div class="answers">
            {#each active.answers as option, index}
              <button
                class:chosen={selectedIndex === index}
                class:correct={submitted && index === active.correctIndex}
                class:wrong={submitted && selectedIndex === index && index !== active.correctIndex}
                disabled={submitted}
                on:click={() => (selectedIndex = index)}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                {option}
              </button>
            {/each}
          </div>
          {#if submitted}
            <div class:ok={isCorrect} class:error={!isCorrect} class="result" role="status" aria-live="polite">
              <strong>{isCorrect ? 'Correct' : 'Wrong'}</strong>
              {#if !isCorrect}
                <span>Answer: {active.answers[active.correctIndex]}</span>
              {/if}
            </div>
            <label class="question-note">
              Notes
              <textarea bind:value={noteDraft} on:blur={saveNote} rows="4" placeholder="Add anything you want to remember about this question"></textarea>
            </label>
          {/if}
          <div class="actions">
            {#if submitted}
              <button class="primary" on:click={nextCard}>
                <Check size={18} /> Next
              </button>
            {:else}
              <button class="primary" disabled={!hasAnswer} on:click={() => (submitted = true)}>
                <Check size={18} /> Submit
              </button>
            {/if}
          </div>
        </article>
      {:else}
        <section class="empty">
          <BarChart3 size={36} />
          <h2>No {studyMode === 'new' ? 'new' : studyMode === 'review' ? 'review' : 'due'} cards right now</h2>
          <p>Switch queues or add more cards when you are ready.</p>
        </section>
      {/if}
    </section>
  {:else if view === 'add'}
    <section class="workspace split">
      <form class="editor" on:submit|preventDefault={submitCard}>
        <label>
          Question text
          <textarea bind:value={question} rows="5" placeholder="Paste markdown or plain text"></textarea>
        </label>

        <div class="answer-grid">
          {#each answers as answerText, index}
            <label>
              Answer {String.fromCharCode(65 + index)}
              <div class="answer-input">
                <input type="radio" bind:group={correctIndex} value={index} aria-label={`Mark answer ${index + 1} correct`} />
                <input bind:value={answers[index]} placeholder="Option text" />
              </div>
            </label>
          {/each}
        </div>

        <label class="file-picker">
          <ImagePlus size={18} />
          {busy ? 'Processing image...' : imageBase64 ? 'Replace image' : 'Add image'}
          <input type="file" accept="image/*" on:change={handleImage} />
        </label>

        <label>
          Question image Base64
          <textarea
            bind:value={imageBase64}
            on:blur={() => (imageBase64 = normalizeImageBase64(imageBase64) ?? '')}
            rows="4"
            placeholder="Paste data:image/png;base64,... or raw Base64"
          ></textarea>
        </label>

        {#if imageBase64}
          <img class="preview" src={imageBase64} alt="" />
        {/if}

        <button class="primary wide" type="submit">Save card</button>
      </form>

      <aside class="tools">
        <h2>Content</h2>
        <label class="tool-button">
          <Upload size={18} /> Import question JSON
          <input type="file" accept="application/json" on:change={handleImport} />
        </label>
        <label class="tool-button">
          <RotateCcw size={18} /> Restore backup
          <input type="file" accept="application/json" on:change={handleRestore} />
        </label>
        <button class="tool-button" on:click={backup}>
          <Download size={18} /> Master backup
        </button>
      </aside>
    </section>
  {:else}
    <section class="workspace deck">
      {#each cards as card}
        <article class="deck-row">
          <div>
            {#if card.imageBase64}
              <img class="thumb" src={card.imageBase64} alt="" />
            {/if}
            <p>{card.question}</p>
            <span>{card.state} - due {new Date(card.due).toLocaleString()} - reps {card.reps}</span>
          </div>
          <button class="icon-button" on:click={() => removeCard(card.id)} title="Delete card">
            <Trash2 size={18} />
          </button>
        </article>
      {:else}
        <section class="empty">
          <Library size={36} />
          <h2>Your local deck is empty</h2>
          <p>Use Add or import the question set JSON when it is ready.</p>
        </section>
      {/each}
    </section>
  {/if}
</main>

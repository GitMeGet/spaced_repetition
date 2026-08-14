<script lang="ts">
  import { onMount } from 'svelte';
  import { BarChart3, Check, Copy, Download, Eye, EyeOff, Flag, GitCompareArrows, ImagePlus, Library, MoonStar, RotateCcw, Sun, Trash2, Upload } from 'lucide-svelte';
  import {
    addCard,
    cardToImportCard,
    deleteCard,
    exportBackup,
    getDeck,
    getDueCards,
    getHiddenCards,
    gradeCard,
    hideCard,
    importCards,
    restoreBackup,
    syncDefaultCards,
    unhideCard,
    updateCardNote
  } from './lib/db';
  import { copyElementAsPng, ImageClipboardError } from './lib/capture';
  import { blurRegionClipPath, getQuestionImageBlurRegions } from './lib/imageBlurRegions';
  import { downloadText, downscaleImage, normalizeImageBase64 } from './lib/images';
  import { isDue } from './lib/scheduler';
  import {
    giveWayRuleCards,
    responsibilityLabels,
    responsibilityMatrix,
    responsibilityVessels,
    signalFlags,
    vesselSignalCards
  } from './lib/referenceData';
  import type { CardType, ImageBlurRegion, ImportCard, McqCard, StudyGrade } from './lib/types';

  type View = 'study' | 'add' | 'deck' | 'hidden' | 'lights' | 'give-way' | 'flags';
  type StudyMode = 'new' | 'due' | 'review';
  type SourceFilter = 'all' | 'oral' | 'test' | 'aids' | 'colreg' | 'islands';
  const colregSourceSet = 'COLREG Vessel Shapes/Lights';
  const colregDisplayName = 'Vessel Symbols';
  const sourceFilterStorageKey = 'mcq-fsrs-source-filter';

  let view: View = 'study';
  let studyMode: StudyMode = 'new';
  let sourceFilter: SourceFilter = 'all';
  let cards: McqCard[] = [];
  let dueCards: McqCard[] = [];
  let hiddenCards: McqCard[] = [];
  let active: McqCard | undefined;
  let selectedIndex: number | undefined;
  let submitted = false;
  let noteDraft = '';
  let status = '';
  let questionCaptureElement: HTMLElement | undefined;
  let copyingStudyContext = false;
  let question = '';
  let answers = ['', '', '', ''];
  let correctIndex = 0;
  let cardType: CardType = 'mcq';
  let imageBase64 = '';
  let busy = false;
  let nightSignalCards = new Set<string>();

  $: filteredCards = cards.filter((card) => matchesSourceFilter(card, sourceFilter));
  $: filteredDueCards = dueCards.filter((card) => matchesSourceFilter(card, sourceFilter));
  $: total = filteredCards.length;
  $: newCount = filteredCards.filter((card) => card.state === 'new').length;
  $: dueCount = filteredDueCards.filter((card) => card.state !== 'new').length;
  $: reviewReady = filteredCards.filter((card) => card.state === 'review' && isDue(card)).length;
  $: accuracy = calculateQuestionAccuracy(filteredCards);
  $: hasAnswer = selectedIndex !== undefined;
  $: isCorrect = hasAnswer && active ? selectedIndex === active.correctIndex : false;
  $: activeQueue = getStudyQueue(studyMode, sourceFilter, cards, dueCards);

  onMount(() => {
    sourceFilter = readStoredSourceFilter();
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
    hiddenCards = await getHiddenCards();
    setActive(pickRandom(getStudyQueue(studyMode, sourceFilter)));
  }

  function getStudyQueue(mode: StudyMode, filter = sourceFilter, deck = cards, dueDeck = dueCards): McqCard[] {
    const sourceCards = deck.filter((card) => matchesSourceFilter(card, filter));
    const sourceDueCards = dueDeck.filter((card) => matchesSourceFilter(card, filter));
    if (mode === 'new') return sourceCards.filter((card) => card.state === 'new');
    if (mode === 'review') return sourceCards.filter((card) => card.state === 'review' && isDue(card));
    return sourceDueCards.filter((card) => card.state !== 'new');
  }

  function selectStudyMode(mode: StudyMode) {
    studyMode = mode;
    setActive(pickRandom(getStudyQueue(mode, sourceFilter)));
  }

  function selectSourceFilter(filter: SourceFilter) {
    sourceFilter = filter;
    localStorage.setItem(sourceFilterStorageKey, filter);
    setActive(pickRandom(getStudyQueue(studyMode, filter)));
  }

  function handleSourceFilterChange(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    selectSourceFilter(select.value as SourceFilter);
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

  function sourceFilterLabel(filter: SourceFilter): string {
    if (filter === 'oral') return 'Oral';
    if (filter === 'test') return 'Test Sets';
    if (filter === 'aids') return 'Aids to Nav';
    if (filter === 'colreg') return 'COLREGs';
    if (filter === 'islands') return 'Islands';
    return 'All';
  }

  function sourceSetLabel(sourceSet?: string): string {
    if (sourceSet === colregSourceSet) return colregDisplayName;
    return sourceSet ?? 'Custom';
  }

  function readStoredSourceFilter(): SourceFilter {
    const stored = localStorage.getItem(sourceFilterStorageKey);
    return stored === 'oral' || stored === 'test' || stored === 'aids' || stored === 'colreg' || stored === 'islands' || stored === 'all' ? stored : 'all';
  }

  function calculateQuestionAccuracy(cards: McqCard[]): number {
    const answeredCards = cards.filter((card) => card.reps > 0);
    if (answeredCards.length === 0) return 0;

    const questionAccuracy = answeredCards.reduce((sum, card) => {
      const correctReps = Math.max(0, card.reps - card.lapses);
      return sum + correctReps / card.reps;
    }, 0);

    return Math.round((questionAccuracy / answeredCards.length) * 100);
  }

  function matchesSourceFilter(card: McqCard, filter: SourceFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'oral') return card.sourceSet === 'Oral';
    if (filter === 'aids') return card.sourceSet === 'Aids to Navigation';
    if (filter === 'colreg') return card.sourceSet?.startsWith('COLREG') ?? false;
    if (filter === 'islands') return card.sourceSet === 'Islands';
    return card.sourceSet?.startsWith('Test Set') ?? false;
  }

  function getCardType(card: Pick<McqCard, 'cardType'>): CardType {
    return card.cardType === 'reveal' ? 'reveal' : 'mcq';
  }

  function questionImageFor(card: Pick<McqCard, 'imageBase64' | 'imageSrc'>): string | undefined {
    return card.imageBase64 || resolveAssetSrc(card.imageSrc);
  }

  function questionImageBlurRegionsFor(card: Pick<McqCard, 'sourceSet' | 'imageSrc'>): ImageBlurRegion[] {
    return getQuestionImageBlurRegions(card);
  }

  function answerImageFor(card: Pick<McqCard, 'answerImageSrc'>): string | undefined {
    return resolveAssetSrc(card.answerImageSrc);
  }

  function resolveAssetSrc(src?: string): string | undefined {
    const trimmed = String(src ?? '').trim();
    if (!trimmed) return undefined;
    if (/^(data:|https?:|blob:)/i.test(trimmed)) return trimmed;
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    return `${base}${trimmed.replace(/^\/+/, '')}`;
  }

  function selectCardType(nextType: CardType) {
    cardType = nextType;
    correctIndex = 0;
  }

  async function submitCard() {
    status = '';
    try {
      const nextAnswers = cardType === 'reveal' ? [answers[0]] : answers;
      await addCard({
        cardType: cardType === 'reveal' ? 'reveal' : undefined,
        question,
        answers: nextAnswers,
        correctIndex: cardType === 'reveal' ? 0 : correctIndex,
        imageBase64
      });
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
    await gradeActive(isCorrect ? 'good' : 'again');
  }

  async function gradeActive(grade: StudyGrade) {
    if (!active) return;
    const reviewedCard = { ...active, note: noteDraft.trim() || undefined };
    await saveNote();
    await gradeCard(reviewedCard, grade);
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

  function toggleSignalCard(id: string) {
    const next = new Set(nightSignalCards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    nightSignalCards = next;
  }

  async function hideActiveCard() {
    if (!active?.id) return;
    status = '';
    try {
      await saveNote();
      await hideCard(active.id);
      status = 'Question moved to Hidden.';
      await load();
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not hide question.';
    }
  }

  async function restoreHiddenCard(id: number | undefined) {
    if (!id) return;
    status = '';
    try {
      await unhideCard(id);
      status = 'Question restored to Study.';
      await load();
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not restore question.';
    }
  }

  async function copyHiddenJson() {
    status = '';
    try {
      const text = hiddenQuestionsJson();
      await copyText(text);
      status = `Copied ${hiddenCards.length} hidden ${hiddenCards.length === 1 ? 'question' : 'questions'} as JSON.`;
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not copy hidden questions.';
    }
  }

  async function copyStudyContextImage() {
    if (!questionCaptureElement || copyingStudyContext) return;
    status = 'Preparing question image...';
    copyingStudyContext = true;
    try {
      await copyElementAsPng(questionCaptureElement);
      status = 'Copied question context as an image. Paste it into your LLM chat.';
    } catch (error) {
      status = studyContextCopyErrorMessage(error);
    } finally {
      copyingStudyContext = false;
    }
  }

  function studyContextCopyErrorMessage(error: unknown): string {
    if (error instanceof ImageClipboardError) {
      if (error.code === 'unsupported') {
        return 'This browser cannot copy PNG images. Try Chrome or Edge on the local app URL.';
      }
      if (error.code === 'permission') {
        return 'Clipboard permission was denied. Allow clipboard access and try again.';
      }
      return `Could not copy the question image. If this card uses a remote image, the browser may be blocking capture.${error.message ? ` ${error.message}` : ''}`;
    }

    return error instanceof Error ? error.message : 'Could not copy the question image.';
  }

  async function removeCard(id: number | undefined) {
    if (!id) return;
    await deleteCard(id);
    await load();
  }

  async function copyText(text: string): Promise<void> {
    if (copyWithTextArea(text)) {
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    throw new Error('Could not copy to clipboard.');
  }

  function copyWithTextArea(text: string): boolean {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand('copy');
    textArea.remove();
    return copied;
  }

  function hiddenQuestionsJson(): string {
    return JSON.stringify(hiddenCards.map(cardToImportCard), null, 2);
  }

  function hiddenDateLabel(hiddenAt?: string): string {
    const date = hiddenAt ? new Date(hiddenAt) : undefined;
    return date && !Number.isNaN(date.getTime()) ? `hidden ${date.toLocaleString()}` : 'hidden';
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
      <button class:active={view === 'lights'} on:click={() => (view = 'lights')} title="Vessel day and night signals">
        <MoonStar size={18} /> Lights
      </button>
      <button class:active={view === 'give-way'} on:click={() => (view = 'give-way')} title="Give-way cheat sheet">
        <GitCompareArrows size={18} /> Give Way
      </button>
      <button class:active={view === 'flags'} on:click={() => (view = 'flags')} title="Signal flags cheat sheet">
        <Flag size={18} /> Flags
      </button>
      <button class:active={view === 'hidden'} on:click={() => (view = 'hidden')} title="Hidden questions">
        <EyeOff size={18} /> Hidden ({hiddenCards.length})
      </button>
      <div class="source-select">
        <select aria-label="Question source" title="Question source" value={sourceFilter} on:change={handleSourceFilterChange}>
          <option value="all">All</option>
          <option value="oral">Oral</option>
          <option value="test">Test Sets</option>
          <option value="aids">Aids to Nav</option>
          <option value="colreg">COLREGs</option>
          <option value="islands">Islands</option>
        </select>
      </div>
    </nav>
  </header>

  {#if view !== 'lights' && view !== 'give-way' && view !== 'flags'}
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
  {/if}

  {#if status && view !== 'lights' && view !== 'give-way' && view !== 'flags'}
    <p class="status">{status}</p>
  {/if}

  {#if view === 'study'}
    <section class="workspace study">
      {#if active}
        <article class="question-panel">
          <div class="study-capture" bind:this={questionCaptureElement}>
            <p class="eyebrow">{queueLabel(studyMode)} - {sourceFilterLabel(sourceFilter)} - {activeQueue.length} in queue</p>
            <h2>{active.question}</h2>
            {#if questionImageFor(active)}
              {@const questionImage = questionImageFor(active)}
              {@const blurRegions = questionImageBlurRegionsFor(active)}
              {#if blurRegions.length > 0}
                <div class="question-image">
                  <img src={questionImage} alt="" />
                  {#each blurRegions as region}
                    <span class="question-image-blur" style={`clip-path: ${blurRegionClipPath(region)};`}>
                      <img src={questionImage} alt="" aria-hidden="true" />
                    </span>
                  {/each}
                </div>
              {:else}
                <img src={questionImage} alt="" />
              {/if}
            {/if}
            {#if getCardType(active) === 'reveal'}
              {#if submitted}
                <div class="reveal-answer" role="status" aria-live="polite">
                  <strong>Answer</strong>
                  <p>{active.answers[0]}</p>
                  {#if answerImageFor(active)}
                    <img src={answerImageFor(active)} alt="" />
                  {/if}
                </div>
              {/if}
            {:else}
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
            {/if}
            {#if submitted}
              {#if getCardType(active) === 'mcq'}
                <div class:ok={isCorrect} class:error={!isCorrect} class="result" role="status" aria-live="polite">
                  <strong>{isCorrect ? 'Correct' : 'Wrong'}</strong>
                  {#if !isCorrect}
                    <span>Answer: {active.answers[active.correctIndex]}</span>
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
          <div class:submitted={submitted} class="actions">
            <button class="danger" on:click={hideActiveCard}>
              <EyeOff size={18} /> Hide
            </button>
            <button on:click={copyStudyContextImage} disabled={copyingStudyContext}>
              <Copy size={18} /> {copyingStudyContext ? 'Copying...' : 'Copy for LLM'}
            </button>
            {#if getCardType(active) === 'reveal'}
              {#if submitted}
                <button on:click={() => gradeActive('again')}>
                  <RotateCcw size={18} /> Again
                </button>
                <button class="primary" on:click={() => gradeActive('good')}>
                  <Check size={18} /> Good
                </button>
              {:else}
                <button class="primary" on:click={() => (submitted = true)}>
                  <Eye size={18} /> Show answer
                </button>
              {/if}
            {:else}
              {#if submitted}
                <button class="primary" on:click={nextCard}>
                  <Check size={18} /> Next
                </button>
              {:else}
                <button class="primary" disabled={!hasAnswer} on:click={() => (submitted = true)}>
                  <Check size={18} /> Submit
                </button>
              {/if}
            {/if}
          </div>
          {#if submitted}
            <label class="question-note">
              Notes
              <textarea bind:value={noteDraft} on:blur={saveNote} rows="4" placeholder="Add anything you want to remember about this question"></textarea>
            </label>
          {/if}
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
        <div class="mode-toggle" role="group" aria-label="Card type">
          <button type="button" class:active={cardType === 'mcq'} on:click={() => selectCardType('mcq')}>MCQ</button>
          <button type="button" class:active={cardType === 'reveal'} on:click={() => selectCardType('reveal')}>Reveal</button>
        </div>

        <label>
          Question text
          <textarea bind:value={question} rows="5" placeholder="Paste markdown or plain text"></textarea>
        </label>

        {#if cardType === 'reveal'}
          <label>
            Expected answer
            <textarea bind:value={answers[0]} rows="5" placeholder="Answer shown after reveal"></textarea>
          </label>
        {:else}
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
        {/if}

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
  {:else if view === 'lights'}
    <section class="workspace reference-page">
      <header class="reference-header">
        <div>
          <p class="eyebrow">COLREG quick reference</p>
          <h2>Vessel day shapes &amp; night lights</h2>
          <p>Choose any card to switch between its daytime signal and nighttime lights.</p>
        </div>
        <div class="reference-hint"><Sun size={18} /> Day <span aria-hidden="true">↔</span> <MoonStar size={18} /> Night</div>
      </header>

      <div class="signal-grid">
        {#each vesselSignalCards as card}
          {@const isNight = nightSignalCards.has(card.id)}
          <button
            type="button"
            class:flipped={isNight}
            class="signal-card"
            aria-pressed={isNight}
            aria-label={`${card.name}. Showing ${isNight ? 'night lights' : 'day shape'}. Activate to show ${isNight ? 'day shape' : 'night lights'}.`}
            on:click={() => toggleSignalCard(card.id)}
          >
            <span class="signal-card-inner">
              <span class="signal-face signal-day" aria-hidden={isNight}>
                <span class="signal-title"><strong>{card.name}</strong><span><Sun size={15} /> Day</span></span>
                <img src={resolveAssetSrc(card.day.imageSrc)} alt="" />
                <span class="signal-description">{card.day.description}</span>
                <span class="flip-prompt">Tap to see night lights <span aria-hidden="true">→</span></span>
              </span>
              <span class="signal-face signal-night" aria-hidden={!isNight}>
                <span class="signal-title"><strong>{card.name}</strong><span><MoonStar size={15} /> Night</span></span>
                <img src={resolveAssetSrc(card.night.imageSrc)} alt="" />
                <span class="signal-description">{card.night.description}</span>
                <span class="flip-prompt"><span aria-hidden="true">←</span> Tap to see day shape</span>
              </span>
            </span>
          </button>
        {/each}
      </div>
    </section>
  {:else if view === 'give-way'}
    <section class="workspace reference-page give-way-page">
      <header class="reference-header">
        <div>
          <p class="eyebrow">COLREG quick reference</p>
          <h2>Who gives way?</h2>
          <p>Read down the left for your vessel, then across to the vessel you meet.</p>
        </div>
      </header>

      <div class="rule-order" role="note">
        <strong>Check in this order</strong>
        <span>Restricted visibility</span><span>Overtaking</span><span>Special waterway</span><span>Encounter geometry</span><span>Vessel status</span>
      </div>

      <div class="matrix-legend" aria-label="Matrix key">
        {#each Object.entries(responsibilityLabels) as [status, item]}
          <span class={`matrix-status ${status}`}><i aria-hidden="true"></i>{item.label}</span>
        {/each}
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_tabindex — the overflow region must be keyboard-scrollable on mobile -->
      <div class="matrix-scroll" role="region" tabindex="0" aria-label="Give-way responsibility matrix. Scroll horizontally to view all vessels.">
        <table class="responsibility-matrix">
          <caption>General vessel responsibilities. Encounter and special-waterway rules may override or qualify this table.</caption>
          <thead>
            <tr>
              <th class="corner-cell" scope="col">Your vessel ↓<br />Other vessel →</th>
              {#each responsibilityVessels as vessel}
                <th scope="col" title={vessel.name}>{vessel.shortName}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each responsibilityVessels as ownVessel}
              <tr>
                <th scope="row" title={ownVessel.name}>{ownVessel.shortName}</th>
                {#each responsibilityVessels as otherVessel}
                  {@const status = responsibilityMatrix[ownVessel.id][otherVessel.id]}
                  <td title={`${responsibilityLabels[status].label}: ${responsibilityLabels[status].detail}`}>
                    <span class={`matrix-status ${status}`}><i aria-hidden="true"></i>{responsibilityLabels[status].label}</span>
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="matrix-note"><strong>No vessel has an absolute right of way.</strong> “Stand on” means initially keeping course and speed while staying ready to prevent a collision. CBD entries mean other vessels should avoid impeding safe passage when circumstances permit.</p>

      <div class="rule-card-grid">
        {#each giveWayRuleCards as item, index}
          <article class:featured={index === 0} class="rule-card">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{item.title}</h3>
            <p>{item.rule}</p>
          </article>
        {/each}
      </div>
    </section>
  {:else if view === 'flags'}
    <section class="workspace reference-page flags-page">
      <header class="reference-header">
        <div>
          <p class="eyebrow">International Code of Signals</p>
          <h2>Essential signal flags</h2>
          <p>Recognise the flag, remember its meaning, then take the safe action shown.</p>
        </div>
      </header>

      <div class="flag-grid">
        {#each signalFlags as flag}
          <article class="flag-card">
            <header>
              <span class="flag-letter">{flag.letter}</span>
              <div><h3>{flag.phonetic}</h3><p>{flag.memory}</p></div>
            </header>
            <img src={resolveAssetSrc(flag.imageSrc)} alt={`International Code flag ${flag.phonetic}`} />
            {#if flag.emphasis}<strong class="flag-emphasis">{flag.emphasis}</strong>{/if}
            <section>
              <h4>Meaning</h4>
              <p>“{flag.meaning}”</p>
            </section>
            <section class="flag-action">
              <h4>What you should do</h4>
              <p>{flag.precaution}</p>
            </section>
          </article>
        {/each}
      </div>
      <p class="local-note"><strong>Local rule:</strong> The 200 m precaution shown for flag Q applies in Singapore waters while quarantine, customs or immigration clearance is pending.</p>
    </section>
  {:else if view === 'deck'}
    <section class="workspace deck">
      {#each filteredCards as card}
        <article class="deck-row">
          <div>
            {#if questionImageFor(card)}
              <img class="thumb" src={questionImageFor(card)} alt="" />
            {:else if answerImageFor(card)}
              <img class="thumb" src={answerImageFor(card)} alt="" />
            {/if}
            <p>{card.question}</p>
            <span>{sourceSetLabel(card.sourceSet)} - {getCardType(card) === 'reveal' ? 'Reveal' : 'MCQ'} - {card.state} - due {new Date(card.due).toLocaleString()} - reps {card.reps}</span>
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
  {:else}
    <section class="workspace deck hidden-list">
      <div class="list-toolbar">
        <div>
          <h2>Hidden</h2>
          <p>{hiddenCards.length} {hiddenCards.length === 1 ? 'question' : 'questions'}</p>
        </div>
        <button class="copy-button" on:click={copyHiddenJson}>
          <Copy size={18} /> Copy JSON
        </button>
      </div>

      {#each hiddenCards as card}
        <article class="deck-row hidden-row">
          <div>
            {#if questionImageFor(card)}
              <img class="thumb" src={questionImageFor(card)} alt="" />
            {:else if answerImageFor(card)}
              <img class="thumb" src={answerImageFor(card)} alt="" />
            {/if}
            <p>{card.question}</p>
            <span>{sourceSetLabel(card.sourceSet)} - {getCardType(card) === 'reveal' ? 'Reveal' : 'MCQ'} - {hiddenDateLabel(card.hiddenAt)}</span>
          </div>
          <button class="row-button" on:click={() => restoreHiddenCard(card.id)} title="Restore question">
            <RotateCcw size={18} /> Restore
          </button>
        </article>
      {:else}
        <section class="empty">
          <EyeOff size={36} />
          <h2>No hidden questions</h2>
          <p>Hide low-value or duplicate questions from Study when you find them.</p>
        </section>
      {/each}
    </section>
  {/if}
</main>

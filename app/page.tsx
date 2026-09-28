"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "en" | "both";
type Card = { word:string; lemma:string; partOfSpeech:string; ukIpa:string; usIpa:string; definition:string; chineseMeaning?:string };
type SavedWord = Card & { id:string; addedAt:number; contextSentence?:string; reviewStatus?:"known"|"unknown" };
type PhraseCard = { phrase:string; definition:string; contextSentence:string; chineseMeaning?:string };
type SavedPhrase = PhraseCard & { id:string; addedAt:number };
type AnalysisKind = "sentence" | "paragraph";
type SentenceAnalysis = { sentence:string; kind:AnalysisKind; logic:string; mainClause:string; structure:string[]; explanation:string; translation?:string };
type SavedSentence = SentenceAnalysis & { id:string; addedAt:number; mode:Mode };
type ReadingHistory = { id:string; title:string; passage:string; tags:string[]; updatedAt:number };

function meaningFor(item:{definition:string;chineseMeaning?:string}){return item.chineseMeaning||item.definition.split("· 中文：")[1]?.trim()||"";}
function englishDefinition(item:{definition:string}){return item.definition.split("· 中文：")[0].trim();}
function mergeById<T extends {id:string;addedAt:number}>(cloud:T[], local:T[]) {const merged=new Map<string,T>();for(const item of [...cloud,...local]){const current=merged.get(item.id);if(!current||item.addedAt>=current.addedAt)merged.set(item.id,item);}return [...merged.values()].sort((a,b)=>b.addedAt-a.addedAt);}

function speak(word:string, lang:"en-GB"|"en-US") {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = lang;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang === lang);
  if (voice) utterance.voice = voice;
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function sentenceForToken(text:string, tokens:string[], tokenIndex:number) {
  const offset = tokens.slice(0,tokenIndex).join("").length;
  const before = text.slice(0,offset);
  const start = Math.max(before.lastIndexOf("."),before.lastIndexOf("!"),before.lastIndexOf("?"),before.lastIndexOf("。"))+1;
  const after = text.slice(offset);
  const ends = [after.indexOf("."),after.indexOf("!"),after.indexOf("?"),after.indexOf("。")].filter((value)=>value>=0);
  const end = ends.length ? offset+Math.min(...ends)+1 : text.length;
  return text.slice(start,end).trim();
}

export default function Home() {
  const [draft,setDraft] = useState("");
  const [passage,setPassage] = useState("");
  const [articleTitle,setArticleTitle] = useState("");
  const [articleTags,setArticleTags] = useState<string[]>([]);
  const [tagsLoading,setTagsLoading] = useState(false);
  const [mode] = useState<Mode>("en");
  const [active,setActive] = useState<string>("");
  const [card,setCard] = useState<Card|null>(null);
  const [wordSentence,setWordSentence] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [saved,setSaved] = useState<SavedWord[]>([]);
  const [wordFilter,setWordFilter] = useState<"all"|"known"|"unknown"|"unreviewed">("all");
  const [phraseCard,setPhraseCard] = useState<PhraseCard|null>(null);
  const [savedPhrases,setSavedPhrases] = useState<SavedPhrase[]>([]);
  const [savedSentences,setSavedSentences] = useState<SavedSentence[]>([]);
  const [readingHistory,setReadingHistory] = useState<ReadingHistory[]>([]);
  const [analysis,setAnalysis] = useState<SentenceAnalysis|null>(null);
  const [sentenceLoading,setSentenceLoading] = useState(false);
  const [sentenceError,setSentenceError] = useState("");
  const [panel,setPanel] = useState<"word"|"phrase"|"sentence">("word");
  const [view,setView] = useState<"read"|"history"|"vocab"|"phrases"|"sentences">("read");
  const [mobileCardOpen,setMobileCardOpen] = useState(false);
  const requestId = useRef(0);
  const passageRef = useRef<HTMLElement|null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("lumen-vocabulary");
    const restoredWords:SavedWord[] = raw ? JSON.parse(raw) : [];
    if (raw) setSaved(restoredWords);
    const phraseRaw = localStorage.getItem("lumen-phrases");
    const restoredPhrases:SavedPhrase[] = phraseRaw ? JSON.parse(phraseRaw) : [];
    if (phraseRaw) setSavedPhrases(restoredPhrases);
    const sentenceRaw = localStorage.getItem("lumen-sentences");
    if (sentenceRaw) {
      const restored = JSON.parse(sentenceRaw) as SavedSentence[];
      setSavedSentences(restored.map((item)=>({...item,kind:item.kind||"sentence",logic:item.logic||item.explanation||""})));
    }
    const restoredSentences:SavedSentence[] = sentenceRaw ? (JSON.parse(sentenceRaw) as SavedSentence[]).map((item)=>({...item,kind:item.kind||"sentence",logic:item.logic||item.explanation||""})) : [];
    void (async()=>{try{const response=await fetch("/api/collections",{cache:"no-store"});if(!response.ok)return;const cloud=await response.json() as {word?:SavedWord[];phrase?:SavedPhrase[];sentence?:SavedSentence[]};const words=mergeById(cloud.word||[],restoredWords);const phrases=mergeById(cloud.phrase||[],restoredPhrases);const sentences=mergeById(cloud.sentence||[],restoredSentences);setSaved(words);setSavedPhrases(phrases);setSavedSentences(sentences);localStorage.setItem("lumen-vocabulary",JSON.stringify(words));localStorage.setItem("lumen-phrases",JSON.stringify(phrases));localStorage.setItem("lumen-sentences",JSON.stringify(sentences));await fetch("/api/collections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:{word:words,phrase:phrases,sentence:sentences}})});if(words.some((item)=>!meaningFor(item))||phrases.some((item)=>!meaningFor(item)))void backfillMeanings(words,phrases);}catch{}})();
  },[]);
  useEffect(()=>{void (async()=>{try{const response=await fetch("/api/readings",{cache:"no-store"});if(!response.ok)return;const data=await response.json() as {items?:ReadingHistory[]};const items=data.items||[];setReadingHistory(items);if(items[0]){setArticleTitle(items[0].title);setPassage(items[0].passage);setArticleTags(items[0].tags||[]);}}catch{}})();},[]);

  function openReading(item:ReadingHistory){setArticleTitle(item.title);setPassage(item.passage);setArticleTags(item.tags||[]);setView("read");setActive("");setCard(null);}
  function removeReading(id:string){setReadingHistory((items)=>items.filter((item)=>item.id!==id));void fetch("/api/readings",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});}
  function saveReading(item:ReadingHistory){setReadingHistory((items)=>[item,...items.filter((entry)=>entry.id!==item.id)].slice(0,50));void fetch("/api/readings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item)});}
  function syncItems(items:Partial<{word:SavedWord[];phrase:SavedPhrase[];sentence:SavedSentence[]}>) {void fetch("/api/collections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items})});}
  function deleteCloudItem(kind:"word"|"phrase"|"sentence",id:string) {void fetch("/api/collections",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,id})});}

  useEffect(() => {
    if (!passageRef.current || !passage) return;
    const highlightApi=(CSS as unknown as {highlights?:Map<string,Highlight>}).highlights;
    if(!highlightApi||typeof Highlight==="undefined")return;
    const frame=requestAnimationFrame(()=>{
      const root=passageRef.current;if(!root)return;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes:Array<{node:Text;start:number;end:number}>=[];let full="";let current:Node|null;
      while((current=walker.nextNode())){const node=current as Text;const start=full.length;full+=node.data;nodes.push({node,start,end:full.length});}
      const ranges:Range[]=[];
      const terms=[...savedSentences.map((item)=>({text:item.sentence,word:false})),...savedPhrases.map((item)=>({text:item.phrase,word:false})),...saved.map((item)=>({text:item.lemma,word:true}))].sort((a,b)=>b.text.length-a.text.length);
      for(const term of terms){const needle=term.text.trim().toLowerCase();if(!needle)continue;let from=0;const haystack=full.toLowerCase();while((from=haystack.indexOf(needle,from))>=0){const end=from+needle.length;const bounded=!term.word||((from===0||!/[a-z]/i.test(full[from-1]))&&(end===full.length||!/[a-z]/i.test(full[end])));if(bounded){const first=nodes.find((item)=>from>=item.start&&from<item.end);const last=nodes.find((item)=>end>item.start&&end<=item.end);if(first&&last){const range=document.createRange();range.setStart(first.node,from-first.start);range.setEnd(last.node,end-last.start);ranges.push(range);}}from=end;}}
      highlightApi.set("saved-content",new Highlight(...ranges));
    });
    return()=>{cancelAnimationFrame(frame);highlightApi.delete("saved-content");};
  },[passage,saved,savedPhrases,savedSentences]);

  const copy = (en:string, _zh:string) => en;

  async function backfillMeanings(words:SavedWord[],phrases:SavedPhrase[]){
    try{const response=await fetch("/api/collection-meanings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({words:words.filter((item)=>!meaningFor(item)).map((item)=>({id:item.id,text:item.lemma,context:item.contextSentence})),phrases:phrases.filter((item)=>!meaningFor(item)).map((item)=>({id:item.id,text:item.phrase,context:item.contextSentence}))})});const data=await response.json();if(!response.ok)return;const meanings=new Map<string,string>((data.items||[]).map((item:{id:string;chineseMeaning:string})=>[item.id,item.chineseMeaning]));const nextWords=words.map((item)=>meaningFor(item)?item:{...item,chineseMeaning:meanings.get(`word:${item.id}`)||""});const nextPhrases=phrases.map((item)=>meaningFor(item)?item:{...item,chineseMeaning:meanings.get(`phrase:${item.id}`)||""});setSaved(nextWords);setSavedPhrases(nextPhrases);localStorage.setItem("lumen-vocabulary",JSON.stringify(nextWords));localStorage.setItem("lumen-phrases",JSON.stringify(nextPhrases));}catch{}
  }

  const paragraphs = useMemo(() => passage.split(/\n\s*\n+/).map((item)=>item.trim()).filter(Boolean),[passage]);
  const wordCounts = useMemo(() => ({
    all: saved.length,
    known: saved.filter((item)=>item.reviewStatus==="known").length,
    unknown: saved.filter((item)=>item.reviewStatus==="unknown").length,
    unreviewed: saved.filter((item)=>!item.reviewStatus).length,
  }),[saved]);
  const visibleWords = useMemo(() => wordFilter==="all" ? saved : saved.filter((item)=>wordFilter==="unreviewed" ? !item.reviewStatus : item.reviewStatus===wordFilter),[saved,wordFilter]);

  async function inspectWord(word:string, sentence:string) {
    const clean = word.replace(/[^A-Za-z'’-]/g,"");
    if (!clean) return;
    const id = ++requestId.current;
    setPanel("word"); setMobileCardOpen(true); setActive(clean); setWordSentence(sentence); setCard(null); setAnalysis(null); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/define",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({word:clean,sentence})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The definition could not be loaded.");
      if (id === requestId.current) setCard(data);
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : "The definition could not be loaded.");
    } finally { if (id === requestId.current) setLoading(false); }
  }

  async function analyzeSentence(sentence:string, kind:AnalysisKind="sentence") {
    setPanel("sentence"); setMobileCardOpen(true); setAnalysis(null); setCard(null); setSentenceError(""); setSentenceLoading(true);
    try {
      const response = await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sentence,mode,kind})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The sentence could not be analyzed.");
      setAnalysis(data);
    } catch (reason) { setSentenceError(reason instanceof Error ? reason.message : "The sentence could not be analyzed."); }
    finally { setSentenceLoading(false); }
  }

  async function inspectPhrase(phrase:string, contextSentence:string) {
    setPanel("phrase"); setMobileCardOpen(true); setPhraseCard(null); setError(""); setLoading(true);
    try {
      const response=await fetch("/api/phrase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phrase,contextSentence})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"The phrase could not be explained.");
      setPhraseCard(data);
    } catch(reason){setError(reason instanceof Error?reason.message:"The phrase could not be explained.");}
    finally{setLoading(false);}
  }

  function analyzeSelection() {
    const selection = window.getSelection();
    const selected = selection?.toString().replace(/\s+/g," ").trim() || "";
    const wordCount=selected.split(" ").filter(Boolean).length;
    if (!selection || !selected || wordCount < 2 || !passageRef.current) return;
    const node = selection.anchorNode;
    if (!node || !passageRef.current.contains(node.nodeType===Node.TEXT_NODE?node.parentElement:node as HTMLElement)) return;
    if(wordCount<=6){
      const paragraph=(node.nodeType===Node.TEXT_NODE?node.parentElement:node as HTMLElement)?.closest(".articleParagraph")?.textContent||selected;
      const index=paragraph.indexOf(selected); const before=paragraph.slice(0,Math.max(0,index));
      const start=Math.max(before.lastIndexOf("."),before.lastIndexOf("!"),before.lastIndexOf("?"))+1;
      const after=paragraph.slice(index+selected.length); const ends=[after.indexOf("."),after.indexOf("!"),after.indexOf("?")].filter((v)=>v>=0);
      const end=ends.length?index+selected.length+Math.min(...ends)+1:paragraph.length;
      inspectPhrase(selected,paragraph.slice(start,end).trim()); return;
    }
    const punctuationCount=(selected.match(/[.!?。]/g)||[]).length;
    analyzeSentence(selected,punctuationCount>1||selected.length>450?"paragraph":"sentence");
  }

  function saveWord() {if(!card)return;const item={...card,contextSentence:wordSentence,id:card.lemma.toLowerCase(),addedAt:Date.now()};const next=[item,...saved.filter((entry)=>entry.id!==item.id)];setSaved(next);localStorage.setItem("lumen-vocabulary",JSON.stringify(next));syncItems({word:[item]});}

  function removeWord(id:string) {const next=saved.filter((item)=>item.id!==id);setSaved(next);localStorage.setItem("lumen-vocabulary",JSON.stringify(next));deleteCloudItem("word",id);}

  function markWord(id:string,reviewStatus:"known"|"unknown"){const next=saved.map((item)=>item.id===id?{...item,reviewStatus}:item);setSaved(next);localStorage.setItem("lumen-vocabulary",JSON.stringify(next));syncItems({word:next.filter((item)=>item.id===id)});}

  function saveSentence(){if(!analysis)return;const id=`${mode}:${analysis.kind}:${analysis.sentence}`;const item={...analysis,id,mode,addedAt:Date.now()};const next=[item,...savedSentences.filter((entry)=>entry.id!==id)];setSavedSentences(next);localStorage.setItem("lumen-sentences",JSON.stringify(next));syncItems({sentence:[item]});}

  function removeSentence(id:string){const next=savedSentences.filter((item)=>item.id!==id);setSavedSentences(next);localStorage.setItem("lumen-sentences",JSON.stringify(next));deleteCloudItem("sentence",id);}

  function savePhrase(){if(!phraseCard)return;const id=phraseCard.phrase.toLowerCase();const item={...phraseCard,id,addedAt:Date.now()};const next=[item,...savedPhrases.filter((entry)=>entry.id!==id)];setSavedPhrases(next);localStorage.setItem("lumen-phrases",JSON.stringify(next));syncItems({phrase:[item]});}
  function removePhrase(id:string){const next=savedPhrases.filter((item)=>item.id!==id);setSavedPhrases(next);localStorage.setItem("lumen-phrases",JSON.stringify(next));deleteCloudItem("phrase",id);}

  const startReading = async () => {
    const lines=draft.split(/\r?\n/).map((line)=>line.trim());const firstContentIndex=lines.findIndex(Boolean);if(firstContentIndex<0)return;const remaining=lines.slice(firstContentIndex+1).join("\n").trim();const hasSeparateTitle=Boolean(remaining);const nextPassage=hasSeparateTitle?remaining:lines[firstContentIndex];const nextTitle=hasSeparateTitle?lines[firstContentIndex]:copy("Untitled reading","未命名精读");
    setArticleTitle(nextTitle);setPassage(nextPassage);setArticleTags([]);setTagsLoading(true);setView("read");setActive("");setCard(null);let tags:string[]=[];
    try{const response=await fetch("/api/metadata",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({passage:nextPassage,mode})});const data=await response.json();if(response.ok&&Array.isArray(data.tags)){tags=data.tags.slice(0,3);setArticleTags(tags);}}finally{setTagsLoading(false);const item={id:crypto.randomUUID(),title:nextTitle,passage:nextPassage,tags,updatedAt:Date.now()};saveReading(item);setDraft("");}
  };

  const articleWordCount = useMemo(() => (passage.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[]).length,[passage]);
  const readingMinutes = Math.max(1,Math.ceil(articleWordCount/220));

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={()=>{setPassage("");setArticleTitle("");setView("read")}}>Lumen</button>
        <nav aria-label="Primary navigation" className="primaryNav">
          <button className={view==="read"?"navActive":""} onClick={()=>setView("read")}>{copy("Read","阅读")}</button>
          <button className={view==="history"?"navActive":""} onClick={()=>setView("history")}>History <span className="badge">{readingHistory.length}</span></button>
          <button className={view==="vocab"?"navActive":""} onClick={()=>setView("vocab")}>{copy("Vocabulary","生词本")} <span className="badge">{saved.length}</span></button>
          <button className={view==="phrases"?"navActive":""} onClick={()=>setView("phrases")}>{copy("Phrases","词组")} <span className="badge">{savedPhrases.length}</span></button>
          <button className={view==="sentences"?"navActive":""} onClick={()=>setView("sentences")}>{copy("Sentences","长难句")} <span className="badge">{savedSentences.length}</span></button>
        </nav>
      </header>

      {view==="history" ? (
        <section className="vocabPage"><p className="eyebrow">READING HISTORY</p><h1>Your readings.</h1>{readingHistory.length===0?<div className="empty"><p>No saved readings yet.</p></div>:<div className="historyList">{readingHistory.map((item)=><article className="historyCard" key={item.id}><div><span>{new Date(item.updatedAt).toLocaleString()}</span><h2>{item.title}</h2><p>{item.passage.slice(0,180)}{item.passage.length>180?"…":""}</p></div><div className="historyActions"><button onClick={()=>openReading(item)}>Open →</button><button onClick={()=>removeReading(item.id)}>Remove</button></div></article>)}</div>}</section>
      ) : view==="phrases" ? (
        <section className="vocabPage"><p className="eyebrow">SAVED PHRASES</p><h1>Your phrases.</h1>{savedPhrases.length===0?<div className="empty"><p>No phrases saved yet.</p></div>:<div className="wordList">{savedPhrases.map((item)=><details key={item.id} className="savedCard"><summary><span className="phraseMark">P</span><h2>{item.phrase}</h2><span className="expandLabel">＋</span></summary><div className="wordDetail"><div className="analysisSection"><b>ENGLISH DEFINITION</b><p>{englishDefinition(item)}</p></div><div className="analysisSection chineseMeaning"><b>中文意思</b><p>{meaningFor(item)||"正在补充中文意思……"}</p></div><div className="analysisSection contextQuote"><b>SENTENCE IN THE PASSAGE</b><p>{item.contextSentence}</p></div><div className="savedActions"><button onClick={()=>speak(item.phrase,"en-GB")}>▶</button><button onClick={()=>removePhrase(item.id)}>Remove</button></div></div></details>)}</div>}</section>
      ) : view==="sentences" ? (
        <section className="vocabPage">
          <p className="eyebrow">{copy("SAVED ANALYSES","收藏的分析")}</p><h1>{copy("Difficult sentences.","长难句收藏。")}</h1>
          {savedSentences.length===0 ? <div className="empty"><p>{copy("No sentence analyses saved yet.","还没有收藏长难句分析。")}</p><button onClick={()=>setView("read")}>{copy("Return to reading","返回阅读")} →</button></div> :
            <div className="sentenceLibrary">{savedSentences.map((item)=><details key={item.id} className="savedSentence"><summary><span className="savedKind">{item.kind==="paragraph"?copy("PARAGRAPH","段落"):copy("SENTENCE","句子")}</span><span className="savedSource">{item.sentence}</span><span className="expandLabel">{copy("Show analysis","展开分析")} ＋</span></summary><div className="savedDetail"><button className="removeSentence" onClick={()=>removeSentence(item.id)}>{copy("Remove","删除")}</button>{item.translation&&<div className="analysisSection translationBlock"><b>中文翻译</b><p>{item.translation}</p></div>}<div className="analysisSection"><b>句子逻辑</b><p>{item.logic}</p></div><div className="analysisSection"><b>主干</b><p>{item.mainClause}</p></div><div className="analysisSection"><b>关键分块</b><ol>{item.structure.map((part,index)=><li key={index}>{part}</li>)}</ol></div><div className="analysisSection"><b>简析</b><p>{item.explanation}</p></div></div></details>)}</div>}
        </section>
      ) : view==="vocab" ? (
        <section className="vocabPage">
          <p className="eyebrow">{copy("SAVED FOR LATER","稍后复习")}</p><h1>{copy("Your vocabulary.","你的生词本。")}</h1>
          {saved.length===0 ? <div className="empty"><p>{copy("No words saved yet.","还没有保存生词。")}</p><button onClick={()=>setView("read")}>{copy("Return to reading","返回阅读")} →</button></div> :
            <><div className="wordFilters" aria-label="Filter vocabulary">{([["all","All",wordCounts.all],["known","Known",wordCounts.known],["unknown","Review again",wordCounts.unknown],["unreviewed","Not reviewed",wordCounts.unreviewed]] as const).map(([value,label,count])=><button key={value} className={`${value}Filter ${wordFilter===value?"active":""}`} aria-pressed={wordFilter===value} onClick={()=>setWordFilter(value)}><span className="filterDot"/>{label} <b>{count}</b></button>)}</div>{visibleWords.length===0?<div className="filterEmpty"><p>No words in this category.</p></div>:<div className="wordList">{visibleWords.map((item)=><details key={item.id} className={`savedCard ${item.reviewStatus||"unreviewed"}`}><summary><span className="reviewDot" aria-label={item.reviewStatus==="known"?"Known":item.reviewStatus==="unknown"?"Review again":"Not reviewed"}/><h2>{item.lemma}</h2><span className="expandLabel">＋</span></summary><div className="wordDetail"><p className="wordMeta">{item.partOfSpeech} · UK {item.ukIpa} · US {item.usIpa}</p><div className="analysisSection"><b>ENGLISH DEFINITION</b><p>{englishDefinition(item)}</p></div><div className="analysisSection chineseMeaning"><b>中文意思</b><p>{meaningFor(item)||"正在补充中文意思……"}</p></div><div className="analysisSection contextQuote"><b>SENTENCE IN THE PASSAGE</b><p>{item.contextSentence||"Not available for words saved before this update."}</p></div><div className="reviewButtons"><button className="knowButton" onClick={(event)=>{markWord(item.id,"known");event.currentTarget.closest("details")?.removeAttribute("open")}}>✓ I know it</button><button className="unknownButton" onClick={(event)=>{markWord(item.id,"unknown");event.currentTarget.closest("details")?.removeAttribute("open")}}>× I don't know it</button></div><div className="savedActions"><button onClick={()=>speak(item.lemma,"en-GB")}>UK ▶</button><button onClick={()=>speak(item.lemma,"en-US")}>US ▶</button><button onClick={()=>removeWord(item.id)}>Remove</button></div></div></details>)}</div>}</>}
        </section>
      ) : !passage ? (
        <>
          <section className="hero"><p className="eyebrow">{copy("YOUR CLOSE READING DESK","你的精读书桌")}</p><h1>{copy("Read less.","读得少些。")}<br/>{copy("Notice more.","看得深些。")}</h1><p>{copy("Paste a passage, select a word, and stay inside the text.","粘贴一段材料，点击单词，专注于文本本身。")}</p></section>
          <section className="workspace">
            <div className="panel inputPanel"><div className="panelHead"><div><span className="step">01</span><h2>{copy("Paste your passage","粘贴阅读材料")}</h2></div><span className="count">{draft.length} {copy("characters","字符")}</span></div><textarea aria-label="Reading passage" value={draft} onChange={(event)=>setDraft(event.target.value)} placeholder={copy("Paste an English passage here…","在这里粘贴英文材料……")}/><div className="inputFoot"><span>{copy("Your text stays on this device.","材料保留在当前设备。")}</span><button className="begin" onClick={startReading}>{copy("Begin reading","开始阅读")} <span>→</span></button></div></div>
            <aside className="panel guide"><span className="step">02</span><h2>{copy("Then, read naturally.","然后，自然地阅读。")}</h2><div className="guideRow"><b>{copy("SELECT","选择")}</b><p>{copy("any English word to open a quiet definition card.","任意英文单词，打开简洁词卡。")}</p></div><div className="guideRow"><b>{copy("LISTEN","朗读")}</b><p>{copy("to British or American pronunciation.","英式或美式发音。")}</p></div><div className="guideRow"><b>{copy("KEEP","收藏")}</b><p>{copy("only the words worth returning to.","真正值得复习的单词。")}</p></div><blockquote>{copy("“The art of reading is the art of thinking.”","“阅读的艺术，就是思考的艺术。”")}</blockquote></aside>
          </section>
        </>
      ) : (
        <section className="reader">
          <div className="readerTop"><div><p className="eyebrow">{copy("CLOSE READING","精读模式")}</p><h1>{articleTitle}</h1><div className="articleMeta"><span>{articleWordCount} {copy("words","词")}</span><span>≈ {readingMinutes} {copy(readingMinutes===1?"minute":"minutes","分钟")}</span>{tagsLoading?<span className="tagLoading">{copy("Finding topics…","正在识别主题……")}</span>:articleTags.map((tag)=><span className="topicTag" key={tag}>{tag}</span>)}</div></div><button className="newText" onClick={()=>{setPassage("");setArticleTitle("");setArticleTags([])}}>← {copy("New passage","新材料")}</button></div>
          <div className="readingGrid">
            <article ref={passageRef} onMouseUp={analyzeSelection} className="passage continuousPassage" aria-label="Interactive reading passage">{paragraphs.map((paragraph,paragraphIndex)=>{const paragraphTokens=paragraph.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/g);return <p className="articleParagraph" key={paragraphIndex}>{paragraphTokens.map((token,index)=>/^[A-Za-z]/.test(token)?<span role="button" tabIndex={0} key={index} onClick={()=>inspectWord(token,sentenceForToken(paragraph,paragraphTokens,index))} onKeyDown={(event)=>{if(event.key==="Enter")inspectWord(token,sentenceForToken(paragraph,paragraphTokens,index))}} className={active.toLowerCase()===token.toLowerCase()?"word activeWord":"word"}>{token}</span>:<span key={index}>{token}</span>)}</p>})}</article>
            <aside className={`wordCard ${mobileCardOpen?"mobileOpen":""}`} aria-live="polite" id="reading-insight">
              <div className="mobileCardHandle"><button className="mobileCardToggle" aria-label={mobileCardOpen?"收起释义卡":"展开释义卡"} aria-expanded={mobileCardOpen} onClick={()=>setMobileCardOpen((open)=>!open)}><span aria-hidden="true"/></button></div>
              {panel==="word" && <>{!active && <div className="cardHint"><span className="step">{copy("WORD CARD","单词卡")}</span><h2>{copy("Select a word or analyze a sentence.","点击单词，或分析一个句子。")}</h2><p>{copy("Contextual definitions and sentence structure appear here.","语境释义和句子结构会显示在这里。")}</p></div>}{loading && <div className="loading"><i/><p>{copy("Reading the context…","正在理解语境……")}</p></div>}{error && <div className="cardError"><span>Couldn’t define this word</span><p>{error}</p></div>}{card && <div className="definition"><span className="part">{card.partOfSpeech}</span><h2>{card.lemma}</h2><div className="pronounce"><button onClick={()=>speak(card.lemma,"en-GB")}><small>UK</small>{card.ukIpa} <b>▶</b></button><button onClick={()=>speak(card.lemma,"en-US")}><small>US</small>{card.usIpa} <b>▶</b></button></div><p>{card.definition}</p><button className="save" onClick={saveWord}>{saved.some((item)=>item.id===card.lemma.toLowerCase())?"Saved ✓":"＋ Add to vocabulary"}</button></div>}</>}
              {panel==="phrase"&&<>{loading&&<div className="loading"><i/><p>{copy("Reading the phrase…","正在理解词组……")}</p></div>}{error&&<div className="cardError"><span>{copy("Couldn’t explain this phrase","无法解释该词组")}</span><p>{error}</p></div>}{phraseCard&&<div className="definition"><span className="part">{copy("PHRASE","词组")}</span><h2 className="phraseTitle">{phraseCard.phrase}</h2><button className="phraseSpeak" onClick={()=>speak(phraseCard.phrase,"en-GB")}>▶ {copy("Listen","朗读")}</button><p>{phraseCard.definition}</p><div className="contextQuote"><b>{copy("Sentence in the passage","文中原句")}</b><p>{phraseCard.contextSentence}</p></div><button className="save" onClick={savePhrase}>{savedPhrases.some((item)=>item.id===phraseCard.phrase.toLowerCase())?copy("Saved ✓","已收藏 ✓"):copy("＋ Save phrase","＋ 收藏词组")}</button></div>}</>}
              {panel==="sentence" && <>{sentenceLoading&&<div className="loading"><i/><p>正在梳理结构……</p></div>}{sentenceError&&<div className="cardError"><span>无法分析这段内容</span><p>{sentenceError}</p></div>}{analysis&&<div className="sentenceAnalysis"><span className="part">{analysis.kind==="paragraph"?"段落分析":"句子分析"}</span><blockquote>{analysis.sentence}</blockquote>{analysis.translation&&<div className="analysisSection translationBlock"><b>中文翻译</b><p>{analysis.translation}</p></div>}<div className="analysisSection logicBlock"><b>句子逻辑</b><p>{analysis.logic}</p></div><h3 className="analysisTitle">解析</h3><div className="analysisSection"><b>主干</b><p>{analysis.mainClause}</p></div><div className="analysisSection"><b>关键分块</b><ol>{analysis.structure.map((part,index)=><li key={index}>{part}</li>)}</ol></div><div className="analysisSection"><b>简析</b><p>{analysis.explanation}</p></div><button className="save" onClick={saveSentence}>{savedSentences.some((item)=>item.id===`${mode}:${analysis.kind}:${analysis.sentence}`)?"已收藏 ✓":"＋ 收藏原文与分析"}</button></div>}</>}
            </aside>
          </div>
          <p className="modeNote">{copy("Word cards always use English explanations.","词卡始终使用英文解释。")}</p>
        </section>
      )}
    </main>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Download, Copy, Undo2, Redo2, Eye, Code, Paintbrush,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link, Image, Trash2, MoveUp, MoveDown, CopyPlus, Palette,
  Maximize2, Minimize2, Layers, PanelRightClose, PanelRightOpen,
  Type, Save, MousePointer, Heading1, Heading2, Heading3,
  CheckCircle, Strikethrough, List, ListOrdered, Minus,
  Sparkles, Loader2, Wand2, ImagePlus, Bot, Zap, RotateCcw, Send,
  Smartphone, Monitor,
  BookmarkPlus, Library, Tag, Clock, FileCode, Search,
  BookOpen, ArrowDownToLine, Eye as EyeIcon,
} from 'lucide-react';
import { SavedSection, SECTION_TYPE_OPTIONS, OUTPUT_STACK_OPTIONS, type OutputStack } from '@/types';

/* ─────────── Types ─────────── */

interface ElementInfo {
  path: string;
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  innerHTML: string;
  outerHTML: string;
  href: string;
  src: string;
  alt: string;
  isTextNode: boolean;
  hasChildren: boolean;
  childCount: number;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
}

interface SectionInfo {
  index: number;
  tagName: string;
  id: string;
  className: string;
  textPreview: string;
  path: string;
}

interface VisualHtmlEditorProps {
  initialHtml: string;
  initialMobileHtml?: string;
  onSave: (html: string, mobileHtml?: string) => void;
  onClose: () => void;
  pageTitle?: string;
}

type EditorMode = 'visual' | 'code' | 'preview';

/* ─────────── Iframe Editor Script ─────────── */

const EDITOR_SCRIPT = `
(function(){
  var sel=null,hover=null,editing=false,editEl=null;
  var HS='2px dashed rgba(59,130,246,0.4)',SS='2px solid #3b82f6',ES='2px solid #f59e0b';

  function gp(el){
    var p=[];var c=el;
    while(c&&c!==document.documentElement){
      var s=c.tagName.toLowerCase();
      if(c.id){s+='#'+c.id}
      else if(c.parentElement){
        var sibs=Array.from(c.parentElement.children).filter(function(x){return x.tagName===c.tagName});
        if(sibs.length>1)s+=':nth-of-type('+(sibs.indexOf(c)+1)+')';
      }
      p.unshift(s);c=c.parentElement;
    }
    return p.join(' > ');
  }

  function gi(el){
    if(!el)return null;
    var cs=getComputedStyle(el),r=el.getBoundingClientRect();
    return{
      path:gp(el),tagName:el.tagName.toLowerCase(),id:el.id||'',
      className:typeof el.className==='string'?el.className:'',
      textContent:el.childNodes.length<=3?(el.textContent||'').substring(0,300):'',
      innerHTML:el.innerHTML?(el.innerHTML).substring(0,2000):'',
      outerHTML:el.outerHTML?(el.outerHTML).substring(0,300):'',
      href:el.getAttribute('href')||'',src:el.getAttribute('src')||'',
      alt:el.getAttribute('alt')||'',
      rect:{x:r.x,y:r.y,width:r.width,height:r.height},
      isTextNode:el.childNodes.length===1&&el.childNodes[0].nodeType===3,
      hasChildren:el.children.length>0,childCount:el.children.length,
      styles:{
        color:cs.color,backgroundColor:cs.backgroundColor,
        fontSize:cs.fontSize,fontWeight:cs.fontWeight,fontFamily:cs.fontFamily,
        fontStyle:cs.fontStyle,textDecoration:cs.textDecoration,
        textAlign:cs.textAlign,lineHeight:cs.lineHeight,
        padding:cs.padding,margin:cs.margin,borderRadius:cs.borderRadius,
        border:cs.border,display:cs.display,opacity:cs.opacity,
        backgroundImage:cs.backgroundImage,
      }
    };
  }

  function co(el){if(el){el.style.outline='';el.style.outlineOffset='';}}
  function sk(el){
    if(!el||el===document.documentElement||el===document.body||el===document.head)return true;
    var t=el.tagName&&el.tagName.toLowerCase();
    return!t||t==='html'||t==='head'||t==='style'||t==='link'||t==='meta'||t==='script'||t==='noscript';
  }

  function sendHtml(){
    var saved=null,so=null;
    if(sel){saved=sel.style.outline;so=sel.style.outlineOffset;sel.style.outline='';sel.style.outlineOffset='';}
    if(editEl){editEl.contentEditable='false';}
    var h='<!DOCTYPE html>'+document.documentElement.outerHTML;
    if(sel){sel.style.outline=saved;sel.style.outlineOffset=so;}
    if(editEl){editEl.contentEditable='true';}
    window.parent.postMessage({type:'html-updated',data:h},'*');
  }

  function finishEdit(){
    if(!editEl)return;
    editEl.contentEditable='false';co(editEl);
    if(sel===editEl){editEl.style.outline=SS;editEl.style.outlineOffset='2px';}
    window.parent.postMessage({type:'editing-finished',data:gi(editEl)},'*');
    editing=false;editEl=null;sendHtml();
  }

  document.addEventListener('mouseover',function(e){
    if(editing)return;var el=e.target;if(sk(el)||el===sel)return;
    if(hover&&hover!==sel)co(hover);hover=el;el.style.outline=HS;el.style.outlineOffset='1px';
  },true);

  document.addEventListener('mouseout',function(e){
    var el=e.target;if(el!==sel)co(el);if(hover===el)hover=null;
  },true);

  document.addEventListener('click',function(e){
    if(editing&&editEl&&!editEl.contains(e.target)){finishEdit();}
    if(editing&&editEl&&editEl.contains(e.target))return;
    e.preventDefault();e.stopPropagation();
    var el=e.target;if(sk(el))return;
    if(sel)co(sel);sel=el;
    el.style.outline=SS;el.style.outlineOffset='2px';
    window.parent.postMessage({type:'element-selected',data:gi(el)},'*');
  },true);

  document.addEventListener('dblclick',function(e){
    e.preventDefault();e.stopPropagation();
    var el=e.target;if(sk(el))return;
    if(editing&&editEl)finishEdit();
    editing=true;editEl=el;sel=el;
    el.contentEditable='true';el.style.outline=ES;el.style.outlineOffset='2px';
    el.focus();
    var range=document.createRange();range.selectNodeContents(el);
    var s=window.getSelection();s.removeAllRanges();s.addRange(range);
    window.parent.postMessage({type:'editing-started',data:gi(el)},'*');
  },true);

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){if(editing)finishEdit();else if(sel){co(sel);sel=null;window.parent.postMessage({type:'element-deselected'},'*');}}
    if(editing&&e.key==='Enter'&&!e.shiftKey){
      var t=editEl&&editEl.tagName&&editEl.tagName.toLowerCase();
      if(t&&['h1','h2','h3','h4','h5','h6','span','a','button','li','label'].indexOf(t)>=0){e.preventDefault();finishEdit();}
    }
  });

  document.addEventListener('submit',function(e){e.preventDefault();},true);

  window.addEventListener('message',function(e){
    if(!e.data||!e.data.type)return;var m=e.data;
    switch(m.type){
      case 'cmd-exec':document.execCommand(m.command,false,m.value||null);sendHtml();
        if(sel)window.parent.postMessage({type:'element-selected',data:gi(sel)},'*');break;
      case 'cmd-set-style':if(sel){sel.style[m.property]=m.value;sendHtml();
        window.parent.postMessage({type:'element-selected',data:gi(sel)},'*');}break;
      case 'cmd-set-attr':if(sel){sel.setAttribute(m.name,m.value);sendHtml();
        window.parent.postMessage({type:'element-selected',data:gi(sel)},'*');}break;
      case 'cmd-set-text':if(sel){sel.textContent=m.value;sendHtml();}break;
      case 'cmd-delete':if(sel){sel.remove();sel=null;sendHtml();
        window.parent.postMessage({type:'element-deselected'},'*');}break;
      case 'cmd-duplicate':if(sel&&sel.parentElement){
        var cl=sel.cloneNode(true);sel.parentElement.insertBefore(cl,sel.nextSibling);
        co(sel);sel=cl;sel.style.outline=SS;sel.style.outlineOffset='2px';sendHtml();
        window.parent.postMessage({type:'element-selected',data:gi(sel)},'*');}break;
      case 'cmd-move-up':if(sel&&sel.previousElementSibling){
        sel.parentElement.insertBefore(sel,sel.previousElementSibling);sendHtml();}break;
      case 'cmd-move-down':if(sel&&sel.nextElementSibling){
        sel.parentElement.insertBefore(sel.nextElementSibling,sel);sendHtml();}break;
      case 'cmd-get-html':
        if(sel)co(sel);if(editEl){editEl.contentEditable='false';co(editEl);}
        var ch='<!DOCTYPE html>'+document.documentElement.outerHTML;
        if(sel){sel.style.outline=SS;sel.style.outlineOffset='2px';}
        window.parent.postMessage({type:'clean-html',data:ch},'*');break;
      case 'cmd-deselect':if(editing)finishEdit();if(sel)co(sel);sel=null;hover=null;
        window.parent.postMessage({type:'element-deselected'},'*');break;
      case 'cmd-select-path':try{var found=document.querySelector(m.path);
        if(found){if(sel)co(sel);sel=found;found.style.outline=SS;found.style.outlineOffset='2px';
        found.scrollIntoView({behavior:'smooth',block:'center'});
        window.parent.postMessage({type:'element-selected',data:gi(found)},'*');}}catch(x){}break;
      case 'cmd-get-sections':
        var b=document.body,secs=[];
        for(var i=0;i<b.children.length;i++){var c=b.children[i];var tg=c.tagName.toLowerCase();
          if(['style','script','link','meta','noscript'].indexOf(tg)>=0)continue;
          secs.push({index:i,tagName:tg,id:c.id||'',
            className:typeof c.className==='string'?c.className.substring(0,100):'',
            textPreview:(c.textContent||'').substring(0,80).trim(),path:gp(c)});}
        window.parent.postMessage({type:'sections-list',data:secs},'*');break;
      case 'cmd-get-selected-full-html':
        if(sel){
          var savedO=sel.style.outline,savedOO=sel.style.outlineOffset;
          sel.style.outline='';sel.style.outlineOffset='';
          var fullOuter=sel.outerHTML;
          sel.style.outline=savedO;sel.style.outlineOffset=savedOO;
          window.parent.postMessage({type:'selected-full-html',data:fullOuter},'*');
        }break;
      case 'cmd-insert-section':
        if(m.html){
          var tmp=document.createElement('div');tmp.innerHTML=m.html;
          var nodes=Array.from(tmp.children);
          var target=sel||document.body.lastElementChild;
          if(target&&target.parentElement){
            nodes.forEach(function(n){target.parentElement.insertBefore(n,target.nextSibling);});
          }else{
            nodes.forEach(function(n){document.body.appendChild(n);});
          }
          sendHtml();
          window.parent.postMessage({type:'section-inserted',data:true},'*');
        }break;
    }
  });

  window.parent.postMessage({type:'editor-ready'},'*');
})();
`;

/* ─────────── Helpers ─────────── */

function prepareEditorHtml(html: string): string {
  let clean = html;
  clean = clean.replace(/<meta[^>]*content-security-policy[^>]*>/gi, '');
  const script = `<script>${EDITOR_SCRIPT}<\/script>`;
  if (clean.includes('</body>')) return clean.replace('</body>', `${script}</body>`);
  if (clean.includes('</html>')) return clean.replace('</html>', `${script}</html>`);
  return clean + script;
}

function stripEditorScript(html: string): string {
  const idx = html.indexOf(EDITOR_SCRIPT.substring(0, 40));
  if (idx === -1) return html;
  const scriptStart = html.lastIndexOf('<script>', idx);
  const scriptEnd = html.indexOf('</script>', idx);
  if (scriptStart !== -1 && scriptEnd !== -1) {
    return html.substring(0, scriptStart) + html.substring(scriptEnd + 9);
  }
  return html;
}

const FONT_SIZES = ['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px','40px','48px','56px','64px','72px'];

const SAVED_SECTIONS_KEY = 'funnel-swiper-saved-sections';

function loadSavedSections(): SavedSection[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_SECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedSections(sections: SavedSection[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SAVED_SECTIONS_KEY, JSON.stringify(sections));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function rgbToHex(rgb: string): string {
  if (!rgb || rgb === 'transparent' || rgb.startsWith('#')) return rgb || '#000000';
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return '#000000';
  return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

const TAG_LABELS: Record<string, string> = {
  h1: 'Titolo H1', h2: 'Titolo H2', h3: 'Titolo H3', h4: 'Titolo H4',
  p: 'Paragrafo', span: 'Testo', a: 'Link', button: 'Pulsante',
  img: 'Immagine', div: 'Sezione', section: 'Sezione', header: 'Header',
  footer: 'Footer', nav: 'Navigazione', ul: 'Lista', ol: 'Lista Ordinata',
  li: 'Elemento Lista', form: 'Form', input: 'Input', textarea: 'Area Testo',
  video: 'Video', figure: 'Figura', figcaption: 'Didascalia', main: 'Contenuto Principale',
  article: 'Articolo', aside: 'Sidebar', blockquote: 'Citazione',
};

/* ─────────── Component ─────────── */

export default function VisualHtmlEditor({ initialHtml, initialMobileHtml, onSave, onClose, pageTitle }: VisualHtmlEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<EditorMode>('visual');
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [showSections, setShowSections] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentHtml, setCurrentHtml] = useState(initialHtml);
  const [codeHtml, setCodeHtml] = useState(initialHtml);
  const undoStack = useRef<string[]>([initialHtml]);
  const redoStack = useRef<string[]>([]);
  const undoIdx = useRef(0);

  /* ── Mobile viewport ── */
  const [editorViewport, setEditorViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [mobileHtml, setMobileHtml] = useState(initialMobileHtml || '');
  const [mobileCodeHtml, setMobileCodeHtml] = useState(initialMobileHtml || '');
  const hasMobile = !!(initialMobileHtml || mobileHtml);

  /* ── AI Image Generation ── */
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiSize, setAiSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
  const [aiStyle, setAiStyle] = useState<'vivid' | 'natural'>('vivid');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiRevisedPrompt, setAiRevisedPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  /* ── AI Code Editor ── */
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [aiEditModel, setAiEditModel] = useState<'claude' | 'gemini'>('claude');
  const [aiEditRunning, setAiEditRunning] = useState(false);
  const [aiEditError, setAiEditError] = useState('');
  const [aiEditProgress, setAiEditProgress] = useState<{ chunkIndex: number; totalChunks: number; label: string } | null>(null);
  const [showAiEditPanel, setShowAiEditPanel] = useState(false);
  const [aiEditHistory, setAiEditHistory] = useState<string[]>([]);
  const [aiPresetPrompts] = useState([
    { label: 'Conspiracy / Dark Brand', prompt: 'Trasforma completamente il brand in stile conspiracy/segreto: usa colori scuri (nero, rosso scuro, oro), font impattanti, aggiungi elementi visivi misteriosi, rendi il tono più urgente e segreto, modifica tutti i testi per avere un angolo conspiracy con linguaggio "they don\'t want you to know", aggiungi simboli come occhi, triangoli, lucchetti dove appropriato nei testi.' },
    { label: 'Luxury / Premium', prompt: 'Trasforma il brand in stile luxury premium: usa colori eleganti (nero, oro, bianco), font serif eleganti, spaziature ampie, aggiungi ombre sottili, rendi il design minimalista e sofisticato, modifica i testi con tono esclusivo e premium.' },
    { label: 'Urgenza / Scarcity', prompt: 'Aggiungi massima urgenza e scarcity a tutta la pagina: banner rossi/gialli di urgenza, countdown timer styling, badge "posti limitati", "offerta in scadenza", colori che comunicano urgenza (rosso, arancione), testi con scarcity e urgenza massima.' },
    { label: 'Health / Natural', prompt: 'Trasforma in stile salute/naturale: colori verdi, beige, marroni terrosi, font puliti e moderni, immagini di natura, toni caldi, testi che enfatizzano naturalità, benessere, ingredienti puri.' },
    { label: 'Tech / Futuristico', prompt: 'Trasforma in stile tech futuristico: colori cyan, viola, nero, gradienti neon, font sans-serif moderni, bordi sottili luminosi, effetti glow, testi con tono innovativo e tecnologico.' },
  ]);

  /* ── Section Library (state only) ── */
  const [savedSections, setSavedSections] = useState<SavedSection[]>([]);
  const [showSectionLibrary, setShowSectionLibrary] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSectionName, setSaveSectionName] = useState('');
  const [saveSectionType, setSaveSectionType] = useState('other');
  const [saveSectionTags, setSaveSectionTags] = useState('');
  const [saveSectionAiRewrite, setSaveSectionAiRewrite] = useState(false);
  const [saveSectionModel, setSaveSectionModel] = useState<'claude' | 'gemini'>('claude');
  const [saveSectionStack, setSaveSectionStack] = useState<OutputStack>('pure_css');
  const [saveSectionCustomInstructions, setSaveSectionCustomInstructions] = useState('');
  const [saveSectionRunning, setSaveSectionRunning] = useState(false);
  const [saveSectionError, setSaveSectionError] = useState('');
  const [saveSectionSuccess, setSaveSectionSuccess] = useState(false);
  const [pendingSectionHtml, setPendingSectionHtml] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilterType, setLibraryFilterType] = useState('all');
  const [previewSectionId, setPreviewSectionId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => { setSavedSections(loadSavedSections()); }, []);

  /* ── Undo/Redo ── */
  const pushUndo = useCallback((html: string) => {
    const stack = undoStack.current;
    if (stack[undoIdx.current] === html) return;
    stack.splice(undoIdx.current + 1);
    stack.push(html);
    if (stack.length > 60) stack.shift();
    undoIdx.current = stack.length - 1;
    redoStack.current = [];
  }, []);

  const canUndo = undoIdx.current > 0;
  const canRedo = undoIdx.current < undoStack.current.length - 1;

  const handleUndo = useCallback(() => {
    if (undoIdx.current <= 0) return;
    undoIdx.current--;
    const html = undoStack.current[undoIdx.current];
    setCurrentHtml(html);
    setCodeHtml(html);
  }, []);

  const handleRedo = useCallback(() => {
    if (undoIdx.current >= undoStack.current.length - 1) return;
    undoIdx.current++;
    const html = undoStack.current[undoIdx.current];
    setCurrentHtml(html);
    setCodeHtml(html);
  }, []);

  /* ── Iframe communication ── */
  const sendToIframe = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;
      switch (e.data.type) {
        case 'editor-ready':
          setEditorReady(true);
          sendToIframe({ type: 'cmd-get-sections' });
          break;
        case 'element-selected':
          setSelectedElement(e.data.data);
          setIsEditing(false);
          break;
        case 'element-deselected':
          setSelectedElement(null);
          setIsEditing(false);
          break;
        case 'editing-started':
          setSelectedElement(e.data.data);
          setIsEditing(true);
          break;
        case 'editing-finished':
          setSelectedElement(e.data.data);
          setIsEditing(false);
          break;
        case 'html-updated': {
          const clean = stripEditorScript(e.data.data);
          if (editorViewport === 'mobile' && mobileHtml) {
            setMobileHtml(clean);
          } else {
            setCurrentHtml(clean);
            pushUndo(clean);
          }
          break;
        }
        case 'clean-html':
          if (editorViewport === 'mobile' && mobileHtml) {
            setMobileHtml(stripEditorScript(e.data.data));
          } else {
            setCurrentHtml(stripEditorScript(e.data.data));
          }
          break;
        case 'sections-list':
          setSections(e.data.data);
          break;
        case 'selected-full-html':
          setPendingSectionHtml(e.data.data);
          setShowSaveDialog(true);
          break;
        case 'section-inserted':
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToIframe, pushUndo, editorViewport, mobileHtml]);

  /* ── Section Library (callbacks – needs sendToIframe) ── */
  const handleRequestSaveSection = useCallback(() => {
    sendToIframe({ type: 'cmd-get-selected-full-html' });
    setSaveSectionName('');
    setSaveSectionType('other');
    setSaveSectionTags('');
    setSaveSectionAiRewrite(false);
    setSaveSectionStack('pure_css');
    setSaveSectionCustomInstructions('');
    setSaveSectionError('');
    setSaveSectionSuccess(false);
  }, [sendToIframe]);

  const handleSaveSection = useCallback(async () => {
    if (!pendingSectionHtml || !saveSectionName.trim()) return;
    setSaveSectionRunning(true);
    setSaveSectionError('');

    try {
      let finalHtml = pendingSectionHtml;

      if (saveSectionAiRewrite) {
        const res = await fetch('/api/rewrite-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: pendingSectionHtml,
            model: saveSectionModel,
            context: pageTitle || undefined,
            outputStack: saveSectionStack,
            customStackInstructions: saveSectionStack === 'custom' ? saveSectionCustomInstructions : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Errore AI rewrite');
        finalHtml = data.html;
      }

      const newSection: SavedSection = {
        id: generateId(),
        name: saveSectionName.trim(),
        html: finalHtml,
        sectionType: saveSectionType,
        tags: saveSectionTags.split(',').map(t => t.trim()).filter(Boolean),
        textPreview: finalHtml.replace(/<[^>]*>/g, '').substring(0, 120).trim(),
        sourcePageTitle: pageTitle || undefined,
        aiRewritten: saveSectionAiRewrite,
        outputStack: saveSectionAiRewrite ? saveSectionStack : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updated = [newSection, ...savedSections];
      setSavedSections(updated);
      persistSavedSections(updated);
      setSaveSectionSuccess(true);
      setTimeout(() => {
        setShowSaveDialog(false);
        setSaveSectionSuccess(false);
      }, 1500);
    } catch (err) {
      setSaveSectionError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setSaveSectionRunning(false);
    }
  }, [pendingSectionHtml, saveSectionName, saveSectionType, saveSectionTags, saveSectionAiRewrite, saveSectionModel, saveSectionStack, saveSectionCustomInstructions, savedSections, pageTitle]);

  const handleDeleteSection = useCallback((id: string) => {
    const updated = savedSections.filter(s => s.id !== id);
    setSavedSections(updated);
    persistSavedSections(updated);
  }, [savedSections]);

  const handleImportSection = useCallback((section: SavedSection) => {
    setImportingId(section.id);
    sendToIframe({ type: 'cmd-insert-section', html: section.html });
    setTimeout(() => setImportingId(null), 1500);
  }, [sendToIframe]);

  const filteredLibrarySections = savedSections.filter(s => {
    if (libraryFilterType !== 'all' && s.sectionType !== libraryFilterType) return false;
    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      return s.name.toLowerCase().includes(q) ||
             s.textPreview.toLowerCase().includes(q) ||
             s.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  /* ── Mode switching ── */
  const switchMode = useCallback((newMode: EditorMode) => {
    if (newMode === mode) return;
    if (mode === 'code' && newMode === 'visual') {
      if (editorViewport === 'mobile' && mobileHtml) {
        setMobileHtml(mobileCodeHtml);
      } else {
        setCurrentHtml(codeHtml);
        pushUndo(codeHtml);
      }
    }
    if (mode === 'visual' && newMode === 'code') {
      sendToIframe({ type: 'cmd-get-html' });
      if (editorViewport === 'mobile' && mobileHtml) {
        setMobileCodeHtml(mobileHtml);
      } else {
        setCodeHtml(currentHtml);
      }
    }
    setMode(newMode);
    setSelectedElement(null);
    setIsEditing(false);
  }, [mode, codeHtml, mobileCodeHtml, currentHtml, mobileHtml, editorViewport, sendToIframe, pushUndo]);

  /* ── Commands ── */
  const execCmd = (cmd: string, val?: string) => sendToIframe({ type: 'cmd-exec', command: cmd, value: val });
  const setStyle = (prop: string, val: string) => sendToIframe({ type: 'cmd-set-style', property: prop, value: val });
  const setAttr = (name: string, val: string) => sendToIframe({ type: 'cmd-set-attr', name, value: val });

  /* ── Export ── */
  const handleSave = () => {
    onSave(currentHtml, mobileHtml || undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited-${pageTitle?.replace(/\s+/g, '-') || 'landing'}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentHtml);
  };

  /* ── AI Image Generation ── */
  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiError('');
    setAiRevisedPrompt('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, size: aiSize, style: aiStyle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nella generazione');
      if (data.url) {
        setAttr('src', data.url);
        if (data.revisedPrompt) {
          setAiRevisedPrompt(data.revisedPrompt);
          setAttr('alt', data.revisedPrompt.substring(0, 120));
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setAiGenerating(false);
    }
  }, [aiPrompt, aiSize, aiStyle, aiGenerating, setAttr]);

  /* ── AI Code Edit Handler ── */
  const handleAiEdit = useCallback(async () => {
    if (!aiEditPrompt.trim() || aiEditRunning) return;
    setAiEditRunning(true);
    setAiEditError('');
    setAiEditProgress(null);

    try {
      const res = await fetch('/api/ai-edit-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: editorViewport === 'mobile' && mobileHtml ? mobileHtml : currentHtml,
          prompt: aiEditPrompt,
          model: aiEditModel,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Errore di rete' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Stream non disponibile');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'chunk-start':
                setAiEditProgress({
                  chunkIndex: data.chunkIndex,
                  totalChunks: data.totalChunks,
                  label: data.label || `Chunk ${data.chunkIndex + 1}`,
                });
                break;
              case 'chunk-done':
                break;
              case 'result':
                if (data.html) {
                  if (editorViewport === 'mobile' && mobileHtml) {
                    setAiEditHistory(prev => [...prev, mobileHtml]);
                    setMobileHtml(data.html);
                    setMobileCodeHtml(data.html);
                  } else {
                    setAiEditHistory(prev => [...prev, currentHtml]);
                    setCurrentHtml(data.html);
                    setCodeHtml(data.html);
                    pushUndo(data.html);
                  }
                }
                break;
              case 'error':
                throw new Error(data.error);
              case 'done':
                break;
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'done') {
              if (!parseErr.message.includes('Unexpected')) throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      setAiEditError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setAiEditRunning(false);
      setAiEditProgress(null);
    }
  }, [aiEditPrompt, aiEditModel, aiEditRunning, currentHtml, pushUndo]);

  const handleAiEditUndo = useCallback(() => {
    if (aiEditHistory.length === 0) return;
    const prev = aiEditHistory[aiEditHistory.length - 1];
    setAiEditHistory(h => h.slice(0, -1));
    if (editorViewport === 'mobile' && mobileHtml) {
      setMobileHtml(prev);
      setMobileCodeHtml(prev);
    } else {
      setCurrentHtml(prev);
      setCodeHtml(prev);
      pushUndo(prev);
    }
  }, [aiEditHistory, editorViewport, mobileHtml, pushUndo]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode !== 'visual') { switchMode('visual'); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const activeHtml = editorViewport === 'mobile' && mobileHtml ? mobileHtml : currentHtml;
  const editorSrcDoc = prepareEditorHtml(activeHtml);
  const el = selectedElement;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* ═══ Top Bar ═══ */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
            <Paintbrush className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">{pageTitle || 'Visual Editor'}</h2>
            <p className="text-[10px] text-slate-400">
              {mode === 'visual' ? 'Click per selezionare · Doppio click per editare testo' :
               mode === 'code' ? 'Modifica il codice HTML direttamente' : 'Anteprima finale'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5 mr-2">
            <button onClick={handleUndo} disabled={!canUndo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Annulla (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={handleRedo} disabled={!canRedo}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Ripristina (Ctrl+Shift+Z)">
              <Redo2 className="h-4 w-4" />
            </button>
          </div>

          {/* Mode switcher */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
            {([['visual', Paintbrush, 'Visuale'], ['code', Code, 'Codice'], ['preview', Eye, 'Anteprima']] as const).map(([m, Icon, label]) => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === m ? 'bg-amber-500 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          {/* Viewport Switcher (Desktop/Mobile) */}
          {hasMobile && (
            <>
              <div className="w-px h-6 bg-slate-700 mx-1" />
              <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setEditorViewport('desktop')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    editorViewport === 'desktop'
                      ? 'bg-blue-500 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />Desktop
                </button>
                <button
                  onClick={() => setEditorViewport('mobile')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    editorViewport === 'mobile'
                      ? 'bg-blue-500 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />Mobile
                </button>
              </div>
            </>
          )}

          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* AI Edit Toggle */}
          <button
            onClick={() => setShowAiEditPanel(!showAiEditPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showAiEditPanel
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30'
                : aiEditRunning
                  ? 'bg-violet-500/20 text-violet-300 animate-pulse'
                  : 'bg-slate-800 text-violet-300 hover:bg-violet-600/30 hover:text-violet-200'
            }`}
            title="AI Editor - Modifica con intelligenza artificiale"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">AI Editor</span>
            {aiEditRunning && <Loader2 className="h-3 w-3 animate-spin" />}
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1" />

          {/* Actions */}
          <button onClick={handleCopy} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Copia HTML">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={handleDownload} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Scarica HTML">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={handleSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              saved ? 'bg-emerald-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white'}`}>
            {saved ? <><CheckCircle className="h-3.5 w-3.5" />Salvato</> : <><Save className="h-3.5 w-3.5" />Salva</>}
          </button>
          <button onClick={onClose} className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Chiudi editor">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ═══ Formatting Toolbar (visual mode only) ═══ */}
      {mode === 'visual' && (
        <div className="flex items-center gap-1 px-4 py-1.5 bg-white border-b border-slate-200 shrink-0 flex-wrap">
          {/* Text Formatting */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            <ToolBtn icon={Bold} title="Grassetto" onClick={() => execCmd('bold')} />
            <ToolBtn icon={Italic} title="Corsivo" onClick={() => execCmd('italic')} />
            <ToolBtn icon={Underline} title="Sottolineato" onClick={() => execCmd('underline')} />
            <ToolBtn icon={Strikethrough} title="Barrato" onClick={() => execCmd('strikeThrough')} />
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Headings */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            <ToolBtn icon={Heading1} title="Titolo H1" onClick={() => execCmd('formatBlock', 'h1')} />
            <ToolBtn icon={Heading2} title="Titolo H2" onClick={() => execCmd('formatBlock', 'h2')} />
            <ToolBtn icon={Heading3} title="Titolo H3" onClick={() => execCmd('formatBlock', 'h3')} />
            <ToolBtn icon={Type} title="Paragrafo" onClick={() => execCmd('formatBlock', 'p')} />
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            <ToolBtn icon={AlignLeft} title="Allinea a sinistra" onClick={() => execCmd('justifyLeft')} />
            <ToolBtn icon={AlignCenter} title="Centra" onClick={() => execCmd('justifyCenter')} />
            <ToolBtn icon={AlignRight} title="Allinea a destra" onClick={() => execCmd('justifyRight')} />
            <ToolBtn icon={AlignJustify} title="Giustifica" onClick={() => execCmd('justifyFull')} />
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Lists */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            <ToolBtn icon={List} title="Lista puntata" onClick={() => execCmd('insertUnorderedList')} />
            <ToolBtn icon={ListOrdered} title="Lista numerata" onClick={() => execCmd('insertOrderedList')} />
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            <ColorPicker label="A" title="Colore testo" value={el ? rgbToHex(el.styles.color) : '#000000'}
              onChange={(c) => execCmd('foreColor', c)} textColor />
            <ColorPicker label="" title="Colore sfondo" value={el ? rgbToHex(el.styles.backgroundColor) : '#ffffff'}
              onChange={(c) => { if (el) setStyle('backgroundColor', c); }} />
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Element Actions */}
          {el && (
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              <ToolBtn icon={MoveUp} title="Sposta su" onClick={() => sendToIframe({ type: 'cmd-move-up' })} />
              <ToolBtn icon={MoveDown} title="Sposta giù" onClick={() => sendToIframe({ type: 'cmd-move-down' })} />
              <ToolBtn icon={CopyPlus} title="Duplica" onClick={() => sendToIframe({ type: 'cmd-duplicate' })} />
              <ToolBtn icon={Trash2} title="Elimina" onClick={() => sendToIframe({ type: 'cmd-delete' })} danger />
            </div>
          )}

          <div className="flex-1" />

          {/* Section Library + Save + Sections toggles */}
          {el && (
            <button onClick={handleRequestSaveSection}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Salva sezione selezionata nella libreria">
              <BookmarkPlus className="h-3.5 w-3.5" />Salva Sezione
            </button>
          )}
          <button onClick={() => setShowSectionLibrary(!showSectionLibrary)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              showSectionLibrary ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-500 hover:bg-indigo-50'}`}>
            <Library className="h-3.5 w-3.5" />Libreria ({savedSections.length})
          </button>
          <button onClick={() => setShowSections(!showSections)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              showSections ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Layers className="h-3.5 w-3.5" />Sezioni
          </button>
          <button onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title={showSidebar ? 'Nascondi pannello' : 'Mostra pannello'}>
            {showSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* ═══ Main Area ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sections panel */}
        {mode === 'visual' && showSections && (
          <div className="w-56 border-r border-slate-200 bg-slate-50 overflow-y-auto shrink-0">
            <div className="px-3 py-2 border-b border-slate-200 bg-white sticky top-0 z-10">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-500" />Sezioni della pagina
              </h3>
            </div>
            {sections.length === 0 ? (
              <p className="p-3 text-xs text-slate-400">Caricamento sezioni...</p>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {sections.map((sec) => (
                  <button key={sec.index} onClick={() => sendToIframe({ type: 'cmd-select-path', path: sec.path })}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-amber-600 bg-amber-50 px-1 rounded">{sec.tagName}</span>
                      {sec.id && <span className="text-[10px] font-mono text-blue-500">#{sec.id}</span>}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 truncate leading-tight group-hover:text-slate-800">
                      {sec.textPreview || '(vuoto)'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Canvas / Code / Preview */}
        <div className="flex-1 relative overflow-hidden"
          style={mode === 'visual' ? {
            backgroundImage: 'radial-gradient(circle, #e2e8f0 0.6px, transparent 0.6px)',
            backgroundSize: '16px 16px',
            backgroundColor: '#f1f5f9',
          } : {}}>

          {mode === 'visual' && (
            <div className={`absolute inset-2 rounded-xl overflow-hidden shadow-xl border bg-white flex items-start justify-center ${
              editorViewport === 'mobile' && mobileHtml ? 'border-blue-300' : 'border-slate-200'
            }`}>
              <iframe
                ref={iframeRef}
                key={`${editorViewport}-${activeHtml.length}-${undoIdx.current}`}
                srcDoc={editorSrcDoc}
                className={`h-full border-0 transition-all duration-300 ${
                  editorViewport === 'mobile' && mobileHtml
                    ? 'w-[390px] border-x-2 border-gray-300 shadow-2xl'
                    : 'w-full'
                }`}
                title="Visual Editor Canvas"
                sandbox="allow-scripts allow-same-origin"
              />
              {!editorReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <div className="flex items-center gap-2 text-slate-500">
                    <MousePointer className="h-5 w-5 animate-pulse" />
                    <span className="text-sm">Caricamento editor...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'code' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                <span className="text-xs text-slate-400 font-mono">
                  HTML {editorViewport === 'mobile' && mobileHtml ? '(Mobile)' : '(Desktop)'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {(editorViewport === 'mobile' && mobileCodeHtml ? mobileCodeHtml : codeHtml).length.toLocaleString()} caratteri
                </span>
              </div>
              <textarea
                value={editorViewport === 'mobile' && mobileHtml ? mobileCodeHtml : codeHtml}
                onChange={(e) => {
                  if (editorViewport === 'mobile' && mobileHtml) {
                    setMobileCodeHtml(e.target.value);
                  } else {
                    setCodeHtml(e.target.value);
                  }
                }}
                className="flex-1 w-full bg-slate-900 text-slate-300 font-mono text-sm p-4 resize-none outline-none leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}

          {mode === 'preview' && (
            <div className="w-full h-full flex items-start justify-center bg-gray-100 overflow-auto">
              <iframe
                srcDoc={activeHtml}
                className={`h-full border-0 transition-all duration-300 ${
                  editorViewport === 'mobile' && mobileHtml
                    ? 'w-[390px] shadow-2xl border-2 border-gray-300 rounded-[2rem] my-4'
                    : 'w-full'
                }`}
                title="Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}
        </div>

        {/* ═══ Properties Sidebar ═══ */}
        {mode === 'visual' && showSidebar && (
          <div className="w-72 border-l border-slate-200 bg-white overflow-y-auto shrink-0">
            {el ? (
              <div className="divide-y divide-slate-100">
                {/* Element Info */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">&lt;{el.tagName}&gt;</span>
                    <span className="text-xs text-slate-500">{TAG_LABELS[el.tagName] || el.tagName}</span>
                  </div>
                  {el.id && <p className="text-[10px] text-blue-500 font-mono mb-1">#{el.id}</p>}
                  {el.className && <p className="text-[10px] text-slate-400 font-mono truncate mb-1" title={el.className}>.{el.className.split(' ').slice(0, 3).join(' .')}</p>}
                  {isEditing && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
                      <Paintbrush className="h-2.5 w-2.5" /> Modalità Editing
                    </span>
                  )}
                </div>

                {/* Text Content */}
                {el.textContent && el.isTextNode && (
                  <div className="p-3">
                    <PropLabel>Testo</PropLabel>
                    <textarea value={el.textContent} rows={3} className="prop-input font-normal"
                      onChange={(e) => sendToIframe({ type: 'cmd-set-text', value: e.target.value })} />
                  </div>
                )}

                {/* Link/Href */}
                {(el.tagName === 'a' || el.href) && (
                  <div className="p-3">
                    <PropLabel icon={Link}>Link URL</PropLabel>
                    <input type="url" defaultValue={el.href} className="prop-input"
                      onBlur={(e) => setAttr('href', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setAttr('href', (e.target as HTMLInputElement).value); }} />
                  </div>
                )}

                {/* Image */}
                {el.tagName === 'img' && (
                  <div className="p-3">
                    <PropLabel icon={Image}>Immagine</PropLabel>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">URL Immagine</label>
                    <input type="url" defaultValue={el.src} className="prop-input"
                      onBlur={(e) => setAttr('src', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setAttr('src', (e.target as HTMLInputElement).value); }} />
                    <label className="text-[10px] text-slate-500 mt-2 mb-0.5 block">Testo alt</label>
                    <input type="text" defaultValue={el.alt} className="prop-input"
                      onBlur={(e) => setAttr('alt', e.target.value)} />

                    {/* AI Image preview */}
                    {el.src && (
                      <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={el.src} alt={el.alt || 'preview'} className="w-full h-auto max-h-32 object-contain" />
                      </div>
                    )}
                  </div>
                )}

                {/* AI Image Generation */}
                {el.tagName === 'img' && (
                  <div className="p-3">
                    <button
                      onClick={() => setShowAiPanel(!showAiPanel)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 hover:border-violet-300 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-500/10">
                          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                        </div>
                        <span className="text-xs font-semibold text-violet-700">Genera con AI</span>
                      </div>
                      <Wand2 className={`h-3.5 w-3.5 text-violet-400 transition-transform ${showAiPanel ? 'rotate-45' : ''}`} />
                    </button>

                    {showAiPanel && (
                      <div className="mt-2 space-y-2.5 p-2.5 rounded-lg bg-gradient-to-b from-violet-50/50 to-transparent border border-violet-100">
                        <div>
                          <label className="text-[10px] text-violet-600 font-medium mb-0.5 block">Descrivi l&apos;immagine</label>
                          <textarea
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Es: Una bottiglia di olio d'oliva premium con sfondo mediterraneo, luce calda, stile fotografico professionale..."
                            rows={3}
                            className="prop-input text-[11px] leading-relaxed resize-none !border-violet-200 focus:!border-violet-400 focus:!shadow-[0_0_0_2px_rgba(139,92,246,0.1)]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-violet-500">Dimensione</label>
                            <select
                              value={aiSize}
                              onChange={(e) => setAiSize(e.target.value as typeof aiSize)}
                              className="prop-select !border-violet-200 text-[10px]"
                            >
                              <option value="1024x1024">Quadrato</option>
                              <option value="1792x1024">Orizzontale</option>
                              <option value="1024x1792">Verticale</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-violet-500">Stile</label>
                            <select
                              value={aiStyle}
                              onChange={(e) => setAiStyle(e.target.value as typeof aiStyle)}
                              className="prop-select !border-violet-200 text-[10px]"
                            >
                              <option value="vivid">Vivido</option>
                              <option value="natural">Naturale</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={handleAiGenerate}
                          disabled={!aiPrompt.trim() || aiGenerating}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                        >
                          {aiGenerating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Generazione in corso...
                            </>
                          ) : (
                            <>
                              <ImagePlus className="h-3.5 w-3.5" />
                              Genera Immagine
                            </>
                          )}
                        </button>

                        {aiError && (
                          <div className="p-2 rounded-md bg-red-50 border border-red-200">
                            <p className="text-[10px] text-red-600 font-medium">{aiError}</p>
                          </div>
                        )}

                        {aiRevisedPrompt && (
                          <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200">
                            <p className="text-[10px] text-emerald-600 font-medium mb-0.5">Prompt utilizzato da DALL-E:</p>
                            <p className="text-[10px] text-emerald-700 leading-relaxed">{aiRevisedPrompt}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Typography */}
                <div className="p-3">
                  <PropLabel icon={Type}>Tipografia</PropLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="text-[10px] text-slate-400">Colore</label>
                      <div className="flex items-center gap-1">
                        <input type="color" value={rgbToHex(el.styles.color)} className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                          onChange={(e) => setStyle('color', e.target.value)} />
                        <span className="text-[10px] font-mono text-slate-500">{rgbToHex(el.styles.color)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Dimensione</label>
                      <select value={el.styles.fontSize} className="prop-select"
                        onChange={(e) => setStyle('fontSize', e.target.value)}>
                        {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Peso</label>
                      <select value={parseInt(el.styles.fontWeight) >= 600 ? '700' : '400'} className="prop-select"
                        onChange={(e) => setStyle('fontWeight', e.target.value)}>
                        <option value="300">Light</option>
                        <option value="400">Normal</option>
                        <option value="500">Medium</option>
                        <option value="600">Semi Bold</option>
                        <option value="700">Bold</option>
                        <option value="800">Extra Bold</option>
                        <option value="900">Black</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Allineamento</label>
                      <div className="flex gap-0.5">
                        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) => (
                          <button key={align} onClick={() => setStyle('textAlign', align)}
                            className={`p-1 rounded ${el.styles.textAlign === align ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:bg-slate-100'}`}>
                            <Icon className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Background */}
                <div className="p-3">
                  <PropLabel icon={Palette}>Sfondo</PropLabel>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={rgbToHex(el.styles.backgroundColor)}
                      className="w-6 h-6 rounded cursor-pointer border border-slate-200"
                      onChange={(e) => setStyle('backgroundColor', e.target.value)} />
                    <span className="text-[10px] font-mono text-slate-500">{rgbToHex(el.styles.backgroundColor)}</span>
                    <button onClick={() => setStyle('backgroundColor', 'transparent')}
                      className="ml-auto text-[10px] text-slate-400 hover:text-red-500">Reset</button>
                  </div>
                </div>

                {/* Spacing */}
                <div className="p-3">
                  <PropLabel>Spaziatura</PropLabel>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="text-[10px] text-slate-400">Padding</label>
                      <input type="text" defaultValue={el.styles.padding} className="prop-input"
                        onBlur={(e) => setStyle('padding', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Margine</label>
                      <input type="text" defaultValue={el.styles.margin} className="prop-input"
                        onBlur={(e) => setStyle('margin', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Bordo arrotondato</label>
                      <input type="text" defaultValue={el.styles.borderRadius} className="prop-input"
                        onBlur={(e) => setStyle('borderRadius', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Opacità</label>
                      <input type="range" min="0" max="1" step="0.05" defaultValue={el.styles.opacity}
                        className="w-full mt-1"
                        onChange={(e) => setStyle('opacity', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-3">
                  <PropLabel>Azioni</PropLabel>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <ActionBtn icon={MoveUp} label="Sposta su" onClick={() => sendToIframe({ type: 'cmd-move-up' })} />
                    <ActionBtn icon={MoveDown} label="Sposta giù" onClick={() => sendToIframe({ type: 'cmd-move-down' })} />
                    <ActionBtn icon={CopyPlus} label="Duplica" onClick={() => sendToIframe({ type: 'cmd-duplicate' })} />
                    <ActionBtn icon={Trash2} label="Elimina" onClick={() => sendToIframe({ type: 'cmd-delete' })} danger />
                  </div>
                </div>

                {/* Save to Library */}
                <div className="p-3">
                  <button
                    onClick={handleRequestSaveSection}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                    Salva nella Libreria
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MousePointer className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-500">Nessun elemento selezionato</p>
                <p className="text-xs text-slate-400 mt-1">Clicca su un elemento nella pagina per selezionarlo e modificarlo</p>
                <div className="mt-6 space-y-2 text-left w-full">
                  <Hint emoji="👆" text="Click per selezionare un elemento" />
                  <Hint emoji="✏️" text="Doppio click per modificare il testo" />
                  <Hint emoji="⎋" text="Esc per deselezionare" />
                  <Hint emoji="⌘Z" text="Ctrl+Z per annullare" />
                  <Hint emoji="⌘S" text="Ctrl+S per salvare" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Save Section Dialog ═══ */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[95vw] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <div className="flex items-center gap-2.5">
                <BookmarkPlus className="h-5 w-5" />
                <div>
                  <h3 className="text-sm font-bold">Salva Sezione nella Libreria</h3>
                  <p className="text-[10px] text-emerald-100">Rendi la sezione riutilizzabile su altri funnel</p>
                </div>
              </div>
              <button onClick={() => setShowSaveDialog(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Preview */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Anteprima sezione</p>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {pendingSectionHtml.replace(/<[^>]*>/g, '').substring(0, 200) || '(sezione vuota)'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">{pendingSectionHtml.length.toLocaleString()} caratteri HTML</p>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Nome sezione *</label>
                <input
                  type="text"
                  value={saveSectionName}
                  onChange={(e) => setSaveSectionName(e.target.value)}
                  placeholder="Es: Hero con video testimonial, CTA urgenza rossa..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  autoFocus
                />
              </div>

              {/* Type + Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Tipo sezione</label>
                  <select
                    value={saveSectionType}
                    onChange={(e) => setSaveSectionType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 outline-none"
                  >
                    {SECTION_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Tag (virgola sep.)</label>
                  <input
                    type="text"
                    value={saveSectionTags}
                    onChange={(e) => setSaveSectionTags(e.target.value)}
                    placeholder="cta, rosso, urgenza..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* AI Rewrite toggle */}
              <div className="bg-violet-50 rounded-xl border border-violet-200 p-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
                      <Sparkles className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-violet-800">Riscrivi con AI</p>
                      <p className="text-[10px] text-violet-500">Rendi la sezione standalone, pronta da condividere</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={saveSectionAiRewrite}
                      onChange={(e) => setSaveSectionAiRewrite(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-300 rounded-full peer-checked:bg-violet-600 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
                  </div>
                </label>

                {saveSectionAiRewrite && (
                  <div className="mt-3 space-y-3">
                    {/* Model selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-violet-500 shrink-0">Modello:</span>
                      <div className="flex bg-white rounded-lg p-0.5 border border-violet-200">
                        <button
                          onClick={() => setSaveSectionModel('claude')}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                            saveSectionModel === 'claude' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >Claude</button>
                        <button
                          onClick={() => setSaveSectionModel('gemini')}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                            saveSectionModel === 'gemini' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >Gemini</button>
                      </div>
                    </div>

                    {/* Output Stack selector */}
                    <div>
                      <label className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1.5 block">Stack di Output</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {OUTPUT_STACK_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setSaveSectionStack(opt.value)}
                            className={`flex flex-col items-start px-2.5 py-2 rounded-lg text-left transition-all border ${
                              saveSectionStack === opt.value
                                ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50'
                            }`}
                          >
                            <span className={`text-[11px] font-bold ${saveSectionStack === opt.value ? 'text-white' : 'text-slate-700'}`}>
                              {opt.label}
                            </span>
                            <span className={`text-[9px] leading-tight mt-0.5 ${saveSectionStack === opt.value ? 'text-violet-200' : 'text-slate-400'}`}>
                              {opt.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom instructions (only for 'custom' stack) */}
                    {saveSectionStack === 'custom' && (
                      <div>
                        <label className="text-[10px] font-semibold text-violet-600 mb-1 block">Istruzioni personalizzate</label>
                        <textarea
                          value={saveSectionCustomInstructions}
                          onChange={(e) => setSaveSectionCustomInstructions(e.target.value)}
                          placeholder="Es: Usa solo HTML semantico con BEM naming, CSS custom properties, e Web Components nativi..."
                          rows={3}
                          className="w-full px-3 py-2 border border-violet-200 rounded-lg text-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none resize-none"
                        />
                      </div>
                    )}

                    {/* Stack info hint */}
                    {saveSectionStack === 'bootstrap' && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                        <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-600 leading-relaxed">
                          L&apos;AI riscriverà la sezione usando classi Bootstrap 5 (.container, .row, .col-*, .btn, .card, ecc.) con JS vanilla per interattività. Pronta da incollare in qualsiasi progetto Bootstrap.
                        </p>
                      </div>
                    )}
                    {saveSectionStack === 'tailwind' && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-cyan-50 border border-cyan-200">
                        <FileCode className="h-3.5 w-3.5 text-cyan-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-cyan-600 leading-relaxed">
                          L&apos;AI userà utility classes Tailwind (flex, grid, p-*, text-*, bg-*, ecc.) senza tag &lt;style&gt; separato. Richiede Tailwind CSS nel progetto target.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error */}
              {saveSectionError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs text-red-600 font-medium">{saveSectionError}</p>
                </div>
              )}

              {/* Success */}
              {saveSectionSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs text-emerald-700 font-semibold">Sezione salvata nella libreria!</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  disabled={saveSectionRunning}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >Annulla</button>
                <button
                  onClick={handleSaveSection}
                  disabled={!saveSectionName.trim() || saveSectionRunning || saveSectionSuccess}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  {saveSectionRunning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Salvataggio{saveSectionAiRewrite ? ' + AI...' : '...'}</>
                  ) : (
                    <><Save className="h-4 w-4" />Salva nella Libreria</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Section Library Panel ═══ */}
      {showSectionLibrary && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[780px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <Library className="h-5 w-5" />
                <div>
                  <h3 className="text-sm font-bold">Libreria Sezioni Salvate</h3>
                  <p className="text-[10px] text-indigo-200">{savedSections.length} sezioni disponibili</p>
                </div>
              </div>
              <button onClick={() => setShowSectionLibrary(false)} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Cerca per nome, testo o tag..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                <select
                  value={libraryFilterType}
                  onChange={(e) => setLibraryFilterType(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="all">Tutti i tipi</option>
                  {SECTION_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sections Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredLibrarySections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen className="h-12 w-12 text-slate-200 mb-3" />
                  <p className="text-sm font-medium text-slate-500">
                    {savedSections.length === 0 ? 'Nessuna sezione salvata' : 'Nessun risultato per questa ricerca'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {savedSections.length === 0
                      ? 'Seleziona un elemento nell\'editor e clicca "Salva Sezione" per iniziare'
                      : 'Prova a cambiare i filtri di ricerca'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredLibrarySections.map((section) => (
                    <div
                      key={section.id}
                      className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all group overflow-hidden"
                    >
                      {/* Section Card Header */}
                      <div className="px-3.5 pt-3 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-slate-800 truncate">{section.name}</h4>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                                <Tag className="h-2.5 w-2.5" />
                                {SECTION_TYPE_OPTIONS.find(o => o.value === section.sectionType)?.label || section.sectionType}
                              </span>
                              {section.aiRewritten && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                                  <Sparkles className="h-2.5 w-2.5" />AI
                                </span>
                              )}
                              {section.outputStack && section.outputStack !== 'pure_css' && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                  <FileCode className="h-2.5 w-2.5" />
                                  {OUTPUT_STACK_OPTIONS.find(o => o.value === section.outputStack)?.label || section.outputStack}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Text preview */}
                      <div className="px-3.5 pb-2">
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                          {section.textPreview || '(vuoto)'}
                        </p>
                      </div>

                      {/* Tags */}
                      {section.tags.length > 0 && (
                        <div className="px-3.5 pb-2 flex items-center gap-1 flex-wrap">
                          {section.tags.map((tag, i) => (
                            <span key={i} className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Preview iframe (collapsible) */}
                      {previewSectionId === section.id && (
                        <div className="mx-3.5 mb-2 rounded-lg overflow-hidden border border-slate-200 bg-white" style={{ height: '180px' }}>
                          <iframe
                            srcDoc={section.html}
                            className="w-full h-full border-0"
                            title={`Preview: ${section.name}`}
                            sandbox="allow-same-origin"
                            style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', height: '200%' }}
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          {new Date(section.createdAt).toLocaleDateString('it-IT')}
                          <span className="text-slate-300">·</span>
                          <FileCode className="h-3 w-3" />
                          {(section.html.length / 1024).toFixed(1)}KB
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPreviewSectionId(previewSectionId === section.id ? null : section.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Anteprima"
                          >
                            <EyeIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(section.html);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            title="Copia HTML"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleImportSection(section)}
                            disabled={importingId === section.id}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all shadow-sm"
                            title="Importa nella pagina corrente"
                          >
                            {importingId === section.id ? (
                              <><CheckCircle className="h-3 w-3" />Importata!</>
                            ) : (
                              <><ArrowDownToLine className="h-3 w-3" />Importa</>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteSection(section.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Elimina sezione"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ AI Edit Panel (Floating) ═══ */}
      {showAiEditPanel && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[70] w-[680px] max-w-[95vw]">
          <div className="bg-slate-900/98 backdrop-blur-xl rounded-2xl border border-violet-500/30 shadow-2xl shadow-violet-500/10 overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AI Code Editor</h3>
                  <p className="text-[10px] text-slate-400">Modifica l&apos;intera pagina con AI in modo intelligente a chunk</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Model Switcher */}
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => setAiEditModel('claude')}
                    disabled={aiEditRunning}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      aiEditModel === 'claude'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Zap className="h-3 w-3" />Claude
                  </button>
                  <button
                    onClick={() => setAiEditModel('gemini')}
                    disabled={aiEditRunning}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      aiEditModel === 'gemini'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />Gemini
                  </button>
                </div>
                <button onClick={() => setShowAiEditPanel(false)} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="px-4 py-2 border-b border-slate-800/50">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="text-[10px] text-slate-500 shrink-0 mr-1">Quick:</span>
                {aiPresetPrompts.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => setAiEditPrompt(preset.prompt)}
                    disabled={aiEditRunning}
                    className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 hover:bg-violet-600/30 hover:text-violet-200 border border-slate-700 hover:border-violet-500/50 transition-all disabled:opacity-40"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="p-4">
              <div className="relative">
                <textarea
                  value={aiEditPrompt}
                  onChange={(e) => setAiEditPrompt(e.target.value)}
                  placeholder="Descrivi come vuoi modificare la pagina... Es: 'Trasforma tutto il brand in stile conspiracy con colori scuri, rosso e oro, tono misterioso e urgente'"
                  rows={3}
                  disabled={aiEditRunning}
                  className="w-full bg-slate-800/60 text-slate-200 text-sm rounded-xl border border-slate-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 px-4 py-3 pr-12 resize-none outline-none placeholder:text-slate-500 disabled:opacity-50 transition-all leading-relaxed"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAiEdit();
                    }
                  }}
                />
                <button
                  onClick={handleAiEdit}
                  disabled={!aiEditPrompt.trim() || aiEditRunning}
                  className="absolute right-2 bottom-2 p-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
                  title="Avvia modifica AI (Ctrl+Enter)"
                >
                  {aiEditRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>

              {/* Progress Bar */}
              {aiEditRunning && aiEditProgress && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-violet-300 font-medium flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {aiEditProgress.label}
                    </span>
                    <span className="text-slate-500">
                      {aiEditProgress.chunkIndex + 1} / {aiEditProgress.totalChunks}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${((aiEditProgress.chunkIndex + 1) / aiEditProgress.totalChunks) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {aiEditRunning && !aiEditProgress && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-violet-300">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Preparazione modifica con {aiEditModel === 'claude' ? 'Claude' : 'Gemini'}...</span>
                </div>
              )}

              {/* Error */}
              {aiEditError && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-[11px] text-red-400 font-medium">{aiEditError}</p>
                </div>
              )}

              {/* AI Edit Undo + Info */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiEditHistory.length > 0 && (
                    <button
                      onClick={handleAiEditUndo}
                      disabled={aiEditRunning}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Annulla AI ({aiEditHistory.length})
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-600">
                  {currentHtml.length.toLocaleString()} car · Ctrl+Enter per inviare
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Bottom Bar ═══ */}
      {mode === 'visual' && (
        <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              {el && (
                <span className="font-mono">
                  {el.path.split(' > ').slice(-3).join(' > ')}
                </span>
              )}
              {el && (
                <span>{Math.round(el.rect.width)}×{Math.round(el.rect.height)}px</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 flex items-center gap-2">
              {editorViewport === 'mobile' && mobileHtml && (
                <span className="flex items-center gap-1 text-blue-400">
                  <Smartphone className="h-3 w-3" /> Mobile
                </span>
              )}
              {activeHtml.length.toLocaleString()} caratteri
            </span>
          </div>
        </div>
      )}

      <style jsx global>{`
        .prop-input {
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 11px;
          color: #334155;
          outline: none;
          transition: border-color 0.15s;
        }
        .prop-input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
        }
        .prop-select {
          width: 100%;
          padding: 3px 6px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 11px;
          color: #334155;
          outline: none;
          background: white;
          cursor: pointer;
        }
        .prop-select:focus {
          border-color: #f59e0b;
        }
      `}</style>
    </div>
  );
}

/* ─────────── Sub-components ─────────── */

function ToolBtn({ icon: Icon, title, onClick, danger }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-md transition-colors ${
        danger
          ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
      }`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ColorPicker({ label, title, value, onChange, textColor }: {
  label: string;
  title: string;
  value: string;
  onChange: (color: string) => void;
  textColor?: boolean;
}) {
  return (
    <label className="relative flex items-center gap-1 cursor-pointer group" title={title}>
      <div className={`flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 group-hover:border-amber-300 transition-colors ${textColor ? 'text-slate-700 font-bold text-xs' : ''}`}>
        {textColor ? label : <Palette className="h-3.5 w-3.5 text-slate-500" />}
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-md" style={{ backgroundColor: value }} />
      </div>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
    </label>
  );
}

function PropLabel({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
      {Icon && <Icon className="h-3 w-3 text-amber-500" />}
      {children}
    </h4>
  );
}

function ActionBtn({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
        danger
          ? 'text-red-600 bg-red-50 hover:bg-red-100'
          : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
      }`}>
      <Icon className="h-3 w-3" />{label}
    </button>
  );
}

function Hint({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-400">
      <span className="w-6 text-center">{emoji}</span>
      <span>{text}</span>
    </div>
  );
}

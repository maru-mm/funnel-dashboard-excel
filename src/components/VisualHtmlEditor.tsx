'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Download, Copy, Undo2, Redo2, Eye, Code, Paintbrush,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link, Image, Trash2, MoveUp, MoveDown, CopyPlus, Palette,
  Maximize2, Minimize2, Layers, PanelRightClose, PanelRightOpen,
  Type, Save, MousePointer, Heading1, Heading2, Heading3,
  CheckCircle, Strikethrough, List, ListOrdered, Minus,
} from 'lucide-react';

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
  onSave: (html: string) => void;
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

export default function VisualHtmlEditor({ initialHtml, onSave, onClose, pageTitle }: VisualHtmlEditorProps) {
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
          setCurrentHtml(clean);
          pushUndo(clean);
          break;
        }
        case 'clean-html':
          setCurrentHtml(stripEditorScript(e.data.data));
          break;
        case 'sections-list':
          setSections(e.data.data);
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToIframe, pushUndo]);

  /* ── Mode switching ── */
  const switchMode = useCallback((newMode: EditorMode) => {
    if (newMode === mode) return;
    if (mode === 'code' && newMode === 'visual') {
      setCurrentHtml(codeHtml);
      pushUndo(codeHtml);
    }
    if (mode === 'visual' && newMode === 'code') {
      sendToIframe({ type: 'cmd-get-html' });
      setCodeHtml(currentHtml);
    }
    setMode(newMode);
    setSelectedElement(null);
    setIsEditing(false);
  }, [mode, codeHtml, currentHtml, sendToIframe, pushUndo]);

  /* ── Commands ── */
  const execCmd = (cmd: string, val?: string) => sendToIframe({ type: 'cmd-exec', command: cmd, value: val });
  const setStyle = (prop: string, val: string) => sendToIframe({ type: 'cmd-set-style', property: prop, value: val });
  const setAttr = (name: string, val: string) => sendToIframe({ type: 'cmd-set-attr', name, value: val });

  /* ── Export ── */
  const handleSave = () => {
    onSave(currentHtml);
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

  const editorSrcDoc = prepareEditorHtml(currentHtml);
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

          {/* Sidebar + Sections toggles */}
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
            <div className="absolute inset-2 rounded-xl overflow-hidden shadow-xl border border-slate-200 bg-white">
              <iframe
                ref={iframeRef}
                key={currentHtml.length + '_' + undoIdx.current}
                srcDoc={editorSrcDoc}
                className="w-full h-full border-0"
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
                <span className="text-xs text-slate-400 font-mono">HTML</span>
                <span className="text-[10px] text-slate-500">{codeHtml.length.toLocaleString()} caratteri</span>
              </div>
              <textarea
                value={codeHtml}
                onChange={(e) => setCodeHtml(e.target.value)}
                className="flex-1 w-full bg-slate-900 text-slate-300 font-mono text-sm p-4 resize-none outline-none leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}

          {mode === 'preview' && (
            <iframe
              srcDoc={currentHtml}
              className="w-full h-full border-0"
              title="Preview"
              sandbox="allow-scripts allow-same-origin"
            />
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
            <span className="text-[10px] text-slate-400">
              {currentHtml.length.toLocaleString()} caratteri
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

'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/store/useStore';
import { BUILT_IN_PAGE_TYPE_OPTIONS, PAGE_TYPE_CATEGORIES, PageType, PageTypeOption, TemplateCategory, TEMPLATE_CATEGORY_OPTIONS, TemplateViewFormat, TEMPLATE_VIEW_FORMAT_OPTIONS, LIBRARY_TEMPLATES } from '@/types';
import { Plus, Trash2, Edit2, Save, X, FileCode, ExternalLink, Tag, Filter, Eye, EyeOff, Maximize2, Layers, HelpCircle, FolderPlus, Settings, Monitor, Smartphone, BookOpen } from 'lucide-react';

interface NewTemplateForm {
  name: string;
  sourceUrl: string;
  pageType: PageType;
  category: TemplateCategory;
  viewFormat: TemplateViewFormat;
  tags: string[];
  description: string;
}

const emptyForm: NewTemplateForm = {
  name: '',
  sourceUrl: '',
  pageType: 'landing',
  category: 'standard',
  viewFormat: 'desktop',
  tags: [],
  description: '',
};

export default function TemplatesPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, customPageTypes, addCustomPageType, deleteCustomPageType } = useStore();
  const [activeTab, setActiveTab] = useState<TemplateCategory>('standard');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState<NewTemplateForm>(emptyForm);
  const [tagInput, setTagInput] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<TemplateViewFormat | 'all'>('all');
  const [expandedPreviews, setExpandedPreviews] = useState<string[]>([]);
  const [fullscreenPreview, setFullscreenPreview] = useState<{ isOpen: boolean; url: string; name: string; viewFormat: TemplateViewFormat }>({
    isOpen: false,
    url: '',
    name: '',
    viewFormat: 'desktop',
  });
  
  // Custom page types management
  const [showPageTypeManager, setShowPageTypeManager] = useState(false);
  const [newCustomPageType, setNewCustomPageType] = useState('');

  // Combine built-in and custom page types
  const allPageTypeOptions: PageTypeOption[] = useMemo(() => {
    const customOptions: PageTypeOption[] = (customPageTypes || []).map(ct => ({
      value: ct.value,
      label: ct.label,
      category: 'custom' as const,
    }));
    return [...BUILT_IN_PAGE_TYPE_OPTIONS, ...customOptions];
  }, [customPageTypes]);

  // Group page types by category for select dropdown
  const groupedPageTypes = useMemo(() => {
    const groups: Record<string, PageTypeOption[]> = {};
    PAGE_TYPE_CATEGORIES.forEach(cat => {
      groups[cat.value] = allPageTypeOptions.filter(opt => opt.category === cat.value);
    });
    return groups;
  }, [allPageTypeOptions]);

  // Get label for a page type value
  const getPageTypeLabel = (value: PageType): string => {
    const option = allPageTypeOptions.find(opt => opt.value === value);
    return option?.label || value;
  };

  // Handle adding custom page type
  const handleAddCustomPageType = () => {
    if (newCustomPageType.trim()) {
      addCustomPageType(newCustomPageType.trim());
      setNewCustomPageType('');
    }
  };

  // Filter templates by category (for tab view when no tag filter)
  const categoryTemplates = useMemo(() => {
    return (templates || []).filter(t => (t.category || 'standard') === activeTab);
  }, [templates, activeTab]);

  // Get all unique tags from ALL templates (per filtrare es. "tutti i funnel nutra")
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    (templates || []).forEach(t => t.tags?.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [templates]);

  // When tag filter is active: show templates from ALL categories that match the tag(s)
  // When no tag selected: show only current category (standard or quiz)
  const filteredTemplates = useMemo(() => {
    const baseList = selectedFilterTags.length > 0
      ? (templates || []).filter(t =>
          selectedFilterTags.some(filterTag => t.tags?.includes(filterTag))
        )
      : categoryTemplates;

    let filtered = baseList;
    if (selectedFormatFilter !== 'all') {
      filtered = filtered.filter(t => (t.viewFormat || 'desktop') === selectedFormatFilter);
    }
    return filtered;
  }, [templates, categoryTemplates, selectedFilterTags, selectedFormatFilter]);

  // Count templates per category
  const standardCount = (templates || []).filter(t => (t.category || 'standard') === 'standard').length;
  const quizCount = (templates || []).filter(t => t.category === 'quiz').length;

  const handleAddTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.sourceUrl.trim()) return;
    addTemplate({
      ...newTemplate,
      category: activeTab, // Use current tab as category
    });
    setNewTemplate({ ...emptyForm, category: activeTab });
    setShowAddForm(false);
  };

  const addTagToNew = () => {
    if (tagInput.trim() && !newTemplate.tags.includes(tagInput.trim().toLowerCase())) {
      setNewTemplate({
        ...newTemplate,
        tags: [...newTemplate.tags, tagInput.trim().toLowerCase()],
      });
      setTagInput('');
    }
  };

  const removeTagFromNew = (tag: string) => {
    setNewTemplate({
      ...newTemplate,
      tags: newTemplate.tags.filter(t => t !== tag),
    });
  };

  const addTagToEdit = (templateId: string, currentTags: string[]) => {
    if (editTagInput.trim() && !currentTags.includes(editTagInput.trim().toLowerCase())) {
      updateTemplate(templateId, {
        tags: [...currentTags, editTagInput.trim().toLowerCase()],
      });
      setEditTagInput('');
    }
  };

  const removeTagFromEdit = (templateId: string, currentTags: string[], tagToRemove: string) => {
    updateTemplate(templateId, {
      tags: currentTags.filter(t => t !== tagToRemove),
    });
  };

  const toggleFilterTag = (tag: string) => {
    setSelectedFilterTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const togglePreviewExpanded = (templateId: string) => {
    setExpandedPreviews(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleTabChange = (tab: TemplateCategory) => {
    setActiveTab(tab);
    setSelectedFilterTags([]);
    setShowAddForm(false);
    setEditingId(null);
  };

  return (
    <div className="min-h-screen">
      <Header
        title="My Templates"
        subtitle="Gestisci i template da swipare per i tuoi funnel"
      />

      <div className="p-6">
        {/* Biblioteca Template — Fase 1: lista template da categorizzare e bibliotecare */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-600" />
              Biblioteca Template
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Fase 1 — Salvare, categorizzare e bibliotecare funnel di diversa tipologia.
            </p>
          </div>
          <div className="p-6">
            <ul className="space-y-3" role="list">
              {LIBRARY_TEMPLATES.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-4 py-3 px-4 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-600">
                    {index + 1}
                  </span>
                  <span className="font-medium text-gray-900">{entry.name}</span>
                  <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
                    entry.category === 'quiz'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {entry.category === 'quiz' ? 'Quiz' : 'Standard'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleTabChange('standard')}
              className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 font-medium transition-colors ${
                activeTab === 'standard'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Layers className="w-5 h-5" />
              <span>Template Standard</span>
              <span className={`px-2 py-0.5 rounded-full text-sm ${
                activeTab === 'standard' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {standardCount}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('quiz')}
              className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 font-medium transition-colors ${
                activeTab === 'quiz'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <HelpCircle className="w-5 h-5" />
              <span>Quiz Template</span>
              <span className={`px-2 py-0.5 rounded-full text-sm ${
                activeTab === 'quiz' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {quizCount}
              </span>
            </button>
          </div>

          {/* Tab Description */}
          <div className={`px-6 py-3 text-sm ${
            activeTab === 'standard' ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800'
          }`}>
            {activeTab === 'standard' ? (
              <p><strong>Template Standard:</strong> Landing page, advertorial, checkout, product page e altre pagine di vendita tradizionali.</p>
            ) : (
              <p><strong>Quiz Template:</strong> Quiz funnel, survey, questionari interattivi e lead magnet basati su domande.</p>
            )}
          </div>
        </div>

        {/* Filter by Tags */}
        {allTags.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Filtra per Tag:</span>
              {selectedFilterTags.length > 0 && (
                <button
                  onClick={() => setSelectedFilterTags([])}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Cancella filtri
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleFilterTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedFilterTags.includes(tag)
                      ? activeTab === 'standard' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setNewTemplate({ ...emptyForm, category: activeTab });
                setShowAddForm(true);
              }}
              className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'standard' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              <Plus className="w-4 h-4" />
              Aggiungi {activeTab === 'standard' ? 'Template' : 'Quiz Template'}
            </button>
            <span className="text-gray-500">
              {selectedFilterTags.length > 0
                ? `${filteredTemplates.length} template con tag ${selectedFilterTags.join(', ')}`
                : `${filteredTemplates.length} di ${categoryTemplates.length} template`}
            </span>
          </div>
          
          {/* Format Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Formato:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setSelectedFormatFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedFormatFilter === 'all'
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Tutti
              </button>
              <button
                onClick={() => setSelectedFormatFilter('desktop')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 border-l border-gray-200 ${
                  selectedFormatFilter === 'desktop'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Monitor className="w-4 h-4" />
                Desktop
              </button>
              <button
                onClick={() => setSelectedFormatFilter('mobile')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 border-l border-gray-200 ${
                  selectedFormatFilter === 'mobile'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Mobile
              </button>
            </div>
            <button
              onClick={() => setShowPageTypeManager(!showPageTypeManager)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-4"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="text-sm hidden md:inline">Gestisci Tipi Pagina</span>
            </button>
          </div>
        </div>

        {/* Custom Page Types Manager */}
        {showPageTypeManager && (
          <div className="bg-indigo-50 rounded-lg shadow-sm border border-indigo-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5" />
                Gestione Tipi Pagina Personalizzati
              </h3>
              <button
                onClick={() => setShowPageTypeManager(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-indigo-700 mb-4">
              Crea categorie personalizzate per organizzare i tuoi template. Le categorie create vengono salvate automaticamente.
            </p>

            {/* Add New Custom Page Type */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCustomPageType}
                onChange={(e) => setNewCustomPageType(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomPageType()}
                className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white"
                placeholder="Nome nuova categoria (es: Webinar, Newsletter, etc.)"
              />
              <button
                onClick={handleAddCustomPageType}
                disabled={!newCustomPageType.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Aggiungi
              </button>
            </div>

            {/* List of Custom Page Types */}
            {(customPageTypes || []).length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-indigo-800 mb-2">Categorie Personalizzate ({(customPageTypes || []).length})</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {(customPageTypes || []).map((pageType) => (
                    <div
                      key={pageType.value}
                      className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-indigo-200"
                    >
                      <span className="text-sm font-medium text-gray-800">{pageType.label}</span>
                      <button
                        onClick={() => deleteCustomPageType(pageType.value)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Elimina categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-indigo-600">
                <FolderPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nessuna categoria personalizzata. Creane una nuova!</p>
              </div>
            )}

            {/* Built-in Categories Info */}
            <div className="mt-6 pt-4 border-t border-indigo-200">
              <h4 className="text-sm font-medium text-indigo-800 mb-3">Categorie Built-in</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PAGE_TYPE_CATEGORIES.filter(c => c.value !== 'custom').map((category) => (
                  <div key={category.value} className="text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${category.color}`}>
                      {category.label}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {(groupedPageTypes[category.value] || []).length} tipi
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add Template Form */}
        {showAddForm && (
          <div className={`rounded-lg shadow-sm border p-6 mb-6 ${
            activeTab === 'standard' 
              ? 'bg-white border-gray-200' 
              : 'bg-purple-50/30 border-purple-200'
          }`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {activeTab === 'standard' ? (
                <><Layers className="w-5 h-5 text-blue-600" /> Nuovo Template Standard</>
              ) : (
                <><HelpCircle className="w-5 h-5 text-purple-600" /> Nuovo Quiz Template</>
              )}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Template *
                  </label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={activeTab === 'standard' ? 'Es: Landing Prodotto Fisico' : 'Es: Quiz Skin Type'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                    <span>Tipo Pagina</span>
                    <button
                      type="button"
                      onClick={() => setShowPageTypeManager(!showPageTypeManager)}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      Gestisci categorie
                    </button>
                  </label>
                  <select
                    value={newTemplate.pageType}
                    onChange={(e) => setNewTemplate({ ...newTemplate, pageType: e.target.value as PageType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {PAGE_TYPE_CATEGORIES.map((category) => {
                      const categoryOptions = groupedPageTypes[category.value] || [];
                      if (categoryOptions.length === 0) return null;
                      return (
                        <optgroup key={category.value} label={category.label}>
                          {categoryOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Sorgente *
                  </label>
                  <input
                    type="url"
                    value={newTemplate.sourceUrl}
                    onChange={(e) => setNewTemplate({ ...newTemplate, sourceUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="https://esempio.com/landing-page"
                  />
                </div>
                
                {/* View Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formato Template *
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setNewTemplate({ ...newTemplate, viewFormat: 'desktop' })}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        newTemplate.viewFormat === 'desktop'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Monitor className="w-5 h-5" />
                      <span className="font-medium">Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTemplate({ ...newTemplate, viewFormat: 'mobile' })}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                        newTemplate.viewFormat === 'mobile'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Smartphone className="w-5 h-5" />
                      <span className="font-medium">Mobile</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Seleziona se questo template è ottimizzato per la visualizzazione desktop o mobile
                  </p>
                </div>
                
                {/* Tags Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Tag
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTagToNew())}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder={activeTab === 'standard' ? 'Es: nutra, supplements...' : 'Es: skincare, quiz, lead-magnet...'}
                    />
                    <button
                      type="button"
                      onClick={addTagToNew}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newTemplate.tags.map((tag, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                          activeTab === 'standard' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {tag}
                        <button
                          onClick={() => removeTagFromNew(tag)}
                          className="hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione
                  </label>
                  <textarea
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    rows={2}
                    placeholder="Descrizione opzionale del template..."
                  />
                </div>
              </div>

              {/* Preview Panel */}
              <div className="lg:border-l lg:pl-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Anteprima Template
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      newTemplate.viewFormat === 'mobile' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {newTemplate.viewFormat === 'mobile' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                      {newTemplate.viewFormat === 'mobile' ? 'Mobile' : 'Desktop'}
                    </span>
                  </label>
                  {isValidUrl(newTemplate.sourceUrl) && (
                    <button
                      onClick={() => setFullscreenPreview({
                        isOpen: true,
                        url: newTemplate.sourceUrl,
                        name: newTemplate.name || 'Nuovo Template',
                        viewFormat: newTemplate.viewFormat,
                      })}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Schermo intero
                    </button>
                  )}
                </div>
                {isValidUrl(newTemplate.sourceUrl) ? (
                  <div className={`border border-gray-300 rounded-lg overflow-hidden bg-gray-100 flex justify-center ${
                    newTemplate.viewFormat === 'mobile' ? 'py-4' : ''
                  }`}>
                    <iframe
                      src={newTemplate.sourceUrl}
                      className={`bg-white ${
                        newTemplate.viewFormat === 'mobile' 
                          ? 'w-[375px] h-[667px] rounded-lg shadow-lg' 
                          : 'w-full h-[400px]'
                      }`}
                      sandbox="allow-same-origin allow-scripts"
                      title="Template Preview"
                    />
                  </div>
                ) : (
                  <div className="border border-gray-300 rounded-lg h-[400px] bg-gray-50 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Eye className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p>Inserisci un URL valido per vedere l&apos;anteprima</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => { setShowAddForm(false); setNewTemplate(emptyForm); setTagInput(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleAddTemplate}
                disabled={!newTemplate.name.trim() || !newTemplate.sourceUrl.trim()}
                className={`px-4 py-2 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${
                  activeTab === 'standard'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                Salva Template
              </button>
            </div>
          </div>
        )}

        {/* Templates List */}
        <div className="space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              {activeTab === 'standard' ? (
                <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              ) : (
                <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              )}
              <h3 className="text-lg font-medium text-gray-900">
                {selectedFilterTags.length > 0
                  ? 'Nessun template con i tag selezionati'
                  : categoryTemplates.length === 0
                    ? `Nessun ${activeTab === 'standard' ? 'template' : 'quiz template'}`
                    : 'Nessun template trovato'}
              </h3>
              <p className="text-gray-500 mt-1">
                {selectedFilterTags.length > 0
                  ? 'Prova altri tag o cancella i filtri'
                  : categoryTemplates.length === 0
                    ? `Aggiungi il tuo primo ${activeTab === 'standard' ? 'template' : 'quiz template'} per iniziare`
                    : 'Prova a modificare i filtri'}
              </p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const templateCategory = (template.category || 'standard') as TemplateCategory;
              return (
              <div
                key={template.id}
                className={`rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${
                  templateCategory === 'standard' 
                    ? 'bg-white border-gray-200' 
                    : 'bg-white border-purple-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {selectedFilterTags.length > 0 && (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                          templateCategory === 'standard' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {templateCategory === 'standard' ? 'Standard' : 'Quiz'}
                        </span>
                      )}
                      {editingId === template.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                              <input
                                type="text"
                                value={template.name}
                                onChange={(e) => updateTemplate(template.id, { name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Pagina</label>
                              <select
                                value={template.pageType}
                                onChange={(e) => updateTemplate(template.id, { pageType: e.target.value as PageType })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                {PAGE_TYPE_CATEGORIES.map((category) => {
                                  const categoryOptions = groupedPageTypes[category.value] || [];
                                  if (categoryOptions.length === 0) return null;
                                  return (
                                    <optgroup key={category.value} label={category.label}>
                                      {categoryOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">URL Sorgente</label>
                              <input
                                type="url"
                                value={template.sourceUrl}
                                onChange={(e) => updateTemplate(template.id, { sourceUrl: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                            
                            {/* Edit View Format */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Formato Template</label>
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={() => updateTemplate(template.id, { viewFormat: 'desktop' })}
                                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                                    (template.viewFormat || 'desktop') === 'desktop'
                                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  <Monitor className="w-4 h-4" />
                                  <span className="font-medium">Desktop</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateTemplate(template.id, { viewFormat: 'mobile' })}
                                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                                    template.viewFormat === 'mobile'
                                      ? 'border-green-600 bg-green-50 text-green-700'
                                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  <Smartphone className="w-4 h-4" />
                                  <span className="font-medium">Mobile</span>
                                </button>
                              </div>
                            </div>
                            
                            {/* Edit Tags */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Tag className="w-4 h-4 inline mr-1" />
                                Tag
                              </label>
                              <div className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  value={editTagInput}
                                  onChange={(e) => setEditTagInput(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTagToEdit(template.id, template.tags || []))}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                  placeholder="Aggiungi tag..."
                                />
                                <button
                                  type="button"
                                  onClick={() => addTagToEdit(template.id, template.tags || [])}
                                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(template.tags || []).map((tag, index) => (
                                  <span
                                    key={index}
                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                                      templateCategory === 'standard' 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    {tag}
                                    <button
                                      onClick={() => removeTagFromEdit(template.id, template.tags || [], tag)}
                                      className="hover:opacity-70"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                              <textarea
                                value={template.description || ''}
                                onChange={(e) => updateTemplate(template.id, { description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                rows={2}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => { setEditingId(null); setEditTagInput(''); }}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              <Save className="w-4 h-4" />
                              Salva
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 mb-2">
                            {templateCategory === 'standard' ? (
                              <Layers className="w-5 h-5 text-blue-600" />
                            ) : (
                              <HelpCircle className="w-5 h-5 text-purple-600" />
                            )}
                            <h3 className="text-xl font-semibold text-gray-900">{template.name}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              templateCategory === 'standard' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {getPageTypeLabel(template.pageType)}
                            </span>
                            {/* Format Badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              template.viewFormat === 'mobile' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {template.viewFormat === 'mobile' ? (
                                <><Smartphone className="w-3 h-3" /> Mobile</>
                              ) : (
                                <><Monitor className="w-3 h-3" /> Desktop</>
                              )}
                            </span>
                          </div>
                          
                          {/* Tags Display */}
                          {template.tags && template.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {template.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {template.description && (
                            <p className="text-gray-600 mb-3">{template.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                            <ExternalLink className="w-4 h-4" />
                            <a
                              href={template.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate max-w-lg"
                            >
                              {template.sourceUrl}
                            </a>
                          </div>

                          {/* Preview Toggle Button */}
                          <button
                            onClick={() => togglePreviewExpanded(template.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              expandedPreviews.includes(template.id)
                                ? templateCategory === 'standard' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {expandedPreviews.includes(template.id) ? (
                              <>
                                <EyeOff className="w-4 h-4" />
                                Nascondi Preview
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                Mostra Preview
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Actions - use templateCategory when filtering by tag */}
                    {editingId !== template.id && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => setFullscreenPreview({
                            isOpen: true,
                            url: template.sourceUrl,
                            name: template.name,
                            viewFormat: template.viewFormat || 'desktop',
                          })}
                          className={`p-2 rounded-lg ${
                            templateCategory === 'standard' 
                              ? 'text-blue-500 hover:bg-blue-50' 
                              : 'text-purple-500 hover:bg-purple-50'
                          }`}
                          title="Schermo intero"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setEditingId(template.id)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title="Modifica"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Elimina"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded Preview */}
                  {expandedPreviews.includes(template.id) && editingId !== template.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className={`border border-gray-300 rounded-lg overflow-hidden bg-gray-100 flex justify-center ${
                        template.viewFormat === 'mobile' ? 'py-4' : ''
                      }`}>
                        <iframe
                          src={template.sourceUrl}
                          className={`bg-white ${
                            template.viewFormat === 'mobile' 
                              ? 'w-[375px] h-[667px] rounded-lg shadow-lg' 
                              : 'w-full h-[500px]'
                          }`}
                          sandbox="allow-same-origin allow-scripts"
                          title={`Preview: ${template.name}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ); })
          )}
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {fullscreenPreview.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex flex-col z-50">
          {/* Modal Header */}
          <div className={`px-6 py-4 flex items-center justify-between ${
            activeTab === 'standard' ? 'bg-gray-900' : 'bg-purple-900'
          }`}>
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-white" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{fullscreenPreview.name}</h2>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                    fullscreenPreview.viewFormat === 'mobile' 
                      ? 'bg-green-500/20 text-green-300' 
                      : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {fullscreenPreview.viewFormat === 'mobile' ? (
                      <><Smartphone className="w-3 h-3" /> Mobile</>
                    ) : (
                      <><Monitor className="w-3 h-3" /> Desktop</>
                    )}
                  </span>
                </div>
                <p className="text-gray-400 text-sm truncate max-w-xl">{fullscreenPreview.url}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={fullscreenPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg ${
                  activeTab === 'standard' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                Apri in nuova scheda
              </a>
              <button
                onClick={() => setFullscreenPreview({ isOpen: false, url: '', name: '', viewFormat: 'desktop' })}
                className="text-white/80 hover:text-white text-3xl font-bold px-2"
              >
                ×
              </button>
            </div>
          </div>

          {/* Iframe */}
          <div className={`flex-1 flex items-center justify-center ${
            fullscreenPreview.viewFormat === 'mobile' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <iframe
              src={fullscreenPreview.url}
              className={`bg-white ${
                fullscreenPreview.viewFormat === 'mobile' 
                  ? 'w-[375px] h-[812px] rounded-[40px] shadow-2xl border-8 border-gray-900' 
                  : 'w-full h-full'
              }`}
              sandbox="allow-same-origin allow-scripts"
              title={`Fullscreen Preview: ${fullscreenPreview.name}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

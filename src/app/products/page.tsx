'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import { useStore } from '@/store/useStore';
import { Plus, Trash2, Edit2, Save, X, Package, Tag, Link, MousePointer } from 'lucide-react';

interface NewProductForm {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  benefits: string[];
  ctaText: string;
  ctaUrl: string;
  brandName: string;
}

const emptyForm: NewProductForm = {
  name: '',
  description: '',
  price: 0,
  imageUrl: '',
  benefits: [''],
  ctaText: 'Acquista Ora',
  ctaUrl: '',
  brandName: '',
};

export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProductForm>(emptyForm);
  const [benefitInput, setBenefitInput] = useState('');

  const handleAddProduct = () => {
    if (!newProduct.name.trim()) return;
    addProduct({
      ...newProduct,
      benefits: newProduct.benefits.filter(b => b.trim() !== ''),
    });
    setNewProduct(emptyForm);
    setShowAddForm(false);
  };

  const addBenefit = () => {
    if (benefitInput.trim()) {
      setNewProduct({
        ...newProduct,
        benefits: [...newProduct.benefits.filter(b => b.trim() !== ''), benefitInput.trim()],
      });
      setBenefitInput('');
    }
  };

  const removeBenefit = (index: number) => {
    setNewProduct({
      ...newProduct,
      benefits: newProduct.benefits.filter((_, i) => i !== index),
    });
  };

  const updateProductBenefits = (productId: string, benefits: string[]) => {
    updateProduct(productId, { benefits });
  };

  return (
    <div className="min-h-screen">
      <Header
        title="My Products"
        subtitle="Gestisci i tuoi prodotti per lo swipe funnel"
      />

      <div className="p-6">
        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Prodotto
            </button>
            <span className="text-gray-500">
              {products.length} prodotti totali
            </span>
          </div>
        </div>

        {/* Add Product Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Nuovo Prodotto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome e Brand */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Prodotto *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Nome del prodotto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Brand *
                </label>
                <input
                  type="text"
                  value={newProduct.brandName}
                  onChange={(e) => setNewProduct({ ...newProduct, brandName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Es: TuoBrand"
                />
              </div>

              {/* Descrizione */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrizione *
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows={2}
                  placeholder="Breve descrizione del prodotto per lo swipe"
                />
              </div>

              {/* Benefits */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benefici del Prodotto
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={benefitInput}
                    onChange={(e) => setBenefitInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Aggiungi un beneficio..."
                  />
                  <button
                    type="button"
                    onClick={addBenefit}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newProduct.benefits.filter(b => b.trim() !== '').map((benefit, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {benefit}
                      <button
                        onClick={() => removeBenefit(index)}
                        className="hover:text-blue-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Testo CTA *
                </label>
                <input
                  type="text"
                  value={newProduct.ctaText}
                  onChange={(e) => setNewProduct({ ...newProduct, ctaText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Es: Acquista Ora"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL CTA *
                </label>
                <input
                  type="url"
                  value={newProduct.ctaUrl}
                  onChange={(e) => setNewProduct({ ...newProduct, ctaUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="https://tuosito.com/buy"
                />
              </div>

              {/* Prezzo e Immagine */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prezzo
                </label>
                <input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Immagine
                </label>
                <input
                  type="url"
                  value={newProduct.imageUrl}
                  onChange={(e) => setNewProduct({ ...newProduct, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowAddForm(false); setNewProduct(emptyForm); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleAddProduct}
                disabled={!newProduct.name.trim() || !newProduct.brandName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Salva Prodotto
              </button>
            </div>
          </div>
        )}

        {/* Products List */}
        <div className="space-y-4">
          {products.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Nessun prodotto</h3>
              <p className="text-gray-500 mt-1">Aggiungi il tuo primo prodotto per iniziare</p>
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                          {product.brandName || 'No Brand'}
                        </span>
                        <span className="text-lg font-bold text-green-600">€{product.price.toFixed(2)}</span>
                      </div>
                      <p className="text-gray-600 mb-4">{product.description || 'Nessuna descrizione'}</p>
                      
                      {/* Benefits */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                          <Tag className="w-4 h-4" />
                          <span>Benefici:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.benefits?.length > 0 ? (
                            product.benefits.map((benefit, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                              >
                                {benefit}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">Nessun beneficio aggiunto</span>
                          )}
                        </div>
                      </div>

                      {/* CTA Info */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <MousePointer className="w-4 h-4" />
                          <span>CTA: <strong>{product.ctaText || 'Non impostato'}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Link className="w-4 h-4" />
                          <span className="truncate max-w-xs">{product.ctaUrl || 'URL non impostato'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setEditingId(editingId === product.id ? null : product.id)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Edit Form */}
                  {editingId === product.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                          <input
                            type="text"
                            value={product.brandName}
                            onChange={(e) => updateProduct(product.id, { brandName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
                          <textarea
                            value={product.description}
                            onChange={(e) => updateProduct(product.id, { description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Testo CTA</label>
                          <input
                            type="text"
                            value={product.ctaText}
                            onChange={(e) => updateProduct(product.id, { ctaText: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">URL CTA</label>
                          <input
                            type="url"
                            value={product.ctaUrl}
                            onChange={(e) => updateProduct(product.id, { ctaUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Prezzo</label>
                          <input
                            type="number"
                            value={product.price}
                            onChange={(e) => updateProduct(product.id, { price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">URL Immagine</label>
                          <input
                            type="url"
                            value={product.imageUrl || ''}
                            onChange={(e) => updateProduct(product.id, { imageUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Save className="w-4 h-4" />
                          Salva Modifiche
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

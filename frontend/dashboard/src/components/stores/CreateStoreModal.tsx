import { useState } from 'react';
import { X, Store, Loader2 } from 'lucide-react';
import { useCreateStore } from '../../hooks/useStores';

interface CreateStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateStoreModal({ isOpen, onClose }: CreateStoreModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    engine: 'woocommerce',
    plan: 'basic',
  });

  const createStore = useCreateStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createStore.mutateAsync(formData);
      onClose();
      setFormData({
        name: '',
        displayName: '',
        description: '',
        engine: 'woocommerce',
        plan: 'basic',
      });
    } catch (error) {
      console.error('Failed to create store:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Store</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="my-store"
              pattern="[a-z0-9-]+"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be unique, lowercase, alphanumeric and hyphens only
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="My Store"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Optional description of your store"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Engine *
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  value="woocommerce"
                  checked={formData.engine === 'woocommerce'}
                  onChange={(e) => setFormData({ ...formData, engine: e.target.value })}
                  className="w-4 h-4 text-primary-600"
                />
                <div className="ml-3">
                  <span className="block font-medium">WooCommerce</span>
                  <span className="text-sm text-gray-500">Complete e-commerce solution</span>
                </div>
              </label>
              <label 
                className="flex items-center p-3 border border-gray-200 rounded-lg cursor-not-allowed opacity-60 group relative"
                title="MedusaJS support is planned for Round 2. Use WooCommerce for now."
              >
                <input
                  type="radio"
                  value="medusa"
                  disabled
                  className="w-4 h-4"
                />
                <div className="ml-3">
                  <span className="block font-medium">MedusaJS</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    Coming in Round 2
                    <span className="inline-flex items-center justify-center w-4 h-4 text-xs bg-gray-200 rounded-full text-gray-600 cursor-help" title="MedusaJS support is planned for Round 2. Please use WooCommerce for now.">?</span>
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan *
            </label>
            <select
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createStore.isPending}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createStore.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Store'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateStoreModal;

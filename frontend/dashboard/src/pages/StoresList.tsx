import { useState } from 'react';
import { Plus, Filter, Loader2 } from 'lucide-react';
import { useStores, useDeleteStore } from '../hooks/useStores';
import StoreCard from '../components/stores/StoreCard';
import CreateStoreModal from '../components/stores/CreateStoreModal';
import StatusBadge from '../components/ui/StatusBadge';
import { Store } from '../types';

export function StoresList() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  
  const { data, isLoading, error } = useStores();
  const deleteStore = useDeleteStore();

  const handleDelete = async () => {
    if (storeToDelete) {
      await deleteStore.mutateAsync(storeToDelete.id);
      setStoreToDelete(null);
    }
  };

  const stores = data?.data?.stores || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
          <p className="text-gray-500">Manage your e-commerce stores</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Store
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <Filter className="w-4 h-4" />
          Filter
        </button>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search stores..."
            className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-error-50 border border-error-200 text-error-700 p-4 rounded-lg">
          Failed to load stores. Please try again.
        </div>
      )}

      {/* Stores Grid */}
      {!isLoading && !error && (
        <>
          {stores.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No stores yet</h3>
              <p className="text-gray-500 mb-4">Create your first store to get started</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary"
              >
                Create Store
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  onDelete={setStoreToDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <CreateStoreModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      {storeToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Store?
            </h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete <strong>{storeToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setStoreToDelete(null)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteStore.isPending}
                className="px-4 py-2 bg-error-500 text-white font-medium rounded-lg hover:bg-error-600 disabled:opacity-50"
              >
                {deleteStore.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoresList;

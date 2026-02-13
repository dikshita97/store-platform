import { Store } from '../../types';
import StatusBadge from '../ui/StatusBadge';
import { ExternalLink, Trash2, MoreVertical } from 'lucide-react';

interface StoreCardProps {
  store: Store;
  onDelete: (store: Store) => void;
}

export function StoreCard({ store, onDelete }: StoreCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-lg">
            🏪
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{store.name}</h3>
            <StatusBadge status={store.status} />
          </div>
        </div>
        <button
          onClick={() => onDelete(store)}
          className="p-2 text-gray-400 hover:text-error-500 hover:bg-error-50 rounded-lg transition-colors"
          title="Delete store"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {store.urls?.storefront && (
          <a
            href={store.urls.storefront}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1 font-mono"
          >
            {store.urls.storefront.replace('https://', '')}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="capitalize">{store.engine}</span>
          <span>•</span>
          <span>{new Date(store.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
        {store.urls?.storefront && (
          <a
            href={store.urls.storefront}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Store
          </a>
        )}
      </div>
    </div>
  );
}

export default StoreCard;

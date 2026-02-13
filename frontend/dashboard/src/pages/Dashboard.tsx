import { useStores } from '../hooks/useStores';
import { Store, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import StatusBadge from '../components/ui/StatusBadge';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { data } = useStores();
  const stores = data?.data?.stores || [];

  const stats = {
    total: stores.length,
    running: stores.filter((s: { status: string }) => s.status === 'running').length,
    provisioning: stores.filter((s: { status: string }) => s.status === 'provisioning').length,
    failed: stores.filter((s: { status: string }) => s.status === 'failed').length,
  };

  const recentStores = stores.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back! 👋</h1>
        <p className="text-primary-100">
          You have {stats.provisioning} store{stats.provisioning !== 1 ? 's' : ''} currently provisioning
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-primary-600" />
            </div>
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500 mt-1">Stores</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success-600" />
            </div>
            <span className="text-sm text-success-600">Active</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.running}</div>
          <div className="text-sm text-gray-500 mt-1">Running</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-warning-600" />
            </div>
            <span className="text-sm text-warning-600">In Progress</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.provisioning}</div>
          <div className="text-sm text-gray-500 mt-1">Provisioning</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-error-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-error-600" />
            </div>
            <span className="text-sm text-error-600">Attention</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.failed}</div>
          <div className="text-sm text-gray-500 mt-1">Failed</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Stores</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentStores.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No stores yet. <Link to="/stores" className="text-primary-600 hover:underline">Create your first store</Link>
            </div>
          ) : (
            recentStores.map((store: { id: string; name: string; status: string; engine: string; createdAt: string }) => (
              <div key={store.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Store className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{store.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{store.engine} • {new Date(store.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <StatusBadge status={store.status as any} size="sm" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Map as MapIcon, List as ListIcon, Scissors, Clock, Phone, ChevronDown, ChevronUp, Star, MessageSquare } from 'lucide-react';
import type { LatLngExpression } from 'leaflet';
import { useBranches } from '@/features/branches/api/use-branches';
import { ReviewFeed } from '@/features/reviews/widgets/review-feed';

export default function BranchDiscoveryPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: branches, isLoading } = useBranches(searchQuery || undefined);

  const centerPos = [-6.200000, 106.816666] as LatLngExpression;

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-20">
      
      {/* Header & Search */}
      <div className="bg-white px-6 pt-12 pb-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Our Locations</h1>
        <p className="text-slate-500 text-sm mt-1">Find the nearest branch and book your spot.</p>

        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by city or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
            />
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ListIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <MapIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="p-6 flex justify-center text-slate-400">Loading locations...</div>
        ) : viewMode === 'list' ? (
          <div className="p-4 space-y-4">
            {branches?.length === 0 && (
              <div className="text-center py-10 text-slate-500">No branches found.</div>
            )}
            {branches?.map((branch) => (
              <div key={branch.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-lg truncate">{branch.name}</h3>
                    <p className="text-slate-500 text-sm line-clamp-1">{branch.address}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-slate-400 text-xs">{branch.city}</p>
                      {branch.isEmergencyClosed && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700">
                          Temporarily Closed
                        </span>
                      )}
                      {branch.totalReviews > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-semibold text-slate-700">{branch.averageRating?.toFixed(1)}</span>
                          <span className="text-xs text-slate-400">({branch.totalReviews})</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 ml-3">
                    {branch.imageUrl ? (
                      <img src={branch.imageUrl} alt={branch.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <Scissors className="w-7 h-7 text-primary" />
                      </div>
                    )}
                  </div>
                </div>

                {expandedId === branch.id && (
                  <div className="mt-3 space-y-3 text-sm text-slate-600 border-t border-slate-100 pt-3">
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{branch.phone}</span>
                      </div>
                    )}
                    {branch.operatingHours && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{branch.operatingHours}</span>
                      </div>
                    )}
                    {!branch.phone && !branch.operatingHours && (
                      <p className="text-xs text-slate-400">No additional details available</p>
                    )}

                    {/* Reviews section */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 mb-3">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Reviews</span>
                      </div>
                      <ReviewFeed
                        branchId={branch.id}
                        averageRating={branch.averageRating}
                        totalReviews={branch.totalReviews}
                        pageSize={3}
                      />
                    </div>
                  </div>
                )}
                
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/book/${branch.id}`)}
                    disabled={!!branch.isEmergencyClosed}
                    className="flex-1 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {branch.isEmergencyClosed ? "Temporarily Closed" : "Book Here"}
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === branch.id ? null : branch.id)}
                    className="flex items-center justify-center gap-1 flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Details
                    {expandedId === branch.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 min-h-[400px] z-0">
            {/* Map View */}
            <MapContainer 
              center={centerPos}
              zoom={11} 
              scrollWheelZoom={false}
              style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {branches?.map((branch) => (
                branch.latitude && branch.longitude && (
                  <Marker key={branch.id} position={[branch.latitude, branch.longitude] as LatLngExpression}>
                    <Popup>
                      <div className="font-bold">{branch.name}</div>
                      <div className="text-sm">{branch.city}</div>
                    </Popup>
                  </Marker>
                )
              ))}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}

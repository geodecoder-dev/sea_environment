import React, { useState } from 'react';
import { Calendar, Tag } from 'lucide-react';
import { CampaignUpdate } from '../types';

interface CampaignUpdatesProps {
  updates: CampaignUpdate[];
}

export const CampaignUpdates: React.FC<CampaignUpdatesProps> = ({ updates }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = activeCategory === 'all'
    ? updates
    : updates.filter((u) => u.category === activeCategory);

  return (
    <section id="updates" className="py-20 bg-[#FFFDF7] border-t border-[#123047]/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header & Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold text-[#247BA0] mb-2">
              Dispatch From The Field
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#123047]">
              Restoration Logs & Milestones
            </h2>
          </div>

          {/* Functional Filter Tabs (interactive button elements with clean states) */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F4E9D8] rounded-xl self-start md:self-auto">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-white text-[#123047] shadow-xs'
                  : 'text-[#123047]/70 hover:text-[#123047]'
              }`}
            >
              All Logs
            </button>
            <button
              onClick={() => setActiveCategory('milestone')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeCategory === 'milestone'
                  ? 'bg-white text-[#123047] shadow-xs'
                  : 'text-[#123047]/70 hover:text-[#123047]'
              }`}
            >
              Milestones
            </button>
            <button
              onClick={() => setActiveCategory('volunteer')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeCategory === 'volunteer'
                  ? 'bg-white text-[#123047] shadow-xs'
                  : 'text-[#123047]/70 hover:text-[#123047]'
              }`}
            >
              Volunteer Dives
            </button>
            <button
              onClick={() => setActiveCategory('biodiversity')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeCategory === 'biodiversity'
                  ? 'bg-white text-[#123047] shadow-xs'
                  : 'text-[#123047]/70 hover:text-[#123047]'
              }`}
            >
              Marine Surveys
            </button>
          </div>
        </div>

        {/* Updates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-[#123047]/60">
              No updates in this category yet.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <article
                key={item.id}
                className="group bg-[#FFFDF7] rounded-3xl border border-[#123047]/15 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Image slot with resilient fallback */}
                  {item.imageUrl ? (
                    <div className="relative h-52 sm:h-56 overflow-hidden bg-[#F4E9D8]">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="h-44 bg-[#F4E9D8]/50 flex items-center justify-center text-[#247BA0]">
                      <Tag className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-6">
                    {/* Zero-Pill Clean Unboxed Metadata */}
                    <div className="flex items-center gap-2 text-xs font-medium text-[#247BA0] mb-3">
                      <span className="capitalize">{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#123047]/60">
                        {new Date(item.publicationDate).toLocaleDateString('en-MY', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h3 className="font-serif text-xl font-bold text-[#123047] group-hover:text-[#247BA0] transition-colors leading-snug">
                      {item.title}
                    </h3>

                    <p className="mt-3 text-sm text-[#123047]/75 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2 border-t border-[#123047]/10 flex items-center justify-between text-xs text-[#123047]/60 font-medium">
                  <span>Coralku & KL Solaris Marine Science Team</span>
                  <span className="font-serif italic">Verified Field Entry</span>
                </div>
              </article>
            ))
          )}
        </div>

      </div>
    </section>
  );
};

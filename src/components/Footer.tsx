import React from 'react';
import { Waves, Heart, Mail, MapPin, Globe } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#123047] text-[#FFFDF7] pt-16 pb-12 border-t border-[#123047]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand & Purpose (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#247BA0] text-white flex items-center justify-center">
                <Waves className="w-4 h-4 text-[#B8E0D2]" />
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-white">
                Solaris Reef
              </span>
            </div>

            <p className="text-sm text-[#FFFDF7]/75 leading-relaxed max-w-sm">
              An environmental flagship initiative by the <strong className="text-white font-medium">Leo-Lion Club of KL Solaris</strong>. Dedicated to marine ecology restoration, youth diver stewardship, and coastal biodiversity revival in Malaysian waters.
            </p>

            <div className="text-xs text-[#B8E0D2] font-medium pt-1">
              "We Serve Our Oceans, We Protect Our Future."
            </div>
          </div>

          {/* Campaign Navigation (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#B8E0D2]">
              Explore Campaign
            </h4>
            <ul className="space-y-2 text-sm text-[#FFFDF7]/75">
              <li>
                <a href="#overview" className="hover:text-white transition-colors">
                  Why Coral Reefs Matter
                </a>
              </li>
              <li>
                <a href="#impact" className="hover:text-white transition-colors">
                  Live Impact Metrics
                </a>
              </li>
              <li>
                <a href="#donate" className="hover:text-white transition-colors">
                  Contribute via Billplz
                </a>
              </li>
            </ul>
          </div>

          {/* Contact & Governance (4 cols) */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#B8E0D2]">
              Club Contact & Marine Base
            </h4>
            <div className="space-y-2 text-xs text-[#FFFDF7]/75 leading-relaxed">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#FF7F6A] shrink-0 mt-0.5" />
                <span>
                  Leo-Lion Club of KL Solaris, Solaris Mont Kiara, 50480 Kuala Lumpur, Malaysia.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                <span>conservation@leolion-solaris.org</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                <span>Restoration Site: Tioman Island Marine Park Sanctuary</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigate('/admin')}
                className="text-xs text-[#B8E0D2]/80 hover:text-white underline underline-offset-4"
              >
                Administrator Portal & Operations Login
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FFFDF7]/60">
          <div>
            © {new Date().getFullYear()} Leo-Lion Club of KL Solaris. Registered Malaysian Non-Governmental Youth & Service Organization.
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Billplz Payment Gateway</span>
            <span aria-hidden="true">·</span>
            <span>Sustainable Web Architecture</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

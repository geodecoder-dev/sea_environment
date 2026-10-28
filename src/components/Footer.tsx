import React from 'react';
import { Waves, Mail, MapPin, Globe, Phone } from 'lucide-react';
import { siteConfig } from '../config/site';

interface FooterProps {
  onNavigate: (path: string) => void;
}

// TODO: replace the placeholder values below with the real contact details.
const contactGroups = [
  {
    name: 'Leo-Lion Club of Solaris KL',
    email: 'leolionscluboftenacitykl@gmail.com',
    phone: '+60-12 366 0188',
    website: 'llcsolariskl',
  },
  {
    name: 'CoralKu',
    address: 'Malaysia Lang Tengah Island, Pulau Lang Tengah, 21090 Kuala Terengganu, Terengganu',
    email: 'natasha@coralku.org',
    website: 'https://www.coralku.org',
  },
];

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#123047] text-[#FFFDF7] pt-16 pb-12 border-t border-[#123047]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          
          {/* Brand & Purpose (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#247BA0] text-white flex items-center justify-center">
                <Waves className="w-4 h-4 text-[#B8E0D2]" />
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-white">
                {siteConfig.initiativeName}
              </span>
            </div>

            <p className="text-sm text-[#FFFDF7]/75 leading-relaxed max-w-sm">
              An environmental initiative by the <strong className="text-white font-medium">{siteConfig.organisationName}</strong>. Dedicated to marine ecology restoration, youth diver stewardship, and coastal biodiversity revival in Malaysian waters.
            </p>

            <div className="text-xs text-[#B8E0D2] font-medium pt-1">
              "{siteConfig.tagline}"
            </div>
          </div>

          {/* Campaign Navigation (2 cols) */}
          <div className="md:col-span-2 space-y-3">
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
                  Donate
                </a>
              </li>
            </ul>
          </div>

          {/* Contact & Governance (6 cols) */}
          <div className="md:col-span-6 space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#B8E0D2] pl-[166px]">
              Contact & Governance
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {contactGroups.map((group) => (
                <div key={group.name} className="space-y-2 text-xs text-[#FFFDF7]/75 leading-relaxed">
                  <div className="text-sm font-semibold text-white">{group.name}</div>

                  {group.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#FF7F6A] shrink-0 mt-0.5" />
                      <span>{group.address}</span>
                    </div>
                  )}
                  {group.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                      <a href={`mailto:${group.email}`} className="hover:text-white transition-colors break-all">
                        {group.email}
                      </a>
                    </div>
                  )}
                  {group.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                      <a href={`tel:${group.phone.replace(/\s|-/g, '')}`} className="hover:text-white transition-colors">
                        {group.phone}
                      </a>
                    </div>
                  )}
                  {group.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                      <a
                        href={group.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition-colors break-all"
                      >
                        {group.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>


            <div className="pt-2">
              <button
                onClick={() => onNavigate('/admin')}
                className="text-xs text-[#B8E0D2]/80 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Administrator Portal & Operations Login
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FFFDF7]/60">
          <div>
            © {new Date().getFullYear()} {siteConfig.organisationName}.
          </div>
          <div className="flex items-center gap-4">
            
          </div>
        </div>

      </div>
    </footer>
  );
};
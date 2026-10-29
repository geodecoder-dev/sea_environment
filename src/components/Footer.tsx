import React from 'react';
import { Mail, MapPin, Globe, Phone } from 'lucide-react';
import { siteConfig } from '../config/site';

interface FooterProps {
  onNavigate: (path: string) => void;
}

const contactGroups = [
  {
    name: 'Leo-Lions Club of Solaris KL',
    email: 'leolionscluboftenacitykl@gmail.com',
    phone: '+60-12 366 0188',
  },
  {
    name: 'CoralKu',
    address: 'Malaysia Lang Tengah Island, Pulau Lang Tengah, 21090 Kuala Terengganu, Terengganu',
    email: 'natasha@coralku.org',
    website: 'https://www.coralku.org',
  },
];

const toHref = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#123047] text-[#FFFDF7] pt-16 pb-10 border-t border-[#123047]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-12 gap-y-10 pb-12 border-b border-white/10">

          {/* Brand & Purpose */}
          <div className="md:col-span-5 space-y-5">
            <div className="flex items-center gap-3">
              <img
                src="/images/solaris_logo.png"
                alt="Solaris logo"
                className="w-14 h-14 object-contain shrink-0"
              />
              <span className="font-serif text-xl font-bold tracking-tight text-white">
                {siteConfig.initiativeName}
              </span>
            </div>

            <p className="text-sm text-[#FFFDF7]/75 leading-relaxed max-w-md">
              An environmental initiative by the <strong className="text-white font-medium">{siteConfig.organisationName}</strong>. Dedicated to marine ecology restoration, youth diver stewardship, and coastal biodiversity revival in Malaysian waters.
            </p>

            <div className="text-xs text-[#B8E0D2] font-medium">
              "{siteConfig.tagline}"
            </div>
          </div>

          {/* Campaign Navigation */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#B8E0D2]">
              Explore Campaign
            </h4>
            <ul className="space-y-2.5 text-sm text-[#FFFDF7]/75">
              <li>
                <a href="#overview" className="hover:text-white transition-colors">
                  Why Reefs Matter
                </a>
              </li>
              <li>
                <a href="#impact" className="hover:text-white transition-colors">
                  Impact
                </a>
              </li>
              <li>
                <a href="#donate" className="hover:text-white transition-colors">
                  Donate
                </a>
              </li>
            </ul>
          </div>

          {/* Contact & Governance */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-[#B8E0D2]">
              Contact & Governance
            </h4>

            <div className="divide-y divide-white/10">
              {contactGroups.map((group) => (
                <div
                  key={group.name}
                  className="space-y-2 py-4 first:pt-0 last:pb-0 text-xs text-[#FFFDF7]/75 leading-relaxed"
                >
                  <div className="text-sm font-semibold text-white">{group.name}</div>

                  {group.address && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#FF7F6A] shrink-0 mt-0.5" />
                      <span>{group.address}</span>
                    </div>
                  )}
                  {group.email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                      <a href={`mailto:${group.email}`} className="hover:text-white transition-colors break-all">
                        {group.email}
                      </a>
                    </div>
                  )}
                  {group.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                      <a href={`tel:${group.phone.replace(/\s|-/g, '')}`} className="hover:text-white transition-colors">
                        {group.phone}
                      </a>
                    </div>
                  )}
                  {group.website && (
                    <div className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 text-[#FF7F6A] shrink-0" />
                      <a
                        href={toHref(group.website)}
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
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#FFFDF7]/60">
          <div>
            © {new Date().getFullYear()} {siteConfig.organisationName}.
          </div>
          <button
            onClick={() => onNavigate('/admin')}
            className="text-xs text-[#B8E0D2]/80 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            Administrator Portal & Operations Login
          </button>
        </div>

      </div>
    </footer>
  );
};

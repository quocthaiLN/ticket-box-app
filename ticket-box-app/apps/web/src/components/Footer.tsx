import { Globe, Mail, MapPin, Phone, Share2, Ticket, Video } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#08080E] text-[#8585A0]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#F5C842] to-[#E8315B]">
                <Ticket className="h-4 w-4 text-white" />
              </div>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: "0.05em" }}>
                <span className="text-[#F5C842]">Ticket</span>
                <span className="text-[#F0EDEB]">Box</span>
              </span>
            </div>
            <p className="mb-4 text-sm leading-relaxed">
              Nền tảng bán vé sự kiện âm nhạc với e-ticket, QR check-in và thanh toán an toàn.
            </p>
            <div className="flex gap-3">
              <SocialIcon icon={<Globe className="h-4 w-4" />} />
              <SocialIcon icon={<Share2 className="h-4 w-4" />} />
              <SocialIcon icon={<Video className="h-4 w-4" />} />
            </div>
          </div>

          <FooterColumn title="Sự kiện" links={["Concert & nhạc sống", "Festival", "Sân khấu & nghệ thuật", "Thể thao"]} />
          <FooterColumn title="Hỗ trợ" links={["Cách mua vé", "Chính sách hoàn tiền", "Câu hỏi thường gặp", "Điều khoản sử dụng"]} />

          <div>
            <h4 className="mb-4 text-sm font-semibold text-[#F0EDEB]">Liên hệ</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-[#F5C842]" />
                <span>support@ticketbox.vn</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-[#F5C842]" />
                <span>1900 6789</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#F5C842]" />
                <span>Thành phố Hồ Chí Minh, Việt Nam</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row">
          <p>(c) 2026 TicketBox Việt Nam. Bảo lưu mọi quyền.</p>
          <div className="flex gap-4">
            <Link to="#" className="transition-colors hover:text-amber-400">Chính sách riêng tư</Link>
            <Link to="#" className="transition-colors hover:text-amber-400">Cookie</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <a href="#" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.07] text-[#8585A0] transition-transform hover:scale-110">
      {icon}
    </a>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-4 text-sm font-semibold text-[#F0EDEB]">{title}</h4>
      <ul className="space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link}>
            <Link to="/events" className="transition-colors hover:text-amber-400">
              {link}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

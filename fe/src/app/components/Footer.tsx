import { Link } from "react-router";
import { Ticket, Facebook, Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer
      style={{
        background: "#08080E",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        color: "#8585A0",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #F5C842, #E8315B)" }}
              >
                <Ticket className="w-4 h-4 text-white" />
              </div>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", color: "#F0EDEB", fontSize: "1.1rem", letterSpacing: "0.05em" }}>
                <span style={{ color: "#F5C842" }}>Ticket</span>Box
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              Nền tảng mua vé sự kiện âm nhạc hàng đầu Việt Nam. Trải nghiệm an toàn, nhanh chóng, chính hãng.
            </p>
            <div className="flex gap-3">
              <SocialIcon href="#" icon={<Facebook className="w-4 h-4" />} />
              <SocialIcon href="#" icon={<Instagram className="w-4 h-4" />} />
              <SocialIcon href="#" icon={<Youtube className="w-4 h-4" />} />
            </div>
          </div>

          {/* Events */}
          <div>
            <h4 className="text-sm font-semibold mb-4" style={{ color: "#F0EDEB" }}>Sự kiện</h4>
            <ul className="space-y-2.5 text-sm">
              <FooterLink to="/events">Concert & Live Music</FooterLink>
              <FooterLink to="/events">Festival</FooterLink>
              <FooterLink to="/events">Theater & Art</FooterLink>
              <FooterLink to="/events">Sports</FooterLink>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold mb-4" style={{ color: "#F0EDEB" }}>Hỗ trợ</h4>
            <ul className="space-y-2.5 text-sm">
              <FooterLink to="#">Hướng dẫn mua vé</FooterLink>
              <FooterLink to="#">Chính sách hoàn tiền</FooterLink>
              <FooterLink to="#">Câu hỏi thường gặp</FooterLink>
              <FooterLink to="#">Điều khoản sử dụng</FooterLink>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold mb-4" style={{ color: "#F0EDEB" }}>Liên hệ</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 flex-shrink-0" style={{ color: "#F5C842" }} />
                <span>support@ticketbox.vn</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0" style={{ color: "#F5C842" }} />
                <span>1900 6789</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#F5C842" }} />
                <span>Tầng 10, 123 Nguyễn Huệ, Q.1, TP.HCM</span>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p>© 2026 TicketBox Vietnam. Bảo lưu mọi quyền.</p>
          <div className="flex gap-4">
            <Link to="#" className="hover:text-amber-400 transition-colors">Chính sách bảo mật</Link>
            <Link to="#" className="hover:text-amber-400 transition-colors">Cookie</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
      style={{ background: "rgba(255,255,255,0.07)", color: "#8585A0" }}
    >
      {icon}
    </a>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="hover:text-amber-400 transition-colors">
        {children}
      </Link>
    </li>
  );
}

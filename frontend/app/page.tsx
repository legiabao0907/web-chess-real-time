import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main style={{ position: "relative", minHeight: "100vh", color: "white", overflow: "hidden" }}>
      {/* Cố định ảnh nền sáng rực theo nguyên bản */}
      <div style={{ position: "absolute", inset: 0, zIndex: -10 }}>
        <Image 
          src="/chess-bg.png" 
          alt="Chess Background" 
          fill
          style={{ objectFit: "cover" }}
          priority
        />
      </div>

      {/* Navbar Layout Top */}
      <header style={{ position: "absolute", top: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px", zIndex: 50 }}>
        <div style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "-0.025em" }}>
          CHESSKY SCRAPER
        </div>
        
        {/* Menu links giữa */}
        <nav className="desktop-only nav-links" style={{ display: "none", alignItems: "center", gap: "40px", fontSize: "14px", fontWeight: 600, letterSpacing: "0.1em", color: "#d1d5db" }}>
          <Link href="#" className="hover-white" style={{ color: "inherit", textDecoration: "none" }}>LEARN</Link>
          <Link href="#" className="hover-white" style={{ color: "inherit", textDecoration: "none" }}>PLAY</Link>
          <Link href="#" className="hover-white" style={{ color: "inherit", textDecoration: "none" }}>COMPETE</Link>
          <Link href="#" className="hover-white" style={{ color: "inherit", textDecoration: "none" }}>ELITE</Link>
        </nav>

        {/* Nút Đăng nhập / Đăng ký ở góc phải */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px", fontSize: "12px", fontWeight: "bold", letterSpacing: "0.1em" }}>
          <Link href="/login" className="hover-white" style={{ color: "#d1d5db", textDecoration: "none" }}>
            ĐĂNG NHẬP
          </Link>
          <Link 
            href="/register" 
            className="btn-purple"
            style={{ padding: "12px 24px", backgroundColor: "#9b00da", color: "white", borderRadius: "4px", textDecoration: "none", transition: "background-color 0.2s" }}
          >
            ĐĂNG KÝ
          </Link>
        </div>
      </header>

      {/* Hero Content Bên trái */}
      <div className="hero-content" style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", maxWidth: "896px", paddingTop: "64px" }}>
        {/* Tiêu đề CHESSKY SCRAPER có ánh sáng bao quanh (glow) */}
        <h1 className="hero-title" style={{ fontWeight: 900, lineHeight: 1, textShadow: "0 0 20px rgba(255,255,255,0.4)" }}>
          CHESSKY<br />SCRAPER
        </h1>
        
        {/* Caption in nghiêng */}
        <p className="hero-caption" style={{ marginTop: "32px", fontWeight: 300, fontStyle: "italic", letterSpacing: "0.25em", color: "#d1d5db", textShadow: "0 4px 4px rgba(0,0,0,0.8)" }}>
          THE ETHEREAL STRATEGIST
        </p>
        
        {/* 2 nút bên dưới tiêu đề */}
        <div style={{ display: "flex", alignItems: "center", gap: "40px", marginTop: "56px" }}>
          <Link
            href="/login"
            className="btn-play"
            style={{ padding: "16px 32px", fontSize: "16px", fontWeight: "bold", letterSpacing: "0.15em", textTransform: "uppercase", backgroundColor: "#9b00da", color: "white", textDecoration: "none", boxShadow: "0 0 20px rgba(155,0,218,0.5)", transition: "all 0.2s" }}
          >
            Bắt đầu chơi
          </Link>
          <Link
            href="/explore"
            className="hover-white-icon"
            style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "16px", fontWeight: "bold", letterSpacing: "0.15em", textTransform: "uppercase", color: "#e5e7eb", textDecoration: "none", transition: "color 0.2s" }}
          >
            Khám phá 
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: "24px", height: "24px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>

      <style>{`
        /* --- Hover effects --- */
        .hover-white {
          transition: color 0.2s;
        }
        .hover-white:hover {
          color: white !important;
        }
        .btn-purple:hover {
          background-color: #8500bd !important;
        }
        .btn-play:hover {
          background-color: #8500bd !important;
          box-shadow: 0 0 30px rgba(155,0,218,0.7) !important;
        }
        .hover-white-icon:hover {
          color: white !important;
        }
        
        /* --- Responsive / Mobile first (like Tailwind) --- */
        .hero-content { 
          padding-left: 40px; 
          padding-right: 40px; 
        }
        .hero-title { 
          font-size: 72px; 
        }
        .hero-caption { 
          font-size: 20px; 
        }

        /* md Breakpoint (min-width: 768px) */
        @media (min-width: 768px) {
          .desktop-only { 
            display: flex !important; 
          }
          .hero-content { 
            padding-left: 96px; 
            padding-right: 96px; 
          }
          .hero-title { 
            font-size: 110px; 
          }
          .hero-caption { 
            font-size: 30px; 
          }
        }
      `}</style>
    </main>
  );
}
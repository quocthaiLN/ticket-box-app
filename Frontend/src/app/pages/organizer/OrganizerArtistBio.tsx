import { useState } from "react";
import { Upload, RefreshCw, CheckCircle, Copy } from "lucide-react";
import { CONCERTS } from "../../data/mockData";

export function OrganizerArtistBio() {
  const [selectedConcertId, setSelectedConcertId] = useState(CONCERTS[0].id);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const myConcerts = CONCERTS.filter((c) => c.organizerId === "user-organizer-1");
  const selectedConcert = myConcerts.find((c) => c.id === selectedConcertId);

  const handleGenerate = () => {
    setLoading(true);
    setResult("");
    setTimeout(() => {
      setResult(
        selectedConcert?.artistBio ||
        `${selectedConcert?.artistName} là một nghệ sĩ nổi bật của làng nhạc Việt Nam, với phong cách âm nhạc độc đáo và sâu sắc. Qua nhiều năm hoạt động nghệ thuật, họ đã để lại dấu ấn không thể phai trong lòng người hâm mộ — từ những bản ballad gắn bó đến những màn trình diễn live đỉnh cao. Sự kết hợp giữa chất giọng đặc trưng và khả năng kết nối khán giả đã tạo nên một thương hiệu nghệ sĩ riêng biệt, không thể nhầm lẫn.`
      );
      setLoading(false);
    }, 2500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.75rem", color: "#F0EDEB", fontWeight: 700 }}>AI Artist Bio</h1>
        <p className="text-sm mt-0.5" style={{ color: "#8585A0" }}>Upload PDF/Press Kit để sinh bản giới thiệu nghệ sĩ tự động bằng AI</p>
      </div>

      {/* Concert selector */}
      <div className="mb-4">
        <label className="text-xs mb-1.5 block" style={{ color: "#8585A0" }}>Chọn concert</label>
        <select
          value={selectedConcertId}
          onChange={(e) => { setSelectedConcertId(e.target.value); setResult(""); }}
          className="px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.08)", color: "#F0EDEB", minWidth: "280px" }}
        >
          {myConcerts.map((c) => (
            <option key={c.id} value={c.id}>{c.title} — {c.artistName}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="p-5 space-y-4">
          {/* Existing bio preview */}
          {selectedConcert?.artistBio && !result && (
            <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "#8585A0" }}>Bio hiện tại</p>
              <p className="text-sm leading-relaxed" style={{ color: "#B0B0C0" }}>{selectedConcert.artistBio.substring(0, 200)}...</p>
            </div>
          )}

          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: "#8585A0" }} />
            <p className="text-sm mb-1" style={{ color: "#F0EDEB" }}>Kéo thả hoặc click để upload PDF/Press Kit</p>
            <p className="text-xs" style={{ color: "#8585A0" }}>Hỗ trợ PDF, Word, TXT — tối đa 10MB</p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:scale-[1.01]"
            style={{ background: "rgba(123,97,255,0.15)", color: "#7B61FF", border: "1px solid rgba(123,97,255,0.3)" }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                AI đang xử lý...
              </>
            ) : (
              "🤖 Sinh Artist Bio bằng AI"
            )}
          </button>

          {result && (
            <div className="p-4 rounded-xl" style={{ background: "rgba(45,190,108,0.07)", border: "1px solid rgba(45,190,108,0.2)" }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-xs" style={{ color: "#2DBE6C" }}>
                  <CheckCircle className="w-4 h-4" />
                  Bio đã được sinh thành công
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors hover:bg-white/10"
                  style={{ color: copied ? "#2DBE6C" : "#8585A0" }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Đã copy!" : "Copy"}
                </button>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#F0EDEB" }}>{result}</p>
              <button
                className="mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.01]"
                style={{ background: "rgba(45,190,108,0.15)", color: "#2DBE6C", border: "1px solid rgba(45,190,108,0.3)" }}
              >
                ✓ Áp dụng vào concert
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

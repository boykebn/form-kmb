import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const jakartaCenter = { lat: -6.2088, lng: 106.8456 };
let googleMapsPromise;

const initialForm = {
  agentPic: "",
  noTelpAgent: "",
  namaLokasi: "",
  namaPenanggungJawabLokasi: "",
  noTelpLokasi: "",
  alamat: "",
  googleMapUrl: "",
  kota: "",
  kecamatan: "",
  kelurahan: "",
  provinsi: "",
  slotBss: "",
  fotoLokasi: "",
};

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title =
      path === "/form-bss"
        ? "Form Pendaftaran BSS"
        : path === "/program-bss"
          ? "Program BSS"
        : "PT. Kreasi Mitra Berdikari";
  }, [path]);

  if (path === "/form-bss") return <FormPage />;
  if (path === "/program-bss") return <ProgramBssPage />;

  return (
    <>
      <CompanyProfile />
      <ScrollToTopButton />
    </>
  );
}

function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      const scrollPosition = window.scrollY + window.innerHeight;
      const bottomDistance = document.documentElement.scrollHeight - scrollPosition;
      setIsVisible(window.scrollY > 520 && bottomDistance < 520);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <button
      className="scroll-top-button"
      type="button"
      aria-label="Kembali ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ↑
    </button>
  );
}

function CompanyProfile() {
  const [galleryImages, setGalleryImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    let disposed = false;

    fetch("/api/gallery/bss")
      .then((response) => (response.ok ? response.json() : { images: [] }))
      .then((result) => {
        if (!disposed) setGalleryImages(result.images || []);
      })
      .catch(() => {
        if (!disposed) setGalleryImages([]);
      });

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <main className="company-page">
      <header className="company-hero">
        <nav className="company-nav" aria-label="Navigasi utama">
          <a className="company-nav-brand" href="/">
            <img src="/logo-kmb.png" alt="PT. Kreasi Mitra Berdikari" />
            <span>
              <strong>PT. Kreasi Mitra Berdikari</strong>
              <small>Business, venue, and operational partner</small>
            </span>
          </a>
          <div className="company-nav-links">
            <a href="#profil">Profil</a>
            <a href="#bidang-usaha">Bidang Usaha</a>
            {galleryImages.length > 0 && <a href="#galeri-bss">Galeri</a>}
            <a href="/program-bss">Program BSS</a>
          </div>
          <div className="company-nav-actions">
            <a className="company-nav-cta" href="/form-bss">
              Daftarkan Lokasi BSS
            </a>
          </div>
        </nav>

        <section className="company-hero-content">
          <div>
            <p className="company-kicker">PT. Kreasi Mitra Berdikari</p>
            <h1>Mitra bisnis untuk eksekusi lapangan yang terukur.</h1>
            <p>
              Kami mendukung pengembangan kemitraan, verifikasi lokasi,
              aktivasi operasional, dan kebutuhan penunjang usaha dengan
              pendekatan yang rapi, responsif, dan berbasis data lapangan.
            </p>
            <div className="company-actions">
              <a className="company-primary-button" href="/form-bss">
                Daftarkan Lokasi BSS
              </a>
              <a className="company-secondary-button" href="#profil">
                Lihat profil
              </a>
            </div>
          </div>
        </section>

        <div className="company-hero-summary" aria-label="Ringkasan perusahaan">
          <div>
            <span>Fokus</span>
            <strong>Kemitraan lokasi</strong>
          </div>
          <div>
            <span>Dukungan</span>
            <strong>Data & operasional</strong>
          </div>
          <div>
            <span>Area Legal</span>
            <strong>PMDN - Usaha Mikro</strong>
          </div>
        </div>
      </header>

      <section className="company-section company-intro-section" id="profil">
        <div className="company-profile-layout">
          <div className="company-section-heading">
            <span>Profil Perusahaan</span>
            <h2>
              Menghubungkan peluang bisnis dengan kebutuhan eksekusi di
              lapangan.
            </h2>
          </div>
          <div className="company-profile-copy">
            <p>
              PT. Kreasi Mitra Berdikari hadir sebagai mitra pelaksana yang
              membantu proses bisnis dari tahap penjajakan lokasi, pengumpulan
              data, koordinasi mitra, hingga kesiapan aktivasi.
            </p>
            <p>
              Perusahaan bergerak di bidang perdagangan, teknologi informasi,
              venue dan event, konsultasi, serta jasa penunjang usaha. Ruang
              lingkup ini memberi KMB fleksibilitas untuk mendukung program
              komersial yang membutuhkan ketelitian administrasi dan kecepatan
              koordinasi.
            </p>
          </div>
        </div>
      </section>

      <section className="company-section" id="bidang-usaha">
        <div className="company-section-heading">
          <span>Bidang Usaha</span>
          <h2>Layanan yang mendukung kebutuhan komersial dan operasional.</h2>
        </div>
        <div className="service-grid">
          <article>
            <h3>Perdagangan & Kemitraan</h3>
            <p>
              Perdagangan besar atas dasar kontrak, berbagai macam barang, dan
              dukungan pengembangan jaringan mitra.
            </p>
          </article>
          <article>
            <h3>Teknologi Informasi</h3>
            <p>
              Aktivitas pemrograman komputer dan jasa teknologi informasi untuk
              mendukung proses bisnis berbasis data.
            </p>
          </article>
          <article>
            <h3>Venue, MICE & Event</h3>
            <p>
              Penyewaan venue, penyelenggaraan pertemuan, pameran, dan event
              khusus untuk kebutuhan aktivasi komersial.
            </p>
          </article>
          <article>
            <h3>Konsultasi & Penunjang Usaha</h3>
            <p>
              Konsultasi manajemen, broker bisnis, riset pasar, desain interior,
              dan jasa penunjang operasional lainnya.
            </p>
          </article>
        </div>
      </section>

      <section className="company-section workflow-section">
        <div className="company-section-heading">
          <span>Cara Kerja</span>
          <h2>Proses sederhana untuk menjaga data dan koordinasi tetap rapi.</h2>
        </div>
        <div className="workflow-grid">
          <article>
            <span>01</span>
            <h3>Identifikasi</h3>
            <p>Memetakan kebutuhan program, area prioritas, dan profil lokasi.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Verifikasi</h3>
            <p>Mengumpulkan data lapangan, titik peta, kontak PIC, dan foto.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Koordinasi</h3>
            <p>Menyusun data untuk tindak lanjut mitra dan kebutuhan operasional.</p>
          </article>
        </div>
      </section>

      {galleryImages.length > 0 && (
        <section className="company-section gallery-section" id="galeri-bss">
          <div className="company-section-heading">
            <span>Galeri BSS</span>
            <h2>Dokumentasi visual lokasi dan aktivitas pendukung BSS.</h2>
          </div>
          <div className="gallery-grid">
            {galleryImages.slice(0, 6).map((image, index) => (
              <button
                type="button"
                className={index === 0 ? "gallery-item gallery-item-large" : "gallery-item"}
                key={image.id}
                onClick={() => setPreviewImage(image)}
              >
                <img src={image.optimizedUrl || image.url} alt={image.title} />
              </button>
            ))}
          </div>
        </section>
      )}

      {previewImage && (
        <div
          className="gallery-preview"
          role="dialog"
          aria-modal="true"
          aria-label="Preview foto BSS"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="gallery-preview-close"
            type="button"
            onClick={() => setPreviewImage(null)}
            aria-label="Tutup preview"
          >
            Tutup
          </button>
          <img
            src={previewImage.url}
            alt={previewImage.title}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <section className="company-section bss-band" id="program-bss">
        <div>
          <span>Program BSS</span>
          <h2>
            Ajukan lokasi potensial untuk jaringan Battery Swapping Station.
          </h2>
          <p>
            Gunakan form terstruktur untuk mengirim data lokasi, titik Google
            Maps, kapasitas slot, dan dokumentasi foto lapangan.
          </p>
        </div>
        <div className="bss-band-actions">
          <a href="/program-bss">Pelajari Program</a>
          <a className="bss-band-secondary" href="/form-bss">Buka Form BSS</a>
        </div>
      </section>

      <footer className="company-footer">
        <div className="company-footer-brand">
          <img src="/logo-kmb.png" alt="PT. Kreasi Mitra Berdikari" />
          <div>
            <strong>PT. Kreasi Mitra Berdikari</strong>
            <p>
              Mitra pengembangan lokasi, bisnis, dan aktivasi operasional
              berbasis kebutuhan lapangan.
            </p>
          </div>
        </div>
        <div className="company-footer-col">
          <span>Alamat</span>
          <p>Bekasi, Jawa Barat, Indonesia</p>
        </div>
        <div className="company-footer-col">
          <span>Kontak</span>
          <a href="mailto:contact@kmbgroup.id">
            contact@kmbgroup.id
          </a>
          <a href="tel:082112941420">082112941420</a>
        </div>
        <div className="company-footer-col">
          <span>Akses Cepat</span>
          <a href="#profil">Profil Perusahaan</a>
          <a href="#bidang-usaha">Bidang Usaha</a>
          {galleryImages.length > 0 && <a href="#galeri-bss">Galeri BSS</a>}
          <a href="/program-bss">Program BSS</a>
          <a href="/form-bss">Form Pendaftaran BSS</a>
        </div>
      </footer>
    </main>
  );
}

function ProgramBssPage() {
  return (
    <main className="company-page">
      <header className="program-hero">
        <nav className="company-nav" aria-label="Navigasi utama">
          <a className="company-nav-brand" href="/">
            <img src="/logo-kmb.png" alt="PT. Kreasi Mitra Berdikari" />
            <span>
              <strong>PT. Kreasi Mitra Berdikari</strong>
              <small>Business, venue, and operational partner</small>
            </span>
          </a>
          <div className="company-nav-links">
            <a href="/">Profil</a>
            <a href="/program-bss">Program BSS</a>
            <a href="/form-bss">Form BSS</a>
          </div>
          <div className="company-nav-actions">
            <a className="company-nav-cta" href="/form-bss">
              Daftarkan Lokasi BSS
            </a>
          </div>
        </nav>

        <section className="program-hero-content">
          <p className="company-kicker">Battery Swap Station</p>
          <h1>Peluang kemitraan lokasi untuk jaringan penukaran baterai.</h1>
          <p>
            Program BSS membuka peluang bagi pemilik lahan untuk menyediakan
            area strategis bagi perangkat penukaran baterai kendaraan listrik
            roda dua, dengan proses validasi dan koordinasi yang terstruktur.
          </p>
          <div className="company-actions">
            <a className="company-primary-button" href="/form-bss">
              Ajukan Lokasi
            </a>
            <a className="company-secondary-button" href="#alur-kemitraan">
              Lihat Alur
            </a>
          </div>
        </section>
      </header>

      <section className="company-section program-overview">
        <div className="program-stat">
          <strong>3.000</strong>
          <span>stasiun pengisian daya nasional</span>
        </div>
        <div className="program-stat">
          <strong>2.500</strong>
          <span>stasiun tukar baterai di Jawa & Bali</span>
        </div>
        <div className="program-stat">
          <strong>30</strong>
          <span>provinsi dalam jaringan pengembangan</span>
        </div>
      </section>

      <section className="company-section program-split-section">
        <div className="company-section-heading">
          <span>Pengenalan</span>
          <h2>BSS dirancang untuk mempercepat mobilitas kendaraan listrik roda dua.</h2>
        </div>
        <div className="program-copy-card">
          <p>
            Battery Swap Station adalah sistem penukaran baterai otomatis yang
            memungkinkan pengendara menukar baterai habis dengan baterai penuh
            dalam hitungan detik.
          </p>
          <p>
            Perangkat mendukung layar sentuh, konektivitas 4G, dan sistem
            pemantauan pintar untuk menunjang operasional di lokasi.
          </p>
        </div>
      </section>

      <section className="company-section">
        <div className="company-section-heading">
          <span>Spesifikasi</span>
          <h2>Pilihan perangkat menyesuaikan kapasitas dan kesiapan daya lokasi.</h2>
        </div>
        <div className="spec-grid">
          <article>
            <span>6 Slot</span>
            <h3>1 Fase</h3>
            <p>Arus 32A, daya PLN 7.7 kVA, dimensi rak 755 x 600 x 1900 mm.</p>
          </article>
          <article>
            <span>12 Slot</span>
            <h3>1 Fase</h3>
            <p>Arus 63A, daya PLN 13.9 kVA, dimensi rak 1060 x 605 x 1900 mm.</p>
          </article>
          <article>
            <span>12 Slot</span>
            <h3>3 Fase</h3>
            <p>Arus 25A, daya PLN 16.5 kVA, dimensi rak 1060 x 605 x 1900 mm.</p>
          </article>
        </div>
      </section>

      <section className="company-section safety-section">
        <div className="company-section-heading">
          <span>Keselamatan</span>
          <h2>Standar perangkat mendukung keamanan instalasi dan operasional.</h2>
        </div>
        <div className="safety-list">
          <p>Grounding dan isolasi penuh sesuai standar keselamatan IEC & PLN.</p>
          <p>Proteksi kebocoran tipe B dan enclosure tahan api.</p>
          <p>Struktur tahan cuaca, tahan korosi, dan aman terhadap petir.</p>
        </div>
      </section>

      <section className="company-section cooperation-section">
        <div className="company-section-heading">
          <span>Skema Kerja Sama</span>
          <h2>Pemilik lahan fokus menyediakan lokasi, kebutuhan teknis ditangani mitra operasional.</h2>
        </div>
        <div className="cooperation-grid">
          <article>
            <h3>V-Green</h3>
            <ul>
              <li>Internet dan konektivitas perangkat</li>
              <li>Listrik bulanan dan kesiapan daya</li>
              <li>Instalasi, konstruksi, mesin, dan material</li>
            </ul>
          </article>
          <article>
            <h3>Pemilik Lahan</h3>
            <ul>
              <li>Menyediakan area penempatan BSS</li>
              <li>Kebutuhan lahan sekitar 1x1m atau 1x2m</li>
              <li>Memberikan persetujuan untuk proses validasi lokasi</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="company-section" id="alur-kemitraan">
        <div className="company-section-heading">
          <span>Alur Kemitraan</span>
          <h2>Dari pengajuan lokasi sampai instalasi dilakukan bertahap.</h2>
        </div>
        <div className="timeline-grid">
          {[
            "Penawaran lokasi",
            "Persetujuan pemilik lahan",
            "Pengisian formulir online",
            "Validasi lokasi",
            "Tanggapan hasil validasi",
            "Perjanjian kerja sama",
            "Survei lokasi",
            "Penagihan",
            "Instalasi & pembayaran",
          ].map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="company-section bss-band">
        <div>
          <span>Ajukan Lokasi</span>
          <h2>Siapkan data lokasi, titik peta, dan dokumentasi foto lapangan.</h2>
          <p>
            Form BSS membantu proses validasi awal agar data kandidat lokasi
            tersusun lengkap sebelum masuk tahap tindak lanjut.
          </p>
        </div>
        <a href="/form-bss">Buka Form BSS</a>
      </section>

      <footer className="company-footer">
        <div className="company-footer-brand">
          <img src="/logo-kmb.png" alt="PT. Kreasi Mitra Berdikari" />
          <div>
            <strong>PT. Kreasi Mitra Berdikari</strong>
            <p>
              Mitra pengembangan lokasi, bisnis, dan aktivasi operasional
              berbasis kebutuhan lapangan.
            </p>
          </div>
        </div>
        <div className="company-footer-col">
          <span>Navigasi</span>
          <a href="/">Company Profile</a>
          <a href="/program-bss">Program BSS</a>
          <a href="/form-bss">Form Pendaftaran BSS</a>
        </div>
        <div className="company-footer-col">
          <span>Kontak</span>
          <a href="mailto:contact@kmbgroup.id">
            contact@kmbgroup.id
          </a>
          {/* <a href="tel:082112941420">082112941420</a> */}
        </div>
      </footer>
    </main>
  );
}

function FormPage() {
  const [form, setForm] = useState(initialForm);
  const [fotoLokasiFiles, setFotoLokasiFiles] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateFile(event) {
    const files = Array.from(event.target.files || []);
    setFotoLokasiFiles(files);
    setForm((current) => ({ ...current, fotoLokasi: "" }));
  }

  const updateLocation = useCallback((location) => {
    setForm((current) => ({
      ...current,
      googleMapUrl: location.googleMapUrl || current.googleMapUrl,
      alamat: location.alamat || current.alamat,
      kota: location.kota || current.kota,
      kecamatan: location.kecamatan || current.kecamatan,
      kelurahan: location.kelurahan || current.kelurahan,
      provinsi: location.provinsi || current.provinsi,
    }));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      let fotoLokasi = form.fotoLokasi;

      if (fotoLokasiFiles.length > 0) {
        const uploadData = new FormData();
        fotoLokasiFiles.forEach((file) => {
          uploadData.append("fotoLokasi", file);
        });

        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          body: uploadData,
        });
        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(
            uploadResult.message || "Foto lokasi belum bisa diupload.",
          );
        }

        fotoLokasi = uploadResult.files.map((file) => file.fileUrl).join("\n");
      }

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fotoLokasi }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Respons belum bisa dikirim.");
      }

      setForm(initialForm);
      setFotoLokasiFiles([]);
      setStatus("success");
      setMessage(result.message);
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <main className="page-shell">
      <a className="back-link" href="/">
        Kembali ke profil perusahaan
      </a>
      <header className="brand-header">
        <div className="brand-mark brand-mark-kmb">
          <img src="/logo-kmb.png" alt="PT. Kreasi Mitra Berdikari" />
        </div>
        <div className="brand-copy">
          <h1>Pendaftaran lokasi BSS</h1>
          <p className="intro">
            Input lokasi Stasiun Penukaran Baterai V-Green x PT. KMB.
          </p>
        </div>
        <div className="brand-mark brand-mark-vgreen">
          <img src="/logo-vgreen.webp" alt="V-Green" />
        </div>
      </header>

      <form className="form-panel" onSubmit={handleSubmit}>
        <section className="form-section">
          <div className="section-heading">
            <span>01</span>
            <div>
              <h2>Agent</h2>
              <p>Kontak Agent yang mengajukan lokasi.</p>
            </div>
          </div>

          <div className="field-grid">
            <label>
              <span>
                Agent / PIC <strong>*</strong>
              </span>
              <input
                name="agentPic"
                value={form.agentPic}
                onChange={updateField}
                placeholder="Nama Agent"
                required
              />
            </label>
            <label>
              <span>
                No. Telp Agent <strong>*</strong>
              </span>
              <input
                name="noTelpAgent"
                value={form.noTelpAgent}
                onChange={updateField}
                placeholder="Contoh: 08123456789"
                required
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <span>02</span>
            <div>
              <h2>Lokasi</h2>
              <p>Identitas lokasi, alamat, dan koordinat peta.</p>
            </div>
          </div>

          <label>
            <span>
              Nama Tempat Usaha <strong>*</strong>
            </span>
            <input
              name="namaLokasi"
              value={form.namaLokasi}
              onChange={updateField}
              placeholder="Contoh: SPBU / minimarket / area parkir"
              required
            />
          </label>

          <div className="field-grid">
            <label>
              <span>
                Nama Penanggung Jawab Tempat Usaha <strong>*</strong>
              </span>
              <input
                name="namaPenanggungJawabLokasi"
                value={form.namaPenanggungJawabLokasi}
                onChange={updateField}
                placeholder="Contoh: Pascal"
                required
              />
            </label>
            <label>
              <span>
                No. Telp Lokasi <strong>*</strong>
              </span>
              <input
                name="noTelpLokasi"
                value={form.noTelpLokasi}
                onChange={updateField}
                placeholder="Contoh: 08123456789"
                required
              />
            </label>
          </div>

          <MapPicker
            value={form.googleMapUrl}
            onLocationChange={updateLocation}
          />

          <label>
            <span>
              Google Map URL <strong>*</strong>
            </span>
            <input
              name="googleMapUrl"
              type="url"
              value={form.googleMapUrl}
              onChange={updateField}
              placeholder="Pilih titik di peta untuk mengisi link"
              required
            />
          </label>

          <div className="field-grid">
            <label>
              <span>
                Provinsi <strong>*</strong>
              </span>
              <input
                name="provinsi"
                value={form.provinsi}
                onChange={updateField}
                placeholder="Contoh: DKI Jakarta"
                required
              />
            </label>
            <label>
              <span>
                Kota / Kabupaten <strong>*</strong>
              </span>
              <input
                name="kota"
                value={form.kota}
                onChange={updateField}
                placeholder="Contoh: Kota Jakarta Selatan"
                required
              />
            </label>
          </div>

          <div className="field-grid">
            <label>
              <span>
                Kecamatan <strong>*</strong>
              </span>
              <input
                name="kecamatan"
                value={form.kecamatan}
                onChange={updateField}
                placeholder="Contoh: Kebayoran Baru"
                required
              />
            </label>
            <label>
              <span>
                Kelurahan <strong>*</strong>
              </span>
              <input
                name="kelurahan"
                value={form.kelurahan}
                onChange={updateField}
                placeholder="Contoh: Senayan"
                required
              />
            </label>
          </div>

          <label>
            <span>
              Alamat Lengkap <strong>*</strong>
            </span>
            <textarea
              name="alamat"
              value={form.alamat}
              onChange={updateField}
              placeholder="Alamat lengkap dari Google Maps atau isi manual"
              rows="4"
              required
            />
          </label>
        </section>

        <section className="form-section capacity-section">
          <div className="section-heading">
            <span>03</span>
            <div>
              <h2>Kapasitas</h2>
              <p>Slot BSS dan dokumentasi lokasi.</p>
            </div>
          </div>

          <div className="capacity-grid">
            <label className="slot-field">
              <span>
                Slot BSS <strong>*</strong>
              </span>
              <select
                name="slotBss"
                value={form.slotBss}
                onChange={updateField}
                required
              >
                <option value="">Pilih slot</option>
                <option value="6">6 Slot</option>
                <option value="12">12 Slot</option>
              </select>
            </label>
            <label className="photo-field">
              <span>
                Foto Lokasi <strong>*</strong>
              </span>
              <div className="photo-guidance">
                <p>Contoh foto yang perlu diupload:</p>
                <ol>
                  <li>Foto tampak depan tempat usaha.</li>
                  <li>Foto jarak antara tempat usaha dengan tiang listrik.</li>
                  <li>
                    Foto dari dalam tempat usaha menghadap ke arah jalan/depan.
                  </li>
                </ol>
              </div>
              <div className="file-upload">
                <input
                  id="fotoLokasi"
                  name="fotoLokasi"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={updateFile}
                  required={fotoLokasiFiles.length === 0}
                />
                <label htmlFor="fotoLokasi" className="file-upload-button">
                  Pilih foto
                </label>
                <p>
                  {fotoLokasiFiles.length > 0
                    ? `${fotoLokasiFiles.length} foto dipilih`
                    : "Bisa pilih lebih dari 1 foto, maksimal 5 MB per file."}
                </p>
              </div>
              {fotoLokasiFiles.length > 0 && (
                <ul className="file-list">
                  {fotoLokasiFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              )}
            </label>
          </div>
        </section>

        <div className="form-actions">
          <button
            className="submit-button"
            type="submit"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Mengirim..." : "Kirim respons"}
          </button>
          {message && <p className={`status ${status}`}>{message}</p>}
        </div>
      </form>
    </main>
  );
}

function MapPicker({ value, onLocationChange }) {
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapState, setMapState] = useState("loading");
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    let disposed = false;

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapRef.current || !searchInputRef.current) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center: jakartaCenter,
          zoom: 12,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        });

        const marker = new window.google.maps.Marker({
          map,
          draggable: true,
          position: jakartaCenter,
        });

        geocoderRef.current = new window.google.maps.Geocoder();
        mapInstanceRef.current = map;
        markerRef.current = marker;

        const setMarkerLocation = (latLng, targetMap, targetMarker, place) => {
          targetMarker.setPosition(latLng);
          targetMap.panTo(latLng);

          const location = buildLocationPayload(latLng, place);
          onLocationChange(location);

          if (!place?.formatted_address && geocoderRef.current) {
            geocoderRef.current.geocode(
              { location: latLng },
              (results, status) => {
                if (status !== "OK" || !results?.[0]) return;
                onLocationChange(buildLocationPayload(latLng, results[0]));
              },
            );
          }
        };

        map.addListener("click", (event) => {
          setMarkerLocation(event.latLng, map, marker);
        });

        marker.addListener("dragend", () => {
          setMarkerLocation(marker.getPosition(), map, marker);
        });

        const autocomplete = new window.google.maps.places.Autocomplete(
          searchInputRef.current,
          {
            componentRestrictions: { country: "id" },
            fields: [
              "address_components",
              "formatted_address",
              "geometry",
              "name",
            ],
          },
        );

        autocomplete.bindTo("bounds", map);
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place?.geometry?.location) return;

          setSearchQuery(
            place.formatted_address ||
              place.name ||
              searchInputRef.current.value,
          );
          map.panTo(place.geometry.location);
          map.setZoom(16);
          setMarkerLocation(place.geometry.location, map, marker, place);
        });

        setMapState("ready");
      })
      .catch(() => {
        if (!disposed) setMapState("error");
      });

    return () => {
      disposed = true;
    };
  }, [onLocationChange]);

  function searchLocation() {
    if (
      !searchQuery.trim() ||
      !geocoderRef.current ||
      !mapInstanceRef.current ||
      !markerRef.current
    )
      return;

    setMapState("searching");
    geocoderRef.current.geocode({ address: searchQuery }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        setMapState("ready");
        return;
      }

      const place = results[0];
      const latLng = place.geometry.location;
      markerRef.current.setPosition(latLng);
      mapInstanceRef.current.panTo(latLng);
      mapInstanceRef.current.setZoom(16);
      onLocationChange(buildLocationPayload(latLng, place));
      setMapState("ready");
    });
  }

  function useCurrentLocation() {
    if (
      !navigator.geolocation ||
      !mapInstanceRef.current ||
      !markerRef.current
    ) {
      setLocationMessage("Browser belum mendukung deteksi lokasi.");
      return;
    }

    setLocationMessage("");
    setMapState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latLng = new window.google.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude,
        );

        markerRef.current.setPosition(latLng);
        mapInstanceRef.current.panTo(latLng);
        mapInstanceRef.current.setZoom(17);

        const location = buildLocationPayload(latLng);
        onLocationChange(location);

        if (geocoderRef.current) {
          geocoderRef.current.geocode(
            { location: latLng },
            (results, status) => {
              if (status === "OK" && results?.[0]) {
                onLocationChange(buildLocationPayload(latLng, results[0]));
                setSearchQuery(results[0].formatted_address || "");
              }
              setMapState("ready");
            },
          );
          return;
        }

        setMapState("ready");
      },
      () => {
        setLocationMessage("Izin lokasi ditolak atau lokasi belum tersedia.");
        setMapState("ready");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      },
    );
  }

  return (
    <div className="map-picker">
      <div className="map-toolbar">
        <label>
          <span>Cari titik di Google Maps</span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                searchLocation();
              }
            }}
            placeholder="Cari nama lokasi, alamat, atau area"
            disabled={mapState === "loading" || mapState === "error"}
          />
        </label>
        <button
          className="map-search-button"
          type="button"
          onClick={searchLocation}
          disabled={
            mapState === "loading" ||
            mapState === "error" ||
            !searchQuery.trim()
          }
        >
          Cari
        </button>
        <button
          className="map-location-button"
          type="button"
          onClick={useCurrentLocation}
          disabled={
            mapState === "loading" ||
            mapState === "error" ||
            mapState === "locating"
          }
        >
          Gunakan lokasi saya
        </button>
        {value && (
          <a href={value} target="_blank" rel="noreferrer">
            Buka Maps
          </a>
        )}
      </div>
      <div className="map-frame">
        <div className="map-canvas" ref={mapRef} />
        {mapState === "loading" && (
          <p className="map-overlay">Memuat Google Maps...</p>
        )}
        {mapState === "searching" && (
          <p className="map-overlay">Mencari lokasi...</p>
        )}
        {mapState === "locating" && (
          <p className="map-overlay">Mengambil lokasi Anda...</p>
        )}
        {mapState === "error" && (
          <p className="map-overlay">
            Google Maps belum bisa dimuat. Cek API key dan domain.
          </p>
        )}
      </div>
      <p className="map-help">
        Cari lokasi, gunakan lokasi Anda, klik peta, atau geser marker untuk
        mengisi link Google Maps.
      </p>
      {locationMessage && <p className="map-message">{locationMessage}</p>}
    </div>
  );
}

function loadGoogleMaps() {
  if (window.google?.maps?.places) return Promise.resolve();

  if (!googleMapsPromise) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    googleMapsPromise = new Promise((resolve, reject) => {
      if (!apiKey) {
        reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY"));
        return;
      }

      const existingScript = document.querySelector("script[data-google-maps]");
      if (existingScript) {
        existingScript.addEventListener("load", resolve, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.dataset.googleMaps = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return googleMapsPromise;
}

function buildLocationPayload(latLng, place) {
  const lat = latLng.lat();
  const lng = latLng.lng();
  const addressParts = parseAddressComponents(place?.address_components || []);

  return {
    googleMapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    alamat: place?.formatted_address || "",
    kota: addressParts.kota,
    kecamatan: addressParts.kecamatan,
    kelurahan: addressParts.kelurahan,
    provinsi: addressParts.provinsi,
  };
}

function parseAddressComponents(components) {
  const findComponent = (...types) =>
    components.find((component) =>
      types.some((type) => component.types.includes(type)),
    )?.long_name || "";

  return {
    kota: findComponent("administrative_area_level_2", "locality"),
    kecamatan: findComponent(
      "administrative_area_level_3",
      "sublocality_level_1",
    ),
    kelurahan: findComponent(
      "administrative_area_level_4",
      "sublocality_level_2",
    ),
    provinsi: findComponent("administrative_area_level_1"),
  };
}

export default App;

import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const jakartaCenter = { lat: -6.2088, lng: 106.8456 };
let googleMapsPromise;

const maxPhotoFiles = 10;
const maxPhotoFileSize = 5 * 1024 * 1024;
const maxPhotoTotalSize = 25 * 1024 * 1024;
const maxPhotoDimension = 1600;
const photoCompressionQuality = 0.76;
const maxParallelUploads = 3;

const initialForm = {
  jenis: "BSS",
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

const editableSubmissionFields = [
  { key: "siteName", label: "Site Name", required: true },
  { key: "address", label: "Address", type: "textarea", required: true },
  { key: "googleMapUrl", label: "Google Map URL", required: true },
  { key: "city", label: "City", required: true },
  { key: "province", label: "Province", required: true },
  { key: "rentalPrice", label: "Rental Price" },
  {
    key: "jenis",
    label: "Jenis",
    type: "select",
    options: ["BSS", "EVCS"],
    required: true,
  },
  {
    key: "slot",
    label: "Slot / Jumlah EVCS",
    type: "select",
    options: ["6", "12", "1", "2"],
    required: true,
  },
  { key: "venuePic", label: "Venue PIC", required: true },
  { key: "accountNumber", label: "Account Number", required: true },
  { key: "rentPeriod", label: "Rent Period" },
  { key: "keyAccount", label: "Key Account", required: true },
  { key: "noTelpLokasi", label: "No. Telp Lokasi", required: true },
  {
    key: "approval",
    label: "Approval",
    type: "select",
    options: ["pending", "approved", "rejected", "follow_up"],
  },
  { key: "awalKontrak", label: "Awal Kontrak", type: "date" },
  { key: "akhirKontrak", label: "Akhir Kontrak", type: "date" },
  { key: "masaKontrak", label: "Masa Kontrak" },
  { key: "terminPembayaran", label: "Termin Pembayaran" },
];

const editFieldGroups = [
  {
    title: "Informasi Lokasi",
    fields: [
      "siteName",
      "address",
      "googleMapUrl",
      "city",
      "province",
      "rentalPrice",
      "jenis",
      "slot",
    ],
  },
  {
    title: "PIC & Kontak",
    fields: [
      "venuePic",
      "accountNumber",
      "rentPeriod",
      "keyAccount",
      "noTelpLokasi",
    ],
  },
  {
    title: "Approval & Kontrak",
    fields: [
      "approval",
      "awalKontrak",
      "akhirKontrak",
      "masaKontrak",
      "terminPembayaran",
    ],
  },
];

const submissionTableColumns = [
  { key: "no", label: "No" },
  { key: "siteName", label: "Site Name" },
  { key: "address", label: "Address" },
  { key: "googleMapUrl", label: "Google Map URL", type: "link" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "rentalPrice", label: "Rental Price" },
  { key: "jenis", label: "Jenis" },
  { key: "slot", label: "Slot / Jumlah EVCS" },
  { key: "venuePic", label: "Venue PIC" },
  { key: "accountNumber", label: "Account Number" },
  { key: "rentPeriod", label: "Rent Period" },
  { key: "keyAccount", label: "Key Account" },
  { key: "noTelpLokasi", label: "No. Telp Lokasi" },
  { key: "fotoLokasi", label: "Foto Lokasi", type: "photos" },
  { key: "approval", label: "Approval", type: "approval" },
  { key: "awalKontrak", label: "Awal Kontrak" },
  { key: "akhirKontrak", label: "Akhir Kontrak" },
  { key: "masaKontrak", label: "Masa Kontrak" },
  { key: "terminPembayaran", label: "Termin Pembayaran" },
];

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
          : path === "/admin-data"
            ? "Data Pendaftaran BSS"
            : "PT. Kreasi Mitra Berdikari";
  }, [path]);

  if (path === "/form-bss") return <FormPage />;
  if (path === "/program-bss") return <ProgramBssPage />;
  if (path === "/admin-data") return <AdminDataPage />;

  return (
    <>
      <CompanyProfile />
      <ScrollToTopButton />
    </>
  );
}

function AdminDataPage() {
  const importInputRef = useRef(null);
  const [adminToken, setAdminToken] = useState(
    () => sessionStorage.getItem("kmbAdminToken") || "",
  );
  const [password, setPassword] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [status, setStatus] = useState(adminToken ? "loading" : "locked");
  const [message, setMessage] = useState("");
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editStatus, setEditStatus] = useState("idle");
  const [editMessage, setEditMessage] = useState("");
  const [deletingNo, setDeletingNo] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [importStatus, setImportStatus] = useState("idle");
  const [exportStatus, setExportStatus] = useState("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const dashboardStats = buildDashboardStats(submissions);
  const filteredSubmissions = submissions.filter((submission) => {
    const approval = normalizeApprovalStatus(submission.approval);
    const matchesStatus = statusFilter === "all" || approval === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [
        submission.no,
        submission.siteName,
        submission.address,
        submission.googleMapUrl,
        submission.city,
        submission.province,
        submission.rentalPrice,
        submission.jenis,
        submission.slot,
        submission.venuePic,
        submission.accountNumber,
        submission.rentPeriod,
        submission.keyAccount,
        submission.noTelpLokasi,
        submission.awalKontrak,
        submission.akhirKontrak,
        submission.masaKontrak,
        submission.terminPembayaran,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });
  const totalPages = Math.max(
    1,
    Math.ceil(filteredSubmissions.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedSubmissions = filteredSubmissions.slice(
    pageStart,
    pageStart + pageSize,
  );
  const visibleStart = filteredSubmissions.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageStart + pageSize, filteredSubmissions.length);
  const paginationItems = buildPaginationItems(currentPage, totalPages);

  useEffect(() => {
    if (!adminToken) return;

    let disposed = false;

    fetch("/api/submissions", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || "Data belum bisa dimuat.");
        }
        return result;
      })
      .then((result) => {
        if (disposed) return;
        setSubmissions(result.submissions || []);
        setStatus("success");
      })
      .catch((error) => {
        if (disposed) return;
        if (error.message.includes("admin")) {
          sessionStorage.removeItem("kmbAdminToken");
          setAdminToken("");
          setStatus("locked");
        } else {
          setStatus("error");
        }
        setMessage(error.message);
      });

    return () => {
      disposed = true;
    };
  }, [adminToken]);

  useEffect(() => {
    if (!toast) return undefined;

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 4600);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  function showToast(type, title, description) {
    setToast({ type, title, description });
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login admin gagal.");
      }

      sessionStorage.setItem("kmbAdminToken", result.token);
      setStatus("loading");
      setAdminToken(result.token);
      setPassword("");
    } catch (error) {
      setStatus("locked");
      setMessage(error.message);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("kmbAdminToken");
    setAdminToken("");
    setSubmissions([]);
    setStatus("locked");
    setMessage("");
    setEditingSubmission(null);
  }

  function startEdit(submission) {
    setEditingSubmission(submission);
    setEditForm(buildEditForm(submission));
    setEditStatus("idle");
    setEditMessage("");
  }

  function closeEdit() {
    if (editStatus === "loading") return;
    setEditingSubmission(null);
    setEditForm({});
    setEditMessage("");
  }

  function updateEditField(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "jenis" ? { slot: "" } : {}),
    }));
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editingSubmission) return;

    setEditStatus("loading");
    setEditMessage("");

    try {
      const response = await fetch(`/api/submissions/${editingSubmission.no}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(editForm),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Data belum bisa disimpan.");
      }

      setSubmissions((current) =>
        current.map((submission) =>
          submission.no === result.submission.no
            ? result.submission
            : submission,
        ),
      );
      setEditingSubmission(null);
      setEditForm({});
      setEditStatus("idle");
      showToast(
        "success",
        "Data diperbarui",
        `No ${result.submission.no} berhasil disimpan.`,
      );
    } catch (error) {
      setEditStatus("error");
      setEditMessage(error.message);
      showToast("error", "Gagal menyimpan data", error.message);
    }
  }

  function requestDelete(submission) {
    setPendingDelete(submission);
    setMessage("");
  }

  function closeDeleteModal() {
    if (deletingNo) return;
    setPendingDelete(null);
  }

  async function confirmDelete() {
    const submission = pendingDelete;
    if (!submission) return;

    setDeletingNo(submission.no);
    setMessage("");

    try {
      const response = await fetch(`/api/submissions/${submission.no}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Data belum bisa dihapus.");
      }

      setSubmissions((current) =>
        current.filter((item) => Number(item.no) !== Number(submission.no)),
      );
      setPendingDelete(null);
      setStatus("success");
      showToast(
        "success",
        "Data dihapus",
        `No ${submission.no} - ${submission.siteName} sudah dihapus.`,
      );
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
      showToast("error", "Gagal menghapus data", error.message);
    } finally {
      setDeletingNo(null);
    }
  }

  async function importFile(file) {
    if (!file) return;

    setImportStatus("loading");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/submissions/import-file", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Import belum bisa dijalankan.");
      }

      setSubmissions(result.submissions || []);
      setStatus("success");
      setPage(1);
      setMessage("");
      setImportStatus("success");
      showToast("success", "Import selesai", result.message);
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
      setImportStatus("error");
      showToast("error", "Import gagal", error.message);
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  async function exportCsv() {
    setExportStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/submissions/export.csv", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Export belum bisa dijalankan.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `data-pendaftaran-bss-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportStatus("success");
      showToast(
        "success",
        "Export CSV dimulai",
        "File data pendaftaran sedang diunduh.",
      );
    } catch (error) {
      setMessage(error.message);
      setStatus("error");
      setExportStatus("error");
      showToast("error", "Export gagal", error.message);
    }
  }

  function updateSearchQuery(value) {
    setSearchQuery(value);
    setPage(1);
  }

  function updateStatusFilter(value) {
    setStatusFilter(value);
    setPage(1);
  }

  function updatePageSize(value) {
    setPageSize(Number(value));
    setPage(1);
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <a className="back-link" href="/">
            Kembali ke profil perusahaan
          </a>
          <p className="company-kicker">Data Internal</p>
          <h1>Data Pendaftaran BSS</h1>
        </div>
        <div className="admin-summary">
          <span>{adminToken ? "Total Baris" : "Status"}</span>
          <strong>{adminToken ? submissions.length : "Locked"}</strong>
        </div>
      </header>

      {!adminToken && (
        <section className="admin-login-panel">
          <form onSubmit={handleAdminLogin}>
            <div>
              <span>Akses Admin</span>
              <h2>Masukkan password untuk membuka data internal.</h2>
            </div>
            <label>
              <span>Password Admin</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password admin"
                required
              />
            </label>
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Memeriksa..." : "Masuk"}
            </button>
            {message && <p className="status error">{message}</p>}
          </form>
        </section>
      )}

      {adminToken && (
        <section className="dashboard-shell">
          <div className="dashboard-toolbar">
            <div>
              <strong>Dashboard BSS</strong>
              <span>
                {status === "loading"
                  ? "Memuat data..."
                  : status === "error"
                    ? message
                    : `${filteredSubmissions.length} dari ${submissions.length} data ditampilkan`}
              </span>
            </div>
            <div className="dashboard-toolbar-actions">
              <input
                ref={importInputRef}
                className="visually-hidden-input"
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={(event) => importFile(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importStatus === "loading"}
              >
                {importStatus === "loading" ? "Import..." : "Import File"}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={exportStatus === "loading"}
              >
                {exportStatus === "loading" ? "Export..." : "Export CSV"}
              </button>
              <button type="button" onClick={handleLogout}>
                Keluar
              </button>
            </div>
          </div>
          {status === "error" && message && (
            <p
              className="dashboard-notice error"
            >
              {message}
            </p>
          )}

          <section
            className="dashboard-metrics"
            aria-label="Ringkasan data BSS"
          >
            <article>
              <span>Total</span>
              <strong>{dashboardStats.total}</strong>
              <p>Semua lokasi</p>
            </article>
            <article>
              <span>Pending</span>
              <strong>{dashboardStats.pending}</strong>
              <p>Menunggu review</p>
            </article>
            <article>
              <span>Approved</span>
              <strong>{dashboardStats.approved}</strong>
              <p>Lokasi disetujui</p>
            </article>
            <article>
              <span>12 Slot</span>
              <strong>{dashboardStats.slot12}</strong>
              <p>Kapasitas besar</p>
            </article>
          </section>

          <section className="dashboard-controls">
            <label>
              <span>Cari data</span>
              <input
                value={searchQuery}
                onChange={(event) => updateSearchQuery(event.target.value)}
                placeholder="Cari lokasi, kota, PIC, atau nomor telepon"
              />
            </label>
            <label>
              <span>Status approval</span>
              <select
                value={statusFilter}
                onChange={(event) => updateStatusFilter(event.target.value)}
              >
                <option value="all">Semua status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="follow_up">Follow up</option>
              </select>
            </label>
          </section>

          <section className="dashboard-table-panel">
            <div className="dashboard-table-header">
              <span>
                {visibleStart}-{visibleEnd} dari {filteredSubmissions.length}{" "}
                baris
              </span>
            </div>
            <div className="dashboard-table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    {submissionTableColumns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubmissions.map((submission) => (
                    <tr key={submission.no}>
                      {submissionTableColumns.map((column) => (
                        <td key={column.key}>
                          <SheetCell
                            column={column}
                            value={submission[column.key]}
                          />
                        </td>
                      ))}
                      <td>
                        <div className="sheet-action-group">
                          <button
                            className="sheet-action-button"
                            type="button"
                            onClick={() => startEdit(submission)}
                            disabled={deletingNo === submission.no}
                          >
                            Edit
                          </button>
                          <button
                            className="sheet-action-button sheet-action-danger"
                            type="button"
                            onClick={() => requestDelete(submission)}
                            disabled={deletingNo === submission.no}
                          >
                            {deletingNo === submission.no ? "..." : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {status === "success" && filteredSubmissions.length === 0 && (
                    <tr>
                      <td
                        colSpan={submissionTableColumns.length + 1}
                        className="sheet-empty"
                      >
                        Data tidak ditemukan.
                      </td>
                    </tr>
                  )}
                  {status === "loading" && (
                    <tr>
                      <td
                        colSpan={submissionTableColumns.length + 1}
                        className="sheet-empty"
                      >
                        Memuat data...
                      </td>
                    </tr>
                  )}
                  {status === "error" && (
                    <tr>
                      <td
                        colSpan={submissionTableColumns.length + 1}
                        className="sheet-empty sheet-error"
                      >
                        {message}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="dashboard-pagination">
              <div className="pagination-size">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => updatePageSize(event.target.value)}
                >
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <p className="pagination-range">
                {visibleStart}-{visibleEnd} of {filteredSubmissions.length} rows
              </p>
              <div className="pagination-pages">
                <button
                  aria-label="Halaman pertama"
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                >
                  «
                </button>
                <button
                  aria-label="Halaman sebelumnya"
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage === 1}
                >
                  ‹
                </button>
                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span
                      className="pagination-ellipsis"
                      key={`ellipsis-${index}`}
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      className={item === currentPage ? "is-active" : ""}
                      type="button"
                      onClick={() => setPage(item)}
                      key={item}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  aria-label="Halaman berikutnya"
                  type="button"
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  ›
                </button>
                <button
                  aria-label="Halaman terakhir"
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  »
                </button>
              </div>
            </div>
          </section>
        </section>
      )}
      {editingSubmission && (
        <EditSubmissionModal
          form={editForm}
          status={editStatus}
          message={editMessage}
          submissionNo={editingSubmission.no}
          onChange={updateEditField}
          onClose={closeEdit}
          onSubmit={saveEdit}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          submission={pendingDelete}
          isDeleting={deletingNo === pendingDelete.no}
          onCancel={closeDeleteModal}
          onConfirm={confirmDelete}
        />
      )}
      <ToastNotice toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function buildEditForm(submission) {
  return Object.fromEntries(
    editableSubmissionFields.map((field) => [
      field.key,
      field.type === "date"
        ? formatDateInput(submission[field.key])
        : String(submission[field.key] ?? ""),
    ]),
  );
}

function getEditableField(fieldKey) {
  return editableSubmissionFields.find((field) => field.key === fieldKey);
}

function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", currentPage, "ellipsis", totalPages];
}

function formatSelectOption(fieldKey, option) {
  if (fieldKey === "slot") {
    if (option === "1" || option === "2") return `${option} EVCS`;
    return `${option} Slot`;
  }

  if (option === "follow_up") return "Follow up";
  return option;
}

function buildDashboardStats(submissions) {
  return submissions.reduce(
    (stats, submission) => {
      const approval = normalizeApprovalStatus(submission.approval);
      stats.total += 1;
      if (approval === "pending") stats.pending += 1;
      if (approval === "approved") stats.approved += 1;
      if (approval === "rejected") stats.rejected += 1;
      if (approval === "follow_up") stats.followUp += 1;
      if (submission.jenis === "BSS" && Number(submission.slot) === 12) stats.slot12 += 1;
      return stats;
    },
    {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      followUp: 0,
      slot12: 0,
    },
  );
}

function normalizeApprovalStatus(status) {
  return String(status || "pending")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
}

function formatApprovalStatus(status) {
  const normalizedStatus = normalizeApprovalStatus(status);
  if (normalizedStatus === "approved") return "Approved";
  if (normalizedStatus === "rejected") return "Rejected";
  if (normalizedStatus === "follow_up") return "Follow up";
  return "Pending";
}

function EditSubmissionModal({
  form,
  status,
  message,
  submissionNo,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="edit-modal-backdrop" role="dialog" aria-modal="true">
      <form className="edit-modal" onSubmit={onSubmit}>
        <div className="edit-modal-header">
          <div>
            <span>Edit Data</span>
            <h2>No {submissionNo}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === "loading"}
          >
            Tutup
          </button>
        </div>

        <div className="edit-section-list">
          {editFieldGroups.map((group) => (
            <section className="edit-section" key={group.title}>
              <h3>{group.title}</h3>
              <div className="edit-field-grid">
                {group.fields.map((fieldKey) => {
                  const field = getEditableField(fieldKey);
                  if (!field) return null;
                  const options =
                    field.key === "slot"
                      ? form.jenis === "EVCS"
                        ? ["1", "2"]
                        : ["6", "12"]
                      : field.options;

                  return (
                    <label
                      key={field.key}
                      className={
                        field.type === "textarea" ? "edit-field-wide" : ""
                      }
                    >
                      <span>
                        {field.label}
                        {field.required && <strong> *</strong>}
                      </span>
                      {field.type === "textarea" ? (
                        <textarea
                          name={field.key}
                          value={form[field.key] || ""}
                          onChange={onChange}
                          rows="4"
                          required={field.required}
                        />
                      ) : field.type === "select" ? (
                        <select
                          name={field.key}
                          value={form[field.key] || ""}
                          onChange={onChange}
                          required={field.required}
                        >
                          <option value="">Pilih</option>
                          {options.map((option) => (
                            <option value={option} key={option}>
                              {formatSelectOption(field.key, option)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          name={field.key}
                          type={field.type || "text"}
                          value={form[field.key] || ""}
                          onChange={onChange}
                          required={field.required}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="edit-modal-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={status === "loading"}
          >
            Batal
          </button>
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Menyimpan..." : "Simpan perubahan"}
          </button>
          {message && <p className="status error">{message}</p>}
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({ submission, isDeleting, onCancel, onConfirm }) {
  return (
    <div className="confirm-modal-backdrop" role="dialog" aria-modal="true">
      <section className="confirm-modal" aria-labelledby="delete-modal-title">
        <div className="confirm-modal-header">
          <span>Konfirmasi Hapus</span>
          <h2 id="delete-modal-title">Hapus data lokasi?</h2>
        </div>
        <div className="confirm-modal-body">
          <p>
            Data <strong>No {submission.no}</strong>
            {submission.siteName ? ` - ${submission.siteName}` : ""} akan
            dihapus dari database.
          </p>
          <p className="confirm-warning">
            Foto Cloudinary yang terhubung dengan data ini juga akan ikut
            dihapus.
          </p>
        </div>
        <div className="confirm-modal-actions">
          <button type="button" onClick={onCancel} disabled={isDeleting}>
            Batal
          </button>
          <button
            className="confirm-danger-button"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Menghapus..." : "Hapus Data"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ToastNotice({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <div className={`toast-card toast-${toast.type}`}>
        <div>
          <strong>{toast.title}</strong>
          <p>{toast.description}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Tutup notifikasi">
          x
        </button>
      </div>
    </div>
  );
}

function SheetCell({ column, value }) {
  if (column.type === "approval") {
    const approval = normalizeApprovalStatus(value);
    return (
      <span className={`status-badge status-${approval}`}>
        {formatApprovalStatus(value)}
      </span>
    );
  }

  if (column.type === "link" && value) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        Buka link
      </a>
    );
  }

  if (column.type === "photos") {
    const photos = Array.isArray(value) ? value : [];
    if (!photos.length) return "";

    return (
      <div className="sheet-photo-links">
        {photos.map((photo, index) => {
          const url = typeof photo === "string" ? photo : photo.url;
          const label =
            typeof photo === "string"
              ? `Foto ${index + 1}`
              : formatPhotoType(photo.type, index);
          return (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              key={`${url}-${index}`}
            >
              {label}
            </a>
          );
        })}
      </div>
    );
  }

  if (column.type === "datetime" && value) {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  return value ?? "";
}

function formatDateInput(value) {
  if (!value) return "";

  return new Date(value).toISOString().slice(0, 10);
}

function formatPhotoType(type, index) {
  if (type === "front_business") return "Tampak depan";
  if (type === "distance_to_power_pole") return "Jarak tiang";
  if (type === "inside_to_road") return "Dari dalam";
  return `Foto ${index + 1}`;
}

function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      const scrollPosition = window.scrollY + window.innerHeight;
      const bottomDistance =
        document.documentElement.scrollHeight - scrollPosition;
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
              Kami mendukung pengembangan kemitraan, verifikasi lokasi, aktivasi
              operasional, dan kebutuhan penunjang usaha dengan pendekatan yang
              rapi, responsif, dan berbasis data lapangan.
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
          <h2>
            Proses sederhana untuk menjaga data dan koordinasi tetap rapi.
          </h2>
        </div>
        <div className="workflow-grid">
          <article>
            <span>01</span>
            <h3>Identifikasi</h3>
            <p>
              Memetakan kebutuhan program, area prioritas, dan profil lokasi.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Verifikasi</h3>
            <p>Mengumpulkan data lapangan, titik peta, kontak PIC, dan foto.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Koordinasi</h3>
            <p>
              Menyusun data untuk tindak lanjut mitra dan kebutuhan operasional.
            </p>
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
                className={
                  index === 0
                    ? "gallery-item gallery-item-large"
                    : "gallery-item"
                }
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
          <a className="bss-band-secondary" href="/form-bss">
            Buka Form BSS
          </a>
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
          <a href="mailto:contact@kmbgroup.id">contact@kmbgroup.id</a>
          {/* <a href="tel:082112941420">082112941420</a> */}
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
          <h2>
            BSS dirancang untuk mempercepat mobilitas kendaraan listrik roda
            dua.
          </h2>
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
          <h2>
            Pilihan perangkat menyesuaikan kapasitas dan kesiapan daya lokasi.
          </h2>
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
            <p>
              Arus 63A, daya PLN 13.9 kVA, dimensi rak 1060 x 605 x 1900 mm.
            </p>
          </article>
          <article>
            <span>12 Slot</span>
            <h3>3 Fase</h3>
            <p>
              Arus 25A, daya PLN 16.5 kVA, dimensi rak 1060 x 605 x 1900 mm.
            </p>
          </article>
        </div>
      </section>

      <section className="company-section safety-section">
        <div className="company-section-heading">
          <span>Keselamatan</span>
          <h2>
            Standar perangkat mendukung keamanan instalasi dan operasional.
          </h2>
        </div>
        <div className="safety-list">
          <p>
            Grounding dan isolasi penuh sesuai standar keselamatan IEC & PLN.
          </p>
          <p>Proteksi kebocoran tipe B dan enclosure tahan api.</p>
          <p>Struktur tahan cuaca, tahan korosi, dan aman terhadap petir.</p>
        </div>
      </section>

      <section className="company-section cooperation-section">
        <div className="company-section-heading">
          <span>Skema Kerja Sama</span>
          <h2>
            Pemilik lahan fokus menyediakan lokasi, kebutuhan teknis ditangani
            mitra operasional.
          </h2>
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
          <h2>
            Siapkan data lokasi, titik peta, dan dokumentasi foto lapangan.
          </h2>
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
          <a href="mailto:contact@kmbgroup.id">contact@kmbgroup.id</a>
          {/* <a href="tel:082112941420">082112941420</a> */}
        </div>
      </footer>
    </main>
  );
}

function FormPage() {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [submissionKey, setSubmissionKey] = useState(() => createSubmissionKey());
  const [fotoLokasiFiles, setFotoLokasiFiles] = useState([]);
  const [fotoLokasiErrors, setFotoLokasiErrors] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "jenis" ? { slotBss: "" } : {}),
    }));
  }

  function updateFile(event) {
    const files = Array.from(event.target.files || []);
    setFotoLokasiFiles(files);
    setFotoLokasiErrors(validatePhotoFiles(files));
    setForm((current) => ({ ...current, fotoLokasi: "" }));
  }

  function removePhotoFile(fileIndex) {
    const nextFiles = fotoLokasiFiles.filter((_, index) => index !== fileIndex);

    setFotoLokasiFiles(nextFiles);
    setFotoLokasiErrors(validatePhotoFiles(nextFiles));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    setUploadProgress(null);

    let uploadedPhotos = [];

    try {
      let fotoLokasi = form.fotoLokasi;
      let fotoLokasiMeta = [];
      const photoErrors = validatePhotoFiles(fotoLokasiFiles);

      if (photoErrors.length > 0) {
        setFotoLokasiErrors(photoErrors);
        throw new Error(photoErrors.join(" "));
      }

      if (fotoLokasiFiles.length > 0) {
        uploadedPhotos = await uploadPhotoFiles(
          fotoLokasiFiles,
          submissionKey,
          setUploadProgress,
        );
        fotoLokasiMeta = uploadedPhotos;
        fotoLokasi = uploadedPhotos.map((file) => file.fileUrl).join("\n");
      }

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          idempotencyKey: submissionKey,
          fotoLokasi,
          fotoLokasiMeta,
        }),
      });
      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(result.message || "Respons belum bisa dikirim.");
      }

      setForm(initialForm);
      setSubmissionKey(createSubmissionKey());
      setFotoLokasiFiles([]);
      setFotoLokasiErrors([]);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatus("success");
      setMessage(result.message);
    } catch (error) {
      await cleanupUploadedPhotos(uploadedPhotos);
      setUploadProgress(null);
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
              <p>Jenis perangkat, kapasitas, dan dokumentasi lokasi.</p>
            </div>
          </div>

          <div className="capacity-grid">
            <label className="slot-field">
              <span>
                Jenis <strong>*</strong>
              </span>
              <select
                name="jenis"
                value={form.jenis}
                onChange={updateField}
                required
              >
                <option value="BSS">BSS</option>
                <option value="EVCS">EVCS</option>
              </select>
            </label>
            <label className="slot-field">
              <span>
                {form.jenis === "EVCS" ? "Jumlah EVCS" : "Slot BSS"} <strong>*</strong>
              </span>
              <select
                name="slotBss"
                value={form.slotBss}
                onChange={updateField}
                required
              >
                <option value="">
                  {form.jenis === "EVCS" ? "Pilih jumlah EVCS" : "Pilih slot"}
                </option>
                {form.jenis === "EVCS" ? (
                  <>
                    <option value="1">1 EVCS</option>
                    <option value="2">2 EVCS</option>
                  </>
                ) : (
                  <>
                    <option value="6">6 Slot</option>
                    <option value="12">12 Slot</option>
                  </>
                )}
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
                  ref={fileInputRef}
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
                  {uploadProgress
                    ? `Mengupload ${uploadProgress.done}/${uploadProgress.total} foto...`
                    : fotoLokasiFiles.length > 0
                      ? `${fotoLokasiFiles.length} foto dipilih, total ${formatFileSize(getTotalFileSize(fotoLokasiFiles))}`
                      : `Bisa pilih lebih dari 1 foto. Maksimal ${maxPhotoFiles} foto, ${formatFileSize(maxPhotoFileSize)} per file, total ${formatFileSize(maxPhotoTotalSize)}.`}
                </p>
              </div>
              {uploadProgress && (
                <div className="upload-progress" aria-label="Progress upload foto">
                  <span
                    style={{
                      width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              )}
              {fotoLokasiErrors.length > 0 && (
                <div className="file-upload-alert" role="alert">
                  <strong>Foto belum bisa dikirim</strong>
                  <ul>
                    {fotoLokasiErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {fotoLokasiFiles.length > 0 && (
                <ul className="file-list">
                  {fotoLokasiFiles.map((file, index) => (
                    <li
                      className={
                        file.size > maxPhotoFileSize ? "file-too-large" : ""
                      }
                      key={`${file.name}-${file.size}-${index}`}
                    >
                      <span>
                        {file.name}
                        <small>{formatFileSize(file.size)}</small>
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhotoFile(index)}
                        aria-label={`Hapus ${file.name}`}
                      >
                        Hapus
                      </button>
                    </li>
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

function validatePhotoFiles(files) {
  const errors = [];
  const totalSize = getTotalFileSize(files);
  const largeFiles = files.filter((file) => file.size > maxPhotoFileSize);

  if (files.length > maxPhotoFiles) {
    errors.push(`Maksimal ${maxPhotoFiles} foto dalam sekali upload.`);
  }

  if (totalSize > maxPhotoTotalSize) {
    errors.push(
      `Total ukuran foto ${formatFileSize(totalSize)}. Maksimal total ${formatFileSize(maxPhotoTotalSize)}.`,
    );
  }

  largeFiles.forEach((file) => {
    errors.push(
      `${file.name} terlalu besar (${formatFileSize(file.size)}). Maksimal ${formatFileSize(maxPhotoFileSize)} per file.`,
    );
  });

  return errors;
}

async function uploadPhotoFiles(files, submissionKey, onProgress) {
  const compressedFiles = [];

  for (const file of files) {
    compressedFiles.push(await compressPhotoFile(file));
  }

  try {
    return await uploadPhotosDirectToCloudinary(
      compressedFiles,
      submissionKey,
      onProgress,
    );
  } catch (error) {
    if (error.code !== "cloudinary_not_configured") throw error;
    return uploadPhotosViaServer(compressedFiles, onProgress);
  }
}

async function uploadPhotosDirectToCloudinary(files, submissionKey, onProgress) {
  const results = new Array(files.length);
  let nextIndex = 0;
  let completed = 0;

  onProgress({ done: 0, total: files.length });

  async function worker() {
    while (nextIndex < files.length) {
      const fileIndex = nextIndex;
      nextIndex += 1;
      results[fileIndex] = await uploadSinglePhotoToCloudinary(
        files[fileIndex],
        submissionKey,
        fileIndex,
      );
      completed += 1;
      onProgress({ done: completed, total: files.length });
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(maxParallelUploads, files.length) },
      () => worker(),
    ),
  );

  return results;
}

async function uploadSinglePhotoToCloudinary(file, submissionKey, photoIndex) {
  const signResponse = await fetch("/api/cloudinary/sign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      idempotencyKey: submissionKey,
      photoIndex,
    }),
  });
  const signResult = await readJsonResponse(signResponse);

  if (signResponse.status === 503) {
    const error = new Error(signResult.message || "Cloudinary belum aktif.");
    error.code = "cloudinary_not_configured";
    throw error;
  }

  if (!signResponse.ok) {
    throw new Error(signResult.message || "Signature upload belum bisa dibuat.");
  }

  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadData.append("api_key", signResult.apiKey);
  uploadData.append("timestamp", signResult.timestamp);
  uploadData.append("signature", signResult.signature);
  uploadData.append("folder", signResult.folder);
  uploadData.append("public_id", signResult.publicId);
  uploadData.append("overwrite", "true");

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signResult.cloudName}/image/upload`,
    {
      method: "POST",
      body: uploadData,
    },
  );
  const uploadResult = await readJsonResponse(uploadResponse);

  if (!uploadResponse.ok) {
    throw new Error(
      uploadResult.error?.message ||
        uploadResult.message ||
        `${file.name} belum bisa diupload ke Cloudinary.`,
    );
  }

  return {
    bytes: uploadResult.bytes || file.size,
    fileName: file.name,
    filePath: uploadResult.public_id,
    fileUrl: uploadResult.secure_url,
    format: uploadResult.format,
    height: uploadResult.height,
    publicId: uploadResult.public_id,
    resourceType: uploadResult.resource_type || "image",
    size: uploadResult.bytes || file.size,
    width: uploadResult.width,
  };
}

async function uploadPhotosViaServer(files, onProgress) {
  const uploadData = new FormData();

  files.forEach((file) => {
    uploadData.append("fotoLokasi", file);
  });

  onProgress({ done: 0, total: files.length });

  const uploadResponse = await fetch("/api/uploads", {
    method: "POST",
    body: uploadData,
  });
  const uploadResult = await readJsonResponse(uploadResponse);

  if (!uploadResponse.ok) {
    throw new Error(uploadResult.message || "Foto lokasi belum bisa diupload.");
  }

  onProgress({ done: files.length, total: files.length });

  return (uploadResult.files || []).map((file) => ({
    ...file,
    publicId: file.filePath,
  }));
}

async function cleanupUploadedPhotos(uploadedPhotos) {
  const publicIds = uploadedPhotos
    .map((photo) => photo.publicId || photo.filePath)
    .filter(Boolean);

  if (publicIds.length === 0) return;

  try {
    await fetch("/api/cloudinary/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicIds }),
    });
  } catch {
    // Cleanup is best-effort; the form error remains the important signal.
  }
}

async function compressPhotoFile(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const image = await loadImageFile(file);
  const scale = Math.min(1, maxPhotoDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) return file;

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", photoCompressionQuality);
  });

  URL.revokeObjectURL(image.src);

  if (!blob || blob.size >= file.size) return file;

  return new File([blob], replaceFileExtension(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error(`${file.name} belum bisa diproses sebagai gambar.`));
    };
    image.src = URL.createObjectURL(file);
  });
}

function replaceFileExtension(fileName, extension) {
  return `${fileName.replace(/\.[^.]+$/, "")}.${extension}`;
}

function getTotalFileSize(files) {
  return files.reduce((total, file) => total + file.size, 0);
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1).replace(".0", "")} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function createSubmissionKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    if (response.status === 413) {
      return {
        message:
          "Ukuran foto terlalu besar. Maksimal 5 MB per file dan total 25 MB per sekali kirim.",
      };
    }

    return {
      message: "Server mengembalikan respons yang belum bisa dibaca.",
    };
  }
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

    setLocationMessage("");
    setMapState("searching");
    const timeoutId = window.setTimeout(() => {
      setLocationMessage("Pencarian lokasi terlalu lama. Coba kata kunci lain.");
      setMapState("ready");
    }, 12000);

    geocoderRef.current.geocode(
      {
        address: searchQuery,
        componentRestrictions: { country: "ID" },
        region: "id",
      },
      (results, status) => {
        window.clearTimeout(timeoutId);
        if (status !== "OK" || !results?.[0]?.geometry?.location) {
          setLocationMessage(
            "Lokasi tidak ditemukan. Coba nama tempat atau alamat yang lebih lengkap.",
          );
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
      },
    );
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
          const timeoutId = window.setTimeout(() => {
            setLocationMessage("Alamat dari lokasi Anda belum bisa dibaca.");
            setMapState("ready");
          }, 12000);

          geocoderRef.current.geocode(
            { location: latLng },
            (results, status) => {
              window.clearTimeout(timeoutId);
              if (status === "OK" && results?.[0]) {
                onLocationChange(buildLocationPayload(latLng, results[0]));
                setSearchQuery(results[0].formatted_address || "");
              } else {
                setLocationMessage(
                  "Titik lokasi didapat, tapi alamat lengkap belum ditemukan.",
                );
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
        if (window.google?.maps?.places) {
          resolve();
          return;
        }

        existingScript.addEventListener("load", resolve, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.dataset.googleMaps = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
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

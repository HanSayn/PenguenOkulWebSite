import AppShell from "@/components/layout/AppShell";

const items = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/ogretmenler", label: "Öğretmenler" },
  { href: "/admin/ogrenciler", label: "Öğrenciler" },
  { href: "/admin/dersler", label: "Dersler" },
  { href: "/admin/paketler", label: "Paketler" },
  { href: "/admin/odemeler", label: "Ödemeler" },
  { href: "/admin/destek", label: "Destek" },
  { href: "/admin/raporlar", label: "Raporlar" },
  { href: "/admin/icerik", label: "İçerik" },
  { href: "/admin/ayarlar", label: "Ayarlar" },
  { href: "/admin/guvenlik", label: "Güvenlik" },
  { href: "/admin/denetim", label: "Denetim kaydı" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell roleLabel="Yönetici" items={items}>
      {children}
    </AppShell>
  );
}
